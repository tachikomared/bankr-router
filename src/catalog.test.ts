import { describe, it } from "node:test";
import assert from "node:assert";
import { buildCatalogLoadError } from "./catalog.js";

describe("catalog", () => {
  it("should build a catalog load error with provider and path", () => {
    const err = new Error("Provider not found");
    const result = buildCatalogLoadError(err, "bankr", "/tmp/openclaw.json");

    assert.strictEqual(result.error, "router_error");
    assert.ok(result.message.includes("Provider not found"));
    assert.strictEqual(result.details.providerId, "bankr");
    assert.strictEqual(result.details.openclawConfigPath, "/tmp/openclaw.json");
  });
});
