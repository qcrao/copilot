// src/utils/iconUtils.ts

// Using official LobeHub AI icons CDN for better quality and authenticity
const ICON_URLS = {
  // Official AI provider icons from LobeHub CDN
  openai: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg',
  anthropic: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/anthropic.svg',
  groq: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/groq.svg',
  grok: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/grok.svg',
  ollama: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/ollama.svg',
  deepseek: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek.svg',
  gemma: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemma.svg'
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
  
  // Groq models (llama without gemma)
  if (normalizedModel.includes('llama') || provider === 'groq') {
    return ICON_URLS.groq;
  }
  
  // xAI models
  if (normalizedModel.includes('grok') || provider === 'xai') {
    return ICON_URLS.grok;
  }
  
  // Default Ollama (local models)
  if (provider === 'ollama') {
    return ICON_URLS.ollama;
  }
  
  return null;
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

  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase();
  
  // Check if it's a local model (Ollama) - this is the key fix
  const isLocal = provider === 'ollama';
  
  // For ANY local model (provider === 'ollama'), determine the specific icon
  if (isLocal) {
    // Specific local model icons
    if (normalizedModel.includes('deepseek')) {
      return { 
        iconUrl: ICON_URLS.deepseek,
        fallbackIcon: '🔍', 
        name: 'DeepSeek', 
        color: '#1A233A',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    if (normalizedModel.includes('gemma')) {
      return { 
        iconUrl: ICON_URLS.gemma,
        fallbackIcon: '💎', 
        name: 'Gemma', 
        color: '#4285F4',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    if (normalizedModel.includes('llama')) {
      return { 
        iconUrl: ICON_URLS.groq,
        fallbackIcon: '⚡', 
        name: 'Llama', 
        color: '#FF6B6B',
        isLocal: true,
        blueprintIcon: null
      };
    }
    
    // Default for other local models
    return {
      iconUrl: ICON_URLS.ollama,
      fallbackIcon: '🏠',
      name: model,
      color: '#2E7D32',
      isLocal: true,
      blueprintIcon: null
    };
  }
  
  // Cloud/API models
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
      name: 'GPT-4', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-3.5')) {
    return { 
      iconUrl: ICON_URLS.openai,
      fallbackIcon: '🤖', 
      name: 'GPT-3.5', 
      color: '#10A37F',
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
      name: 'Claude', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('grok')) {
    return { 
      iconUrl: ICON_URLS.grok,
      fallbackIcon: '🚀', 
      name: 'Grok', 
      color: '#1D9BF0',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('llama') || normalizedModel.includes('gemma')) {
    return { 
      iconUrl: ICON_URLS.groq,
      fallbackIcon: '⚡', 
      name: normalizedModel.includes('llama') ? 'Llama' : 'Gemma',
      color: normalizedModel.includes('llama') ? '#FF6B6B' : '#4285F4',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Default for unknown models
  return { 
    iconUrl: null,
    fallbackIcon: '🤖', 
    name: model, 
    color: '#666',
    isLocal: false,
    blueprintIcon: null
  };
};