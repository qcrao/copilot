// src/utils/tokenLimits.ts
//
// Single source of truth for all token-related limits and estimation.
// Two distinct concepts:
//   1. Context window  – total tokens a model can accept (input + output)
//   2. Completion limit – max tokens a model can generate in one response

// ──────────────────────────────────────────────
// 1. Completion (output) token limits
// ──────────────────────────────────────────────

export const DEFAULT_MAX_COMPLETION_TOKENS = 4096;
const MIN_COMPLETION_TOKENS = 256;

/** Per-model completion ceilings (exact match, lowercase keys). */
const COMPLETION_MODEL_LIMITS: Record<string, number> = {
  // OpenAI
  "gpt-5": 16384,
  "gpt-5-mini": 16384,
  "gpt-4.1": 32768,
  "gpt-4.1-mini": 16384,
  "gpt-4.1-nano": 16384,
  "o4-mini": 16384,
  "o3-mini": 16384,
  "gpt-4o": 16384,
  "gpt-4o-mini": 16384,
  "gpt-4o-2024-08-06": 16384,
  "gpt-4o-2024-05-13": 4096,
  "gpt-4-turbo": 4096,
  "gpt-4-turbo-preview": 4096,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 4096,

  // Anthropic Claude
  "claude-sonnet-4-6": 16384,
  "claude-haiku-4-5-20251001": 8192,
  "claude-3-5-sonnet-20241022": 8192,
  "claude-3-5-sonnet-20240620": 8192,
  "claude-3-5-haiku-20241022": 8192,
  "claude-3-opus-20240229": 8192,
  "claude-3-sonnet-20240229": 8192,
  "claude-3-haiku-20240307": 8192,

  // Google Gemini
  "gemini-2.5-pro": 65536,
  "gemini-2.5-flash": 65536,
  "gemini-2.0-flash": 8192,
  "gemini-2.0-flash-exp": 8192,
  "gemini-1.5-flash": 8192,
  "gemini-1.5-pro": 8192,

  // xAI Grok
  "grok-4": 16000,
  "grok-3": 16000,
  "grok-2": 16000,
  "grok-2-1212": 16000,
  "grok-beta": 16000,
  "grok-vision-beta": 16000,

  // Groq (Llama)
  "llama-3.3-70b-versatile": 8192,
  "llama-3.1-8b-instant": 8192,
  "llama3.2-90b-vision-preview": 8192,

  // GitHub Models
  "phi-3.5-mini-instruct": 8192,
  "meta-llama-3.1-8b-instruct": 8192,

  // DeepSeek
  "deepseek-chat": 8192,
  "deepseek-reasoner": 8192,
  "deepseek-coder": 8192,
  "deepseek-r1": 8192,
};

/** Substring-based fallback for completion limits (order matters). */
const COMPLETION_SUBSTRING_LIMITS: Array<{ match: string; limit: number }> = [
  // OpenAI
  { match: "gpt-5", limit: 16384 },
  { match: "gpt-4.1", limit: 32768 },
  { match: "o4-mini", limit: 16384 },
  { match: "o3-mini", limit: 16384 },
  { match: "gpt-4o", limit: 16384 },
  { match: "gpt-4-turbo", limit: 4096 },
  { match: "gpt-4", limit: 8192 },
  { match: "gpt-3.5", limit: 4096 },
  // Anthropic
  { match: "claude-sonnet-4", limit: 16384 },
  { match: "claude-haiku-4", limit: 8192 },
  { match: "claude-3-5-sonnet", limit: 8192 },
  { match: "claude-3-5-haiku", limit: 8192 },
  { match: "claude", limit: 8192 },
  // Gemini
  { match: "gemini-2.5", limit: 65536 },
  { match: "gemini", limit: 8192 },
  // xAI
  { match: "grok", limit: 16000 },
  // Groq
  { match: "llama", limit: 8192 },
  // DeepSeek
  { match: "deepseek", limit: 8192 },
];

