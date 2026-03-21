import { DEFAULT_BANKR_ROUTING_CONFIG } from "./config.js";
import { classifyByRules } from "../router/rules.js";
function minTier(a, b) {
    const order = ["SIMPLE", "MEDIUM", "COMPLEX", "REASONING"];
    return order[Math.max(order.indexOf(a), order.indexOf(b))];
}
function estimateInputTokens(systemPrompt, prompt) {
    return Math.ceil(`${systemPrompt ?? ""} ${prompt}`.length / 4);
}
function chooseTierConfigSet(config, profile, agenticScore) {
    if (profile === "eco" && config.ecoTiers)
        return config.ecoTiers;
    if (profile === "premium" && config.premiumTiers)
        return config.premiumTiers;
    if (profile === "auto" &&
        config.overrides.enableAgenticAuto &&
        agenticScore >= 0.6 &&
        config.agenticTiers) {
        return config.agenticTiers;
    }
    return config.tiers;
}
function getFallbackChain(tier, tierConfigs) {
    const cfg = tierConfigs[tier];
    return [cfg.primary, ...cfg.fallback];
}
function filterExisting(ids, catalog) {
    const filtered = ids.filter((id) => catalog.has(id));
    if (!filtered.length) {
        throw new Error("No configured tier models exist in current BANKR catalog");
    }
    return filtered;
}
function filterByVision(ids, hasVision, catalog) {
    if (!hasVision)
        return ids;
    const filtered = ids.filter((id) => {
        const model = catalog.get(id);
        return (model?.input ?? ["text"]).includes("image");
    });
    if (!filtered.length) {
        throw new Error("No eligible vision-capable models in selected tier chain");
    }
    return filtered;
}
function filterByTools(ids, hasTools, catalog) {
    if (!hasTools)
        return ids;
    const filtered = ids.filter((id) => {
        const model = catalog.get(id);
        if (!model)
            return false;
        if (model.supportsTools === false)
            return false;
        return true;
    });
    if (!filtered.length) {
        throw new Error("No eligible tool-capable models in selected tier chain");
    }
    return filtered;
}
function filterByContext(ids, estimatedTotalTokens, catalog) {
    const filtered = ids.filter((id) => {
        const cw = catalog.get(id)?.contextWindow;
        if (cw == null)
            return true;
        return cw >= estimatedTotalTokens * 1.1;
    });
    if (!filtered.length) {
        throw new Error(`No eligible models fit required context window: ${estimatedTotalTokens} tokens`);
    }
    return filtered;
}
function estimateModelCost(model, estimatedInputTokens, maxOutputTokens) {
    const inputPrice = model.cost?.input ?? Number.POSITIVE_INFINITY;
    const outputPrice = model.cost?.output ?? Number.POSITIVE_INFINITY;
    return ((estimatedInputTokens / 1_000_000) * inputPrice +
        (maxOutputTokens / 1_000_000) * outputPrice);
}
function looksCodeHeavy(prompt, systemPrompt) {
    const text = `${systemPrompt ?? ""}\n${prompt}`.toLowerCase();
    const codeSignals = [
        "```",
        "function",
        "class",
        "typescript",
        "javascript",
        "python",
        "rust",
        "sql",
        "regex",
        "debug",
        "bug",
        "stack trace",
        "refactor",
        "unit test",
        "dockerfile",
        "yaml",
        "json schema",
        "endpoint",
        "middleware",
        "proxy",
        "функция",
        "отладка",
        "ошибка",
        "рефакторинг",
        "函数",
        "调试",
        "错误",
        "関数",
        "デバッグ"
    ];
    let count = 0;
    for (const s of codeSignals) {
        if (text.includes(s))
            count++;
        if (count >= 2)
            return true;
    }
    return false;
}
function codeAffinityBonus(modelId, codeHeavy) {
    if (!codeHeavy)
        return 0;
    const id = modelId.toLowerCase();
    if (id.includes("codex"))
        return -0.35;
    if (id.includes("coder"))
        return -0.30;
    if (id.includes("sonnet-4.6"))
        return -0.08;
    if (id.includes("gpt-5.2"))
        return -0.04;
    return 0;
}
function rerankByPriority(ranked, priorityList) {
    const priorityModels = priorityList
        .map((id) => ranked.find((c) => c.id === id))
        .filter((x) => !!x);
    if (!priorityModels.length)
        return ranked;
    const remainder = ranked.filter((candidate) => !priorityModels.includes(candidate));
    priorityModels.sort((a, b) => (a.estimatedCost ?? Infinity) - (b.estimatedCost ?? Infinity));
    return [...priorityModels, ...remainder];
}
function rerankForCodeHeavy(ranked, profile) {
    const CODE_HEAVY_PRIORITY_AUTO = [
        "qwen3-coder",
        "deepseek-v3.2",
        "gpt-5.4-mini",
        "claude-sonnet-4.6",
        "gpt-5.2-codex",
    ];
    const CODE_HEAVY_PRIORITY_ECO = [
        "qwen3-coder",
        "deepseek-v3.2",
        "gemini-3.1-flash-lite",
        "qwen3.5-plus",
        "gpt-5-mini",
    ];
    const CODE_HEAVY_PRIORITY_PREMIUM = [
        "gpt-5.4",
        "claude-sonnet-4.6",
        "gpt-5.2-codex",
        "claude-opus-4.6",
        "gemini-3.1-pro",
    ];
    const priorityList = profile === "eco"
        ? CODE_HEAVY_PRIORITY_ECO
        : profile === "premium"
            ? CODE_HEAVY_PRIORITY_PREMIUM
            : CODE_HEAVY_PRIORITY_AUTO;
    return rerankByPriority(ranked, priorityList);
}
function rerankForToolAndStructured(ranked, profile, tools, structured) {
    if (!tools && !structured)
        return ranked;
    const TOOL_STRUCTURED_PRIORITY_AUTO = [
        "gpt-5.4-mini",
        "claude-sonnet-4.6",
        "gemini-3.1-pro",
        "deepseek-v3.2",
        "gemini-3.1-flash-lite",
    ];
    const TOOL_STRUCTURED_PRIORITY_ECO = [
        "deepseek-v3.2",
        "gemini-3.1-flash-lite",
        "gpt-5-mini",
        "qwen3.5-plus",
        "grok-4.1-fast",
    ];
    const TOOL_STRUCTURED_PRIORITY_PREMIUM = [
        "claude-sonnet-4.6",
        "gpt-5.4",
        "claude-opus-4.6",
        "gemini-3.1-pro",
        "gpt-5.2",
    ];
    const priorityList = profile === "eco"
        ? TOOL_STRUCTURED_PRIORITY_ECO
        : profile === "premium"
            ? TOOL_STRUCTURED_PRIORITY_PREMIUM
            : TOOL_STRUCTURED_PRIORITY_AUTO;
    return rerankByPriority(ranked, priorityList);
}
function pickCheapestInChain(chain, catalog, estimatedInputTokens, maxOutputTokens, prompt, systemPrompt, profile, tier) {
    const codeHeavy = looksCodeHeavy(prompt, systemPrompt);
    const ranked = chain
        .map((id, index) => {
        const model = catalog.get(id);
        if (!model)
            return null;
        const rawCost = estimateModelCost(model, estimatedInputTokens, maxOutputTokens);
        const estimatedCost = Number.isFinite(rawCost) ? Math.max(0, rawCost) : Number.POSITIVE_INFINITY;
        const rankingScore = rawCost + codeAffinityBonus(id, codeHeavy);
        const tierBias = index === 0 ? -0.5 : index * 0.01;
        const profileBias = profile === "auto" ? -0.1 : 0;
        const tierPreference = tier === "SIMPLE"
            ? ["gpt-5.4-mini"]
            : tier === "MEDIUM"
                ? ["deepseek-v3.2"]
                : tier === "COMPLEX"
                    ? ["gemini-3.1-pro"]
                    : tier === "REASONING"
                        ? ["gpt-5.4"]
                        : [];
        const preferredBoost = tierPreference.includes(id) ? -1 : 0;
        return {
            id,
            estimatedCost,
            rankingScore: rankingScore + tierBias + profileBias + preferredBoost
        };
    })
        .filter((x) => !!x && Number.isFinite(x.rankingScore ?? Number.POSITIVE_INFINITY));
    ranked.sort((a, b) => (a.rankingScore ?? a.estimatedCost) - (b.rankingScore ?? b.estimatedCost));
    return ranked;
}
export function routeBankrRequest(args) {
    const { prompt, systemPrompt, maxOutputTokens, profile = "auto", hasVision = false, hasTools = false, catalog, config = DEFAULT_BANKR_ROUTING_CONFIG, inheritedTier = null, inheritedConfidence = 0, structuredOutput = false } = args;
    const catalogMap = new Map(catalog.map((m) => [m.id, m]));
    const estimatedInputTokens = estimateInputTokens(systemPrompt, prompt);
    const estimatedTotalTokens = estimatedInputTokens + maxOutputTokens;
    let tier;
    let confidence = 0.99;
    let agenticScore = 0;
    let signals = [];
    let inherited = false;
    if (estimatedTotalTokens > config.overrides.maxTokensForceComplex) {
        tier = "COMPLEX";
    }
    else {
        const ruleResult = classifyByRules(prompt, systemPrompt, estimatedInputTokens, config.scoring);
        tier = ruleResult.tier ?? config.overrides.ambiguousDefaultTier;
        confidence = ruleResult.confidence;
        agenticScore = ruleResult.agenticScore;
        signals = ruleResult.signals;
        const structuredDetected = structuredOutput ||
            (systemPrompt ?? "").toLowerCase().includes("json") ||
            (systemPrompt ?? "").toLowerCase().includes("yaml") ||
            prompt.toLowerCase().includes("json") ||
            prompt.toLowerCase().includes("yaml");
        if (structuredDetected) {
            tier = minTier(tier, config.overrides.structuredOutputMinTier);
        }
        const followupConfig = config.followup;
        if (!structuredDetected && followupConfig?.enabled && inheritedTier && inheritedConfidence >= followupConfig.inheritConfidenceFloor) {
            tier = inheritedTier;
            confidence = Math.max(confidence, inheritedConfidence);
            inherited = true;
        }
    }
    const tierConfigs = chooseTierConfigSet(config, profile, agenticScore);
    let chain = getFallbackChain(tier, tierConfigs);
    chain = filterExisting(chain, catalogMap);
    chain = filterByTools(chain, hasTools, catalogMap);
    chain = filterByVision(chain, hasVision, catalogMap);
    chain = filterByContext(chain, estimatedTotalTokens, catalogMap);
    const ranked = pickCheapestInChain(chain, catalogMap, estimatedInputTokens, maxOutputTokens, prompt, systemPrompt, profile, tier);
    const codeHeavy = looksCodeHeavy(prompt, systemPrompt);
    let reranked = ranked;
    reranked = rerankForCodeHeavy(reranked, profile);
    const isStructured = structuredOutput || (systemPrompt ?? "").toLowerCase().includes("json") || prompt.toLowerCase().includes("json") || prompt.toLowerCase().includes("yaml");
    reranked = rerankForToolAndStructured(reranked, profile, hasTools, isStructured);
    if (!reranked.length) {
        throw new Error(`No eligible BANKR models with finite cost in tier ${tier}`);
    }
    const selected = reranked[0].id;
    const baselineModel = catalogMap.get("claude-opus-4.6") ??
        catalogMap.get("claude-opus-4.5") ??
        catalogMap.get(selected);
    const selectedModel = catalogMap.get(selected);
    const costEstimate = estimateModelCost(selectedModel, estimatedInputTokens, maxOutputTokens);
    const baselineCost = estimateModelCost(baselineModel, estimatedInputTokens, maxOutputTokens);
    const savings = baselineCost > 0 && Number.isFinite(baselineCost)
        ? Math.max(0, (baselineCost - costEstimate) / baselineCost)
        : 0;
    return {
        model: selected,
        plannedModel: selected,
        tier,
        confidence,
        inherited,
        inheritedFromTier: inherited ? inheritedTier : null,
        toolsDetected: hasTools,
        structuredOutput: isStructured,
        codeHeavy,
        method: "rules",
        reasoning: [
            `tier=${tier}`,
            `profile=${profile}`,
            ...(signals.length ? [`signals=${signals.slice(0, 5).join(", ")}`] : [])
        ].join(" | "),
        costEstimate,
        baselineCost,
        savings,
        agenticScore,
        chain,
        ranked: reranked.map((r) => ({
            id: r.id,
            estimatedCost: Number.isFinite(r.estimatedCost) ? r.estimatedCost : 999999,
            rankingScore: Number.isFinite(r.rankingScore) ? r.rankingScore : undefined
        }))
    };
}
