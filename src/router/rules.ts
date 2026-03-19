/**
 * Rule-Based Classifier (BANKR router adaptation)
 *
 * Scores a request across weighted dimensions and maps the aggregate
 * score to a tier using configurable boundaries. Confidence is calibrated
 * via sigmoid. Low confidence returns null tier so selector can fall back
 * to ambiguousDefaultTier.
 *
 * Handles the majority of requests locally with zero routing cost.
 */

import type { Tier, ScoringResult, ScoringConfig } from "./types.js";

type DimensionScore = { name: string; score: number; signal: string | null };

type KeywordHit = { count: number; matches: string[] };

function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLatinLike(keyword: string): boolean {
  const raw = keyword.trim();
  if (!raw) return false;
  const latinLike = raw.match(/[a-z0-9]/gi)?.length ?? 0;
  const nonLatin = raw.match(/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\u0600-\u06ff]/g)?.length ?? 0;
  return latinLike >= Math.max(1, nonLatin);
}

function containsKeyword(text: string, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  if (!needle) return false;

  if (!isLatinLike(needle)) {
    return text.includes(needle);
  }

  const escaped = escapeRegExp(needle);
  const hasSpaces = /\s+/.test(needle);
  const pattern = hasSpaces
    ? `(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`
    : `(?:^|[^\\p{L}\\p{N}_])${escaped}(?:$|[^\\p{L}\\p{N}_])`;

  const re = new RegExp(pattern, "iu");
  return re.test(text);
}

function countKeywordHits(text: string, keywords: string[]): KeywordHit {
  const matches: string[] = [];
  let count = 0;

  for (const kw of keywords) {
    if (containsKeyword(text, kw)) {
      count++;
      if (!matches.includes(kw) && matches.length < 3) matches.push(kw);
    }
  }

  return { count, matches };
}

function countContains(text: string, keywords: string[]): number {
  return countKeywordHits(text, keywords).count;
}

function countContainsRaw(text: string, keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    const needle = kw.toLowerCase();
    if (needle && text.includes(needle)) count++;
  }
  return count;
}

// ─── Dimension Scorers ───

function scoreTokenCount(
  estimatedTokens: number,
  thresholds: { simple: number; complex: number }
): DimensionScore {
  if (estimatedTokens < thresholds.simple) {
    return { name: "tokenCount", score: -1.0, signal: `short (${estimatedTokens} tokens)` };
  }
  if (estimatedTokens > thresholds.complex) {
    return { name: "tokenCount", score: 1.0, signal: `long (${estimatedTokens} tokens)` };
  }
  return { name: "tokenCount", score: 0, signal: null };
}

function scoreKeywordMatch(
  text: string,
  keywords: string[],
  name: string,
  signalLabel: string,
  thresholds: { low: number; high: number },
  scores: { none: number; low: number; high: number }
): DimensionScore {
  const { count, matches } = countKeywordHits(text, keywords);

  if (count >= thresholds.high) {
    return {
      name,
      score: scores.high,
      signal: `${signalLabel} (${matches.join(", ")})`
    };
  }

  if (count >= thresholds.low) {
    return {
      name,
      score: scores.low,
      signal: `${signalLabel} (${matches.join(", ")})`
    };
  }

  return { name, score: scores.none, signal: null };
}

