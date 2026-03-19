const reliabilityStore = new Map();
function getOrCreate(modelId) {
    const existing = reliabilityStore.get(modelId);
    if (existing)
        return existing;
    return {
        successCount: 0,
        errorCount: 0,
        timeoutCount: 0,
        rateLimitCount: 0,
        totalRequests: 0,
        avgLatencyMs: 0,
        toolSuccessCount: 0,
        structuredSuccessCount: 0,
        lastUpdatedAt: Date.now(),
    };
}
export function recordSuccess(modelId, latencyMs, tools, structured) {
    const stats = getOrCreate(modelId);
    stats.successCount += 1;
    stats.totalRequests += 1;
    stats.avgLatencyMs = (stats.avgLatencyMs * stats.totalRequests + latencyMs) / stats.totalRequests;
    if (tools)
        stats.toolSuccessCount += 1;
    if (structured)
        stats.structuredSuccessCount += 1;
    stats.lastUpdatedAt = Date.now();
    reliabilityStore.set(modelId, stats);
}
export function recordError(modelId, status) {
    const stats = getOrCreate(modelId);
    stats.errorCount += 1;
    stats.totalRequests += 1;
    if (status === 408 || status === 504)
        stats.timeoutCount += 1;
    if (status === 429)
        stats.rateLimitCount += 1;
    stats.lastUpdatedAt = Date.now();
    reliabilityStore.set(modelId, stats);
}
export function getReliability(modelId) {
    return reliabilityStore.get(modelId);
}
export function getAllReliability() {
    return Object.fromEntries(reliabilityStore.entries());
}
export function computeReliabilityScore(modelId) {
    const stats = getOrCreate(modelId);
    if (stats.totalRequests === 0)
        return 1.0;
    const successRate = stats.successCount / stats.totalRequests;
    const failurePenalty = stats.errorCount * 0.2 + stats.timeoutCount * 0.4 + stats.rateLimitCount * 0.3;
    const reliability = Math.max(0, successRate - failurePenalty / stats.totalRequests);
    return Math.min(1.0, reliability);
}
export function toolSuccessRate(modelId) {
    const stats = getOrCreate(modelId);
    if (stats.toolSuccessCount === 0)
        return 0;
    return stats.toolSuccessCount / stats.totalRequests;
}
export function structuredSuccessRate(modelId) {
    const stats = getOrCreate(modelId);
    if (stats.structuredSuccessCount === 0)
        return 0;
    return stats.structuredSuccessCount / stats.totalRequests;
}
