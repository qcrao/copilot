// src/settings.ts
import React from "react";
import { AISettings, MultiProviderSettings, AI_PROVIDERS } from "./types";

// Default settings for legacy AISettings
const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "",
  temperature: 0.7,
  maxTokens: 8000,
};

// Default settings for MultiProviderSettings
const DEFAULT_MULTI_PROVIDER_SETTINGS: MultiProviderSettings = {
  currentModel: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 8000,
  responseLanguage: "English",
  apiKeys: {},
  ollamaBaseUrl: "http://localhost:11434",
  customModels: {},
};

// New multi-provider settings
export let multiProviderSettings: MultiProviderSettings = {
  ...DEFAULT_MULTI_PROVIDER_SETTINGS,
};

export let aiSettings: AISettings = { ...DEFAULT_AI_SETTINGS };

export function loadInitialSettings(extensionAPI: any) {
  // Load new multi-provider settings
  const savedCurrentModel = extensionAPI.settings.get("copilot-current-model");
  const savedTemperature = extensionAPI.settings.get("copilot-temperature");
  const savedMaxTokens = extensionAPI.settings.get("copilot-max-tokens");
  const savedResponseLanguage = extensionAPI.settings.get(
    "copilot-response-language"
  );
  const savedOllamaBaseUrl = extensionAPI.settings.get(
    "copilot-ollama-base-url"
  );

  // Load API keys for all providers
  const apiKeys: { [providerId: string]: string } = {};
  AI_PROVIDERS.forEach((provider) => {
    const savedKey = extensionAPI.settings.get(
      `copilot-api-key-${provider.id}`
    );
    if (savedKey) {
      apiKeys[provider.id] = savedKey;
    }
  });

  // Load custom models for all providers
  const customModels: { [providerId: string]: string } = {};
  AI_PROVIDERS.forEach((provider) => {
    const savedCustomModels = extensionAPI.settings.get(
      `copilot-custom-models-${provider.id}`
    );
    if (savedCustomModels) {
      customModels[provider.id] = savedCustomModels;
    }
  });

  // For initial loading, use synchronous model checking
  const availableModels = getSyncAvailableModelsWithKeys(apiKeys, customModels);
  let currentModel = savedCurrentModel || "gpt-4o-mini";

  // If the saved model doesn't have an API key, use the first available model
  if (!availableModels.some((m) => m.model === currentModel)) {
    currentModel =
      availableModels.length > 0 ? availableModels[0].model : "gpt-4o-mini";
  }

  multiProviderSettings = {
    apiKeys,
    currentModel,
    temperature: savedTemperature ? parseFloat(savedTemperature) : 0.7,
    maxTokens: savedMaxTokens ? parseInt(savedMaxTokens) : 8000,
    responseLanguage: savedResponseLanguage || "English",
    ollamaBaseUrl: savedOllamaBaseUrl || "http://localhost:11434",
    customModels,
  };

  // Keep legacy settings for backward compatibility
  const savedProvider = extensionAPI.settings.get("copilot-provider");
  const savedModel = extensionAPI.settings.get("copilot-model");
  const savedApiKey = extensionAPI.settings.get("copilot-api-key");

  aiSettings = {
    provider: savedProvider || DEFAULT_AI_SETTINGS.provider,
    model: savedModel || DEFAULT_AI_SETTINGS.model,
    apiKey: savedApiKey || DEFAULT_AI_SETTINGS.apiKey,
    temperature:
      multiProviderSettings.temperature || DEFAULT_AI_SETTINGS.temperature,
    maxTokens: multiProviderSettings.maxTokens || DEFAULT_AI_SETTINGS.maxTokens,
  };
}

// Helper function to get models for a provider (custom or default)
function getProviderModels(provider: any, customModels: { [providerId: string]: string }): string[] {
  // Check if there are custom models for this provider
  const customModelList = customModels[provider.id];
  if (customModelList && customModelList.trim()) {
    // Parse comma-separated custom models
    return customModelList.split(',').map(model => model.trim()).filter(model => model);
  }
  
  // Use default models
  return provider.models;
}

