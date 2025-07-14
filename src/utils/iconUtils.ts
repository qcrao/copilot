// src/utils/iconUtils.ts

// Using official LobeHub AI icons CDN for better quality and authenticity
const ICON_URLS = {
  // Official AI provider icons from LobeHub CDN
  openai: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg',
  anthropic: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/anthropic.svg',
  groq: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/groq.svg',
  grok: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/grok.svg',
  github: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/github.svg',
  ollama: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/ollama.svg',
  deepseek: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek.svg',
  gemma: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemma.svg',
  qwen: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/qwen.svg'
};

export const getIconUrl = (provider: string, model?: string): string | null => {
  const normalizedModel = model?.toLowerCase() || '';
  
  // OpenAI models
  if (normalizedModel.includes('gpt')) {
    return ICON_URLS.openai;
  }
  
  // Anthropic models
  if (normalizedModel.includes('claude')) {
    return ICON_URLS.anthropic;
  }
  
  // Specific model icons (for local models)
  if (normalizedModel.includes('deepseek')) {
    return ICON_URLS.deepseek;
  }
  
  if (normalizedModel.includes('gemma')) {
    return ICON_URLS.gemma;
  }
  
  if (normalizedModel.includes('qwen')) {
    return ICON_URLS.qwen;
  }
  
  // Groq models (llama without gemma)
  if (normalizedModel.includes('llama') || provider === 'groq') {
    return ICON_URLS.groq;
  }
  
  // xAI models
  if (normalizedModel.includes('grok') || provider === 'xai') {
    return ICON_URLS.grok;
  }
  
  // GitHub models
  if (provider === 'github') {
    return ICON_URLS.github;
  }
  
  // Default Ollama (local models)
  if (provider === 'ollama') {
    return ICON_URLS.ollama;
  }
  
  return null;
};

// Helper function to clean model names by removing date suffixes and other clutter
const cleanModelName = (modelName: string): string => {
  // Remove date patterns like -20241022, -20240229, etc.
  const cleanedName = modelName.replace(/-\d{8}$/, '');
  
  // Additional cleanups for better display
  return cleanedName
    .replace(/gpt-4o-mini/i, 'GPT-4o Mini')
    .replace(/gpt-4o/i, 'GPT-4o')
    .replace(/gpt-4-turbo/i, 'GPT-4 Turbo')
    .replace(/gpt-4/i, 'GPT-4')
    .replace(/gpt-3.5-turbo/i, 'GPT-3.5 Turbo')
    .replace(/claude-3-5-sonnet/i, 'Claude 3.5 Sonnet')
    .replace(/claude-3-5-haiku/i, 'Claude 3.5 Haiku')
    .replace(/claude-3-opus/i, 'Claude 3 Opus')
    .replace(/claude-3-sonnet/i, 'Claude 3 Sonnet')
    .replace(/claude-3-haiku/i, 'Claude 3 Haiku')
    .replace(/llama-3\.3-70b-versatile/i, 'Llama 3.3 70B')
    .replace(/llama-3\.1-70b-versatile/i, 'Llama 3.1 70B')
    .replace(/llama-3\.1-8b-instant/i, 'Llama 3.1 8B')
    .replace(/grok-3-beta/i, 'Grok 3 Beta')
    .replace(/grok-3/i, 'Grok 3')
    .replace(/grok-2/i, 'Grok 2')
    .replace(/Meta-Llama-3\.1-8B-Instruct/i, 'Llama 3.1 8B')
    .replace(/Phi-3\.5-mini-instruct/i, 'Phi-3.5 Mini')
    .replace(/qwen2\.5:latest/i, 'Qwen 2.5')
    .replace(/llama3\.2:latest/i, 'Llama 3.2')
    .replace(/:latest/i, '');
};

