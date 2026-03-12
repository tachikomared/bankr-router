import fs from "node:fs";
export function loadBankrCatalogFromOpenClaw(openclawPath = "/home/tachiboss/.openclaw/openclaw.json", providerId = "bankr") {
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
