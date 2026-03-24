import http from "node:http";
import { buildCatalogLoadError, loadBankrCatalogCachedWithDiscovery, isConfigNotFoundError, } from "./catalog.js";
import { routeBankrRequest } from "./router/selector.js";
import { DEFAULT_BANKR_ROUTING_CONFIG } from "./router/config.js";
import { resolveOpenclawConfigPath, requireOpenclawConfigPath, OpenclawConfigNotFoundError, } from "./config-path.js";
import { getConversationState, getSessionId, isFollowupPrompt, setConversationState, } from "./context.js";
import { getHealthSummary, getStats, recordRequest } from "./stats.js";
import { recordSuccess, recordError } from "./reliability.js";
import { isDegradedResponse } from "./degraded.js";
import { checkBudget } from "./budget.js";
const activeBudgets = new Map();
import { hashPrompt, logRequest } from "./logging.js";
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const BANKR_UPSTREAM_BASE_URL = "https://llm.bankr.bot/v1";
const DEBUG_ENABLED = process.env.BANKR_ROUTER_DEBUG === "1";
function json(res, status, obj, headers) {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) });
    res.end(JSON.stringify(obj, null, 2));
}
function debugLog(...args) {
    if (!DEBUG_ENABLED)
        return;
    console.error("[bankr-router]", ...args);
}
function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
}
function parseAuth(req) {
    const auth = req.headers.authorization;
    if (!auth || typeof auth !== "string")
        return null;
    const [scheme, token] = auth.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token)
        return null;
    return token.trim();
}
function shouldRetry(status, retryOn) {
    if (status == null)
        return true;
    return retryOn.includes(status);
}
function buildConfigNotFoundError(attemptedPaths) {
    return {
        error: "router_error",
        message: "Could not locate OpenClaw config",
        details: {
            attemptedPaths,
            hint: "Set plugins.entries.bankr-router.config.openclawConfigPath or OPENCLAW_CONFIG_PATH",
        },
    };
}
async function readBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > MAX_BODY_BYTES) {
            throw new Error(`Request body too large: exceeds ${MAX_BODY_BYTES} bytes`);
        }
        chunks.push(buf);
    }
    return Buffer.concat(chunks);
}
function extractPromptText(messages) {
    const userMessages = messages.filter((m) => m?.role === "user");
    const last = userMessages[userMessages.length - 1];
    if (!last)
        return "";
    if (typeof last.content === "string")
        return last.content;
    if (Array.isArray(last.content)) {
        return last.content
            .map((p) => {
            if (typeof p?.text === "string")
                return p.text;
            if (typeof p?.input_text === "string")
                return p.input_text;
            return "";
        })
            .filter(Boolean)
            .join("\n");
    }
    return "";
}
function extractSystemPrompt(messages) {
    const system = messages.filter((m) => m?.role === "system");
    const content = system
        .map((m) => {
        if (typeof m.content === "string")
            return m.content;
        if (Array.isArray(m.content)) {
            return m.content
                .map((p) => {
                if (typeof p?.text === "string")
                    return p.text;
                if (typeof p?.input_text === "string")
                    return p.input_text;
                return "";
            })
                .filter(Boolean)
                .join("\n");
        }
        return "";
    })
        .filter(Boolean)
        .join("\n");
    return content || undefined;
}
function hasVision(messages) {
    for (const m of messages) {
        if (!Array.isArray(m?.content))
            continue;
        for (const part of m.content) {
            const t = String(part?.type || "").toLowerCase();
            if (t.includes("image"))
                return true;
        }
    }
    return false;
}
function hasTools(body) {
    return Array.isArray(body?.tools) && body.tools.length > 0;
}
function isStructuredOutput(body) {
    const formatType = body?.response_format?.type ?? body?.response_format;
    if (typeof formatType === "string") {
        const normalized = formatType.toLowerCase();
        if (normalized === "json" || normalized === "json_object" || normalized === "json_schema") {
            return true;
        }
    }
    const schema = body?.response_format?.schema ?? body?.response_format?.json_schema;
    if (schema)
        return true;
    const prompt = extractPromptText(body?.messages ?? []);
    const system = extractSystemPrompt(body?.messages ?? []);
    return ((system ?? "").toLowerCase().includes("json") ||
        (system ?? "").toLowerCase().includes("yaml") ||
        prompt.toLowerCase().includes("json") ||
        prompt.toLowerCase().includes("yaml"));
}
function normalizeRequestedModel(model, routerProviderId) {
    const raw = String(model || "auto");
    const last = raw.split("/").pop() || raw;
    if (last === "auto" || last === "eco" || last === "premium") {
        return { profile: last, explicitModel: null };
    }
    if (raw.startsWith(`${routerProviderId}/`)) {
        return { profile: "auto", explicitModel: null };
    }
    return { profile: null, explicitModel: raw };
}
function buildUpstreamHeaders(req, openclawBankrApiKey, explicitEnvKey) {
    const headers = {
        "content-type": "application/json",
    };
    const upstreamKey = explicitEnvKey || openclawBankrApiKey || undefined;
    if (upstreamKey && upstreamKey !== "local-router") {
        headers["x-api-key"] = upstreamKey;
    }
    else {
        const incomingKey = req.headers["x-api-key"];
        if (typeof incomingKey === "string" && incomingKey !== "local-router") {
            headers["x-api-key"] = incomingKey;
        }
        const auth = req.headers.authorization;
        if (!headers["x-api-key"] && typeof auth === "string" && auth.trim()) {
            headers.authorization = auth;
        }
    }
    return headers;
}
function resolveDiagnostics(options) {
    const resolved = resolveOpenclawConfigPath({
        explicitPath: options.openclawConfigPath ?? null,
    });
    return {
        selectedPath: resolved.selectedPath,
        attemptedPaths: resolved.attemptedPaths,
        bankrProviderId: options.bankrProviderId ?? "bankr",
        routerProviderId: options.routerProviderId ?? "bankr-router",
    };
}
export function startServer(options = {}) {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 8787;
    const bankrProviderId = options.bankrProviderId ?? "bankr";
    const routerProviderId = options.routerProviderId ?? "bankr-router";
    const configPath = options.openclawConfigPath ?? null;
    if (DEBUG_ENABLED) {
        const diag = resolveDiagnostics({
            ...options,
            openclawConfigPath: configPath ?? undefined,
        });
        debugLog("Config discovery", diag);
    }
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
            if (req.method === "GET" && url.pathname === "/health") {
                return json(res, 200, {
                    ok: true,
                    name: "bankr-router",
                    upstream: BANKR_UPSTREAM_BASE_URL,
                    ...getHealthSummary(),
                });
            }
            if (req.method === "GET" && url.pathname === "/v1/stats") {
                return json(res, 200, getStats());
            }
            if (req.method === "GET" && url.pathname === "/v1/models") {
                return json(res, 200, {
                    object: "list",
                    data: [
                        { id: "auto", object: "model", owned_by: "bankr-router" },
                        { id: "eco", object: "model", owned_by: "bankr-router" },
                        { id: "premium", object: "model", owned_by: "bankr-router" },
                    ],
                });
            }
            if (req.method === "GET" && url.pathname === "/v1/diagnostics") {
                return json(res, 200, resolveDiagnostics({
                    ...options,
                    openclawConfigPath: configPath ?? undefined,
                }));
            }
            if (req.method !== "POST" ||
                (url.pathname !== "/v1/chat/completions" && url.pathname !== "/v1/route")) {
                return json(res, 404, { error: "not_found" });
            }
            const bodyBuffer = await readBody(req);
            const body = JSON.parse(bodyBuffer.toString("utf8"));
            const messages = Array.isArray(body?.messages) ? body.messages : [];
            const { selectedPath } = requireOpenclawConfigPath({
                explicitPath: configPath ?? null,
            });
            const loaded = loadBankrCatalogCachedWithDiscovery({
                openclawConfigPath: selectedPath,
                providerId: bankrProviderId,
            });
            const catalog = loaded.catalog.models;
            const routerConfig = DEFAULT_BANKR_ROUTING_CONFIG;
            const requested = normalizeRequestedModel(body?.model, routerProviderId);
            const prompt = extractPromptText(messages);
            const systemPrompt = extractSystemPrompt(messages);
            const sessionId = getSessionId(req, body);
            const followupConfig = routerConfig.followup;
            const promptIsFollowup = followupConfig
                ? isFollowupPrompt(prompt, followupConfig.shortPromptMaxChars)
                : false;
            let inheritedTier = null;
            let inheritedConfidence = 0;
            if (promptIsFollowup && followupConfig?.enabled) {
                const previous = getConversationState(sessionId);
                if (previous && Date.now() - previous.lastUpdatedAt <= followupConfig.maxAgeMs) {
                    inheritedTier = previous.lastTier;
                    inheritedConfidence = previous.lastConfidence;
                }
            }
            const serverConfig = routerConfig?.server ?? DEFAULT_BANKR_ROUTING_CONFIG.server;
            if (serverConfig?.authToken) {
                const token = parseAuth(req);
                if (!token || token !== serverConfig.authToken) {
                    return json(res, 401, { error: "unauthorized" });
                }
            }
            const rateLimit = serverConfig?.rateLimitPerMinute ?? 0;
            if (rateLimit > 0) {
                const bucket = Math.floor(Date.now() / 60000);
                const ip = getClientIp(req);
                const key = `${ip}:${bucket}`;
                const existing = server.__rateLimitStore ?? new Map();
                const current = existing.get(key) ?? 0;
                if (current >= rateLimit) {
                    return json(res, 429, { error: "rate_limited" });
                }
                existing.set(key, current + 1);
                server.__rateLimitStore = existing;
            }
            let selectedModel = requested.explicitModel;
            let plannedModel = null;
            let routeDecision = null;
            let executionChain = [];
            const toolsDetected = hasTools(body);
            const structuredOutput = isStructuredOutput(body);
            if (selectedModel && !catalog.find((m) => m.id === selectedModel)) {
                throw new Error(`Requested model not found in BANKR catalog: ${selectedModel}`);
            }
            if (!selectedModel) {
                routeDecision = routeBankrRequest({
                    prompt,
                    systemPrompt,
                    maxOutputTokens: body?.max_tokens ?? body?.max_completion_tokens ?? 1024,
                    profile: requested.profile ?? "auto",
                    hasVision: hasVision(messages),
                    hasTools: toolsDetected,
                    catalog,
                    config: routerConfig ?? DEFAULT_BANKR_ROUTING_CONFIG,
                    inheritedTier,
                    inheritedConfidence,
                    structuredOutput,
                });
                selectedModel = routeDecision.model;
                executionChain = Array.isArray(routeDecision?.ranked)
                    ? routeDecision.ranked.map((candidate) => candidate.id).filter(Boolean)
                    : [];
            }
            if (!selectedModel) {
                throw new Error("No model selected");
            }
            if (!executionChain.length) {
                executionChain = [selectedModel];
            }
            plannedModel = executionChain[0] ?? selectedModel;
            const headers = {
                "x-router-planned-model": plannedModel,
                "x-router-selected-model": plannedModel,
                "x-router-tier": routeDecision?.tier ?? "",
                "x-router-confidence": String(routeDecision?.confidence ?? ""),
            };
            if (routeDecision?.inheritedFromTier) {
                headers["x-router-inherited-tier"] = String(routeDecision.inheritedFromTier);
            }
            if (url.pathname === "/v1/route") {
                const { model: _plannedFromDecision, ...decisionPayload } = routeDecision ?? {};
                return json(res, 200, {
                    requestedModel: body?.model ?? "auto",
                    plannedModel,
                    ...decisionPayload,
                }, headers);
            }
            const headersUpstream = buildUpstreamHeaders(req, loaded.catalog.bankrProviderApiKey, process.env.BANKR_LLM_KEY);
            const upstreamBody = { ...body, model: plannedModel };
            const retriesConfig = routerConfig?.retries ?? DEFAULT_BANKR_ROUTING_CONFIG.retries;
            const maxAttempts = retriesConfig?.enabled ? retriesConfig.maxAttempts : 1;
            const retryOnStatuses = retriesConfig?.retryOnStatuses ?? [];
            const upstreamTimeout = serverConfig?.upstreamTimeoutMs ?? 60000;
            const chain = executionChain.length ? executionChain : (routeDecision?.chain ?? [plannedModel]);
            let attempt = 0;
            let lastResponse = null;
            let responseText = "";
            let lastStatus = null;
            let finalModel = null;
            let upstreamModel = null;
            const attemptedModels = [];
            const attemptStatuses = [];
            let abortSource = null;
            let abortedByClient = false;
            const startAt = Date.now();
            req.on("aborted", () => {
                abortedByClient = true;
                abortSource = abortSource ?? "client_disconnected";
            });
            while (attempt < maxAttempts && attempt < chain.length) {
                const modelToTry = chain[attempt] ?? plannedModel;
                attemptedModels.push(modelToTry);
                const sessionId = `${(req.headers["x-session-id"]) || "default"}`;
                let sessionBudget = activeBudgets.get(sessionId) || { spentUsd: 0, inputTokens: 0, outputTokens: 0, downgradeHappened: false };
                // Let's assume a generic config for now (could be parsed from headers)
                const isStrictMock = (req.headers["x-mock-budget-reject"]) === "true";
                const budgetConfig = {
                    budgetMode: isStrictMock ? 'strict' : 'graceful',
                    maxCostPerRunUsd: isStrictMock ? -1 : 10
                };
                const budgetStatus = checkBudget(budgetConfig, sessionBudget);
                let actualModelToTry = modelToTry;
                if (budgetStatus === 'reject') {
                    return new Response(JSON.stringify({ error: "budget_exceeded" }), { status: 402 });
                }
                else if (budgetStatus === 'downgrade') {
                    sessionBudget.downgradeHappened = true;
                    if (actualModelToTry === 'bankr-router/premium') {
                        actualModelToTry = 'bankr-router/eco';
                    }
                }
                const attemptBody = { ...upstreamBody, model: actualModelToTry };
                const controller = new AbortController();
                const timeout = setTimeout(() => {
                    abortSource = abortSource ?? "request_timeout";
                    controller.abort();
                }, upstreamTimeout);
                try {
                    lastResponse = await fetch(`${BANKR_UPSTREAM_BASE_URL}/chat/completions`, {
                        method: "POST",
                        headers: headersUpstream,
                        body: JSON.stringify(attemptBody),
                        signal: controller.signal,
                    });
                    lastStatus = lastResponse.status;
                    attemptStatuses.push(lastStatus);
                    if (lastStatus && lastStatus < 400) {
                        finalModel = modelToTry;
                    }
                    if (body?.stream) {
                        if (lastStatus && lastStatus < 400) {
                            break;
                        }
                    }
                    else {
                        responseText = await lastResponse.text();
                        if (lastStatus === 200 && isDegradedResponse(responseText, body?.response_format?.type === "json_object" || body?.response_format?.type === "json_schema")) {
                            lastStatus = 500; // treat as server error so it triggers retry
                        }
                        if (lastStatus && lastStatus < 400) {
                            try {
                                const parsed = JSON.parse(responseText);
                                if (parsed?.model) {
                                    upstreamModel = String(parsed.model);
                                }
                            }
                            catch {
                                // ignore parse errors
                            }
                            break;
                        }
                    }
                }
                catch (err) {
                    if (err?.name === "AbortError") {
                        abortSource = abortSource ?? "upstream_fetch_aborted";
                    }
                    lastStatus = 0;
                    attemptStatuses.push(0);
                    responseText = "";
                }
                finally {
                    clearTimeout(timeout);
                }
                if (!shouldRetry(lastStatus, retryOnStatuses)) {
                    break;
                }
                attempt += 1;
            }
            const latencyMs = Date.now() - startAt;
            const finalStatus = lastStatus ?? 502;
            const retried = Math.max(0, attempt);
            if (retried > 0) {
                headers["x-router-retries"] = String(retried);
            }
            const attemptsHeader = attemptedModels.length ? attemptedModels.join(",") : plannedModel;
            const finalResolvedModel = finalModel ?? attemptedModels[attemptedModels.length - 1] ?? plannedModel;
            headers["x-router-final-model"] = finalResolvedModel ?? "";
            headers["x-router-attempts"] = String(attemptedModels.length || 1);
            headers["x-router-attempted-models"] = attemptsHeader ?? "";
            if (!body?.stream && responseText) {
                try {
                    const parsed = JSON.parse(responseText);
                    if (parsed?.model) {
                        upstreamModel = String(parsed.model);
                    }
                }
                catch {
                    // ignore parse errors
                }
            }
            if (upstreamModel) {
                headers["x-router-upstream-model"] = upstreamModel;
            }
            // keep x-router-selected-model aligned with final model (legacy header)
            headers["x-router-selected-model"] = finalResolvedModel ?? "";
            res.writeHead(finalStatus, {
                "content-type": lastResponse?.headers.get("content-type") || "application/json; charset=utf-8",
                ...headers,
            });
            if (body?.stream) {
                if (lastResponse?.body) {
                    lastResponse.body.pipeTo(new WritableStream({
                        write(chunk) {
                            res.write(chunk);
                        },
                        close() {
                            res.end();
                        },
                        abort() {
                            abortSource = abortSource ?? "stream_cancelled";
                            res.end();
                        },
                    }));
                }
                else {
                    res.end();
                }
            }
            else {
                res.end(responseText || "");
            }
            recordRequest({
                ts: Date.now(),
                selectedModel: finalResolvedModel ?? plannedModel,
                plannedModel: plannedModel ?? undefined,
                finalModel: finalResolvedModel ?? undefined,
                upstreamModel: upstreamModel ?? undefined,
                tier: routeDecision?.tier ?? null,
                confidence: routeDecision?.confidence ?? 0,
                latencyMs,
                status: finalStatus,
                retried,
                inherited: Boolean(routeDecision?.inherited),
                toolsDetected,
                structuredOutput,
                codeHeavy: routeDecision?.codeHeavy ?? false,
                success: finalStatus < 400,
                statusCode: finalStatus,
            });
            let severity = "info";
            if (finalStatus >= 200 && finalStatus < 300) {
                severity = "info";
            }
            else if (finalStatus >= 400 && finalStatus < 500) {
                severity = shouldRetry(finalStatus, retryOnStatuses) ? "warn" : "error";
            }
            else if (finalStatus >= 500) {
                severity = "error";
            }
            if (abortedByClient && finalStatus < 400) {
                severity = "warn";
            }
            logRequest({
                ts: new Date().toISOString(),
                plannedModel: plannedModel ?? undefined,
                finalModel: finalResolvedModel ?? undefined,
                upstreamModel: upstreamModel ?? undefined,
                tier: routeDecision?.tier ?? null,
                confidence: routeDecision?.confidence ?? null,
                retryCount: retried,
                statusCode: finalStatus,
                latencyMs,
                toolsDetected,
                structuredOutput,
                codeHeavy: routeDecision?.codeHeavy ?? false,
                promptHash: hashPrompt(prompt),
                abortSource,
            }, severity);
            // Reliability: record each attempted model once
            attemptedModels.forEach((modelId, index) => {
                const status = attemptStatuses[index] ?? finalStatus;
                if (status != null && status < 400) {
                    recordSuccess(modelId, latencyMs, toolsDetected, structuredOutput);
                }
                else {
                    recordError(modelId, status ?? 502);
                }
            });
            if (routeDecision?.tier) {
                setConversationState(sessionId, {
                    lastTier: routeDecision.tier,
                    lastConfidence: routeDecision.confidence ?? 0,
                    lastSelectedModel: selectedModel,
                    lastUpdatedAt: Date.now(),
                });
            }
        }
        catch (error) {
            let abortSource = null;
            if (error && typeof error === "object") {
                const errName = error.name;
                if (errName === "AbortError") {
                    abortSource = "openclaw_cancellation";
                }
            }
            if (isConfigNotFoundError(error) || error instanceof OpenclawConfigNotFoundError) {
                const attemptedPaths = error instanceof OpenclawConfigNotFoundError ? error.attemptedPaths : [];
                logRequest({
                    ts: new Date().toISOString(),
                    statusCode: 500,
                    abortSource,
                }, "error");
                return json(res, 500, buildConfigNotFoundError(attemptedPaths));
            }
            const providerId = bankrProviderId;
            const resolvedPath = configPath ?? "(auto-discovery)";
            if (error instanceof Error) {
                const response = buildCatalogLoadError(error, providerId, resolvedPath);
                logRequest({
                    ts: new Date().toISOString(),
                    statusCode: 500,
                    abortSource,
                }, "error");
                return json(res, 500, response);
            }
            const message = error instanceof Error ? error.message : String(error);
            logRequest({
                ts: new Date().toISOString(),
                statusCode: 500,
                abortSource,
            }, "error");
            json(res, 500, { error: "router_error", message });
        }
    });
    server.on("error", (err) => {
        if (err?.code === "EADDRINUSE") {
            console.error(`Bankr Router port ${port} already in use`);
            return;
        }
        console.error(err);
    });
    server.listen(port, host, () => {
        console.error(`Bankr Router listening on http://${host}:${port}`);
    });
    return server;
}
