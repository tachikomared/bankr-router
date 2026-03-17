import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { startServer } from "./server.js";
function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
        });
        req.on("error", reject);
        if (body)
            req.write(body);
        req.end();
    });
}
describe("server", () => {
    it("should respond to /health", async () => {
        const server = startServer({
            host: "127.0.0.1",
            port: 0,
            bankrProviderId: "bankr",
            routerProviderId: "bankr-router"
        });
        const address = server.address();
        if (!address || typeof address === "string")
            throw new Error("Invalid address");
        const port = address.port;
        const response = await httpRequest({
            method: "GET",
            hostname: "127.0.0.1",
            port,
            path: "/health"
        });
        server.close();
        assert.strictEqual(response.status, 200);
        const payload = JSON.parse(response.body);
        assert.strictEqual(payload.ok, true);
        assert.ok(payload.name);
    });
    it("should respond to /v1/models", async () => {
        const server = startServer({
            host: "127.0.0.1",
            port: 0,
            bankrProviderId: "bankr",
            routerProviderId: "bankr-router"
        });
        const address = server.address();
        if (!address || typeof address === "string")
            throw new Error("Invalid address");
        const port = address.port;
        const response = await httpRequest({
            method: "GET",
            hostname: "127.0.0.1",
            port,
            path: "/v1/models"
        });
        server.close();
        assert.strictEqual(response.status, 200);
        const payload = JSON.parse(response.body);
        assert.ok(Array.isArray(payload.data));
        assert.ok(payload.data.some((m) => m.id === "auto"));
    });
    it("should respond to /v1/route with selected model", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bankr-router-test-"));
        const configPath = path.join(tempDir, "openclaw.json");
        const config = {
            models: {
                providers: {
                    bankr: {
                        apiKey: "local-router",
                        models: [
                            { id: "bankr/eco" },
                            { id: "bankr/premium" }
                        ]
                    }
                }
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(config));
        const server = startServer({
            host: "127.0.0.1",
            port: 0,
            openclawConfigPath: configPath,
            bankrProviderId: "bankr",
            routerProviderId: "bankr-router"
        });
        const address = server.address();
        if (!address || typeof address === "string")
            throw new Error("Invalid address");
        const port = address.port;
        const response = await httpRequest({
            method: "POST",
            hostname: "127.0.0.1",
            port,
            path: "/v1/route",
            headers: { "content-type": "application/json" }
        }, JSON.stringify({
            model: "bankr-router/auto",
            messages: [{ role: "user", content: "test" }]
        }));
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
        assert.strictEqual(response.status, 200);
        const payload = JSON.parse(response.body);
        assert.ok(payload.selectedModel);
    });
});
