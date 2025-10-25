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

  // DeepSeek models
  "deepseek-chat": 8192,
  "deepseek-reasoner": 8192,
  "deepseek-coder": 8192,
  "deepseek-r1": 8192,
};

const MODEL_SUBSTRING_LIMITS: Array<{ match: string; limit: number }> = [
  // OpenAI patterns
  { match: "gpt-4o", limit: 16384 },
  { match: "gpt-4-turbo", limit: 4096 },
  { match: "gpt-4", limit: 8192 },
  { match: "gpt-3.5", limit: 4096 },

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
