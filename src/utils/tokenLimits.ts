export const DEFAULT_MAX_COMPLETION_TOKENS = 4096;
const MIN_COMPLETION_TOKENS = 256;

type ProviderCompletionLimits = {
  default?: number;
  models?: Record<string, number>;
};

const NORMALIZED_MODEL_LIMITS: Record<string, number> = {
  // OpenAI models
  "gpt-4o": 16384,
  "gpt-4o-mini": 16384,
  "gpt-4o-2024-08-06": 16384,
  "gpt-4o-2024-05-13": 4096,
  "gpt-4-turbo": 4096,
  "gpt-4-turbo-preview": 4096,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 4096,

  // Anthropic Claude models
  "claude-3-5-sonnet-20241022": 8192,
  "claude-3-5-sonnet-20240620": 8192,
  "claude-3-5-haiku-20241022": 8192,
  "claude-3-opus-20240229": 8192,
  "claude-3-sonnet-20240229": 8192,
  "claude-3-haiku-20240307": 8192,

  // Google Gemini models
  "gemini-2.5-pro": 65536,
  "gemini-2.5-flash": 65536,
  "gemini-2.0-flash-exp": 8192,
  "gemini-1.5-flash": 8192,
  "gemini-1.5-pro": 8192,

  // xAI Grok models
  "grok-3": 16000,
  "grok-2": 16000,
  "grok-4": 16000,
  "grok-beta": 16000,
  "grok-vision-beta": 16000,

  // Groq models (Llama)
  "llama-3.3-70b-versatile": 8192,
  "llama-3.1-8b-instant": 8192,
  "llama3.2-90b-vision-preview": 8192,

  // GitHub Models
  "phi-3.5-mini-instruct": 8192,
  "meta-llama-3.1-8b-instruct": 8192,

  // DeepSeek models
  "deepseek-chat": 8192,
  "deepseek-reasoner": 8192,
  "deepseek-coder": 8192,
  "deepseek-r1": 8192,
};

const MODEL_SUBSTRING_LIMITS: Array<{ match: string; limit: number }> = [
  // OpenAI patterns (order matters: more specific first)
  { match: "gpt-4o", limit: 16384 },
  { match: "gpt-4-turbo", limit: 4096 },
  { match: "gpt-4", limit: 8192 },
  { match: "gpt-3.5", limit: 4096 },

  // Anthropic Claude patterns
  { match: "claude-3-5-sonnet", limit: 8192 },
  { match: "claude-3-5-haiku", limit: 8192 },
  { match: "claude-3-opus", limit: 8192 },
  { match: "claude-3-sonnet", limit: 8192 },
  { match: "claude-3-haiku", limit: 8192 },
  { match: "claude", limit: 8192 },

  // Google Gemini patterns
  { match: "gemini-2.5", limit: 65536 },
  { match: "gemini-2.0", limit: 8192 },
  { match: "gemini-1.5", limit: 8192 },
  { match: "gemini", limit: 8192 },

  // xAI Grok patterns
  { match: "grok", limit: 16000 },

  // Groq Llama patterns
  { match: "llama-3.3", limit: 8192 },
  { match: "llama-3.1", limit: 8192 },
  { match: "llama", limit: 8192 },

  // DeepSeek patterns
  { match: "deepseek/", limit: 8192 },
  { match: "deepseek", limit: 8192 },
];