// Synchronous version for initial loading (uses fallback models for Ollama)
function getSyncAvailableModelsWithKeys(
  apiKeys: { [providerId: string]: string },
  customModels: { [providerId: string]: string } = {}
): Array<{ model: string; provider: string; providerName: string }> {
  const availableModels: Array<{
    model: string;
    provider: string;
    providerName: string;
  }> = [];

  AI_PROVIDERS.forEach((provider) => {
    // Ollama doesn't need API key, directly available
    const hasApiKey =
      provider.id === "ollama" ||
      (apiKeys[provider.id] && apiKeys[provider.id].trim() !== "");

    if (hasApiKey) {
      const models = getProviderModels(provider, customModels);
      
      // For Ollama, skip if no models defined (will be loaded dynamically)
      if (provider.id === "ollama" && models.length === 0) {
        return;
      }

      models.forEach((model) => {
        availableModels.push({
          model,
          provider: provider.id,
          providerName: provider.name,
        });
      });
    }
  });

  return availableModels;
}

// Helper function to get available models with given API keys
async function getAvailableModelsWithKeys(
  apiKeys: { [providerId: string]: string },
  customModels: { [providerId: string]: string } = {}
): Promise<Array<{ model: string; provider: string; providerName: string }>> {
  const availableModels: Array<{
    model: string;
    provider: string;
    providerName: string;
  }> = [];

  for (const provider of AI_PROVIDERS) {
    // Ollama doesn't need API key, directly available
    const hasApiKey =
      provider.id === "ollama" ||
      (apiKeys[provider.id] && apiKeys[provider.id].trim() !== "");

    if (hasApiKey) {
      let models = getProviderModels(provider, customModels);

      // For Ollama, try to fetch dynamic models if no custom models are set
      if (provider.id === "ollama" && provider.supportsDynamicModels && !customModels[provider.id]) {
        try {
          const { AIService } = await import("./services/aiService");
          const dynamicModels = await AIService.getOllamaModels();
          if (dynamicModels.length > 0) {
            models = dynamicModels;
          }
        } catch (error: any) {
          if (error.message === "CORS_ERROR") {
            console.warn(
              "CORS error detected for Ollama. Skipping Ollama models from model selector. " +
                "To fix this, configure CORS on your Ollama instance by setting OLLAMA_ORIGINS=* environment variable."
            );
          } else {
            console.warn(
              "Failed to connect to Ollama. Skipping Ollama models from model selector. " +
                "Please ensure Ollama is running and accessible.",
              error
            );
          }

          // Skip adding any Ollama models when any error occurs (CORS, network, etc.)
          continue;
        }
      }

      models.forEach((model) => {
        availableModels.push({
          model,
          provider: provider.id,
          providerName: provider.name,
        });
      });
    }
  }

  return availableModels;
}

// Helper function to get all available models (only providers with API keys)
export async function getAvailableModels(): Promise<
  Array<{ model: string; provider: string; providerName: string }>
> {
  return await getAvailableModelsWithKeys(
    multiProviderSettings.apiKeys,
    multiProviderSettings.customModels || {}
  );
}

