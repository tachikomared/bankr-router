import http, { IncomingMessage, ServerResponse } from "node:http";
import {
  buildCatalogLoadError,
  loadBankrCatalogWithDiscovery,
  isConfigNotFoundError,
} from "./catalog.js";
import { routeBankrRequest } from "./router/selector.js";
import type { RoutingProfile, Tier } from "./router/types.js";
import { DEFAULT_BANKR_ROUTING_CONFIG } from "./router/config.js";
import {
  resolveOpenclawConfigPath,
  requireOpenclawConfigPath,
  OpenclawConfigNotFoundError,
} from "./config-path.js";
import {
  getConversationState,
  getSessionId,
  isFollowupPrompt,
  setConversationState,
} from "./context.js";
import { getHealthSummary, getStats, recordRequest } from "./stats.js";
import { recordSuccess, recordError } from "./reliability.js";

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const BANKR_UPSTREAM_BASE_URL = "https://llm.bankr.bot/v1";

type StartServerOptions = {
  host?: string;
  port?: number;
  openclawConfigPath?: string;
  bankrProviderId?: string;
  routerProviderId?: string;
};

type MessageContentPart = {
  text?: string;
  input_text?: string;
  type?: string;
};

const DEBUG_ENABLED = process.env.BANKR_ROUTER_DEBUG === "1";

function json(res: ServerResponse, status: number, obj: unknown, headers?: Record<string, string>) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) });
  res.end(JSON.stringify(obj, null, 2));
}

