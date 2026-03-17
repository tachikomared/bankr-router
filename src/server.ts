import http, { IncomingMessage, ServerResponse } from "node:http";
import {
  buildCatalogLoadError,
  loadBankrCatalogWithDiscovery,
  isConfigNotFoundError,
} from "./catalog.js";
import { routeBankrRequest } from "./router/selector.js";
import type { RoutingProfile } from "./router/types.js";
import {
  resolveOpenclawConfigPath,
  requireOpenclawConfigPath,
  OpenclawConfigNotFoundError,
} from "./config-path.js";

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

function json(res: ServerResponse, status: number, obj: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj, null, 2));
}

function debugLog(...args: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.error("[bankr-router]", ...args);
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
        });
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

      const requested = normalizeRequestedModel(body?.model, routerProviderId);
      const prompt = extractPromptText(messages);
      const systemPrompt = extractSystemPrompt(messages);

      let selectedModel = requested.explicitModel;
      let routeDecision: any = null;

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
          hasTools: hasTools(body),
          catalog,
        });

        selectedModel = routeDecision.model;
      }

      if (!selectedModel) {
        throw new Error("No model selected");
      }

      if (url.pathname === "/v1/route") {
        return json(res, 200, {
          requestedModel: body?.model ?? "auto",
          selectedModel,
          ...(routeDecision ?? {}),
        });
      }

      const headers = buildUpstreamHeaders(
        req,
        loaded.catalog.bankrProviderApiKey,
        process.env.BANKR_LLM_KEY,
      );

      const upstreamBody = { ...body, model: selectedModel };

      const upstreamRes = await fetch(`${BANKR_UPSTREAM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
      });

      const responseText = await upstreamRes.text();

      res.writeHead(upstreamRes.status, {
        "content-type":
          upstreamRes.headers.get("content-type") || "application/json; charset=utf-8",
        "x-router-selected-model": selectedModel,
      });

      res.end(responseText);
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
