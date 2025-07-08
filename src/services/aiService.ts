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
      console.log("🔧 AI Service 发送消息:", {
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

      console.log("🔧 AI Service 工具调用结果:", {
        hasToolResults: !!result.toolResults,
        toolCallCount: result.toolResults?.length || 0,
        responseLength: result.text.length,
        usage: result.usage,
      });

      return result.text;
    } catch (error: any) {
      console.error("❌ AI Service 错误:", {
        provider: providerInfo.provider.id,
        model: model,
        error: error.message,
        stack: error.stack,
      });

      // Provide more specific error messages
      if (error.message.includes("API key")) {
        throw new Error(
          `API 密钥错误 (${providerInfo.provider.name}): ${error.message}`
        );
      } else if (
        error.message.includes("rate limit") ||
        error.message.includes("quota")
      ) {
        throw new Error(
          `请求频率限制或配额不足 (${providerInfo.provider.name}): ${error.message}`
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error(
          `网络连接错误 (${providerInfo.provider.name}): ${error.message}`
        );
      } else {
        throw new Error(
          `AI 响应失败 (${providerInfo.provider.name}): ${error.message}`
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
    return `你是 Roam Research 的AI助手，拥有 getRoamNotes 工具获取笔记数据。

**工具调用规则：**
- 时间查询："昨天"→{date:"YYYY-MM-DD"}，"上周"→{startDate:"YYYY-MM-DD",endDate:"YYYY-MM-DD"}
- 页面查询："这个页面"→{currentPageContext:true}，"某页面"→{pageTitle:"页面名"}
- 引用查询："关于X的笔记"→{referencedPage:"X"}
- 搜索查询："包含X的内容"→{searchTerm:"X"}

**响应流程：**
1. 立即调用 getRoamNotes 工具（无需解释）
2. 基于工具结果分析和总结
3. 用中文回应中文查询，英文回应英文查询

**核心原则：**
- 始终基于真实工具数据，不编造内容
- 引用格式：((uid)) 和 [[页面名]]
- 空结果时诚实说明没有相关笔记
- 鼓励用户写作和反思

${context ? `\n**上下文：**${context}` : ""}

立即开始工具调用，不要过度解释意图。`;
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
