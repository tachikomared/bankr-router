import type { RoutingConfig } from "./types.js";

export const DEFAULT_BANKR_ROUTING_CONFIG: RoutingConfig = {
  scoring: {
    tokenCountThresholds: { simple: 50, complex: 500 },

    codeKeywords: [
      "function", "class", "import", "def", "select", "async", "await",
      "const", "let", "var", "return", "typescript", "javascript", "python",
      "rust", "sql", "regex", "stack trace", "bug", "debug", "exception",
      "compile", "refactor", "unit test", "dockerfile", "yaml", "json schema",
      "proxy", "middleware", "endpoint", "api", "```",
      "функция", "класс", "отладка", "ошибка", "рефакторинг",
      "函数", "调试", "错误",
      "関数", "デバッグ",
      "함수", "디버그",
      "دالة", "تصحيح"
    ],

    reasoningKeywords: [
      "prove", "theorem", "derive", "step by step", "chain of thought",
      "formally", "mathematical", "proof", "logically", "counterexample",
      "invariant", "tradeoff", "root cause",
      "доказать", "теорема", "шаг за шагом", "логически", "контрпример",
      "证明", "定理", "逐步", "逻辑", "反例",
      "証明", "定理", "論理的", "反例",
      "증명", "정리", "논리적",
      "إثبات", "نظرية", "خطوة بخطوة", "منطقياً"
    ],

    simpleKeywords: [
      "what is", "define", "translate", "hello", "yes or no", "capital of",
      "how old", "who is", "when was", "explain simply",
      "что такое", "переведи", "привет", "кто такой", "объясни просто",
      "什么是", "翻译", "你好",
      "とは", "翻訳", "こんにちは",
      "무엇", "번역", "안녕하세요",
      "ما هو", "ترجم", "مرحبا"
    ],

    technicalKeywords: [
      "algorithm", "optimize", "architecture", "distributed", "kubernetes",
      "microservice", "database", "infrastructure", "gateway", "router",
      "schema", "oauth", "grpc", "latency", "throughput", "cache", "worker",
      "context window", "tool calling",
      "алгоритм", "архитектура", "роутер", "контекстное окно",
      "算法", "架构", "网关", "上下文窗口",
      "アルゴリズム", "アーキテクチャ", "ゲートウェイ",
      "알고리즘", "아키텍처", "게이트웨이",
      "خوارزمية", "بوابة", "نافذة السياق"
    ],

    creativeKeywords: [
      "story", "poem", "compose", "brainstorm", "creative", "imagine",
      "write a", "tagline", "slogan",
      "история", "стихотворение", "мозговой штурм", "творческий",
      "故事", "诗", "头脑风暴", "创意",
      "物語", "詩", "創造的",
      "이야기", "시", "창의적",
      "قصة", "قصيدة", "إبداعي"
    ],

    imperativeVerbs: [
      "build", "create", "implement", "design", "develop", "construct",
      "generate", "deploy", "configure", "set up", "fix", "patch",
      "создай", "реализуй", "исправь",
      "构建", "创建", "实现", "修复",
      "構築", "作成", "実装", "修正",
      "구축", "생성", "구현", "수정",
      "بناء", "إنشاء", "تنفيذ", "أصلح"
    ],

    constraintIndicators: [
      "under", "at most", "at least", "within", "no more than", "o(",
      "maximum", "minimum", "limit", "budget", "must", "cannot", "without",
      "strict", "hard requirement", "zero external", "<1ms",
      "не более", "бюджет", "должен", "без",
      "不超过", "预算", "必须", "不能",
      "必須", "制限", "予算",
      "예산", "반드시", "없이",
      "ميزانية", "يجب", "بدون"
    ],

    outputFormatKeywords: [
      "json", "yaml", "xml", "table", "csv", "markdown", "schema",
      "format as", "structured", "diff", "patch", "typescript", "bash", "curl",
      "таблица", "структурированный", "патч",
      "表格", "结构化", "补丁",
      "テーブル", "構造化", "パッチ",
      "테이블", "구조화", "패치",
      "جدول", "منظم"
    ],

    referenceKeywords: [
      "above", "below", "previous", "following", "the docs", "the api",
      "the code", "earlier", "attached", "this repo", "thread", "conversation",
      "выше", "ниже", "документация", "код", "этот репозиторий",
      "上面", "下面", "文档", "代码", "这个仓库",
      "上記", "下記", "ドキュメント", "コード",
      "위", "아래", "문서", "코드",
      "أعلاه", "أدناه", "الوثائق", "الكود"
    ],

    negationKeywords: [
      "don't", "do not", "avoid", "never", "without", "except", "exclude",
      "no longer", "rather than", "instead of",
      "не делай", "нельзя", "без", "кроме",
      "不要", "避免", "没有", "排除",
      "しないで", "避ける", "なしで",
      "하지 마", "없이", "제외",
      "لا تفعل", "تجنب", "بدون"
    ],

    domainSpecificKeywords: [
      "quantum", "fpga", "vlsi", "risc-v", "asic", "photonics", "genomics",
      "proteomics", "topological", "homomorphic", "zero-knowledge",
      "lattice-based", "openclaw", "bankr", "anthropic", "gemini", "qwen",
      "kimi", "gpt", "mcp", "ollama", "vllm", "llm gateway",
      "квантовый", "контекстное окно", "шлюз llm",
      "量子", "上下文窗口", "网关",
      "量子", "コンテキストウィンドウ", "ゲートウェイ",
      "양자", "컨텍스트 윈도우",
      "كمي", "نافذة السياق", "بوابة llm"
    ],

    agenticTaskKeywords: [
      "read file", "read the file", "look at", "check the", "open the",
      "edit", "modify", "update the", "change the", "write to", "create file",
      "execute", "deploy", "install", "npm", "pip", "compile", "after that",
      "and also", "once done", "step 1", "step 2", "fix", "debug",
      "until it works", "keep trying", "iterate", "make sure", "verify",
      "confirm", "wire up", "integrate",
      "читать файл", "открой", "отредактируй", "выполни", "установи", "шаг 1",
      "读取文件", "打开", "编辑", "执行", "安装", "第一步",
      "ファイルを読む", "開く", "編集", "実行", "インストール",
      "파일 읽기", "열기", "편집", "실행", "설치",
      "قراءة ملف", "فتح", "تحرير", "تنفيذ", "تثبيت"
    ],

    dimensionWeights: {
      tokenCount: 0.08,
      codePresence: 0.15,
      reasoningMarkers: 0.18,
      technicalTerms: 0.10,
      creativeMarkers: 0.05,
      simpleIndicators: 0.02,
      multiStepPatterns: 0.12,
      questionComplexity: 0.05,
      imperativeVerbs: 0.03,
      constraintCount: 0.04,
      outputFormat: 0.03,
      referenceComplexity: 0.02,
      negationComplexity: 0.01,
      domainSpecificity: 0.02,
      agenticTask: 0.04
    },

    tierBoundaries: {
      simpleMedium: 0.08,
      mediumComplex: 0.30,
      complexReasoning: 0.50
    },

    confidenceSteepness: 12,
    confidenceThreshold: 0.7
  },

  tiers: {
    SIMPLE: {
      primary: "gpt-5.4-nano",
      fallback: [
        "qwen3.5-flash",
        "deepseek-v3.2",
        "gpt-5.4-nano",
        "gemini-3.1-flash-lite",
        "grok-4.1-fast",
      ]
    },
    MEDIUM: {
      primary: "gpt-5.4-mini",
      fallback: [
        "deepseek-v3.2",
        "qwen3.5-plus",
        "gemini-3.1-flash-lite",
        "grok-4.1-fast",
        "gpt-5-mini",
        "gemini-3-flash",
      ]
    },
    COMPLEX: {
      primary: "gpt-5.4",
      fallback: [
        "claude-sonnet-4.6",
        "gemini-3.1-pro",
        "gemini-3-pro",
        "gpt-5.2",
        "claude-sonnet-4.5",
        "claude-opus-4.5",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
      ]
    },
    REASONING: {
      primary: "gpt-5.4",
      fallback: [
        "claude-opus-4.6",
        "claude-sonnet-4.6",
        "gemini-3.1-pro",
        "gpt-5.2",
        "claude-opus-4.5",
        "gemini-2.5-pro",
      ]
    }
  },

  ecoTiers: {
    SIMPLE: {
      primary: "gpt-5-nano",
      fallback: [
        "qwen3.5-flash",
        "deepseek-v3.2",
        "gpt-5.4-nano",
      ]
    },
    MEDIUM: {
      primary: "deepseek-v3.2",
      fallback: [
        "qwen3.5-plus",
        "gemini-3.1-flash-lite",
        "grok-4.1-fast",
        "gpt-5-mini",
      ]
    },
    COMPLEX: {
      primary: "gemini-3.1-flash-lite",
      fallback: [
        "deepseek-v3.2",
        "qwen3.5-plus",
        "minimax-m2.7",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
      ]
    },
    REASONING: {
      primary: "gemini-3.1-pro",
      fallback: [
        "gpt-5-mini",
        "deepseek-v3.2",
        "qwen3.5-plus",
        "grok-4.1-fast",
        "gemini-2.5-pro",
      ]
    }
  },

  premiumTiers: {
    SIMPLE: {
      primary: "gpt-5.4-mini",
      fallback: [
        "claude-haiku-4.5",
        "gemini-3-flash",
        "gpt-5-mini",
      ]
    },
    MEDIUM: {
      primary: "claude-sonnet-4.6",
      fallback: [
        "gpt-5.4-mini",
        "gpt-5.2-codex",
        "gemini-3.1-pro",
        "gpt-5.2",
        "claude-sonnet-4.5",
      ]
    },
    COMPLEX: {
      primary: "gpt-5.4",
      fallback: [
        "claude-opus-4.6",
        "claude-sonnet-4.6",
        "gemini-3.1-pro",
        "gpt-5.2",
        "claude-opus-4.5",
        "gemini-2.5-pro",
      ]
    },
    REASONING: {
      primary: "claude-opus-4.6",
      fallback: [
        "gpt-5.4",
        "claude-sonnet-4.6",
        "gemini-3.1-pro",
        "claude-opus-4.5",
      ]
    }
  },

  agenticTiers: {
    SIMPLE: {
      primary: "gpt-5.4-mini",
      fallback: [
        "claude-haiku-4.5",
        "grok-4.1-fast",
        "gpt-5-mini",
      ]
    },
    MEDIUM: {
      primary: "qwen3-coder",
      fallback: [
        "deepseek-v3.2",
        "gpt-5.4-mini",
        "claude-sonnet-4.6",
        "gemini-3.1-flash-lite",
      ]
    },
    COMPLEX: {
      primary: "claude-sonnet-4.6",
      fallback: [
        "gpt-5.4",
        "claude-opus-4.6",
        "gemini-3.1-pro",
        "gpt-5.2-codex",
        "claude-opus-4.5",
      ]
    },
    REASONING: {
      primary: "claude-opus-4.6",
      fallback: [
        "gpt-5.4",
        "claude-sonnet-4.6",
        "gemini-3.1-pro",
        "claude-opus-4.5",
      ]
    }
  },

  overrides: {
    maxTokensForceComplex: 100000,
    structuredOutputMinTier: "MEDIUM",
    ambiguousDefaultTier: "MEDIUM",
    enableAgenticAuto: true
  },

  followup: {
    enabled: true,
    maxAgeMs: 10 * 60 * 1000,
    shortPromptMaxChars: 80,
    inheritConfidenceFloor: 0.72
  },

  retries: {
    enabled: true,
    maxAttempts: 3,
    retryOnStatuses: [408, 429, 500, 502, 503, 504]
  },

  server: {
    authToken: process.env.BANKR_ROUTER_AUTH_TOKEN || "",
    rateLimitPerMinute: Number(process.env.BANKR_ROUTER_RATE_LIMIT || 100),
    upstreamTimeoutMs: Number(process.env.BANKR_ROUTER_TIMEOUT_MS || 60000)
  }
};