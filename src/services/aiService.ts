// src/services/aiService.ts
import { AISettings, AI_PROVIDERS } from "../types";
import { multiProviderSettings } from "../settings";
import { RoamService } from "./roamService";
import { LLMUtil } from "../utils/llmUtil";

export class AIService {
  // Helper function to get provider for a specific model
  static async getProviderForModel(
    model: string
  ): Promise<{ provider: any; apiKey: string } | null> {
    return LLMUtil.getProviderForModel(model);
  }

  // New method that uses the currently selected model from multiProviderSettings
  static async sendMessageWithCurrentModel(
    userMessage: string,
    context: string
  ): Promise<string> {
    const model = multiProviderSettings.currentModel;
    if (!model) {
      throw new Error(
        "No model selected. Please select a model from the dropdown."
      );
    }

    const providerInfo = await this.getProviderForModel(model);
    if (!providerInfo) {
      throw new Error(
        `Model not found or API key not configured for model: ${model}. Please configure the API key in settings.`
      );
    }

    // Ollama doesn't need API key validation
    if (providerInfo.provider.id !== "ollama" && !providerInfo.apiKey) {
      throw new Error(
        `No API key configured for model: ${model}. Please configure the API key in settings.`
      );
    }

    // Add language instruction based on user's manual setting if it's not English
    let finalUserMessage = userMessage;
    const responseLanguage =
      multiProviderSettings.responseLanguage || "English";
    if (responseLanguage !== "English") {
      finalUserMessage =
        userMessage + `\n\nIMPORTANT: Please respond in ${responseLanguage}.`;
    }

    // Use LLMUtil with tool calling for all providers (including Ollama simulation)
    const systemMessage = this.getSystemMessage(context);

    try {
      console.log("🔧 AI Service sending message:", {
        provider: providerInfo.provider.id,
        model: model,
        hasApiKey: !!providerInfo.apiKey,
        userMessageLength: finalUserMessage.length,
        systemMessageLength: systemMessage.length,
      });

      const result = await LLMUtil.generateResponseWithTools(
        {
          provider: providerInfo.provider.id,
          model: model,
          apiKey: providerInfo.apiKey,
          baseUrl: providerInfo.provider.baseUrl,
          temperature: multiProviderSettings.temperature || 0.7,
          maxTokens: multiProviderSettings.maxTokens || 4000,
        },
        [
          { role: "system", content: systemMessage },
          { role: "user", content: finalUserMessage },
        ]
      );

      console.log("🔧 AI Service tool call results:", {
        hasToolResults: !!result.toolResults,
        toolCallCount: result.toolResults?.length || 0,
        responseLength: result.text.length,
        usage: result.usage,
      });

      return result.text;
    } catch (error: any) {
      console.error("❌ AI Service error:", {
        provider: providerInfo.provider.id,
        model: model,
        error: error.message,
        stack: error.stack,
      });

      // Provide more specific error messages
      if (error.message.includes("API key")) {
        throw new Error(
          `API key error (${providerInfo.provider.name}): ${error.message}`
        );
      } else if (
        error.message.includes("rate limit") ||
        error.message.includes("quota")
      ) {
        throw new Error(
          `Rate limit or quota exceeded (${providerInfo.provider.name}): ${error.message}`
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error(
          `Network connection error (${providerInfo.provider.name}): ${error.message}`
        );
      } else {
        throw new Error(
          `AI response failed (${providerInfo.provider.name}): ${error.message}`
        );
      }
    }
  }

  static async sendMessage(
    settings: AISettings,
    userMessage: string,
    context: string
  ): Promise<string> {
    // Ollama doesn't need API key validation
    if (settings.provider !== "ollama" && !settings.apiKey) {
      throw new Error(
        "API key not configured. Please set your API key in the extension settings."
      );
    }

    const systemMessage = this.getSystemMessage(context);

    // Handle Ollama requests separately
    if (settings.provider === "ollama") {
      const result = await LLMUtil.handleOllamaRequest(
        {
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 4000,
        },
        [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ]
      );
      return result.text;
    }

    // Use LLMUtil for other providers
    try {
      const result = await LLMUtil.generateResponse(
        {
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          baseUrl: AI_PROVIDERS.find((p) => p.id === settings.provider)
            ?.baseUrl,
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 4000,
        },
        [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ]
      );

      return result.text;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  private static getSystemMessage(context: string): string {
    return `You are a Roam Research AI assistant with access to the getRoamNotes tool to retrieve note data.

**Tool Call Rules:**
- Time queries: "yesterday"→{date:"YYYY-MM-DD"}, "last week"→{startDate:"YYYY-MM-DD",endDate:"YYYY-MM-DD"}
- Page queries: "this page"→{currentPageContext:true}, "some page"→{pageTitle:"page name"}
- Reference queries: "notes about X"→{referencedPage:"X"}
- Search queries: "content containing X"→{searchTerm:"X"}

**Response Flow:**
1. Immediately call getRoamNotes tool (no explanation needed)
2. Analyze and summarize based on tool results
3. Respond in Chinese for Chinese queries, English for English queries

**Core Principles:**
- Always base responses on real tool data, don't fabricate content
- Reference format: ((uid)) and [[page name]]
- Honestly state when no relevant notes are found
- Encourage user writing and reflection

${context ? `\n**Context:**${context}` : ""}

Start tool calling immediately, don't over-explain intentions.`;
  }

  /**
   * Get available Ollama models from the service
   */
  static async getOllamaModels(baseUrl?: string): Promise<string[]> {
    return LLMUtil.getOllamaModels(baseUrl);
  }

  /**
   * Test Ollama connection and list available models
   */
  static async testOllamaConnection(
    baseUrl?: string
  ): Promise<{ isConnected: boolean; models?: string[]; error?: string }> {
    return LLMUtil.testOllamaConnection(baseUrl);
  }

  static validateSettings(settings: AISettings): {
    isValid: boolean;
    error?: string;
  } {
    // Ollama doesn't need API key validation
    if (settings.provider !== "ollama" && !settings.apiKey?.trim()) {
      return { isValid: false, error: "API key is required" };
    }

    if (!settings.provider) {
      return { isValid: false, error: "AI provider is required" };
    }

    if (!settings.model) {
      return { isValid: false, error: "AI model is required" };
    }

    const provider = AI_PROVIDERS.find((p) => p.id === settings.provider);
    if (!provider) {
      return { isValid: false, error: "Invalid AI provider" };
    }

    if (!provider.models.includes(settings.model)) {
      return { isValid: false, error: "Invalid model for selected provider" };
    }

    return { isValid: true };
  }
}
