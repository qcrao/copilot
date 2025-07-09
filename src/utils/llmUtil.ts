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
    description: `Retrieve note content from Roam Research. This is a powerful tool that can fetch user's note data based on various conditions.

Usage Guide:
- **Get notes from specific date**: Use date parameter (YYYY-MM-DD)
- **Get notes from date range**: Use startDate and endDate parameters
- **Get specific page**: Use pageTitle parameter
- **Get current viewing content**: Use currentPageContext: true
- **Find referenced content**: Use referencedPage parameter
- **Get specific block**: Use blockUid parameter
- **Search content**: Use searchTerm parameter

Best Practices:
- When user mentions time ("yesterday", "this week", "last month"), automatically convert to corresponding date parameters
- When user says "current notes", "this page", use currentPageContext
- When user asks about a concept or project, use referencedPage to find related content
- Always use limit parameter to control return count and avoid data overload`,

    parameters: RoamQuerySchema,

    execute: async (params) => {
      try {
        console.log("🔧 Executing getRoamNotes tool with params:", params);
        const result = await GetRoamNotesTool.execute(params);
        return result;
      } catch (error: any) {
        console.error("❌ getRoamNotes tool execution error:", error);
        return JSON.stringify({
          success: false,
          error: error.message,
          summary: "Tool execution failed",
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

    console.log("🔧 Starting tool call generation - config:", {
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
      `🔧 Model tool support check: ${config.provider}/${config.model} -> ${
        supportsTools ? "✅ Supported" : "❌ Not supported"
      }`
    );

    try {
      // Ollama doesn't support native tool calling, use simulation
      if (config.provider === "ollama") {
        console.log("🔧 Using Ollama tool simulation");
        return this.simulateToolsForOllama(config, messages);
      }

      // For non-tool-supporting models, fall back to regular generation
      if (!supportsTools) {
        console.warn(`⚠️ Model ${config.model} does not support tool calling, falling back to regular generation`);
        return this.generateResponse(config, messages);
      }

      const model = this.getProviderClient(config);
      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      console.log("🔧 Using AI SDK tool call response generation", {
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

      console.log("🔧 AI SDK tool call results:", {
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
          console.log(`🔧 Tool result ${index + 1}:`, {
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
      console.error("❌ AI SDK tool call generation failed:", {
        provider: config.provider,
        model: config.model,
        error: error.message,
        stack: error.stack,
      });

      // Check if it's a network connection issue
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("ERR_EMPTY_RESPONSE")
      ) {
        if (config.provider === "xai") {
          throw new Error(`xAI (Grok) service connection failed. Possible reasons:
1. xAI API service temporarily unavailable
2. Network connection issue
3. API Key configuration error

Suggestions:
- Check network connection
- Verify API Key validity
- Try other models (like OpenAI or Anthropic)
- Retry later

Original error: ${error.message}`);
        }
      }

      // Check if it's a tool-related error and fallback
      if (
        error.message.includes("tool") ||
        error.message.includes("function")
      ) {
        console.warn(`⚠️ Tool call failed, attempting fallback to regular generation: ${error.message}`);
        try {
          return this.generateResponse(config, messages);
        } catch (fallbackError: any) {
          console.error("❌ Fallback generation also failed:", fallbackError.message);
          throw new Error(
            `Both tool call and fallback generation failed: ${error.message} | Fallback error: ${fallbackError.message}`
          );
        }
      }

      throw new Error(`LLM tool call generation failed: ${error.message}`);
    }
  }

  /**
   * Format tool results for better understanding by Ollama models
   */
  static formatToolResultForOllama(toolResult: string): string {
    try {
      const parsed = JSON.parse(toolResult);
      
      console.log("🔧 Tool result parsing status:", {
        success: parsed.success,
        notesCount: parsed.notes?.length || 0,
        queryType: parsed.queryInfo?.queryType,
        hasWarnings: parsed.warnings?.length > 0
      });
      
      if (!parsed.success || !parsed.notes || parsed.notes.length === 0) {
        const errorMessage = `No relevant note content found. ${parsed.error || ''}`;
        console.log("🔧 Tool result: no data, returning error message");
        return errorMessage;
      }

      let formatted = `=== Note Query Results ===\n`;
      formatted += `Query Type: ${parsed.queryInfo?.queryType || 'unknown'}\n`;
      if (parsed.queryInfo?.sourcePage) {
        formatted += `Query Page: ${parsed.queryInfo.sourcePage}\n`;
      }
      formatted += `Results Found: ${parsed.notes.length} entries\n\n`;
      formatted += `The following are all relevant notes about "${parsed.queryInfo?.sourcePage || 'query content'}":\n\n`;

      // Format each note
      parsed.notes.forEach((note: any, index: number) => {
        formatted += `【Note ${index + 1}】`;
        
        if (note.title) {
          formatted += ` From page: ${note.title}\n`;
        } else {
          formatted += `\n`;
        }
        
        if (note.content) {
          // Clean up the content - remove excessive whitespace and format nicely
          const cleanContent = note.content
            .replace(/\n\s*\n/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();
          formatted += `Content: ${cleanContent}\n`;
        }
        
        if (note.uid) {
          formatted += `Reference ID: ((${note.uid}))\n`;
        }
        
        if (note.hasMore) {
          formatted += `[Note: Content truncated, actual content is longer]\n`;
        }
        
        formatted += `---\n\n`;
      });

      if (parsed.warnings && parsed.warnings.length > 0) {
        formatted += `\nWarnings:\n`;
        parsed.warnings.forEach((warning: string) => {
          formatted += `- ${warning}\n`;
        });
      }

      formatted += `\n=== Summary Instructions ===\n`;
      formatted += `Please summarize the main content about "${parsed.queryInfo?.sourcePage || 'query content'}" based on the above ${parsed.notes.length} notes.\n`;
      formatted += `These notes contain all relevant information that the user has recorded in Roam Research.\n`;
      formatted += `Please extract key information and organize it into a clear response.\n`;

      console.log("🔧 Tool result formatting complete:", {
        originalLength: toolResult.length,
        formattedLength: formatted.length,
        notesProcessed: parsed.notes.length,
        hasStructuredFormat: formatted.includes("=== Note Query Results ==="),
        includesSummaryInstruction: formatted.includes("=== Summary Instructions ===")
      });

      return formatted;
    } catch (error) {
      console.warn("🔧 Tool result formatting failed:", error);
      console.log("🔧 Falling back to raw tool result");
      return `Tool execution result:\n${toolResult}`;
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
      console.log("🔧 Simulating tool calls for Ollama", {
        model: config.model,
        messageCount: messages.length,
      });

      const userMessage =
        messages.find((m) => m.role === "user")?.content || "";
      const systemMessage =
        messages.find((m) => m.role === "system")?.content || "";

      console.log("🔧 Ollama message analysis:", {
        userMessageLength: userMessage.length,
        systemMessageLength: systemMessage.length,
        userMessagePreview:
          userMessage.substring(0, 100) +
          (userMessage.length > 100 ? "..." : ""),
      });

      // 1. First, check if the user message needs tool calling
      const toolDetectionPrompt = `You are a professional tool call analysis assistant. Please carefully analyze the user message to determine if Roam note data needs to be retrieved.

User message: ${userMessage}

=== Tool Call Analysis Guide ===
If the user mentions the following content, tool calling is needed:
- Page names or references (like [[PageName]], #tags, mentioning specific people/concepts)
- Time-related queries (yesterday, last week, specific date notes)
- Search for specific content (notes containing certain keywords)
- Current page related (this page, current notes)

=== Tool Call Format ===
If tool calling is needed, return strictly in the following format:

TOOL_CALL:getRoamNotes
PARAMETERS:{...json parameters...}

Parameter field descriptions:
- date: "YYYY-MM-DD" (query notes from specific date)
- startDate + endDate: "YYYY-MM-DD" (query date range)
- pageTitle: "Page Title" (query specific page)
- referencedPage: "Page Name" (query all content referencing a page)
- searchTerm: "Search Term" (full text search)
- currentPageContext: true (get current page content)

=== Parameter Selection Examples ===
- "yesterday's notes" → {"date": "2025-07-08"}
- "last week's work" → {"startDate": "2025-06-30", "endDate": "2025-07-06"}
- "notes about project" → {"referencedPage": "project"}
- "look at [[Cao Da]]" → {"referencedPage": "Cao Da"}
- "content containing Go language" → {"searchTerm": "Go language"}

If no tool calling is needed, answer "not needed".

Please analyze and return the correct tool call parameters:`;

      const detectionResult = await this.handleOllamaRequest(config, [
        { role: "system", content: toolDetectionPrompt },
        { role: "user", content: userMessage },
      ]);

      console.log("🔧 Ollama tool detection result:", detectionResult.text);

      // 2. Parse if there's a tool call
      if (detectionResult.text.includes("TOOL_CALL:getRoamNotes")) {
        try {
          const paramMatch = detectionResult.text.match(
            /PARAMETERS:\s*({.*?})/
          );
          if (paramMatch) {
            let params = JSON.parse(paramMatch[1]);
            console.log("🔧 Parsed raw parameters:", params);

            // Handle incorrect parameter format
            if (
              params.query &&
              !params.startDate &&
              !params.date &&
              !params.pageTitle &&
              !params.referencedPage &&
              !params.searchTerm
            ) {
              console.log("🔧 Detected incorrect query parameter, converting to correct format");
              const query = params.query;

              // Infer correct parameters based on query content
              if (query.includes("上周") || query.includes("last week")) {
                // Calculate last week's date range
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
              } else if (query.includes("工作") || query.includes("项目") || query.includes("work") || query.includes("project")) {
                params = {
                  searchTerm: query.includes("工作") ? "工作" : "work",
                  limit: 10,
                };
              } else {
                params = {
                  searchTerm: query,
                  limit: 10,
                };
              }
            }

            console.log("🔧 Final tool parameters:", params);
            const toolResult = await GetRoamNotesTool.execute(params);
            console.log("🔧 Tool execution result (raw JSON):", {
              length: toolResult.length,
              preview: toolResult.substring(0, 200) + (toolResult.length > 200 ? "..." : ""),
              isValidJson: (() => {
                try {
                  JSON.parse(toolResult);
                  return true;
                } catch {
                  return false;
                }
              })()
            });

            // 3. Format tool result for better understanding
            const formattedToolResult = this.formatToolResultForOllama(toolResult);
            console.log("🔧 Formatted tool result:", {
              length: formattedToolResult.length,
              preview: formattedToolResult.substring(0, 300) + (formattedToolResult.length > 300 ? "..." : ""),
              improvedReadability: formattedToolResult.includes("=== Note Query Results ===")
            });

            // 4. Add tool result to context and regenerate
            const enhancedPrompt = `You are a Roam Research AI assistant that has successfully retrieved the user's queried note data.

=== Tool Call Results ===
${formattedToolResult}

=== Key Instructions ===
The tool call results above contain the real note data from the user's query. Please strictly follow these requirements when answering:

1. **Must answer based on tool results**: Only use the real data from the tool call results above
2. **Summarize main content**: If relevant notes are found, please summarize key information and main content
3. **Quote specific content**: You can quote specific note content and UIDs (like ((uid)))
4. **Answer honestly**: If no relevant content is found, please clearly state so
5. **Do not fabricate**: Never fabricate or speculate about non-existent information

=== Answer Format ===
Please answer in the following format:
- First state the query results (how many relevant notes were found)
- Then summarize the main content
- Finally quote specific note content if applicable

User question: ${userMessage}

Please answer based on the above tool call results:`;

            console.log("🔧 Generated enhanced prompt:", {
              originalSystemMessageLength: systemMessage.length,
              enhancedPromptLength: enhancedPrompt.length,
              includesToolResult: enhancedPrompt.includes("=== Tool Call Results ==="),
              includesInstructions: enhancedPrompt.includes("=== Key Instructions ===")
            });

            const finalResponse = await this.handleOllamaRequest(config, [
              { role: "system", content: enhancedPrompt },
              { role: "user", content: `Answer based on tool call results: ${userMessage}` },
            ]);

            console.log("🔧 Ollama final response analysis:", {
              responseLength: finalResponse.text.length,
              preview: finalResponse.text.substring(0, 200) + (finalResponse.text.length > 200 ? "..." : ""),
              containsToolData: finalResponse.text.includes("曹大") || finalResponse.text.includes("Go") || finalResponse.text.includes("performance") || finalResponse.text.includes("性能"),
              respondsToQuery: finalResponse.text.includes("main content") || finalResponse.text.includes("notes") || finalResponse.text.includes("found") || finalResponse.text.includes("主要内容") || finalResponse.text.includes("笔记") || finalResponse.text.includes("找到"),
              isGenericResponse: finalResponse.text.includes("no clear public information") || finalResponse.text.includes("possible situations") || finalResponse.text.includes("没有明确的公开信息") || finalResponse.text.includes("可能是以下情况")
            });

            return finalResponse;
          }
        } catch (error) {
          console.warn("❌ Ollama tool simulation failed:", error);
        }
      }

      // 4. No tool call needed, process normally
      console.log("🔧 No tool call needed, processing normally");
      const normalResponse = await this.handleOllamaRequest(config, messages);
      
      console.log("🔧 Ollama normal response analysis:", {
        responseLength: normalResponse.text.length,
        preview: normalResponse.text.substring(0, 200) + (normalResponse.text.length > 200 ? "..." : ""),
        isNormalFlow: true
      });
      
      return normalResponse;
    } catch (error: any) {
      console.error("❌ Ollama tool simulation error:", error);
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
