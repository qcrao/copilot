// src/utils/llmUtil.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { CoreMessage, generateText, LanguageModel, tool } from "ai";
import { z } from "zod";
import { multiProviderSettings } from "../settings";
import { AI_PROVIDERS } from "../types";
import { GetRoamNotesTool, RoamQuerySchema } from "../tools/getRoamNotes";
import { RoamService } from "../services/roamService";

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
   * Get local date range for a specific period
   * @param period - The period type ('last_week', 'this_week', etc.)
   * @returns Object with startDate and endDate in YYYY-MM-DD format
   */
  private static getLocalDateRange(period: string): { startDate: string; endDate: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    console.log(`🗓️ Date range calculation: period=${period}, today=${today.toDateString()}, dayOfWeek=${dayOfWeek}`);
    
    switch (period) {
      case 'last_week':
        // Last week: Monday to Sunday of previous week
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - dayOfWeek - 6); // Go to last Monday
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Go to last Sunday
        
        const lastWeekRange = {
          startDate: this.dateToLocalString(lastWeekStart),
          endDate: this.dateToLocalString(lastWeekEnd)
        };
        console.log(`🗓️ Last week range:`, lastWeekRange);
        return lastWeekRange;
        
      case 'this_week':
        // This week: Monday to today
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - dayOfWeek + 1); // Go to this Monday
        
        const thisWeekRange = {
          startDate: this.dateToLocalString(thisWeekStart),
          endDate: this.getLocalDateString(0)
        };
        console.log(`🗓️ This week range:`, thisWeekRange);
        return thisWeekRange;
        
      default:
        const defaultRange = {
          startDate: this.getLocalDateString(0),
          endDate: this.getLocalDateString(0)
        };
        console.log(`🗓️ Default range:`, defaultRange);
        return defaultRange;
    }
  }

  /**
   * Convert Date object to local date string
   * @param date - Date object
   * @returns Local date string in YYYY-MM-DD format
   */
  private static dateToLocalString(date: Date): string {
    // Ensure we're working with local date components
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}`;
    console.log(`🗓️ Date conversion: input=${date.toDateString()}, result=${result}`);
    
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
    
    execute: async (params) => {
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
    const startTime = performance.now();
    
    try {
      const parsed = JSON.parse(toolResult);
      
      console.log("🔧 Tool result parsing status:", {
        success: parsed.success,
        notesCount: parsed.notes?.length || 0,
        queryType: parsed.queryInfo?.queryType,
        hasWarnings: parsed.warnings?.length > 0,
        executionTime: parsed.executionTime
      });
      
      if (!parsed.success || !parsed.notes || parsed.notes.length === 0) {
        const errorMessage = `No relevant note content found. ${parsed.error || ''}`;
        console.log("❌ Tool result: no data found:", {
          success: parsed.success,
          error: parsed.error,
          warnings: parsed.warnings
        });
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
        
        // Add date information with proper Roam format
        if (note.date) {
          const roamDate = note.date.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? LLMUtil.convertToRoamDateFormat(note.date)
            : note.date;
          formatted += `Date: ${roamDate}\n`;
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

      const formattingTime = performance.now() - startTime;
      console.log("✅ Tool result formatting complete:", {
        originalLength: toolResult.length,
        formattedLength: formatted.length,
        notesProcessed: parsed.notes.length,
        hasStructuredFormat: formatted.includes("=== Note Query Results ==="),
        includesSummaryInstruction: formatted.includes("=== Summary Instructions ==="),
        formattingTime: `${formattingTime.toFixed(2)}ms`
      });

      return formatted;
    } catch (error: any) {
      const formattingTime = performance.now() - startTime;
      console.error("❌ Tool result formatting failed:", {
        error: error.message,
        stack: error.stack,
        inputLength: toolResult.length,
        formattingTime: `${formattingTime.toFixed(2)}ms`
      });
      
      return `Tool execution result (formatting failed):\n${toolResult}`;
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

      // Get the LAST user message (current input), not the first one from history
      const userMessages = messages.filter((m) => m.role === "user");
      const userMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : "";
      const systemMessage =
        messages.find((m) => m.role === "system")?.content || "";

      console.log("🔧 Ollama message analysis:", {
        userMessageLength: userMessage.length,
        systemMessageLength: systemMessage.length,
        userMessagePreview:
          userMessage.substring(0, 100) +
          (userMessage.length > 100 ? "..." : ""),
      });

      // 1. Enhanced tool detection with better Chinese understanding
      const toolDetectionPrompt = `You are a professional tool call analysis assistant specialized in understanding multilingual queries, especially Chinese. Analyze the user message to determine which tool should be called.

