// src/utils/llmUtil.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { CoreMessage, generateText, LanguageModel, tool } from "ai";
import { multiProviderSettings } from "../settings";
import { AI_PROVIDERS } from "../types";
import { GetRoamNotesTool, RoamQuerySchema } from "../tools/getRoamNotes";

interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

interface LLMResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolResults?: any[];
}

export class LLMUtil {
  /**
   * Define getRoamNotes tool for AI SDK
   */
  static getRoamNotesTool = tool({
    description: `检索 Roam Research 中的笔记内容。这是一个强大的工具，可以根据多种条件获取用户的笔记数据。

使用指南：
- **获取特定日期笔记**：使用 date 参数 (YYYY-MM-DD)
- **获取日期范围笔记**：使用 startDate 和 endDate 参数
- **获取特定页面**：使用 pageTitle 参数
- **获取当前查看内容**：使用 currentPageContext: true
- **查找引用内容**：使用 referencedPage 参数
- **获取特定块**：使用 blockUid 参数
- **搜索内容**：使用 searchTerm 参数

最佳实践：
- 当用户提到时间（"昨天"、"本周"、"上个月"）时，自动转换为对应的日期参数
- 当用户说"当前笔记"、"这个页面"时，使用 currentPageContext
- 当用户询问某个概念或项目时，使用 referencedPage 查找相关内容
- 总是使用 limit 参数来控制返回数量，避免数据过载`,

    parameters: RoamQuerySchema,

    execute: async (params) => {
      try {
        console.log("🔧 执行 getRoamNotes 工具，参数：", params);
        const result = await GetRoamNotesTool.execute(params);
        return result;
      } catch (error: any) {
        console.error("❌ getRoamNotes 工具执行错误：", error);
        return JSON.stringify({
          success: false,
          error: error.message,
          summary: "工具执行失败",
        });
      }
    },
  });