export function initPanelConfig(extensionAPI: any) {
  // Create settings for all providers
  const providerSettings: any[] = [];

  AI_PROVIDERS.forEach((provider) => {
    // Ollama is a local service, doesn't need API key, but needs service address configuration
    if (provider.id === "ollama") {
      providerSettings.push({
        id: `copilot-ollama-base-url`,
        name: `${provider.name} Service URL`,
        description: React.createElement(
          React.Fragment,
          {},
          "Enter your local Ollama service URL",
          React.createElement("br"),
          React.createElement("small", {}, "Default: http://localhost:11434"),
          React.createElement("br"),
          React.createElement(
            "a",
            {
              href: "https://ollama.com/",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "📥 Download Ollama"
          ),
          " | ",
          React.createElement(
            "a",
            {
              href: "https://ollama.com/library",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "🤖 Browse Models"
          )
        ),
        action: {
          type: "input",
          placeholder: "http://localhost:11434",
          value:
            multiProviderSettings.ollamaBaseUrl || "http://localhost:11434",
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (value !== undefined) {
              multiProviderSettings.ollamaBaseUrl =
                value || "http://localhost:11434";
              extensionAPI.settings.set(
                "copilot-ollama-base-url",
                multiProviderSettings.ollamaBaseUrl
              );
            }
          },
        },
      });

      // Add custom models input for Ollama
      providerSettings.push({
        id: `copilot-custom-models-${provider.id}`,
        name: `${provider.name} Custom Models`,
        description: React.createElement(
          React.Fragment,
          {},
          "Enter custom models for Ollama (comma-separated)",
          React.createElement("br"),
          React.createElement("small", {}, "Leave empty to auto-detect models"),
          React.createElement("br"),
          React.createElement("small", {}, "Example: llama3.2:1b, codellama:7b")
        ),
        action: {
          type: "input",
          placeholder: "llama3.2:1b, codellama:7b",
          value: multiProviderSettings.customModels?.[provider.id] || "",
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (value === undefined) return;

            if (!multiProviderSettings.customModels) {
              multiProviderSettings.customModels = {};
            }
            multiProviderSettings.customModels[provider.id] = value;
            extensionAPI.settings.set(`copilot-custom-models-${provider.id}`, value);
          },
        },
      });

      return; // Skip API key setting for Ollama
    }

    // Build description with clickable links for API-based providers
    const links: React.ReactElement[] = [];
    if (provider.apiKeyUrl) {
      links.push(
        React.createElement(
          "a",
          {
            key: "api-key",
            href: provider.apiKeyUrl,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "🔑 Get API Key"
        )
      );
    }
    if (provider.billingUrl) {
      links.push(
        React.createElement(
          "a",
          {
            key: "billing",
            href: provider.billingUrl,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "💳 View Usage"
        )
      );
    }

    const description =
      links.length > 0
        ? React.createElement(
            React.Fragment,
            {},
            `Enter your ${provider.name} API key`,
            React.createElement("br"),
            ...links.map((link, index) =>
              React.createElement(
                React.Fragment,
                { key: index },
                index > 0 ? " | " : "",
                link
              )
            )
          )
        : `Enter your ${provider.name} API key`;

    // Add API key input setting
    providerSettings.push({
      id: `copilot-api-key-${provider.id}`,
      name: `${provider.name} API Key`,
      description: description,
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
    });

    // Add custom models input setting
    const defaultModels = provider.models.join(", ");
    providerSettings.push({
      id: `copilot-custom-models-${provider.id}`,
      name: `${provider.name} Custom Models`,
      description: React.createElement(
        React.Fragment,
        {},
        `Enter custom models for ${provider.name} (comma-separated)`,
        React.createElement("br"),
        React.createElement("small", {}, `Default: ${defaultModels}`),
        React.createElement("br"),
        React.createElement("small", {}, "Leave empty to use default models")
      ),
      action: {
        type: "input",
        placeholder: defaultModels,
        value: multiProviderSettings.customModels?.[provider.id] || "",
        onChange: (evt: any) => {
          const value = evt?.target?.value;
          if (value === undefined) return;

          if (!multiProviderSettings.customModels) {
            multiProviderSettings.customModels = {};
          }
          multiProviderSettings.customModels[provider.id] = value;
          extensionAPI.settings.set(`copilot-custom-models-${provider.id}`, value);
        },
      },
    });
  });

  return {
    tabTitle: "Roam Copilot",
    settings: [
      ...providerSettings,
      {
        id: "copilot-response-language",
        name: "Response Language",
        description: React.createElement(
          React.Fragment,
          {},
          "Language for AI responses",
          React.createElement("br"),
          React.createElement("small", {}, "You can enter any language (e.g., English, Chinese, Japanese, French, etc.)")
        ),
        action: {
          type: "input",
          placeholder: "English",
          value: multiProviderSettings.responseLanguage || "English",
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (value !== undefined) {
              multiProviderSettings.responseLanguage = value || "English";
              extensionAPI.settings.set("copilot-response-language", multiProviderSettings.responseLanguage);
            }
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
          placeholder: "8000",
          value: multiProviderSettings.maxTokens?.toString(),
          onChange: (evt: any) => {
            const value = evt?.target?.value;
            if (!value) return;

            const tokens = parseInt(value);
            if (!isNaN(tokens) && tokens > 0) {
              multiProviderSettings.maxTokens = tokens;
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