const COMPLETION_LIMITS: Record<string, ProviderCompletionLimits> = {
  openai: {
    models: {
      "gpt-4o": 16384,
      "gpt-4o-mini": 16384,
      "gpt-4o-2024-08-06": 16384,
      "gpt-4o-2024-05-13": 4096,
      "gpt-4-turbo": 4096,
      "gpt-4-turbo-preview": 4096,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 4096,
    },
  },
  anthropic: {
    models: {
      "claude-3-5-sonnet-20241022": 8192,
      "claude-3-5-sonnet-20240620": 8192,
      "claude-3-5-haiku-20241022": 8192,
      "claude-3-opus-20240229": 8192,
      "claude-3-sonnet-20240229": 8192,
      "claude-3-haiku-20240307": 8192,
    },
  },
  gemini: {
    models: {
      "gemini-2.5-pro": 65536,
      "gemini-2.5-flash": 65536,
      "gemini-2.0-flash-exp": 8192,
      "gemini-1.5-flash": 8192,
      "gemini-1.5-pro": 8192,
    },
  },
  xai: {
    models: {
      "grok-3": 16000,
      "grok-2": 16000,
      "grok-4": 16000,
      "grok-beta": 16000,
      "grok-vision-beta": 16000,
    },
  },
  groq: {
    models: {
      "llama-3.3-70b-versatile": 8192,
      "llama-3.1-8b-instant": 8192,
      "llama3.2-90b-vision-preview": 8192,
    },
  },
  github: {
    models: {
      "gpt-4o": 16384,
      "Phi-3.5-mini-instruct": 8192,
      "Meta-Llama-3.1-8B-Instruct": 8192,
    },
  },
  deepseek: {
    default: 8192,
  },
  "custom-openai": {
    models: {
      // DeepSeek models via custom OpenAI endpoint
      "deepseek-chat": 8192,
      "deepseek-reasoner": 8192,
      "deepseek-coder": 8192,
      "deepseek-r1": 8192,

      // OpenAI models via custom endpoint
      "gpt-4o": 16384,
      "gpt-4o-mini": 16384,
      "gpt-4o-2024-08-06": 16384,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 4096,
    },
  },
  openrouter: {
    // OpenRouter relays still enforce upstream completion ceilings
    models: {
      "deepseek-chat": 8192,
      "deepseek-reasoner": 8192,
      "deepseek-coder": 8192,
      "deepseek/deepseek-chat": 8192,
      "deepseek/deepseek-reasoner": 8192,
      "deepseek/deepseek-coder": 8192,

      // OpenAI models via OpenRouter
      "openai/gpt-4o": 16384,
      "openai/gpt-4o-mini": 16384,
      "openai/gpt-4": 8192,

      // Anthropic models via OpenRouter
      "anthropic/claude-3-5-sonnet": 8192,
      "anthropic/claude-3-opus": 8192,
    },
  },
};

function normalize(value?: string): string | undefined {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

function resolveProviderLimit(
  provider?: string,
  model?: string
): number | undefined {
  const normalizedProvider = normalize(provider);
  if (!normalizedProvider) {
    return undefined;
  }

  const providerLimits = COMPLETION_LIMITS[normalizedProvider];
  if (!providerLimits) {
    return undefined;
  }

  const normalizedModel = normalize(model);
  const { models, default: defaultLimit } = providerLimits;
  if (
    normalizedModel &&
    models &&
    Object.prototype.hasOwnProperty.call(models, normalizedModel)
  ) {
    return models[normalizedModel];
  }

  return defaultLimit;
}

function resolveModelLimit(model?: string): number | undefined {
  const normalizedModel = normalize(model);
  if (!normalizedModel) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(NORMALIZED_MODEL_LIMITS, normalizedModel)) {
    return NORMALIZED_MODEL_LIMITS[normalizedModel];
  }

  for (const { match, limit } of MODEL_SUBSTRING_LIMITS) {
    if (normalizedModel.includes(match)) {
      return limit;
    }
  }

  return undefined;
}

export function getSafeMaxCompletionTokens(
  provider?: string,
  model?: string,
  requested?: number,
  fallback: number = DEFAULT_MAX_COMPLETION_TOKENS
): number {
  const providerLimit = resolveProviderLimit(provider, model);
  const modelLimit = resolveModelLimit(model);
  const target = typeof requested === "number" ? requested : fallback;

  const effectiveUpperBounds = [providerLimit, modelLimit]
    .filter((limit): limit is number => typeof limit === "number");

  const upperBound =
    effectiveUpperBounds.length > 0
      ? Math.min(...effectiveUpperBounds)
      : target;

  return Math.max(MIN_COMPLETION_TOKENS, Math.min(target, upperBound));
}