/** Provider-specific overrides for completion limits. */
const COMPLETION_PROVIDER_LIMITS: Record<string, { default?: number; models?: Record<string, number> }> = {
  openai: {
    models: {
      "gpt-5": 16384,
      "gpt-5-mini": 16384,
      "gpt-4.1": 32768,
      "gpt-4.1-mini": 16384,
      "gpt-4.1-nano": 16384,
      "o4-mini": 16384,
      "o3-mini": 16384,
      "gpt-4o": 16384,
      "gpt-4o-mini": 16384,
      "gpt-4-turbo": 4096,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 4096,
    },
  },
  anthropic: {
    models: {
      "claude-sonnet-4-6": 16384,
      "claude-haiku-4-5-20251001": 8192,
      "claude-3-5-sonnet-20241022": 8192,
      "claude-3-5-haiku-20241022": 8192,
      "claude-3-opus-20240229": 8192,
    },
  },
  gemini: {
    models: {
      "gemini-2.5-pro": 65536,
      "gemini-2.5-flash": 65536,
      "gemini-2.0-flash": 8192,
      "gemini-1.5-flash": 8192,
      "gemini-1.5-pro": 8192,
    },
  },
  xai: { default: 16000 },
  groq: { default: 8192 },
  github: { default: 8192 },
  deepseek: { default: 8192 },
  "custom-openai": {
    models: {
      "deepseek-chat": 8192,
      "deepseek-reasoner": 8192,
      "gpt-4o": 16384,
      "gpt-4o-mini": 16384,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 4096,
    },
  },
  openrouter: {
    models: {
      "deepseek-chat": 8192,
      "deepseek/deepseek-chat": 8192,
      "openai/gpt-4o": 16384,
      "anthropic/claude-3-5-sonnet": 8192,
    },
  },
};

// ──────────────────────────────────────────────
// 2. Context window (input capacity) limits
// ──────────────────────────────────────────────

/** Per-model context window sizes (exact match, lowercase keys). */
const CONTEXT_WINDOW_LIMITS: Record<string, number> = {
  // OpenAI
  "gpt-5": 128000,
  "gpt-5-mini": 128000,
  "gpt-4.1": 1047576,
  "gpt-4.1-mini": 1047576,
  "gpt-4.1-nano": 1047576,
  "o4-mini": 200000,
  "o3-mini": 200000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8000,
  "gpt-3.5-turbo": 16000,

  // Anthropic Claude
  "claude-sonnet-4-6": 200000,
  "claude-haiku-4-5-20251001": 200000,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-5-sonnet-20240620": 200000,
  "claude-3-5-haiku-20241022": 200000,
  "claude-3-opus-20240229": 200000,
  "claude-3-sonnet-20240229": 200000,
  "claude-3-haiku-20240307": 200000,

  // Google Gemini
  "gemini-2.5-pro": 1048576,
  "gemini-2.5-flash": 1048576,
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-flash-exp": 1048576,
  "gemini-1.5-flash": 1048576,
  "gemini-1.5-pro": 2097152,

  // xAI Grok
  "grok-4": 131072,
  "grok-3": 131072,
  "grok-2": 131072,
  "grok-2-1212": 131072,
  "grok-beta": 131072,
  "grok-vision-beta": 131072,

  // Groq (Llama)
  "llama-3.3-70b-versatile": 128000,
  "llama-3.1-70b-versatile": 128000,
  "llama-3.1-8b-instant": 128000,

  // GitHub Models
  "phi-3.5-mini-instruct": 128000,
  "meta-llama-3.1-8b-instruct": 128000,

  // DeepSeek
  "deepseek-chat": 64000,
  "deepseek-reasoner": 64000,
  "deepseek-coder": 64000,
  "deepseek-r1": 64000,

  // Common Ollama models
  "qwen3:8b": 32000,
  "qwen2.5:latest": 32000,
  "qwen2.5:7b": 32000,
  "qwen2.5:14b": 32000,
  "qwen2.5:32b": 32000,
  "qwen2.5:72b": 32000,
  "deepseek-r1:latest": 64000,
  "deepseek-r1:8b": 64000,
  "deepseek-r1:14b": 64000,
  "deepseek-r1:32b": 64000,
  "deepseek-r1:70b": 64000,
  "deepseek-coder:latest": 64000,
  "llama3.2:latest": 128000,
  "llama3.2:3b": 128000,
  "llama3.2:1b": 128000,
  "llama3.1:latest": 128000,
  "llama3.1:8b": 128000,
  "llama3.1:70b": 128000,
  "llama3:latest": 32000,
  "llama3:8b": 32000,
  "llama3:70b": 32000,
  "codellama:latest": 32000,
  "mistral:latest": 32000,
  "mistral:7b": 32000,
  "mixtral:latest": 32000,
  "phi3:latest": 32000,
  "gemma:latest": 32000,
  "gemma:2b": 32000,
  "gemma:7b": 32000,
};

