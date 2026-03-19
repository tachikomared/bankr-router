import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { startServer } from "./server.js";
import { loadBankrCatalogCachedWithDiscovery } from "./catalog.js";

describe("server v0.8.0", () => {
  let server: http.Server;
  let port: number;
  const testConfigPath = "/tmp/test-openclaw-v08.json";
  const testLogDir = "/tmp/test-logs-v08";

  // Use model IDs that match DEFAULT_BANKR_ROUTING_CONFIG tiers
  const mockCatalog = [
    { id: "gpt-5-nano", name: "GPT-5 Nano", contextWindow: 128000, cost: { input: 0.1, output: 0.3 } },
    { id: "deepseek-v3.2", name: "DeepSeek V3.2", contextWindow: 128000, cost: { input: 0.2, output: 0.6 } },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 128000, cost: { input: 0.5, output: 1.5 } },
    { id: "gpt-5.2", name: "GPT-5.2", contextWindow: 128000, cost: { input: 1.0, output: 3.0 } },
  ];

  before(async () => {
    // Create test config
    fs.writeFileSync(
      testConfigPath,
      JSON.stringify({
        models: {
          providers: {
            bankr: {
              apiKey: "test-key",
              models: mockCatalog,
            },
          },
        },
      })
    );

    // Clean up log dir
    try {
      fs.rmSync(testLogDir, { recursive: true });
    } catch {}
    fs.mkdirSync(testLogDir, { recursive: true });

    process.env.BANKR_ROUTER_LOG_DIR = testLogDir;

    // Start server on random port and wait for it to be ready
    const srv = startServer({
      host: "127.0.0.1",
      port: 0,
      openclawConfigPath: testConfigPath,
      bankrProviderId: "bankr",
      routerProviderId: "bankr-router",
    });
    server = srv;

    // Wait for server to be listening
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server start timeout")), 5000);
      srv.on("listening", () => {
        clearTimeout(timeout);
        resolve();
      });
      srv.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    port = (server.address() as any).port;
  });

  after(() => {
    server.close();
    try {
      fs.unlinkSync(testConfigPath);
      fs.rmSync(testLogDir, { recursive: true });
    } catch {}
  });

  function request(path: string, body: any, headers?: Record<string, string>) {
    return new Promise<{ status: number; headers: Record<string, string>; body: string }>((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
            ...headers,
          },
        },
        (res) => {
          let chunks = "";
          res.on("data", (c) => (chunks += c));
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers as Record<string, string>,
              body: chunks,
            });
          });
        }
      );
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  }

  describe("/v1/route dry-run", () => {
    it("should return planned model without executing upstream", async () => {
      const res = await request("/v1/route", {
        model: "bankr-router/auto",
        messages: [{ role: "user", content: "Hello" }],
      });

      assert.strictEqual(res.status, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.plannedModel);
      assert.ok(json.tier);
      assert.ok(res.headers["x-router-planned-model"]);
      assert.strictEqual(res.headers["x-router-final-model"], undefined);
    });

    it("should not have upstream-model header in dry-run", async () => {
      const res = await request("/v1/route", {
        model: "bankr-router/auto",
        messages: [{ role: "user", content: "Test" }],
      });
      assert.strictEqual(res.headers["x-router-upstream-model"], undefined);
    });
  });
});