User message: ${userMessage}

=== Available Tools ===

**getCurrentTime tool** - For basic time/date information WITHOUT note content:
- Pure time queries: "What time?", "现在几点?", "今天几号?"
- Date queries: "What's today's date?", "今天是几号?", "今天星期几?"
- NO mention of notes, writing, or content

**getRoamNotes tool** - For retrieving note data and content:
- Yesterday notes: "昨天的笔记", "昨天我记了什么", "yesterday's notes"
- Today's writing: "今天写了什么", "今天记了哪些", "what did I write today"
- Week queries: "上周的笔记", "这周写了什么", "last week's notes"
- Content search: "查看笔记", "看下内容", "关于..." 
- General queries: "我记了哪些", "写了什么", "show me my notes"

=== Enhanced Chinese Pattern Recognition ===

**时间类 (Time-only):**
- 今天几号/几日 (纯时间查询)
- 现在几点 (纯时间查询)
- 什么时间 (纯时间查询)

**笔记类 (Notes-related):**
- 昨天 + [笔记/内容/写了/记了] → getRoamNotes
- 今天 + [写了/记了/内容] → getRoamNotes  
- [上/这]周 + [笔记/内容] → getRoamNotes
- 查看/看下 + [笔记/内容] → getRoamNotes
- 我记了哪些/写了什么 → getRoamNotes

=== Response Format ===

For getCurrentTime:
TOOL_CALL:getCurrentTime
PARAMETERS:{"format": "all"}

For getRoamNotes (yesterday example):
TOOL_CALL:getRoamNotes
PARAMETERS:{"date": "${this.getLocalDateString(-1)}"}

No tool needed:
no tool needed

Analyze the SEMANTIC INTENT focusing on whether user wants time info or note content:`;

      const detectionResult = await this.handleOllamaRequest(config, [
        { role: "system", content: toolDetectionPrompt },
        { role: "user", content: userMessage },
      ]);

      console.log("🔧 Ollama tool detection result:", detectionResult.text);

      // 2. Handle getCurrentTime tool call
      if (detectionResult.text.includes("TOOL_CALL:getCurrentTime")) {
        console.log("🔧 AI detected time query, calling getCurrentTime tool");
        
        const timeResult = await LLMUtil.getCurrentTimeTool.execute({ format: 'all' }, { 
          toolCallId: 'ai-time-call', 
          messages: [] 
        });
        console.log("🔧 getCurrentTime tool result:", timeResult);
        
        const enhancedPrompt = `You are a helpful AI assistant that has retrieved current time information.

=== Current Time Information ===
${timeResult}

=== User Query ===
${userMessage}

