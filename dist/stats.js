const stats = {
    startedAt: Date.now(),
    totalRequests: 0,
    totalRetries: 0,
    requestsByModel: new Map(),
    requestsByTier: new Map(),
    errorsByModel: new Map(),
    latencyByModel: new Map(),
    inheritedFollowups: 0,
    lastRequestAt: 0,
};
function incMap(map, key, amount = 1) {
    map.set(key, (map.get(key) ?? 0) + amount);
}
export function recordRequest(stat) {
    stats.totalRequests += 1;
    stats.totalRetries += stat.retried;
    stats.lastRequestAt = stat.ts;
    if (stat.tier) {
        incMap(stats.requestsByTier, stat.tier);
    }
    incMap(stats.requestsByModel, stat.selectedModel);
    if (stat.inherited) {
        stats.inheritedFollowups += 1;
    }
    const latency = stats.latencyByModel.get(stat.selectedModel) ?? { count: 0, totalMs: 0 };
    latency.count += 1;
    latency.totalMs += stat.latencyMs;
    stats.latencyByModel.set(stat.selectedModel, latency);
    if (stat.status >= 400) {
        incMap(stats.errorsByModel, stat.selectedModel);
    }
}
export function getStats() {
    const requestsByModel = Object.fromEntries(stats.requestsByModel.entries());
    const requestsByTier = Object.fromEntries(stats.requestsByTier.entries());
    const errorsByModel = Object.fromEntries(stats.errorsByModel.entries());
    const latencyByModel = Object.fromEntries(Array.from(stats.latencyByModel.entries()).map(([model, value]) => [
        model,
        {
            avgMs: value.count ? value.totalMs / value.count : 0,
            count: value.count,
        },
    ]));
    return {
        startedAt: stats.startedAt,
        totalRequests: stats.totalRequests,
        totalRetries: stats.totalRetries,
        lastRequestAt: stats.lastRequestAt,
        inheritedFollowups: stats.inheritedFollowups,
        requestsByModel,
        requestsByTier,
        errorsByModel,
        latencyByModel,
    };
}
export function getHealthSummary() {
    const uptimeMs = Date.now() - stats.startedAt;
    return {
        startedAt: stats.startedAt,
        uptimeMs,
        totalRequests: stats.totalRequests,
        totalRetries: stats.totalRetries,
        lastRequestAt: stats.lastRequestAt,
        inheritedFollowups: stats.inheritedFollowups,
    };
}
