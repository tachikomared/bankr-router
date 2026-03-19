import fs from "node:fs";
import { requireOpenclawConfigPath, OpenclawConfigNotFoundError, } from "./config-path.js";
export function loadBankrCatalogFromOpenClaw(openclawPath, providerId = "bankr") {
    const raw = JSON.parse(fs.readFileSync(openclawPath, "utf8"));
    const provider = raw?.models?.providers?.[providerId];
    const models = provider?.models;
    if (!provider || typeof provider !== "object") {
        throw new Error(`Provider '${providerId}' not found in ${openclawPath}`);
    }
    if (!Array.isArray(models) || models.length === 0) {
        throw new Error(`No models.providers.${providerId}.models found in ${openclawPath}`);
    }
    for (const model of models) {
        if (!model || typeof model.id !== "string") {
            throw new Error(`Invalid model entry in providers.${providerId}.models`);
        }
    }
    return {
        bankrProviderApiKey: typeof provider.apiKey === "string" ? provider.apiKey : undefined,
        models,
    };
}
const CATALOG_CACHE_TTL_MS = 5000;
const catalogCache = new Map();
function getCacheKey(openclawPath, providerId) {
    return `${openclawPath}::${providerId}`;
}
export function loadBankrCatalogCachedWithDiscovery(options) {
    const { selectedPath, attemptedPaths } = requireOpenclawConfigPath({
        explicitPath: options.openclawConfigPath ?? null,
        cwd: options.cwd,
    });
    const providerId = options.providerId ?? "bankr";
    const cacheKey = getCacheKey(selectedPath, providerId);
    let statMtime = 0;
    try {
        statMtime = fs.statSync(selectedPath).mtimeMs;
    }
    catch {
        statMtime = 0;
    }
    const existing = catalogCache.get(cacheKey);
    const now = Date.now();
    if (existing &&
        now - existing.loadedAt < CATALOG_CACHE_TTL_MS &&
        existing.mtimeMs === statMtime) {
        return existing.result;
    }
    const result = {
        catalog: loadBankrCatalogFromOpenClaw(selectedPath, providerId),
        openclawConfigPath: selectedPath,
        attemptedPaths,
    };
    catalogCache.set(cacheKey, {
        loadedAt: now,
        mtimeMs: statMtime,
        result,
    });
    return result;
}
export function isConfigNotFoundError(err) {
    return err instanceof OpenclawConfigNotFoundError;
}
export function buildCatalogLoadError(err, providerId, openclawConfigPath) {
    const message = err instanceof Error ? err.message : String(err);
    return {
        error: "router_error",
        message: `Failed to load Bankr provider catalog: ${message}`,
        details: {
            providerId,
            openclawConfigPath,
        },
    };
}
