export function checkBudget(config, state) {
    if (!config)
        return 'ok';
    if (config.maxCostPerRunUsd && state.spentUsd > config.maxCostPerRunUsd) {
        return config.budgetMode === 'strict' ? 'reject' : 'downgrade';
    }
    if (config.maxInputTokensPerRun && state.inputTokens > config.maxInputTokensPerRun) {
        return config.budgetMode === 'strict' ? 'reject' : 'downgrade';
    }
    if (config.maxOutputTokensPerRun && state.outputTokens > config.maxOutputTokensPerRun) {
        return config.budgetMode === 'strict' ? 'reject' : 'downgrade';
    }
    return 'ok';
}