function debugLog(...args: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.error("[bankr-router]", ...args);
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function parseAuth(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== "string") return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function shouldRetry(status: number | null, retryOn: number[]): boolean {
  if (status == null) return true;
  return retryOn.includes(status);
}

function buildConfigNotFoundError(attemptedPaths: string[]) {
  return {
    error: "router_error" as const,
    message: "Could not locate OpenClaw config",
    details: {
      attemptedPaths,
      hint: "Set plugins.entries.bankr-router.config.openclawConfigPath or OPENCLAW_CONFIG_PATH",
    },
  };
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
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

function extractPromptText(messages: any[]): string {
  const userMessages = messages.filter((m) => m?.role === "user");
  const last = userMessages[userMessages.length - 1];
  if (!last) return "";

  if (typeof last.content === "string") return last.content;

  if (Array.isArray(last.content)) {
    return (last.content as MessageContentPart[])
      .map((p: MessageContentPart) => {
        if (typeof p?.text === "string") return p.text;
        if (typeof p?.input_text === "string") return p.input_text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractSystemPrompt(messages: any[]): string | undefined {
  const system = messages.filter((m) => m?.role === "system");

  const content = system
    .map((m) => {
      if (typeof m.content === "string") return m.content;

      if (Array.isArray(m.content)) {
        return (m.content as MessageContentPart[])
          .map((p: MessageContentPart) => {
            if (typeof p?.text === "string") return p.text;
            if (typeof p?.input_text === "string") return p.input_text;
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

function hasVision(messages: any[]): boolean {
  for (const m of messages) {
    if (!Array.isArray(m?.content)) continue;

    for (const part of m.content as MessageContentPart[]) {
      const t = String(part?.type || "").toLowerCase();
      if (t.includes("image")) return true;
    }
  }

  return false;
}

function hasTools(body: any): boolean {
  return Array.isArray(body?.tools) && body.tools.length > 0;
}

function isStructuredOutput(body: any): boolean {
  const formatType = body?.response_format?.type ?? body?.response_format;
  if (typeof formatType === "string") {
    const normalized = formatType.toLowerCase();
    if (normalized === "json" || normalized === "json_object" || normalized === "json_schema") {
      return true;
    }
  }

  const schema = body?.response_format?.schema ?? body?.response_format?.json_schema;
  if (schema) return true;

  const prompt = extractPromptText(body?.messages ?? []);
  const system = extractSystemPrompt(body?.messages ?? []);
  return (
    (system ?? "").toLowerCase().includes("json") ||
    (system ?? "").toLowerCase().includes("yaml") ||
    prompt.toLowerCase().includes("json") ||
    prompt.toLowerCase().includes("yaml")
  );
}

function normalizeRequestedModel(
  model: string | undefined,
  routerProviderId: string,
): { profile: RoutingProfile | null; explicitModel: string | null } {
  const raw = String(model || "auto");
  const last = raw.split("/").pop() || raw;

  if (last === "auto" || last === "eco" || last === "premium") {
    return { profile: last as RoutingProfile, explicitModel: null };
  }

  if (raw.startsWith(`${routerProviderId}/`)) {
    return { profile: "auto", explicitModel: null };
  }

  return { profile: null, explicitModel: raw };
}

function buildUpstreamHeaders(
  req: IncomingMessage,
  openclawBankrApiKey: string | undefined,
  explicitEnvKey: string | undefined,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const upstreamKey = explicitEnvKey || openclawBankrApiKey || undefined;

  if (upstreamKey && upstreamKey !== "local-router") {
    headers["x-api-key"] = upstreamKey;
  } else {
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

function resolveDiagnostics(options: StartServerOptions) {
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

export function startServer(options: StartServerOptions = {}) {
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
        return json(
          res,
          200,
          resolveDiagnostics({
            ...options,
            openclawConfigPath: configPath ?? undefined,
          }),
        );
      }

      if (
        req.method !== "POST" ||
        (url.pathname !== "/v1/chat/completions" && url.pathname !== "/v1/route")
      ) {
        return json(res, 404, { error: "not_found" });
      }

      const bodyBuffer = await readBody(req);
      const body = JSON.parse(bodyBuffer.toString("utf8"));
      const messages = Array.isArray(body?.messages) ? body.messages : [];

      const { selectedPath } = requireOpenclawConfigPath({
        explicitPath: configPath ?? null,
      });

      const loaded = loadBankrCatalogWithDiscovery({
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

      let inheritedTier: Tier | null = null;
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
        const existing = (server as any).__rateLimitStore ?? new Map<string, number>();
        const current = existing.get(key) ?? 0;
        if (current >= rateLimit) {
          return json(res, 429, { error: "rate_limited" });
        }
        existing.set(key, current + 1);
        (server as any).__rateLimitStore = existing;
      }

      let selectedModel = requested.explicitModel;
      let plannedModel: string | null = null;
      let routeDecision: any = null;

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
      }

      if (!selectedModel) {
        throw new Error("No model selected");
      }

      plannedModel = selectedModel;

      const headers: Record<string, string> = {
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
        return json(
          res,
          200,
          {
            requestedModel: body?.model ?? "auto",
            plannedModel,
            ...decisionPayload,
          },
          headers
        );
      }

      const headersUpstream = buildUpstreamHeaders(
        req,
        loaded.catalog.bankrProviderApiKey,
        process.env.BANKR_LLM_KEY,
      );

      const upstreamBody = { ...body, model: plannedModel };

      const retriesConfig = routerConfig?.retries ?? DEFAULT_BANKR_ROUTING_CONFIG.retries;
      const maxAttempts = retriesConfig?.enabled ? retriesConfig.maxAttempts : 1;
      const retryOnStatuses = retriesConfig?.retryOnStatuses ?? [];
      const upstreamTimeout = serverConfig?.upstreamTimeoutMs ?? 60000;

      const chain = routeDecision?.chain ?? [plannedModel];
      let attempt = 0;
      let lastResponse: Response | null = null;
      let responseText = "";
      let lastStatus: number | null = null;
      let finalModel: string | null = null;
      let upstreamModel: string | null = null;
      const attemptedModels: string[] = [];
      const attemptStatuses: Array<number | null> = [];

      const startAt = Date.now();

      while (attempt < maxAttempts && attempt < chain.length) {
        const modelToTry = chain[attempt] ?? plannedModel;
        attemptedModels.push(modelToTry);
        const attemptBody = { ...upstreamBody, model: modelToTry };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), upstreamTimeout);

        console.error(
          `[bankr-router] requested=${body?.model ?? "auto"} selected=${modelToTry} prompt=${prompt.slice(0, 120).replace(/\s+/g, " ")}`
        );

        try {
          lastResponse = await fetch(`${BANKR_UPSTREAM_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: headersUpstream,
            body: JSON.stringify(attemptBody),
            signal: controller.signal,
          });

          responseText = await lastResponse.text();
          lastStatus = lastResponse.status;
          attemptStatuses.push(lastStatus);

          if (lastStatus && lastStatus < 400) {
            finalModel = modelToTry;
            try {
              const parsed = JSON.parse(responseText);
              if (parsed?.model) {
                upstreamModel = String(parsed.model);
              }
            } catch (err) {
              // ignore parse errors
            }
          }
        } catch (err) {
          lastStatus = 0;
          attemptStatuses.push(0);
          responseText = "";
        } finally {
          clearTimeout(timeout);
        }

        if (!shouldRetry(lastStatus, retryOnStatuses)) {
          break;
        }

        console.error(`[bankr-router] retry=${attempt + 1} next=${chain[attempt + 1] ?? "none"}`);
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
      if (upstreamModel) {
        headers["x-router-upstream-model"] = upstreamModel;
      }

      // keep x-router-selected-model aligned with final model (legacy header)
      headers["x-router-selected-model"] = finalResolvedModel ?? "";

      res.writeHead(finalStatus, {
        "content-type":
          lastResponse?.headers.get("content-type") || "application/json; charset=utf-8",
        ...headers,
      });

      res.end(responseText || "");

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

      // Reliability: record each attempted model once
      attemptedModels.forEach((modelId, index) => {
        const status = attemptStatuses[index] ?? finalStatus;
        if (status != null && status < 400) {
          recordSuccess(modelId, latencyMs, toolsDetected, structuredOutput);
        } else {
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
    } catch (error) {
      if (isConfigNotFoundError(error) || error instanceof OpenclawConfigNotFoundError) {
        const attemptedPaths =
          error instanceof OpenclawConfigNotFoundError ? error.attemptedPaths : [];
        return json(res, 500, buildConfigNotFoundError(attemptedPaths));
      }

      const providerId = bankrProviderId;
      const resolvedPath = configPath ?? "(auto-discovery)";
      if (error instanceof Error) {
        const response = buildCatalogLoadError(error, providerId, resolvedPath);
        return json(res, 500, response);
      }

      const message = error instanceof Error ? error.message : String(error);
      json(res, 500, { error: "router_error", message });
    }
  });

  server.on("error", (err: any) => {
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