Please provide a helpful response based on the current time information above. Answer in Chinese if the user asked in Chinese.`;

        const finalResult = await this.handleOllamaRequest(config, [
          { role: "system", content: enhancedPrompt },
          { role: "user", content: userMessage },
        ]);

        return {
          text: finalResult.text,
          usage: finalResult.usage,
          toolResults: [{ toolName: "getCurrentTime", args: { format: 'all' }, result: timeResult }],
        };
      }

      // 3. Smart fallback: Infer tool parameters if detection missed obvious patterns
      const shouldInferTool = this.shouldInferToolCall(userMessage, detectionResult.text);
      
      if (shouldInferTool) {
        console.log("🔧 Smart fallback: Inferring tool parameters for missed detection");
        
        const inferredParams = this.inferToolParameters(userMessage);
        console.log("🔧 Inferred parameters:", inferredParams);
        
        return await this.executeToolAndRespond(config, userMessage, inferredParams);
      }

      // 3. Parse if there's a tool call
      if (detectionResult.text.includes("TOOL_CALL:getRoamNotes")) {
        try {
          const paramMatch = detectionResult.text.match(
            /PARAMETERS:\s*({.*?})/
          );
          if (paramMatch) {
            let params = JSON.parse(paramMatch[1]);
            console.log("🔧 Parsed raw parameters:", params);

            // Enhanced parameter processing
            console.log("🔧 Processing detected tool parameters:", params);
            
            // Enhance parameters with smart inference if needed
            params = this.enhanceToolParameters(params, userMessage);

            console.log("🔧 Final tool parameters:", params);
            
            // Add debug info for date queries
            if (params.date) {
              const roamDate = LLMUtil.convertToRoamDateFormat(params.date);
              console.log("🔧 Date query debug info:", {
                isoDate: params.date,
                roamDate: roamDate,
                userQuery: userMessage
              });
            }
            
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

            // Execute tool and generate response
            return await this.executeToolAndRespond(config, userMessage, params);
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
   * Determine if we should infer tool parameters for missed detection
   */
  private static shouldInferToolCall(userMessage: string, detectionResponse: string): boolean {
    // Skip if tool call already detected
    if (detectionResponse.includes("TOOL_CALL:")) {
      return false;
    }
    
    // Enhanced note-related patterns with better Chinese support
    const notePatterns = [
      // Yesterday patterns
      /昨天.*[笔记内容写了记了]/,
      /yesterday.*[notes?|wrote|recorded|content]/i,
      /昨日.*[内容笔记]/,
      
      // Today patterns
      /今天.*[写了记了写的记的]/,
      /today.*[wrote|notes?|recorded]/i,
      
      // Week patterns
      /[上这本]周.*[笔记内容写了]/,
      /[last|this] week.*[notes?|wrote|content]/i,
      
      // Generic note queries
      /[记了写了].*哪些/,
      /查看.*[笔记内容]/,
      /看下.*[内容笔记]/,
      /[show|find].*[notes?|content]/i,
      
      // Topic-based queries
      /[关于有关].*的.*[笔记内容]/,
      /about.*[notes?|content]/i
    ];
    
    // Exclude pure time queries (more comprehensive)
    const timeOnlyPatterns = [
      /^今天[几多少]*[号日号]/,
      /^现在[几多少]*点/,
      /^what time/i,
      /^what.*date/i,
      /^什么时间/,
      /^[今现]天天[几多少]*[号日]/,
      /^current.*[time|date]/i
    ];
    
    const hasNotePattern = notePatterns.some(pattern => pattern.test(userMessage));
    const isTimeOnly = timeOnlyPatterns.some(pattern => pattern.test(userMessage));
    
    console.log("🧠 Tool inference check:", {
      userMessage: userMessage.substring(0, 50) + "...",
      hasNotePattern,
      isTimeOnly,
      shouldInfer: hasNotePattern && !isTimeOnly
    });
    
    return hasNotePattern && !isTimeOnly;
  }
  
  /**
   * Infer tool parameters from user message with enhanced Chinese support
   */
  private static inferToolParameters(userMessage: string): any {
    console.log("🧠 Inferring tool parameters from:", userMessage);
    
    // Use lowercase for enhanced pattern matching
    console.log("🧠 Processing normalized query:", userMessage.toLowerCase().slice(0, 50) + "...");
    
    // Enhanced yesterday patterns
    const yesterdayPatterns = [
      /昨天.*[笔记内容写了记了]/,
      /yesterday.*[notes?|wrote|recorded]/i,
      /昨日.*[内容笔记]/
    ];
    
    if (yesterdayPatterns.some(pattern => pattern.test(userMessage))) {
      const yesterdayDate = this.getLocalDateString(-1);
      console.log("🧠 Detected yesterday query, date:", yesterdayDate);
      return {
        date: yesterdayDate,
        limit: 10,
        includeChildren: true,
        includeReferences: false
      };
    }
    
    // Enhanced today patterns  
    const todayPatterns = [
      /今天.*[写了记了写的记的]/,
      /today.*[wrote|notes?|recorded]/i,
      /今日.*[内容笔记]/
    ];
    
    if (todayPatterns.some(pattern => pattern.test(userMessage))) {
      const todayDate = this.getLocalDateString(0);
      console.log("🧠 Detected today query, date:", todayDate);
      return {
        date: todayDate,
        limit: 10,
        includeChildren: true,
        includeReferences: false
      };
    }
    
    // Enhanced last week patterns
    const lastWeekPatterns = [
      /[上上个]周.*[笔记内容写了]/,
      /last week.*[notes?|wrote|content]/i,
      /上星期.*[内容笔记]/
    ];
    
    if (lastWeekPatterns.some(pattern => pattern.test(userMessage))) {
      const dateRange = this.getLocalDateRange('last_week');
      console.log("🧠 Detected last week query, range:", dateRange);
      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 15,
        includeChildren: true,
        includeReferences: false
      };
    }
    
    // Enhanced this week patterns
    const thisWeekPatterns = [
      /[这本]周.*[笔记内容写了]/,
      /this week.*[notes?|wrote|content]/i,
      /本星期.*[内容笔记]/
    ];
    
    if (thisWeekPatterns.some(pattern => pattern.test(userMessage))) {
      const dateRange = this.getLocalDateRange('this_week');
      console.log("🧠 Detected this week query, range:", dateRange);
      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 15,
        includeChildren: true,
        includeReferences: false
      };
    }
    
    // Enhanced specific topic queries
    const topicPatterns = [
      /[关于有关].*的.*[笔记内容]/,
      /about.*[notes?|content]/i,
      /.*相关.*[笔记内容]/
    ];
    
    for (const pattern of topicPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        // Extract topic from the query
        let topic = userMessage
          .replace(/[看下查看我记了哪些的关于有关相关笔记内容]/g, '')
          .replace(/[about|notes?|content]/gi, '')
          .trim();
        
        if (topic) {
          console.log("🧠 Detected topic query for:", topic);
          return {
            referencedPage: topic,
            limit: 20,
            includeChildren: true,
            includeReferences: false
          };
        }
      }
    }
    
    // Generic content search - clean up common query words
    const cleanedQuery = userMessage
      .replace(/[看下查看我记了哪些的内容笔记帮我]/g, '')
      .replace(/[show me|look at|find|search|notes?|content]/gi, '')
      .trim();
      
    console.log("🧠 Using generic search term:", cleanedQuery || userMessage);
    return {
      searchTerm: cleanedQuery || userMessage,
      limit: 20,
      includeChildren: true,
      includeReferences: false
    };
  }
  
  /**
   * Enhance tool parameters with smart inference
   */
  private static enhanceToolParameters(params: any, userMessage: string): any {
    // If no core parameters provided, try to infer
    if (!params.date && !params.startDate && !params.pageTitle && 
        !params.referencedPage && !params.searchTerm && !params.currentPageContext) {
      console.log("🧠 No core parameters found, inferring from message");
      return this.inferToolParameters(userMessage);
    }
    
    // Handle legacy query parameter
    if (params.query && !params.date && !params.searchTerm) {
      console.log("🧠 Converting legacy query parameter:", params.query);
      return this.inferToolParameters(params.query);
    }
    
    return params;
  }
  
  /**
   * Execute tool and generate response with comprehensive monitoring
   */
  private static async executeToolAndRespond(config: any, userMessage: string, toolParams: any): Promise<any> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const startTime = performance.now();
    
    console.log(`🚀 Starting tool execution [${executionId}]:`, {
      userMessage: userMessage.substring(0, 100) + (userMessage.length > 100 ? "..." : ""),
      toolParams,
      provider: config.provider,
      model: config.model
    });
    
    try {
      // Phase 1: Parameter validation and enhancement
      const paramValidationStart = performance.now();
      
      if (toolParams.date) {
        const roamDate = LLMUtil.convertToRoamDateFormat(toolParams.date);
        console.log(`🗓️ [${executionId}] Date parameters:`, {
          isoDate: toolParams.date,
          roamDate: roamDate,
          userQuery: userMessage.substring(0, 50) + "..."
        });
      }
      
      const paramValidationTime = performance.now() - paramValidationStart;
      
      // Phase 2: Tool execution
      const toolExecutionStart = performance.now();
      console.log(`🔧 [${executionId}] Executing getRoamNotes tool...`);
      
      const toolResult = await GetRoamNotesTool.execute(toolParams);
      const toolExecutionTime = performance.now() - toolExecutionStart;
      
      console.log(`✅ [${executionId}] Tool execution completed:`, {
        executionTime: `${toolExecutionTime.toFixed(2)}ms`,
        resultLength: toolResult.length,
        success: toolResult.includes('"success":true'),
        preview: toolResult.substring(0, 200) + "..."
      });
      
      // Phase 3: Result formatting
      const formattingStart = performance.now();
      console.log(`🎨 [${executionId}] Formatting tool result for Ollama...`);
      
      const formattedToolResult = this.formatToolResultForOllama(toolResult);
      const formattingTime = performance.now() - formattingStart;
      
      // Phase 4: Context preparation
      const contextStart = performance.now();
      console.log(`🎯 [${executionId}] Preparing minimal context...`);
      
      const toolCallContext = await RoamService.getToolCallContext();
      const minimalContext = RoamService.formatContextForAI(toolCallContext, 1000);
      const contextTime = performance.now() - contextStart;
      
      // Phase 5: Query description generation
      const queryDate = toolParams.date ? LLMUtil.convertToRoamDateFormat(toolParams.date) :
                       toolParams.startDate && toolParams.endDate ? `${toolParams.startDate} to ${toolParams.endDate}` :
                       toolParams.searchTerm ? `search: "${toolParams.searchTerm}"` :
                       toolParams.referencedPage ? `page: "${toolParams.referencedPage}"` :
                       "specified criteria";
      
      // Phase 6: Prompt generation
      const enhancedPrompt = `You are a Roam Research AI assistant. Based on the user's query "${userMessage}", you have retrieved relevant note data.

