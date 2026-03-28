// src/utils/iconUtils.ts

// Using official LobeHub AI icons CDN for better quality and authenticity
const ICON_URLS = {
  // Official AI provider icons from LobeHub CDN
  openai: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg",
  anthropic:
    "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/anthropic.svg",
  groq: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/groq.svg",
  grok: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/grok.svg",
  github: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/github.svg",
  ollama: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/ollama.svg",
  deepseek:
    "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek.svg",
  gemma: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemma.svg",
  gemini: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemini.svg",
  qwen: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/qwen.svg",
};

export const getIconUrl = (provider: string, model?: string): string | null => {
  const normalizedModel = model?.toLowerCase() || "";

  // OpenAI models
  if (normalizedModel.includes("gpt")) {
    return ICON_URLS.openai;
  }

  // Anthropic models
  if (normalizedModel.includes("claude")) {
    return ICON_URLS.anthropic;
  }

  // Specific model icons (for local models)
  if (normalizedModel.includes("deepseek")) {
    return ICON_URLS.deepseek;
  }

  if (normalizedModel.includes("gemma")) {
    return ICON_URLS.gemma;
  }

  if (normalizedModel.includes("qwen")) {
    return ICON_URLS.qwen;
  }

  // Gemini models
  if (normalizedModel.includes("gemini") || provider === "gemini") {
    return ICON_URLS.gemini;
  }

  // Groq models (llama without gemma)
  if (normalizedModel.includes("llama") || provider === "groq") {
    return ICON_URLS.groq;
  }

  // xAI models
  if (normalizedModel.includes("grok") || provider === "xai") {
    return ICON_URLS.grok;
  }

  // GitHub models
  if (provider === "github") {
    return ICON_URLS.github;
  }

  // Default Ollama (local models)
  if (provider === "ollama") {
    return ICON_URLS.ollama;
  }

  return null;
};

// Helper function to get display name for provider
export const getProviderDisplayName = (provider?: string): string => {
  if (provider === "custom-openai") {
    return "custom";
  }
  return provider || "unknown";
};

// Helper function to clean model names by removing date suffixes and other clutter
const cleanModelName = (modelName: string): string => {
  // Remove date patterns like -20241022, -20240229, etc.
  const cleanedName = modelName.replace(/-\d{8}$/, "");

  // Additional cleanups for better display
  return cleanedName
    // OpenAI models (order matters: more specific first)
    .replace(/gpt-5-mini/i, "GPT-5 Mini")
    .replace(/gpt-5/i, "GPT-5")
    .replace(/gpt-4\.1-nano/i, "GPT-4.1 Nano")
    .replace(/gpt-4\.1-mini/i, "GPT-4.1 Mini")
    .replace(/gpt-4\.1/i, "GPT-4.1")
    .replace(/o4-mini/i, "o4-mini")
    .replace(/o3-mini/i, "o3-mini")
    .replace(/gpt-4o-mini/i, "GPT-4o Mini")
    .replace(/gpt-4o/i, "GPT-4o")
    .replace(/gpt-4-turbo/i, "GPT-4 Turbo")
    .replace(/gpt-4/i, "GPT-4")
    .replace(/gpt-3.5-turbo/i, "GPT-3.5 Turbo")
    // Anthropic models
    .replace(/claude-sonnet-4-6/i, "Claude Sonnet 4")
    .replace(/claude-haiku-4-5/i, "Claude Haiku 4.5")
    .replace(/claude-3-5-sonnet/i, "Claude 3.5 Sonnet")
    .replace(/claude-3-5-haiku/i, "Claude 3.5 Haiku")
    .replace(/claude-3-opus/i, "Claude 3 Opus")
    .replace(/claude-3-sonnet/i, "Claude 3 Sonnet")
    .replace(/claude-3-haiku/i, "Claude 3 Haiku")
    // Llama models
    .replace(/llama-3\.3-70b-versatile/i, "Llama 3.3 70B")
    .replace(/llama-3\.1-70b-versatile/i, "Llama 3.1 70B")
    .replace(/llama-3\.1-8b-instant/i, "Llama 3.1 8B")
    .replace(/Meta-Llama-3\.1-8B-Instruct/i, "Llama 3.1 8B")
    .replace(/Phi-3\.5-mini-instruct/i, "Phi-3.5 Mini")
    // xAI models
    .replace(/grok-4/i, "Grok 4")
    .replace(/grok-3-beta/i, "Grok 3 Beta")
    .replace(/grok-3/i, "Grok 3")
    .replace(/grok-2-1212/i, "Grok 2")
    .replace(/grok-2/i, "Grok 2")
    // Gemini models
    .replace(/gemini-2\.5-flash/i, "Gemini 2.5 Flash")
    .replace(/gemini-2\.5-pro/i, "Gemini 2.5 Pro")
    .replace(/gemini-2\.0-flash-exp/i, "Gemini 2.0 Flash (Exp)")
    .replace(/gemini-2\.0-flash/i, "Gemini 2.0 Flash")
    .replace(/gemini-1\.5-flash/i, "Gemini 1.5 Flash")
    .replace(/gemini-1\.5-pro/i, "Gemini 1.5 Pro")
    // DeepSeek models
    .replace(/deepseek-chat/i, "DeepSeek Chat")
    .replace(/deepseek-reasoner/i, "DeepSeek Reasoner")
    // Local models
    .replace(/qwen2\.5:latest/i, "Qwen 2.5")
    .replace(/llama3\.2:latest/i, "Llama 3.2")
    .replace(/:latest/i, "");
};

