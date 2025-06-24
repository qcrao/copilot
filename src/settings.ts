// src/settings.ts
import { AISettings, AI_PROVIDERS } from "./types";

const DEFAULT_SETTINGS: AISettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "",
  temperature: 0.7,
  maxTokens: 2000,
};

export let aiSettings: AISettings = { ...DEFAULT_SETTINGS };

export function loadInitialSettings(extensionAPI: any) {
  const savedProvider = extensionAPI.settings.get("copilot-provider");
  const savedModel = extensionAPI.settings.get("copilot-model");
  const savedApiKey = extensionAPI.settings.get("copilot-api-key");
  const savedTemperature = extensionAPI.settings.get("copilot-temperature");
  const savedMaxTokens = extensionAPI.settings.get("copilot-max-tokens");

  aiSettings = {
    provider: savedProvider || DEFAULT_SETTINGS.provider,
    model: savedModel || DEFAULT_SETTINGS.model,
    apiKey: savedApiKey || DEFAULT_SETTINGS.apiKey,
    temperature: savedTemperature
      ? parseFloat(savedTemperature)
      : DEFAULT_SETTINGS.temperature,
    maxTokens: savedMaxTokens
      ? parseInt(savedMaxTokens)
      : DEFAULT_SETTINGS.maxTokens,
  };
}

// Helper function to get models for current provider
function getModelsForProvider(providerId: string) {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  return provider ? provider.models : [];
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
  // Get initial models for current provider
  const initialModelItems = getModelsForProvider(aiSettings.provider);
  
  console.log("initPanelConfig - Current provider:", aiSettings.provider);
  console.log("initPanelConfig - Available models:", initialModelItems);
  console.log("initPanelConfig - Current model:", aiSettings.model);
  
  // Ensure current model is valid for current provider
  if (initialModelItems.length > 0) {
    if (!initialModelItems.includes(aiSettings.model)) {
      aiSettings.model = initialModelItems[0];
      extensionAPI.settings.set("copilot-model", aiSettings.model);
      console.log("initPanelConfig - Updated model to:", aiSettings.model);
    }
  } else {
    console.log("initPanelConfig - No models available for provider:", aiSettings.provider);
    // Fallback to OpenAI if no models found
    aiSettings.provider = "openai";
    extensionAPI.settings.set("copilot-provider", "openai");
    const fallbackModels = getModelsForProvider("openai");
    if (fallbackModels.length > 0) {
      aiSettings.model = fallbackModels[0];
      extensionAPI.settings.set("copilot-model", aiSettings.model);
      console.log("initPanelConfig - Fallback to OpenAI with model:", aiSettings.model);
    }
  }
  
  // Get current provider name for display
  const currentProvider = AI_PROVIDERS.find(p => p.id === aiSettings.provider);
  const currentProviderName = currentProvider ? currentProvider.name : AI_PROVIDERS[0].name;
  
  // Re-get models in case provider was changed in fallback
  const finalModelItems = getModelsForProvider(aiSettings.provider);
  console.log("initPanelConfig - Final models for UI:", finalModelItems);
  console.log("initPanelConfig - Final provider name:", currentProviderName);
  console.log("initPanelConfig - Final model:", aiSettings.model);

  return {
    tabTitle: "Roam Copilot",
    settings: [
      {
        id: "copilot-provider",
        name: "AI Provider",
        description: "Choose your AI provider",
        action: {
          type: "select",
          items: AI_PROVIDERS.map((provider) => provider.name),
          value: currentProviderName,
          onChange: (evt: any) => {
            console.log("Provider onChange event:", evt);
            
            // Try different ways to get the value
            const value = evt?.target?.value || evt?.value || evt;
            console.log("Provider changed to:", value);
            
            if (!value) {
              console.log("No value found in event");
              return;
            }

            // Find provider by name and get its id
            const provider = AI_PROVIDERS.find((p) => p.name === value);
            if (!provider) {
              console.log("Provider not found for name:", value);
              return;
            }

            console.log("Provider ID:", provider.id);
            console.log("Provider models:", provider.models);

            aiSettings.provider = provider.id;
            extensionAPI.settings.set("copilot-provider", provider.id);

            // Update model dropdown with new provider's models
            updateModelDropdown(extensionAPI, provider.id);
          },
        },
      },
      {
        id: "copilot-model",
        name: "AI Model",
        description: "Choose the AI model to use",
        action: {
          type: "select",
          items: finalModelItems, // Populate with final models
          value: aiSettings.model,
          onChange: (evt: any) => {
            console.log("Model onChange event:", evt);
            
            const value = evt?.target?.value || evt?.value || evt;
            console.log("Model changed to:", value);
            
            if (!value) {
              console.log("No model value found in event");
              return;
            }

            aiSettings.model = value;
            extensionAPI.settings.set("copilot-model", value);
          },
        },
      },
      {
        id: "copilot-api-key",
        name: "API Key",
        description: "Enter your API key for the selected provider",
        action: {
          type: "input",
          placeholder: "Enter your API key...",
          value: aiSettings.apiKey,
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (value === undefined) return;

            aiSettings.apiKey = value;
            extensionAPI.settings.set("copilot-api-key", value);
          },
        },
      },
      {
        id: "copilot-temperature",
        name: "Temperature",
        description: "Control randomness in responses (0.0 - 1.0)",
        action: {
          type: "input",
          placeholder: "0.7",
          value: aiSettings.temperature?.toString(),
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

            const temp = parseFloat(value);
            if (!isNaN(temp) && temp >= 0 && temp <= 1) {
              aiSettings.temperature = temp;
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
          value: aiSettings.maxTokens?.toString(),
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

            const tokens = parseInt(value);
            if (!isNaN(tokens) && tokens > 0) {
              aiSettings.maxTokens = tokens;
              extensionAPI.settings.set(
                "copilot-max-tokens",
                tokens.toString()
              );
            }
          },
        },
      },
    ],
  };
}
