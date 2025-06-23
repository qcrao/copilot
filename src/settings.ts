// src/settings.ts
import { AISettings, AI_PROVIDERS } from "./types";

const DEFAULT_SETTINGS: AISettings = {
  provider: "openai",
  model: "gpt-4",
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
  const modelItems = getModelsForProvider(providerId);
  const modelSetting = extensionAPI.settings.panel.get("copilot-model");
  if (modelSetting && modelSetting.action) {
    modelSetting.action.items = modelItems;
    // Set first model as default if current model is not available
    const provider = AI_PROVIDERS.find((p) => p.id === providerId);
    if (
      provider &&
      provider.models.length > 0 &&
      !provider.models.includes(aiSettings.model)
    ) {
      aiSettings.model = provider.models[0];
      extensionAPI.settings.set("copilot-model", aiSettings.model);
    }
  }
}

export function initPanelConfig(extensionAPI: any) {
  // Get initial models for current provider
  const initialModelItems = getModelsForProvider(aiSettings.provider);

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
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

            // Find provider by name and get its id
            const provider = AI_PROVIDERS.find((p) => p.name === value);
            if (!provider) return;

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
          items: initialModelItems, // Populate with initial models
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

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