/** Substring-based fallback for context window (order matters). */
const CONTEXT_WINDOW_SUBSTRING_LIMITS: Array<{ match: string; limit: number }> = [
  // OpenAI
  { match: "gpt-5", limit: 128000 },
  { match: "gpt-4.1", limit: 1047576 },
  { match: "o4-mini", limit: 200000 },
  { match: "o3-mini", limit: 200000 },
  { match: "gpt-4o", limit: 128000 },
  { match: "gpt-4-turbo", limit: 128000 },
  { match: "gpt-4", limit: 8000 },
  { match: "gpt-3.5", limit: 16000 },
  // Anthropic
  { match: "claude", limit: 200000 },
  // Gemini
  { match: "gemini", limit: 1048576 },
  // xAI
  { match: "grok", limit: 131072 },
  // Groq
  { match: "llama-3.3", limit: 128000 },
  { match: "llama-3.1", limit: 128000 },
  { match: "llama3", limit: 128000 },
  { match: "llama", limit: 32000 },
  // DeepSeek
  { match: "deepseek", limit: 64000 },
  // Ollama families
  { match: "qwen", limit: 32000 },
  { match: "mistral", limit: 32000 },
  { match: "phi", limit: 32000 },
  { match: "gemma", limit: 32000 },
  { match: "codellama", limit: 32000 },
  { match: "mixtral", limit: 32000 },
];

/** Ollama model size heuristic when no name match is found. */
function getOllamaContextWindowBySize(model: string): number {
  const m = model.toLowerCase();
  if (m.includes("70b") || m.includes("72b")) return 128000;
  if (m.includes("13b") || m.includes("14b") || m.includes("34b")) return 32000;
  if (m.includes("7b") || m.includes("8b") || m.includes("9b")) return 32000;
  if (m.includes("3b") || m.includes("4b")) return 8000;
  if (m.includes("1b") || m.includes("2b")) return 4000;
  return 32000; // safe default for unknown Ollama models
}

// ──────────────────────────────────────────────
// 3. Token estimation
// ──────────────────────────────────────────────

/**
 * Estimate token count for a given text.
 * Uses ~4 chars/token for Latin text, ~1.5 chars/token for CJK.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

// ──────────────────────────────────────────────
// 4. Public API
// ──────────────────────────────────────────────

function normalize(value?: string): string | undefined {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

/**
 * Get the context window size (total input capacity) for a model.
 * Used by context composers and history trimmers to decide how much to send.
 */
export function getModelContextWindow(provider?: string, model?: string): number {
  const normalizedModel = normalize(model);

  // 1. Exact match
  if (normalizedModel && Object.prototype.hasOwnProperty.call(CONTEXT_WINDOW_LIMITS, normalizedModel)) {
    return CONTEXT_WINDOW_LIMITS[normalizedModel];
  }

  // 2. Substring match
  if (normalizedModel) {
    for (const { match, limit } of CONTEXT_WINDOW_SUBSTRING_LIMITS) {
      if (normalizedModel.includes(match)) {
        return limit;
      }
    }
  }

  // 3. Ollama size heuristic
  if (provider === "ollama" && model) {
    return getOllamaContextWindowBySize(model);
  }

  return 48000; // safe default
}

/**
 * Get a safe max-completion-tokens value clamped to model/provider ceilings.
 * Used when building the LLM request to cap the output length.
 */
export function getSafeMaxCompletionTokens(
  provider?: string,
  model?: string,
  requested?: number,
  fallback: number = DEFAULT_MAX_COMPLETION_TOKENS
): number {
  const target = typeof requested === "number" ? requested : fallback;

  // Collect upper bounds from provider-specific and model-generic tables
  const bounds: number[] = [];

  // Provider-specific lookup
  const normalizedProvider = normalize(provider);
  if (normalizedProvider) {
    const providerLimits = COMPLETION_PROVIDER_LIMITS[normalizedProvider];
    if (providerLimits) {
      const normalizedModel = normalize(model);
      if (normalizedModel && providerLimits.models && Object.prototype.hasOwnProperty.call(providerLimits.models, normalizedModel)) {
        bounds.push(providerLimits.models[normalizedModel]);
      } else if (providerLimits.default !== undefined) {
        bounds.push(providerLimits.default);
      }
    }
  }

  // Model-generic lookup (exact then substring)
  const normalizedModel = normalize(model);
  if (normalizedModel) {
    if (Object.prototype.hasOwnProperty.call(COMPLETION_MODEL_LIMITS, normalizedModel)) {
      bounds.push(COMPLETION_MODEL_LIMITS[normalizedModel]);
    } else {
      for (const { match, limit } of COMPLETION_SUBSTRING_LIMITS) {
        if (normalizedModel.includes(match)) {
          bounds.push(limit);
          break;
        }
      }
    }
  }

  const upperBound = bounds.length > 0 ? Math.min(...bounds) : target;
  return Math.max(MIN_COMPLETION_TOKENS, Math.min(target, upperBound));
}