=== RETRIEVED DATA FOR: ${queryDate} ===
${formattedToolResult}

${minimalContext ? `=== Context (Selected Text Only) ===\n${minimalContext}\n` : ""}

=== RESPONSE REQUIREMENTS ===
**CRITICAL**: Base your response ONLY on the retrieved data above.

1. **Query target**: ${queryDate}
2. **Data source**: Only use note content, UIDs and information from the search results
3. **Date clarity**: Clearly state you're showing content from ${queryDate}
4. **Honest reporting**: If no relevant notes found, state this clearly
5. **Context isolation**: Ignore any current page information or unrelated contexts

**Respond in Chinese based exclusively on the retrieved data above.**`;
      
      console.log(`📝 [${executionId}] Generated enhanced prompt:`, {
        promptLength: enhancedPrompt.length,
        includesToolResult: enhancedPrompt.includes("=== RETRIEVED DATA"),
        includesContext: !!minimalContext
      });
      
      // Phase 7: Final response generation
      const responseStart = performance.now();
      console.log(`🤖 [${executionId}] Generating final response...`);
      
      const finalResponse = await this.handleOllamaRequest(config, [
        { role: "system", content: enhancedPrompt },
        { role: "user", content: userMessage },
      ]);
      
      const responseTime = performance.now() - responseStart;
      const totalTime = performance.now() - startTime;
      
      console.log(`✅ [${executionId}] Tool execution pipeline completed:`, {
        totalTime: `${totalTime.toFixed(2)}ms`,
        phases: {
          paramValidation: `${paramValidationTime.toFixed(2)}ms`,
          toolExecution: `${toolExecutionTime.toFixed(2)}ms`,
          formatting: `${formattingTime.toFixed(2)}ms`,
          context: `${contextTime.toFixed(2)}ms`,
          response: `${responseTime.toFixed(2)}ms`
        },
        responseLength: finalResponse.text.length,
        preview: finalResponse.text.slice(0, 150) + "..."
      });
      
      return {
        text: finalResponse.text,
        usage: finalResponse.usage,
        toolResults: [{ 
          toolName: "getRoamNotes", 
          args: toolParams, 
          result: toolResult,
          executionId,
          executionTime: totalTime
        }],
      };
      
    } catch (error: any) {
      const totalTime = performance.now() - startTime;
      
      console.error(`❌ [${executionId}] Tool execution failed:`, {
        error: error.message,
        stack: error.stack,
        executionTime: `${totalTime.toFixed(2)}ms`,
        userMessage: userMessage.substring(0, 100),
        toolParams,
        provider: config.provider,
        model: config.model
      });
      
      // Re-throw with enhanced error context
      const enhancedError = new Error(`Tool execution failed [${executionId}]: ${error.message}`);
      enhancedError.stack = error.stack;
      throw enhancedError;
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