function scoreCodePresence(rawPrompt: string, userText: string, keywords: string[]): DimensionScore {
  const codeFenceCount = (rawPrompt.match(/```/g) || []).length;
  const keywordMatches = countContainsRaw(userText, keywords);

  if (codeFenceCount >= 2) {
    return { name: "codePresence", score: 1.0, signal: "code fence" };
  }
  if (codeFenceCount >= 1 || keywordMatches >= 3) {
    return { name: "codePresence", score: 0.8, signal: "code-heavy" };
  }
  if (keywordMatches >= 1) {
    return { name: "codePresence", score: 0.5, signal: "code" };
  }
  return { name: "codePresence", score: 0, signal: null };
}

function scoreMultiStep(text: string): DimensionScore {
  const patterns = [
    // EN
    /first.*then/i,
    /step\s*1/i,
    /step\s*2/i,
    /\bnext\b/i,
    /\bfinally\b/i,
    /\bafter that\b/i,
    /\bonce done\b/i,
    /\band also\b/i,
    // ZH
    /第一步/,
    /第二步/,
    /然后/,
    /最后/,
    // JA
    /ステップ1/,
    /ステップ2/,
    /その後/,
    /最後に/,
    // RU
    /шаг 1/i,
    /шаг 2/i,
    /затем/i,
    /после этого/i,
    /наконец/i,
    // DE
    /schritt 1/i,
    /schritt 2/i,
    /danach/i,
    /schließlich/i,
    // ES
    /paso 1/i,
    /paso 2/i,
    /después/i,
    /finalmente/i,
    // PT
    /passo 1/i,
    /passo 2/i,
    /depois/i,
    /finalmente/i,
    // KO
    /단계 1/,
    /단계 2/,
    /그 다음/,
    /마지막으로/,
    // AR
    /الخطوة 1/,
    /الخطوة 2/,
    /بعد ذلك/,
    /أخيرًا/
  ];

  const hits = patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);

  if (hits >= 3) {
    return { name: "multiStepPatterns", score: 1.0, signal: "multi-step-heavy" };
  }
  if (hits >= 1) {
    return { name: "multiStepPatterns", score: 0.5, signal: "multi-step" };
  }
  return { name: "multiStepPatterns", score: 0, signal: null };
}

function scoreQuestionComplexity(prompt: string): DimensionScore {
  const qMarks = (prompt.match(/\?/g) || []).length;
  const multiQuestionWords = countContains(prompt.toLowerCase(), [
    "why",
    "how",
    "compare",
    "tradeoff",
    "versus",
    "vs",
    "почему",
    "как",
    "сравни",
    "плюсы и минусы",
    "为什么",
    "如何",
    "比较",
    "权衡",
    "なぜ",
    "どう",
    "比較",
    "por qué",
    "cómo",
    "comparar",
    "por que",
    "como",
    "vergleiche",
    "warum"
  ]);

  if (qMarks >= 3 || multiQuestionWords >= 2) {
    return { name: "questionComplexity", score: 0.5, signal: "complex-question" };
  }
  if (qMarks >= 1 || multiQuestionWords >= 1) {
    return { name: "questionComplexity", score: 0.2, signal: "question" };
  }
  return { name: "questionComplexity", score: 0, signal: null };
}

/**
 * Score agentic task indicators.
 * - 4+ matches = 1.0
 * - 2-3 matches = 0.6
 * - 1 match = 0.2
 */
function scoreAgenticTask(
  text: string,
  keywords: string[]
): { dimensionScore: DimensionScore; agenticScore: number } {
  let matchCount = 0;
  const signals: string[] = [];

  for (const keyword of keywords) {
    if (containsKeyword(text, keyword)) {
      matchCount++;
      if (signals.length < 3) signals.push(keyword);
    }
  }

  if (matchCount >= 4) {
    return {
      dimensionScore: {
        name: "agenticTask",
        score: 1.0,
        signal: `agentic (${signals.join(", ")})`
      },
      agenticScore: 1.0
    };
  } else if (matchCount >= 2) {
    return {
      dimensionScore: {
        name: "agenticTask",
        score: 0.6,
        signal: `agentic (${signals.join(", ")})`
      },
      agenticScore: 0.6
    };
  } else if (matchCount >= 1) {
    return {
      dimensionScore: {
        name: "agenticTask",
        score: 0.2,
        signal: `agentic-light (${signals.join(", ")})`
      },
      agenticScore: 0.2
    };
  }

  return {
    dimensionScore: { name: "agenticTask", score: 0, signal: null },
    agenticScore: 0
  };
}

// ─── Main Classifier ───

export function classifyByRules(
  prompt: string,
  systemPrompt: string | undefined,
  estimatedTokens: number,
  config: ScoringConfig
): ScoringResult {
  // Keep prompt dominant, but allow system prompt to contribute lightly.
  // This is safer than discarding it completely for BANKR/OpenClaw agents,
  // while still avoiding boilerplate domination.
  const userText = normalizeText(prompt);
  const systemText = normalizeText(systemPrompt ?? "");
  const textForScoring = systemText ? `${userText} ${systemText}` : userText;

  const dimensions: DimensionScore[] = [
    // Token count uses total estimated tokens
    scoreTokenCount(estimatedTokens, config.tokenCountThresholds),

    // Code detection benefits from raw prompt for fenced blocks
    scoreCodePresence(prompt, userText, config.codeKeywords),

    scoreKeywordMatch(
      textForScoring,
      config.reasoningKeywords,
      "reasoningMarkers",
      "reasoning",
      { low: 1, high: 2 },
      { none: 0, low: 0.7, high: 1.0 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.technicalKeywords,
      "technicalTerms",
      "technical",
      { low: 2, high: 4 },
      { none: 0, low: 0.5, high: 1.0 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.creativeKeywords,
      "creativeMarkers",
      "creative",
      { low: 1, high: 2 },
      { none: 0, low: 0.5, high: 0.7 }
    ),
    scoreKeywordMatch(
      userText,
      config.simpleKeywords,
      "simpleIndicators",
      "simple",
      { low: 1, high: 2 },
      { none: 0, low: -1.0, high: -1.0 }
    ),
    scoreMultiStep(textForScoring),
    scoreQuestionComplexity(prompt),

    scoreKeywordMatch(
      textForScoring,
      config.imperativeVerbs,
      "imperativeVerbs",
      "imperative",
      { low: 1, high: 2 },
      { none: 0, low: 0.3, high: 0.5 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.constraintIndicators,
      "constraintCount",
      "constraints",
      { low: 1, high: 3 },
      { none: 0, low: 0.3, high: 0.7 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.outputFormatKeywords,
      "outputFormat",
      "format",
      { low: 1, high: 2 },
      { none: 0, low: 0.4, high: 0.7 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.referenceKeywords,
      "referenceComplexity",
      "references",
      { low: 1, high: 2 },
      { none: 0, low: 0.3, high: 0.5 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.negationKeywords,
      "negationComplexity",
      "negation",
      { low: 2, high: 3 },
      { none: 0, low: 0.3, high: 0.5 }
    ),
    scoreKeywordMatch(
      textForScoring,
      config.domainSpecificKeywords,
      "domainSpecificity",
      "domain-specific",
      { low: 1, high: 2 },
      { none: 0, low: 0.5, high: 0.8 }
    )
  ];

  const agenticResult = scoreAgenticTask(userText, config.agenticTaskKeywords);
  dimensions.push(agenticResult.dimensionScore);
  const agenticScore = agenticResult.agenticScore;

  const signals = dimensions.filter((d) => d.signal !== null).map((d) => d.signal!);

  let weightedScore = 0;
  for (const d of dimensions) {
    const w = config.dimensionWeights[d.name] ?? 0;
    weightedScore += d.score * w;
  }

  // Reasoning override should still be user-intent driven, so only user prompt.
  const reasoningMatches = countKeywordHits(userText, config.reasoningKeywords).count;

  if (reasoningMatches >= 2) {
    const confidence = calibrateConfidence(
      Math.max(weightedScore, 0.35),
      config.confidenceSteepness
    );
    return {
      score: weightedScore,
      tier: "REASONING",
      confidence: Math.max(confidence, 0.85),
      signals,
      agenticScore,
      dimensions
    };
  }

  const { simpleMedium, mediumComplex, complexReasoning } = config.tierBoundaries;
  let tier: Tier;
  let distanceFromBoundary: number;

  if (weightedScore < simpleMedium) {
    tier = "SIMPLE";
    distanceFromBoundary = simpleMedium - weightedScore;
  } else if (weightedScore < mediumComplex) {
    tier = "MEDIUM";
    distanceFromBoundary = Math.min(
      weightedScore - simpleMedium,
      mediumComplex - weightedScore
    );
  } else if (weightedScore < complexReasoning) {
    tier = "COMPLEX";
    distanceFromBoundary = Math.min(
      weightedScore - mediumComplex,
      complexReasoning - weightedScore
    );
  } else {
    tier = "REASONING";
    distanceFromBoundary = weightedScore - complexReasoning;
  }

  const confidence = calibrateConfidence(distanceFromBoundary, config.confidenceSteepness);

  if (confidence < config.confidenceThreshold) {
    return {
      score: weightedScore,
      tier: null,
      confidence,
      signals,
      agenticScore,
      dimensions
    };
  }

  return {
    score: weightedScore,
    tier,
    confidence,
    signals,
    agenticScore,
    dimensions
  };
}

function calibrateConfidence(distance: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * distance));
}