export const getModelDisplayInfo = (model?: string, provider?: string) => {
  if (!model) {
    return {
      iconUrl: null,
      fallbackIcon: "🤖",
      name: "AI Assistant",
      color: "#666",
      isLocal: false,
      blueprintIcon: null,
    };
  }

  // Clean the model name for display
  const cleanedName = cleanModelName(model);

  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase();

  // Check if it's a local model (Ollama)
  const isLocal = provider === "ollama";

  // For local models, use original name to preserve tags like :latest, :70b
  const displayName = isLocal ? model : cleanedName;

  // For Ollama models, determine the specific icon based on model name
  if (isLocal) {
    // Specific local model icons based on model name
    if (normalizedModel.includes("deepseek")) {
      return {
        iconUrl: ICON_URLS.deepseek,
        fallbackIcon: "🔍",
        name: displayName,
        color: "#1A233A",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    if (normalizedModel.includes("gemma")) {
      return {
        iconUrl: ICON_URLS.gemma,
        fallbackIcon: "💎",
        name: displayName,
        color: "#4285F4",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    if (normalizedModel.includes("gpt")) {
      return {
        iconUrl: ICON_URLS.openai,
        fallbackIcon: "🤖",
        name: displayName,
        color: "#10A37F",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    if (normalizedModel.includes("llama")) {
      return {
        iconUrl: ICON_URLS.groq,
        fallbackIcon: "⚡",
        name: displayName,
        color: "#FF6B6B",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    if (normalizedModel.includes("qwen")) {
      return {
        iconUrl: ICON_URLS.qwen,
        fallbackIcon: "🧠",
        name: displayName,
        color: "#6366F1",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    if (normalizedModel.includes("claude")) {
      return {
        iconUrl: ICON_URLS.anthropic,
        fallbackIcon: "🧠",
        name: displayName,
        color: "#CC785C",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    if (normalizedModel.includes("gemini")) {
      return {
        iconUrl: ICON_URLS.gemini,
        fallbackIcon: "💎",
        name: displayName,
        color: "#4285F4",
        isLocal: true,
        blueprintIcon: null,
      };
    }

    // Default for other local models
    return {
      iconUrl: ICON_URLS.ollama,
      fallbackIcon: "🏠",
      name: displayName,
      color: "#2E7D32",
      isLocal: true,
      blueprintIcon: null,
    };
  }

  // Non-Ollama providers: use provider-based icons regardless of model name
  switch (provider) {
    case "openai":
      return {
        iconUrl: ICON_URLS.openai,
        fallbackIcon: "🤖",
        name: cleanedName,
        color: "#10A37F",
        isLocal: false,
        blueprintIcon: null,
      };

    case "anthropic":
      return {
        iconUrl: ICON_URLS.anthropic,
        fallbackIcon: "🧠",
        name: cleanedName,
        color: "#CC785C",
        isLocal: false,
        blueprintIcon: null,
      };

    case "groq":
      return {
        iconUrl: ICON_URLS.groq,
        fallbackIcon: "⚡",
        name: cleanedName,
        color: "#FF6B6B",
        isLocal: false,
        blueprintIcon: null,
      };

    case "xai":
      return {
        iconUrl: ICON_URLS.grok,
        fallbackIcon: "🚀",
        name: cleanedName,
        color: "#1D9BF0",
        isLocal: false,
        blueprintIcon: null,
      };

    case "github":
      return {
        iconUrl: ICON_URLS.github,
        fallbackIcon: "🐙",
        name: cleanedName,
        color: "#24292e",
        isLocal: false,
        blueprintIcon: null,
      };

    case "gemini":
      return {
        iconUrl: ICON_URLS.gemini,
        fallbackIcon: "💎",
        name: cleanedName,
        color: "#4285F4",
        isLocal: false,
        blueprintIcon: null,
      };

    case "deepseek":
      return {
        iconUrl: ICON_URLS.deepseek,
        fallbackIcon: "🔍",
        name: cleanedName,
        color: "#1A233A",
        isLocal: false,
        blueprintIcon: null,
      };

    case "custom-openai":
      // Smart icon matching for custom OpenAI provider based on model name
      let iconUrl = ICON_URLS.openai; // Default to OpenAI icon
      let fallbackIcon = "🤖";

      // Choose icon based on model name
      if (normalizedModel.includes("deepseek")) {
        iconUrl = ICON_URLS.deepseek;
        fallbackIcon = "🔍";
      } else if (normalizedModel.includes("claude")) {
        iconUrl = ICON_URLS.anthropic;
        fallbackIcon = "🧠";
      } else if (normalizedModel.includes("gemini")) {
        iconUrl = ICON_URLS.gemini;
        fallbackIcon = "💎";
      } else if (normalizedModel.includes("llama")) {
        iconUrl = ICON_URLS.groq;
        fallbackIcon = "⚡";
      } else if (normalizedModel.includes("grok")) {
        iconUrl = ICON_URLS.grok;
        fallbackIcon = "🚀";
      } else if (normalizedModel.includes("qwen")) {
        iconUrl = ICON_URLS.qwen;
        fallbackIcon = "🧠";
      } else if (normalizedModel.includes("gemma")) {
        iconUrl = ICON_URLS.gemma;
        fallbackIcon = "💎";
      }

      // All custom OpenAI models use purple color regardless of model type
      return {
        iconUrl,
        fallbackIcon,
        name: cleanedName,
        color: "#6366F1", // Purple for all custom-openai models
        isLocal: false,
        blueprintIcon: null,
      };

    default:
      // Fallback for unknown providers
      return {
        iconUrl: null,
        fallbackIcon: "🤖",
        name: cleanedName,
        color: "#666",
        isLocal: false,
        blueprintIcon: null,
      };
  }
};