  private static getProviderClient(config: LLMConfig): LanguageModel {
    const { provider, model, apiKey, baseUrl } = config;

    switch (provider) {
      case "openai":
        const openai = createOpenAI({
          baseURL: baseUrl || "https://api.openai.com/v1",
          apiKey: apiKey,
        });
        return openai(model);

      case "anthropic":
        const anthropic = createAnthropic({
          baseURL: baseUrl || "https://api.anthropic.com/v1",
          apiKey: apiKey,
        });
        return anthropic(model);

      case "groq":
        const groq = createOpenAI({
          baseURL: baseUrl || "https://api.groq.com/openai/v1",
          apiKey: apiKey,
        });
        return groq(model);

      case "xai":
        const xai = createOpenAI({
          baseURL: baseUrl || "https://api.x.ai/v1",
          apiKey: apiKey,
          fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
            const response = await fetch(url, {
              ...init,
              headers: {
                ...init?.headers,
                "Content-Type": "application/json",
              },
            });

            if (!response.ok) {
              console.error(
                "xAI API Error:",
                response.status,
                response.statusText
              );
              const errorText = await response
                .text()
                .catch(() => "No error details available");
              console.error("xAI API Error Details:", errorText);
              throw new Error(
                `xAI API Error: ${response.status} ${response.statusText}`
              );
            }

            return response;
          },
        });
        return xai(model);

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private static convertToAISDKMessages(messages: any[]): CoreMessage[] {
    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));
  }

  static async generateResponse(
    config: LLMConfig,
    messages: any[]
  ): Promise<LLMResult> {
    const { temperature = 0.7, maxTokens = 4000 } = config;

    try {
      const model = this.getProviderClient(config);
      const aiMessages = this.convertToAISDKMessages(messages);

      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      const result = await generateText({
        model,
        system: systemMessage?.content,
        messages: this.convertToAISDKMessages(conversationMessages),
        temperature,
        maxTokens,
      });

      return {
        text: result.text,
        usage: result.usage && {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
      };
    } catch (error: any) {
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  static async generateResponseWithCurrentModel(
    userMessage: string,
    systemMessage: string
  ): Promise<LLMResult> {
    const model = multiProviderSettings.currentModel;
    if (!model) {
      throw new Error(
        "No model selected. Please select a model from the dropdown."
      );
    }

    const providerInfo = await this.getProviderForModel(model);
    if (!providerInfo) {
      throw new Error(
        `Model not found or API key not configured for model: ${model}`
      );
    }

    const config: LLMConfig = {
      provider: providerInfo.provider.id,
      model: model,
      apiKey: providerInfo.apiKey,
      baseUrl: providerInfo.provider.baseUrl,
      temperature: multiProviderSettings.temperature || 0.7,
      maxTokens: multiProviderSettings.maxTokens || 4000,
    };

    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ];

    // Use tool-enabled generation
    return this.generateResponseWithTools(config, messages);
  }

  /**
   * Generate response with AI SDK tool calling support
   */
  static async generateResponseWithTools(
    config: LLMConfig,
    messages: any[]
  ): Promise<LLMResult> {
    const { temperature = 0.7, maxTokens = 4000 } = config;

    console.log("🔧 开始工具调用生成 - 配置:", {
      provider: config.provider,
      model: config.model,
      temperature,
      maxTokens,
      messageCount: messages.length,
    });

    // Check if model supports tools
    const supportsTools = this.modelSupportsTools(
      config.provider,
      config.model
    );
    console.log(
      `🔧 模型工具支持检查: ${config.provider}/${config.model} -> ${
        supportsTools ? "✅ 支持" : "❌ 不支持"
      }`
    );

    try {
      // Ollama doesn't support native tool calling, use simulation
      if (config.provider === "ollama") {
        console.log("🔧 使用 Ollama 工具模拟");
        return this.simulateToolsForOllama(config, messages);
      }

      // For non-tool-supporting models, fall back to regular generation
      if (!supportsTools) {
        console.warn(`⚠️ 模型 ${config.model} 不支持工具调用，回退到常规生成`);
        return this.generateResponse(config, messages);
      }

      const model = this.getProviderClient(config);
      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      console.log("🔧 使用 AI SDK 工具调用生成响应", {
        systemMessageLength: systemMessage?.content?.length || 0,
        conversationMessageCount: conversationMessages.length,
        hasTools: true,
      });

      const result = await generateText({
        model,
        system: systemMessage?.content,
        messages: this.convertToAISDKMessages(conversationMessages),
        tools: {
          getRoamNotes: this.getRoamNotesTool,
        },
        temperature,
        maxTokens,
        maxSteps: 3, // Allow multiple rounds of tool calling
      });

      console.log("🔧 AI SDK 工具调用结果：", {
        hasToolResults: !!result.toolResults,
        toolCallCount: result.toolResults?.length || 0,
        textLength: result.text.length,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : "N/A",
      });

      // Log tool results details if any
      if (result.toolResults && result.toolResults.length > 0) {
        result.toolResults.forEach((toolResult, index) => {
          console.log(`🔧 工具结果 ${index + 1}:`, {
            toolName: toolResult.toolName,
            args: toolResult.args,
            resultLength: JSON.stringify(toolResult.result).length,
          });
        });
      }

      return {
        text: result.text,
        usage: result.usage && {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        toolResults: result.toolResults,
      };
    } catch (error: any) {
      console.error("❌ AI SDK 工具调用生成失败：", {
        provider: config.provider,
        model: config.model,
        error: error.message,
        stack: error.stack,
      });

      // 检查是否是网络连接问题
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("ERR_EMPTY_RESPONSE")
      ) {
        if (config.provider === "xai") {
          throw new Error(`xAI (Grok) 服务连接失败。可能的原因：
1. xAI API 服务暂时不可用
2. 网络连接问题
3. API Key 配置错误

建议：
- 检查网络连接
- 验证 API Key 是否有效
- 尝试其他模型（如 OpenAI 或 Anthropic）
- 稍后重试

原始错误: ${error.message}`);
        }
      }

      // Check if it's a tool-related error and fallback
      if (
        error.message.includes("tool") ||
        error.message.includes("function")
      ) {
        console.warn(`⚠️ 工具调用失败，尝试回退到常规生成: ${error.message}`);
        try {
          return this.generateResponse(config, messages);
        } catch (fallbackError: any) {
          console.error("❌ 回退生成也失败：", fallbackError.message);
          throw new Error(
            `工具调用和回退生成都失败: ${error.message} | 回退错误: ${fallbackError.message}`
          );
        }
      }

      throw new Error(`LLM 工具调用生成失败: ${error.message}`);
    }
  }

  /**
   * Simulate tools for Ollama (which doesn't support native tool calling)
   */
  static async simulateToolsForOllama(
    config: LLMConfig,
    messages: any[]
  ): Promise<LLMResult> {
    try {
      console.log("🔧 为 Ollama 模拟工具调用", {
        model: config.model,
        messageCount: messages.length,
      });

      const userMessage =
        messages.find((m) => m.role === "user")?.content || "";
      const systemMessage =
        messages.find((m) => m.role === "system")?.content || "";

      console.log("🔧 Ollama 消息分析:", {
        userMessageLength: userMessage.length,
        systemMessageLength: systemMessage.length,
        userMessagePreview:
          userMessage.substring(0, 100) +
          (userMessage.length > 100 ? "..." : ""),
      });

      // 1. First, check if the user message needs tool calling
      const toolDetectionPrompt = `分析用户消息，判断是否需要获取 Roam 笔记数据。如果需要，请按以下格式返回工具调用：

TOOL_CALL:getRoamNotes
PARAMETERS:{...json参数...}

参数必须使用以下字段名（不要使用"query"）：
- date: "YYYY-MM-DD" (特定日期)
- startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" (日期范围)
- pageTitle: "页面标题" (特定页面)
- referencedPage: "页面名" (引用某页面的内容)
- searchTerm: "搜索词" (全文搜索)
- currentPageContext: true (当前页面内容)

示例：
- "昨天的笔记" → {"date": "2025-07-06"}
- "上周的工作" → {"startDate": "2025-06-30", "endDate": "2025-07-06"}
- "关于项目的笔记" → {"referencedPage": "项目"}

用户消息：${userMessage}

请分析并返回正确的工具调用参数，或回答"不需要"。`;

      const detectionResult = await this.handleOllamaRequest(config, [
        { role: "system", content: toolDetectionPrompt },
        { role: "user", content: userMessage },
      ]);

      console.log("🔧 Ollama 工具检测结果：", detectionResult.text);

      // 2. Parse if there's a tool call
      if (detectionResult.text.includes("TOOL_CALL:getRoamNotes")) {
        try {
          const paramMatch = detectionResult.text.match(
            /PARAMETERS:\s*({.*?})/
          );
          if (paramMatch) {
            let params = JSON.parse(paramMatch[1]);
            console.log("🔧 解析到原始参数：", params);

            // 处理错误的参数格式
            if (
              params.query &&
              !params.startDate &&
              !params.date &&
              !params.pageTitle &&
              !params.referencedPage &&
              !params.searchTerm
            ) {
              console.log("🔧 检测到错误的 query 参数，转换为正确格式");
              const query = params.query;

              // 根据查询内容推断正确的参数
              if (query.includes("上周") || query.includes("last week")) {
                // 计算上周的日期范围
                const today = new Date();
                const lastWeekEnd = new Date(
                  today.getTime() - (today.getDay() + 1) * 24 * 60 * 60 * 1000
                );
                const lastWeekStart = new Date(
                  lastWeekEnd.getTime() - 6 * 24 * 60 * 60 * 1000
                );

                params = {
                  startDate: lastWeekStart.toISOString().split("T")[0],
                  endDate: lastWeekEnd.toISOString().split("T")[0],
                  limit: 10,
                };
              } else if (
                query.includes("昨天") ||
                query.includes("yesterday")
              ) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                params = {
                  date: yesterday.toISOString().split("T")[0],
                  limit: 10,
                };
              } else if (query.includes("工作") || query.includes("项目")) {
                params = {
                  searchTerm: "工作",
                  limit: 10,
                };
              } else {
                params = {
                  searchTerm: query,
                  limit: 10,
                };
              }
            }

            console.log("🔧 最终工具参数：", params);
            const toolResult = await GetRoamNotesTool.execute(params);
            console.log("🔧 工具执行结果：", toolResult);

            // 3. Add tool result to context and regenerate
            const enhancedPrompt = `${systemMessage}

工具调用结果：
${toolResult}

请基于以上数据回答用户问题。`;

            return this.handleOllamaRequest(config, [
              { role: "system", content: enhancedPrompt },
              { role: "user", content: userMessage },
            ]);
          }
        } catch (error) {
          console.warn("❌ Ollama 工具模拟失败：", error);
        }
      }

      // 4. No tool call needed, process normally
      console.log("🔧 无需工具调用，正常处理");
      return this.handleOllamaRequest(config, messages);
    } catch (error: any) {
      console.error("❌ Ollama 工具模拟错误：", error);
      return this.handleOllamaRequest(config, messages);
    }
  }

  static async getProviderForModel(
    model: string
  ): Promise<{ provider: any; apiKey: string } | null> {
    for (const provider of AI_PROVIDERS) {
      if (provider.models.includes(model)) {
        if (provider.id === "ollama") {
          return { provider, apiKey: "" };
        }

        const apiKey = multiProviderSettings.apiKeys[provider.id];
        if (apiKey && apiKey.trim() !== "") {
          return { provider, apiKey };
        }
      }
    }

    const ollamaProvider = AI_PROVIDERS.find((p) => p.id === "ollama");
    if (ollamaProvider?.supportsDynamicModels) {
      try {
        const dynamicModels = await this.getOllamaModels();
        if (dynamicModels.includes(model)) {
          return { provider: ollamaProvider, apiKey: "" };
        }
      } catch (error) {
        console.log("Failed to check Ollama dynamic models:", error);
      }

      console.log(`Assuming model "${model}" is a local Ollama model`);
      return { provider: ollamaProvider, apiKey: "" };
    }

    return null;
  }

  static async getOllamaModels(baseUrl?: string): Promise<string[]> {
    const url =
      baseUrl ||
      multiProviderSettings.ollamaBaseUrl ||
      "http://localhost:11434";

    try {
      const response = await fetch(`${url}/api/tags`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch Ollama models: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      const models = data.models?.map((model: any) => model.name) || [];
      console.log("Ollama models fetched:", models);
      return models;
    } catch (error: any) {
      console.warn("Failed to fetch Ollama models:", error.message);
      return [];
    }
  }

  static async handleOllamaRequest(
    config: LLMConfig,
    messages: any[]
  ): Promise<LLMResult> {
    const baseUrl =
      multiProviderSettings.ollamaBaseUrl || "http://localhost:11434";
    const { model, temperature = 0.7, maxTokens = 4000 } = config;

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: false,
          options: {
            temperature: temperature,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "");
        throw new Error(
          `Ollama API error: ${response.status} ${error || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.message?.content || "No response generated";

      return {
        text,
        usage: data.usage && {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        },
      };
    } catch (error: any) {
      if (error.message.includes("fetch")) {
        throw new Error(
          `Cannot connect to Ollama service (${baseUrl}). Please ensure:\n1. Ollama is installed and running\n2. Service URL is configured correctly\n3. Model "${model}" is downloaded`
        );
      }
      throw error;
    }
  }

  static async testOllamaConnection(
    baseUrl?: string
  ): Promise<{ isConnected: boolean; models?: string[]; error?: string }> {
    const url =
      baseUrl ||
      multiProviderSettings.ollamaBaseUrl ||
      "http://localhost:11434";

    try {
      const response = await fetch(`${url}/api/tags`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          isConnected: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const models = data.models?.map((model: any) => model.name) || [];

      return {
        isConnected: true,
        models,
      };
    } catch (error: any) {
      return {
        isConnected: false,
        error: error.message || "Connection failed",
      };
    }
  }

  /**
   * Check if a model supports tool calling
   */
  static modelSupportsTools(provider: string, model: string): boolean {
    // Tool-enabled models by provider
    const toolSupportedModels: { [provider: string]: string[] } = {
      openai: [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
      ],
      anthropic: [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
      ],
      groq: [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-groq-70b-8192-tool-use-preview",
        "llama3-groq-8b-8192-tool-use-preview",
      ],
      xai: ["grok-3", "grok-3-beta", "grok-2-vision-1212", "grok-2"],
      // Ollama uses simulation, so technically "supports" tools
      ollama: ["*"], // All models via simulation
    };

    const supportedModels = toolSupportedModels[provider];
    if (!supportedModels) {
      console.warn(`🔧 Unknown provider for tool support check: ${provider}`);
      return false;
    }

    // Ollama supports all models via simulation
    if (provider === "ollama") {
      return true;
    }

    const isSupported = supportedModels.includes(model);
    console.log(
      `🔧 Tool support check - Provider: ${provider}, Model: ${model}, Supported: ${isSupported}`
    );
    return isSupported;
  }
}
