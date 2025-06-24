// src/settings.ts
import { AISettings, MultiProviderSettings, AI_PROVIDERS } from "./types";

const DEFAULT_SETTINGS: AISettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "",
  temperature: 0.7,
  maxTokens: 2000,
};

// New multi-provider settings
export let multiProviderSettings: MultiProviderSettings = {
  apiKeys: {},
  currentModel: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 2000,
};

export let aiSettings: AISettings = { ...DEFAULT_SETTINGS };

export function loadInitialSettings(extensionAPI: any) {
  // Load new multi-provider settings
  const savedCurrentModel = extensionAPI.settings.get("copilot-current-model");
  const savedTemperature = extensionAPI.settings.get("copilot-temperature");
  const savedMaxTokens = extensionAPI.settings.get("copilot-max-tokens");

  // Load API keys for all providers
  const apiKeys: { [providerId: string]: string } = {};
  AI_PROVIDERS.forEach(provider => {
    const savedKey = extensionAPI.settings.get(`copilot-api-key-${provider.id}`);
    if (savedKey) {
      apiKeys[provider.id] = savedKey;
    }
  });

  multiProviderSettings = {
    apiKeys,
    currentModel: savedCurrentModel || "gpt-4o-mini",
    temperature: savedTemperature ? parseFloat(savedTemperature) : 0.7,
    maxTokens: savedMaxTokens ? parseInt(savedMaxTokens) : 2000,
  };

  // Keep legacy settings for backward compatibility
  const savedProvider = extensionAPI.settings.get("copilot-provider");
  const savedModel = extensionAPI.settings.get("copilot-model");
  const savedApiKey = extensionAPI.settings.get("copilot-api-key");

  aiSettings = {
    provider: savedProvider || DEFAULT_SETTINGS.provider,
    model: savedModel || DEFAULT_SETTINGS.model,
    apiKey: savedApiKey || DEFAULT_SETTINGS.apiKey,
    temperature: multiProviderSettings.temperature || DEFAULT_SETTINGS.temperature,
    maxTokens: multiProviderSettings.maxTokens || DEFAULT_SETTINGS.maxTokens,
  };
}

// Helper function to get models for current provider
function getModelsForProvider(providerId: string) {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  return provider ? provider.models : [];
}

// Helper function to get all available models (only providers with API keys)
export function getAvailableModels(): Array<{model: string, provider: string, providerName: string}> {
  const availableModels: Array<{model: string, provider: string, providerName: string}> = [];
  
  AI_PROVIDERS.forEach(provider => {
    const hasApiKey = multiProviderSettings.apiKeys[provider.id] && 
                     multiProviderSettings.apiKeys[provider.id].trim() !== '';
    
    if (hasApiKey) {
      provider.models.forEach(model => {
        availableModels.push({
          model,
          provider: provider.id,
          providerName: provider.name
        });
      });
    }
  });
  
  return availableModels;
}

