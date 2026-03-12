import http, { IncomingMessage, ServerResponse } from "node:http";
import { loadBankrCatalogFromOpenClaw } from "./catalog.js";
import { routeBankrRequest } from "./router/selector.js";
import type { RoutingProfile } from "./router/types.js";

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

function json(res: ServerResponse, status: number, obj: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj, null, 2));
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

export function startServer(options: StartServerOptions = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const openclawConfigPath =
    options.openclawConfigPath ?? "/home/tachiboss/.openclaw/openclaw.json";
  const bankrProviderId = options.bankrProviderId ?? "bankr";
  const routerProviderId = options.routerProviderId ?? "bankr-router";

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

      if (
        req.method !== "POST" ||
        (url.pathname !== "/v1/chat/completions" && url.pathname !== "/v1/route")
      ) {
        return json(res, 404, { error: "not_found" });
      }

      const bodyBuffer = await readBody(req);
      const body = JSON.parse(bodyBuffer.toString("utf8"));
      const messages = Array.isArray(body?.messages) ? body.messages : [];

      const loaded = loadBankrCatalogFromOpenClaw(openclawConfigPath, bankrProviderId);
      const catalog = loaded.models;

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
        loaded.bankrProviderApiKey,
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