export const getModelDisplayInfo = (model?: string, provider?: string) => {
  if (!model) {
    return { 
      iconUrl: null,
      fallbackIcon: '🤖', 
      name: 'AI Assistant', 
      color: '#666',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Clean the model name for display
  const cleanedName = cleanModelName(model);
  
  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase();
  
  // Check if it's a GitHub model
  if (provider === 'github') {
    return { 
      iconUrl: ICON_URLS.github,
      fallbackIcon: '🐙', 
      name: `${cleanedName} (github)`, 
      color: '#24292e',
      isLocal: false,
      blueprintIcon: null
    };
  }
  
  // Check if it's a local model (Ollama) - this is the key fix
  const isLocal = provider === 'ollama';
  
  // For local models, use original name to preserve tags like :latest, :70b
  const displayName = isLocal ? model : cleanedName;
  
  // For ANY local model (provider === 'ollama'), determine the specific icon
  if (isLocal) {
    // Specific local model icons
    if (normalizedModel.includes('deepseek')) {
      return { 
        iconUrl: ICON_URLS.deepseek,
        fallbackIcon: '🔍', 
        name: displayName, 
        color: '#1A233A',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    if (normalizedModel.includes('gemma')) {
      return { 
        iconUrl: ICON_URLS.gemma,
        fallbackIcon: '💎', 
        name: displayName, 
        color: '#4285F4',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    if (normalizedModel.includes('llama')) {
      return { 
        iconUrl: ICON_URLS.groq,
        fallbackIcon: '⚡', 
        name: displayName,
        color: '#FF6B6B',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    if (normalizedModel.includes('qwen')) {
      return { 
        iconUrl: ICON_URLS.qwen,
        fallbackIcon: '🧠', 
        name: displayName,
        color: '#6366F1',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    // Default for other local models
    return {
      iconUrl: ICON_URLS.ollama,
      fallbackIcon: '🏠',
      name: cleanedName,
      color: '#2E7D32',
      isLocal: true,
      blueprintIcon: null
    };
  }
  
  // Cloud/API models - use cleaned names
  if (normalizedModel.includes('gpt-4o-mini')) {
    return { 
      iconUrl: ICON_URLS.openai,
      fallbackIcon: '🤖', 
      name: 'GPT-4o Mini', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-4o')) {
    return { 
      iconUrl: ICON_URLS.openai,
      fallbackIcon: '🤖', 
      name: 'GPT-4o', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-4')) {
    return { 
      iconUrl: ICON_URLS.openai,
      fallbackIcon: '🤖', 
      name: cleanedName,
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-3.5')) {
    return { 
      iconUrl: ICON_URLS.openai,
      fallbackIcon: '🤖', 
      name: 'GPT-3.5 Turbo',
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3.5-sonnet')) {
    return { 
      iconUrl: ICON_URLS.anthropic,
      fallbackIcon: '🧠', 
      name: 'Claude 3.5 Sonnet', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3.5-haiku')) {
    return { 
      iconUrl: ICON_URLS.anthropic,
      fallbackIcon: '🧠', 
      name: 'Claude 3.5 Haiku', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3-opus')) {
    return { 
      iconUrl: ICON_URLS.anthropic,
      fallbackIcon: '🧠', 
      name: 'Claude 3 Opus', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3-sonnet')) {
    return { 
      iconUrl: ICON_URLS.anthropic,
      fallbackIcon: '🧠', 
      name: 'Claude 3 Sonnet', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3-haiku')) {
    return { 
      iconUrl: ICON_URLS.anthropic,
      fallbackIcon: '🧠', 
      name: 'Claude 3 Haiku', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude')) {
    return { 
      iconUrl: ICON_URLS.anthropic,
      fallbackIcon: '🧠', 
      name: cleanedName,
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('grok')) {
    return { 
      iconUrl: ICON_URLS.grok,
      fallbackIcon: '🚀', 
      name: cleanedName,
      color: '#1D9BF0',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('llama') || normalizedModel.includes('gemma')) {
    return { 
      iconUrl: ICON_URLS.groq,
      fallbackIcon: '⚡', 
      name: cleanedName,
      color: normalizedModel.includes('llama') ? '#FF6B6B' : '#4285F4',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Default for unknown models
  return { 
    iconUrl: null,
    fallbackIcon: '🤖', 
    name: cleanedName, 
    color: '#666',
    isLocal: false,
    blueprintIcon: null
  };
};