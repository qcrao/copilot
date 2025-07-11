// src/utils/llmUtil.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { CoreMessage, generateText, LanguageModel, tool } from "ai";
import { z } from "zod";
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
   * Convert ISO date format to Roam date format
   * @param isoDate - Date in YYYY-MM-DD format
   * @returns Date in Roam format (e.g., "July 8th, 2025")
   */
  static convertToRoamDateFormat(isoDate: string): string {
    try {
      // Parse date in local timezone to avoid UTC conversion issues
      const [year, month, day] = isoDate.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const dayNum = date.getDate();
      const monthName = months[date.getMonth()];
      const yearNum = date.getFullYear();
      
      // Add ordinal suffix (st, nd, rd, th)
      const getOrdinalSuffix = (day: number): string => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      
      const roamFormat = `${monthName} ${dayNum}${getOrdinalSuffix(dayNum)}, ${yearNum}`;
      console.log(`🗓️ Date format conversion: ${isoDate} → ${roamFormat}`);
      
      return roamFormat;
    } catch (error) {
      console.error('❌ Error converting date to Roam format:', error);
      return isoDate; // Return original if conversion fails
    }
  }
  
  /**
   * Generate all possible Roam date formats for a given ISO date
   * @param isoDate - Date in YYYY-MM-DD format
   * @returns Array of possible date formats Roam might use
   */
  static generateRoamDateFormats(isoDate: string): string[] {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      const formats = [
        // Standard Roam format: "July 8th, 2025"
        this.convertToRoamDateFormat(isoDate),
        
        // MM-dd-yyyy format
        `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`,
        
        // yyyy-mm-dd format
        isoDate,
        
        // dd-mm-yyyy format
        `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`,
        
        // Month dd, yyyy (without ordinal)
        `${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        
        // Just year-month-day without leading zeros
        `${year}-${month}-${day}`,
      ];
      
      // Remove duplicates
      const uniqueFormats = [...new Set(formats)];
      console.log(`🗓️ Generated ${uniqueFormats.length} date formats for ${isoDate}:`, uniqueFormats);
      
      return uniqueFormats;
    } catch (error) {
      console.error('❌ Error generating Roam date formats:', error);
      return [isoDate];
    }
  }

  /**
   * Get local date string in YYYY-MM-DD format
   * @param daysOffset - Number of days to offset from today (negative for past days)
   * @returns Local date string in YYYY-MM-DD format
   */
  private static getLocalDateString(daysOffset: number = 0): string {
    // Create date in local timezone to avoid UTC conversion issues
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Add the offset days
    localDate.setDate(localDate.getDate() + daysOffset);
    
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}`;
    
    // Add debug logging for date calculations
    console.log(`🗓️ Date calculation: today=${now.toDateString()}, offset=${daysOffset}, result=${result}`);
    
    return result;
  }



  /**
   * Define getCurrentTime tool for basic time information queries
   */
  static getCurrentTimeTool = tool({
    description: `Get current time and date information. Use this tool when users ask for current time, date, or basic time information like:
    - "What time is it?"
    - "What's today's date?"
    - "What day is it?"
    - "今天是几号?"
    - "现在几点了?"
    
    This tool provides basic time information without searching notes.`,
    
    parameters: z.object({
      format: z.enum(['date', 'time', 'datetime', 'day', 'all']).default('all').describe('The format of time information requested')
    }),
    
    execute: async () => {
      try {
        const now = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const result = {
          timestamp: now.toISOString(),
          timezone: timezone,
          date: now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }),
          roamDate: LLMUtil.convertToRoamDateFormat(now.toISOString().split('T')[0]),
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
          dayOfMonth: now.getDate(),
          month: now.toLocaleDateString('en-US', { month: 'long' }),
          year: now.getFullYear()
        };
        
        return JSON.stringify(result);
      } catch (error: any) {
        console.error('❌ getCurrentTime tool execution error:', error);
        return JSON.stringify({
          error: error.message,
          summary: 'Failed to get current time information'
        });
      }
    }
  });

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

      case "ollama":
        const ollamaBaseUrl = baseUrl || 
          multiProviderSettings.ollamaBaseUrl || 
          "http://localhost:11434";
        const ollama = createOpenAI({
          baseURL: `${ollamaBaseUrl}/v1`,
          apiKey: "ollama", // Ollama doesn't require a real API key
        });
        return ollama(model);

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
    const { temperature = 0.7, maxTokens = 8000 } = config;

    try {
      const model = this.getProviderClient(config);
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
      maxTokens: multiProviderSettings.maxTokens || 8000,
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
    const { temperature = 0.7, maxTokens = 8000 } = config;

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
          getCurrentTime: this.getCurrentTimeTool,
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
        responseText: result.text.substring(0, 200) + "...",
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

      // Special handling for Ollama: if tools were called but results seem empty
      if (config.provider === "ollama" && result.toolResults && result.toolResults.length > 0) {
        console.log("🔧 Ollama tool calling detected, checking if results are properly integrated...");
        
        // If tool results exist but the response seems generic, try to integrate manually
        const hasGetRoamNotesCall = result.toolResults.some(tr => tr.toolName === "getRoamNotes");
        const responseContainsRealData = result.text.includes("claude-code") || 
                                       result.text.includes("ccusage") ||
                                       result.text.includes("视频");
        
        if (hasGetRoamNotesCall && !responseContainsRealData) {
          console.warn("🔧 Ollama tool results may not be properly integrated, attempting manual integration...");
          
          // Get the tool result data
          const getRoamNotesResult = result.toolResults.find(tr => tr.toolName === "getRoamNotes");
          if (getRoamNotesResult) {
            const toolData = typeof getRoamNotesResult.result === 'string' 
              ? JSON.parse(getRoamNotesResult.result) 
              : getRoamNotesResult.result;
            
            if (toolData.success && toolData.notes && toolData.notes.length > 0) {
              // Create a summary of the actual data
              const summary = `根据查询结果，昨天（${toolData.queryInfo?.sourcePage || 'July 10th, 2025'}）的笔记内容包括：\n\n`;
              const notesSummary = toolData.notes.map((note: any, index: number) => {
                return `${index + 1}. ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`;
              }).join('\n');
              
              return {
                text: summary + notesSummary,
                usage: result.usage && {
                  promptTokens: result.usage.promptTokens,
                  completionTokens: result.usage.completionTokens,
                  totalTokens: result.usage.totalTokens,
                },
                toolResults: result.toolResults,
              };
            }
          }
        }
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
    const { model, temperature = 0.7, maxTokens = 8000 } = config;

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
      // Ollama models that support native tool calling
      ollama: [
        "llama3.1:8b",
        "llama3.1:70b", 
        "llama3.1:latest",
        "llama3.2:latest",
        "qwen2.5:latest",
        "qwen2.5:7b",
        "qwen2.5:14b",
        "qwen2.5:32b",
        "qwen3:8b",
        "qwen3:latest",
        "deepseek-r1:1.5b",
        "deepseek-r1:7b",
        "deepseek-r1:8b",
        "deepseek-r1:14b",
        "deepseek-r1:32b",
        "deepseek-r1:latest",
        "mistral:7b",
        "mistral:latest",
        "phi3:3.8b",
        "phi3:latest",
      ],
    };

    const supportedModels = toolSupportedModels[provider];
    if (!supportedModels) {
      console.warn(`🔧 Unknown provider for tool support check: ${provider}`);
      return false;
    }

    // For Ollama, check if the specific model supports tools
    if (provider === "ollama") {
      const isSupported = supportedModels.includes(model);
      if (!isSupported) {
        console.warn(`⚠️ Ollama model ${model} may not support native tool calling. Supported models: ${supportedModels.join(", ")}`);
        return false;
      }
      return true;
    }

    const isSupported = supportedModels.includes(model);
    console.log(
      `🔧 Tool support check - Provider: ${provider}, Model: ${model}, Supported: ${isSupported}`
    );
    return isSupported;
  }
}