// Helper function to update model dropdown
function updateModelDropdown(extensionAPI: any, providerId: string) {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  if (provider && provider.models.length > 0) {
    // If current model is not available for new provider, set to first available model
    if (!provider.models.includes(aiSettings.model)) {
      aiSettings.model = provider.models[0];
      extensionAPI.settings.set("copilot-model", aiSettings.model);
    }
    
    // Try to update model dropdown directly via DOM
    setTimeout(() => {
      try {
        console.log("Searching for model dropdown...");
        
        // Strategy 1: Find all select elements and log them
        const allSelects = document.querySelectorAll('select');
        console.log("Found", allSelects.length, "select elements");
        
        let modelSelect: HTMLSelectElement | null = null;
        
        // Strategy 2: Look for select elements and examine their options
        allSelects.forEach((select, index) => {
          if (select instanceof HTMLSelectElement) {
            const options = Array.from(select.options).map(opt => opt.value);
            console.log(`Select ${index}:`, options);
            
            // Check if this select contains any AI model names
            if (options.some(opt => 
              opt.includes('gpt') || opt.includes('claude') || 
              opt.includes('llama') || opt.includes('grok') || opt.includes('gemma')
            )) {
              modelSelect = select;
              console.log("Found model select at index", index);
            }
          }
        });
        
        // Strategy 3: Look for elements with specific IDs or classes
        if (!modelSelect) {
          const potentialSelects = [
            document.getElementById('copilot-model'),
            document.querySelector('[data-setting-id="copilot-model"]'),
            document.querySelector('.copilot-model'),
            document.querySelector('select[name*="model"]'),
            document.querySelector('select[id*="model"]')
          ].filter(Boolean) as HTMLSelectElement[];
          
          if (potentialSelects.length > 0) {
            modelSelect = potentialSelects[0];
            console.log("Found model select via specific selector");
          }
        }
        
        // Strategy 4: Look for the second select element (assuming first is provider)
        if (!modelSelect && allSelects.length >= 2) {
          modelSelect = allSelects[1] as HTMLSelectElement;
          console.log("Using second select element as model dropdown");
        }
        
        if (modelSelect) {
          console.log("Found model select, updating options");
          console.log("Current options before update:", Array.from(modelSelect.options).map(opt => opt.value));
          
          // Clear existing options
          modelSelect.innerHTML = '';
          
          // Add new options
          provider.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === aiSettings.model) {
              option.selected = true;
            }
            if (modelSelect) {
              modelSelect.appendChild(option);
            }
          });
          
          console.log("Updated model dropdown with:", provider.models);
          
          // Trigger change event
          if (modelSelect) {
            const changeEvent = new Event('change', { bubbles: true });
            modelSelect.dispatchEvent(changeEvent);
          }
        } else {
          console.log("Could not find model dropdown in DOM");
          console.log("Available elements:", Array.from(document.querySelectorAll('*')).map(el => el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ').join('.') : '')).slice(0, 20));
        }
      } catch (error) {
        console.log("DOM update failed:", error);
      }
    }, 200);
  }
}

export function initPanelConfig(extensionAPI: any) {
  // Create settings for all providers
  const providerSettings = AI_PROVIDERS.map(provider => ({
    id: `copilot-api-key-${provider.id}`,
    name: `${provider.name} API Key`,
    description: `Enter your ${provider.name} API key`,
    action: {
      type: "input",
      placeholder: `Enter your ${provider.name} API key...`,
      value: multiProviderSettings.apiKeys[provider.id] || "",
      onChange: (evt: any) => {
        const value = evt?.target?.value;
        if (value === undefined) return;

        multiProviderSettings.apiKeys[provider.id] = value;
        extensionAPI.settings.set(`copilot-api-key-${provider.id}`, value);
      },
    },
  }));

  return {
    tabTitle: "Roam Copilot",
    settings: [
      ...providerSettings,
      {
        id: "copilot-temperature",
        name: "Temperature",
        description: "Control randomness in responses (0.0 - 1.0)",
        action: {
          type: "input",
          placeholder: "0.7",
          value: multiProviderSettings.temperature?.toString(),
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

            const temp = parseFloat(value);
            if (!isNaN(temp) && temp >= 0 && temp <= 1) {
              multiProviderSettings.temperature = temp;
              extensionAPI.settings.set("copilot-temperature", temp.toString());
            }
          },
        },
      },
      {
        id: "copilot-max-tokens",
        name: "Max Tokens",
        description: "Maximum number of tokens in response",
        action: {
          type: "input",
          placeholder: "2000",
          value: multiProviderSettings.maxTokens?.toString(),
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

            const tokens = parseInt(value);
            if (!isNaN(tokens) && tokens > 0) {
              multiProviderSettings.maxTokens = tokens;
              extensionAPI.settings.set("copilot-max-tokens", tokens.toString());
            }
          },
        },
      },
    ],
  };
}
