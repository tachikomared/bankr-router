import fs from "node:fs";
import type { BankrModel } from "./router/types.js";
import {
  requireOpenclawConfigPath,
  OpenclawConfigNotFoundError,
} from "./config-path.js";

export type LoadedCatalog = {
  bankrProviderApiKey?: string;
  models: BankrModel[];
};

export type CatalogLoadErrorInfo = {
  error: "router_error";
  message: string;
  details: {
    providerId: string;
    openclawConfigPath: string;
  };
};

export type CatalogDiscoveryResult = {
  catalog: LoadedCatalog;
  openclawConfigPath: string;
  attemptedPaths: string[];
};

export function loadBankrCatalogFromOpenClaw(
  openclawPath: string,
  providerId = "bankr",
): LoadedCatalog {
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

type CatalogCacheEntry = {
  loadedAt: number;
  mtimeMs: number;
  result: CatalogDiscoveryResult;
};

const CATALOG_CACHE_TTL_MS = 5000;
const catalogCache = new Map<string, CatalogCacheEntry>();

function getCacheKey(openclawPath: string, providerId: string) {
  return `${openclawPath}::${providerId}`;
}

export function loadBankrCatalogCachedWithDiscovery(options: {
  openclawConfigPath?: string | null;
  providerId?: string;
  cwd?: string;
}): CatalogDiscoveryResult {
  const { selectedPath, attemptedPaths } = requireOpenclawConfigPath({
    explicitPath: options.openclawConfigPath ?? null,
    cwd: options.cwd,
  });
  const providerId = options.providerId ?? "bankr";
  const cacheKey = getCacheKey(selectedPath, providerId);

  let statMtime = 0;
  try {
    statMtime = fs.statSync(selectedPath).mtimeMs;
  } catch {
    statMtime = 0;
  }

  const existing = catalogCache.get(cacheKey);
  const now = Date.now();
  if (
    existing &&
    now - existing.loadedAt < CATALOG_CACHE_TTL_MS &&
    existing.mtimeMs === statMtime
  ) {
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

export function isConfigNotFoundError(err: unknown): err is OpenclawConfigNotFoundError {
  return err instanceof OpenclawConfigNotFoundError;
}

export function buildCatalogLoadError(
  err: unknown,
  providerId: string,
  openclawConfigPath: string,
): CatalogLoadErrorInfo {
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
