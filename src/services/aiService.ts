// src/services/aiService.ts
import { AISettings, AI_PROVIDERS, ChatMessage } from "../types";
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
    context: string,
    conversationHistory: ChatMessage[] = []
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

    // Use LLMUtil without tool calling for better compatibility
    const systemMessage = this.getSystemMessage(context);
    const finalUserMessage = userMessage;
    const messagesWithHistory = this.buildMessagesWithHistory(
      systemMessage,
      finalUserMessage,
      conversationHistory,
      model
    );

    try {
      console.log("🔧 AI Service sending message:", {
        provider: providerInfo.provider.id,
        model: model,
        hasApiKey: !!providerInfo.apiKey,
        userMessageLength: finalUserMessage.length,
        systemMessageLength: systemMessage.length,
        systemMessagePreview: systemMessage.substring(0, 200) + "...",
        hasBacklinks: systemMessage.includes("反向链接"),
        contextInSystemMessage: {
          hasAvailableContext: systemMessage.includes("**Available Context:**"),
          contextStartIndex: systemMessage.indexOf("**Available Context:**"),
          contextLength: context.length,
          contextPreview: context.substring(0, 500) + "...",
          hasBacklinksInContext: context.includes("反向链接"),
          backlinksCount: (context.match(/\*\*反向链接\*\*/g) || []).length,
          referenceCount: (context.match(/\*\*块引用\*\*/g) || []).length,
          pageCount: (context.match(/\*\*页面:/g) || []).length
        }
      });

      // 添加完整的系统消息和用户消息日志
      console.log("📤 FULL SYSTEM MESSAGE:", systemMessage);
      console.log("📤 FULL USER MESSAGE:", finalUserMessage);
      console.log("📤 FULL CONTEXT:", context);

      const result = await LLMUtil.generateResponse(
        {
          provider: providerInfo.provider.id,
          model: model,
          apiKey: providerInfo.apiKey,
          baseUrl: providerInfo.provider.baseUrl,
          temperature: multiProviderSettings.temperature || 0.7,
          maxTokens: multiProviderSettings.maxTokens || 8000,
        },
        messagesWithHistory
      );

      console.log("🔧 AI Service response:", {
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

  // New streaming method that uses the currently selected model
  static async* sendMessageWithCurrentModelStream(
    userMessage: string,
    context: string,
    conversationHistory: ChatMessage[] = []
  ): AsyncGenerator<{ text: string; isComplete: boolean; usage?: any }> {
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

    // Use LLMUtil streaming
    const systemMessage = this.getSystemMessage(context);
    const finalUserMessage = userMessage;
    const messagesWithHistory = this.buildMessagesWithHistory(
      systemMessage,
      finalUserMessage,
      conversationHistory,
      model
    );

    try {
      console.log("🔧 AI Service sending streaming message:", {
        provider: providerInfo.provider.id,
        model: model,
        hasApiKey: !!providerInfo.apiKey,
        userMessageLength: finalUserMessage.length,
        systemMessageLength: systemMessage.length,
        systemMessagePreview: systemMessage.substring(0, 200) + "...",
        hasBacklinks: systemMessage.includes("反向链接"),
        contextInSystemMessage: {
          hasAvailableContext: systemMessage.includes("**Available Context:**"),
          contextStartIndex: systemMessage.indexOf("**Available Context:**"),
          contextLength: context.length,
          contextPreview: context.substring(0, 500) + "...",
          hasBacklinksInContext: context.includes("反向链接"),
          backlinksCount: (context.match(/\*\*反向链接\*\*/g) || []).length,
          referenceCount: (context.match(/\*\*块引用\*\*/g) || []).length,
          pageCount: (context.match(/\*\*页面:/g) || []).length
        }
      });

      // 添加完整的系统消息和用户消息日志
      console.log("📤 FULL SYSTEM MESSAGE:", systemMessage);
      console.log("📤 FULL USER MESSAGE:", finalUserMessage);
      console.log("📤 FULL CONTEXT:", context);

      const config = {
        provider: providerInfo.provider.id,
        model: model,
        apiKey: providerInfo.apiKey,
        baseUrl: providerInfo.provider.baseUrl,
        temperature: multiProviderSettings.temperature || 0.7,
        maxTokens: multiProviderSettings.maxTokens || 8000,
      };

      // Handle Ollama separately for streaming
      if (providerInfo.provider.id === "ollama") {
        yield* LLMUtil.handleOllamaStreamRequest(config, messagesWithHistory);
      } else {
        yield* LLMUtil.generateStreamResponse(config, messagesWithHistory);
      }
    } catch (error: any) {
      console.error("❌ AI Service streaming error:", {
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
    context: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    // Ollama doesn't need API key validation
    if (settings.provider !== "ollama" && !settings.apiKey) {
      throw new Error(
        "API key not configured. Please set your API key in the extension settings."
      );
    }

    const systemMessage = this.getSystemMessage(context);
    const messagesWithHistory = this.buildMessagesWithHistory(
      systemMessage,
      userMessage,
      conversationHistory,
      settings.model
    );

    // Handle Ollama requests separately
    if (settings.provider === "ollama") {
      const result = await LLMUtil.handleOllamaRequest(
        {
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 8000,
        },
        messagesWithHistory
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
          maxTokens: settings.maxTokens || 8000,
        },
        messagesWithHistory
      );

      return result.text;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }


  private static getSystemMessage(context: string): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    // Get response language setting
    const responseLanguage = multiProviderSettings.responseLanguage || "English";
    const languageInstruction = responseLanguage !== "English" 
      ? `\n**LANGUAGE REQUIREMENT:** Please respond in ${responseLanguage}.`
      : "";
    
    return `You are an introspective AI assistant helping the user reflect on their past thoughts.

**Current Date and Time Context:**
- Today's date: ${currentDate}
- User's timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

You will be given a set of notes written by the user over a period of time. These notes may be fragmented, emotional, logical, or incomplete — that's okay. Do not fix or summarize them.${languageInstruction}

**CRITICAL REQUIREMENT: INSIGHTFUL ANALYSIS FORMAT**
You MUST ALWAYS write in the form of a **thoughtful analysis with title and insights**. This is non-negotiable regardless of the user's question or content type.

**Your Task:**
Write a **thoughtful analysis** based on the user's notes and questions. Your response should:
- Start with a compelling title that captures the essence of your analysis
- Provide deep insights and understanding drawn from the notes
- Reveal recurring questions, concerns, or patterns the user seems to revisit
- Identify emotional conflicts or internal contradictions if they exist
- Highlight what the user consistently pays attention to, and what they might be ignoring
- Gently surface implicit beliefs, desires, or fears
- Be compassionate, reflective, and insightful — as if the user is writing to themselves
- Address the user's specific question or request within the context of personal reflection
- End with actionable insights and thoughtful conclusions

**MANDATORY FORMAT:**
- Begin with a clear, descriptive title in **bold** - DO NOT add any prefix like "Title:" or "标题："
- Follow with a comprehensive insights paragraph that reveals deeper understanding
- Use conversational, warm tone throughout the analysis
- Include personal insights and observations
- End with meaningful conclusions and insights (no formal closing)

**Response Requirements:**
1. Answer the user's question based on the provided information, with particular attention to the relevant content in backlinks
2. When answering, cite specific sources using the provided clickable link format ((block-id))
3. When citing information, maintain the original clickable links so users can jump directly to the original source
4. Format your response as a thoughtful analysis with title, insights, and deep understanding that makes the user feel seen and understood

**ABSOLUTELY FORBIDDEN:**
- Direct answers without title and insights format
- Bullet points or lists as the main response format
- Surface-level summaries without personal reflection and analysis
- Any response that doesn't start with a title and comprehensive insights
- Adding any prefix like "Title:" or "标题：" before the title
- Starting the response with anything other than the bold title

**Always Remember:**
- Do **not** rewrite or summarize the notes.
- Focus on the **user's own voice and thoughts**, as shown in the notes.
- Be compassionate and insightful in your analysis.
- Write in analysis format with title and insights, even when addressing specific tasks or questions.
- NEVER provide direct answers - always wrap them in personal reflection within a thoughtful analysis.
- ALWAYS start directly with the bold title - no prefixes, no labels, just the title.

**STRICTLY FORBIDDEN:**
- Do NOT include any <think> or </think> tags in your response
- Do NOT output raw lists of block UIDs like: 4dmeNU66m, tJ5nSkKf3, SQEmCB129, etc.
- Do NOT include debug information or code blocks with UIDs
- Do NOT include any XML-style tags in your response
- Keep your response clean and user-friendly

${context ? `\n**Your Notes:**\n${context}` : "\n**No notes provided.**"}

Write a thoughtful analysis with a compelling title and deep insights based on the notes above, addressing the user's question while providing deeper reflection on their thinking patterns.`;
  }

  /**
   * Build messages array with conversation history, respecting token limits
   */
  private static buildMessagesWithHistory(
    systemMessage: string,
    currentUserMessage: string,
    conversationHistory: ChatMessage[],
    modelName: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    
    // Add system message
    messages.push({ role: "system", content: systemMessage });
    
    // Get token limit for the model
    const tokenLimit = this.getModelTokenLimit(modelName);
    const reservedTokens = 1000; // Reserve tokens for response
    const availableTokens = tokenLimit - reservedTokens;
    
    // Estimate tokens for system message and current user message
    const systemTokens = this.estimateTokens(systemMessage);
    const currentMessageTokens = this.estimateTokens(currentUserMessage);
    let usedTokens = systemTokens + currentMessageTokens;
    
    // Add conversation history in reverse order (most recent first)
    const relevantHistory: ChatMessage[] = [];
    const recentHistory = conversationHistory.slice(-10); // Last 10 messages
    
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const message = recentHistory[i];
      const messageTokens = this.estimateTokens(message.content);
      
      if (usedTokens + messageTokens > availableTokens) {
        break; // Stop if adding this message would exceed token limit
      }
      
      relevantHistory.unshift(message);
      usedTokens += messageTokens;
    }
    
    // Add relevant history to messages
    for (const message of relevantHistory) {
      messages.push({
        role: message.role,
        content: message.content
      });
    }
    
    // Add current user message
    messages.push({ role: "user", content: currentUserMessage });
    
    // console.log("🔧 Context Management:", {
    //   totalMessages: messages.length,
    //   historyMessages: relevantHistory.length,
    //   estimatedTokens: usedTokens,
    //   tokenLimit: tokenLimit,
    //   model: modelName
    // });
    
    return messages;
  }
  
  /**
   * Get token limit for a specific model
   */
  private static getModelTokenLimit(modelName: string): number {
    const tokenLimits: { [key: string]: number } = {
      // OpenAI models
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4": 8000,
      "gpt-3.5-turbo": 16000,
      
      // Anthropic models
      "claude-3-5-sonnet-20241022": 200000,
      "claude-3-5-sonnet-20240620": 200000,
      "claude-3-5-haiku-20241022": 200000,
      "claude-3-opus-20240229": 200000,
      "claude-3-sonnet-20240229": 200000,
      "claude-3-haiku-20240307": 200000,
      
      // xAI models
      "grok-beta": 131072,
      "grok-vision-beta": 131072,
      
      // Google Gemini models
      "gemini-2.0-flash-exp": 1048576,
      "gemini-1.5-flash": 1048576,
      "gemini-1.5-pro": 2097152,
      
      // GitHub Models
      "Phi-3.5-mini-instruct": 128000,
      "Meta-Llama-3.1-8B-Instruct": 128000,
      
      // Qwen models (Alibaba Cloud)
      "qwen3:8b": 32000,
      "qwen2.5:latest": 32000,
      "qwen2.5:7b": 32000,
      "qwen2.5:14b": 32000,
      "qwen2.5:32b": 32000,
      "qwen2.5:72b": 32000,
      "qwen2:7b": 32000,
      "qwen2:72b": 32000,
      "qwen:7b": 32000,
      "qwen:14b": 32000,
      "qwen:72b": 32000,
      
      // DeepSeek models
      "deepseek-r1:latest": 64000,
      "deepseek-r1:8b": 64000,
      "deepseek-r1:14b": 64000,
      "deepseek-r1:32b": 64000,
      "deepseek-r1:70b": 64000,
      "deepseek-coder:latest": 64000,
      "deepseek-coder:6.7b": 64000,
      "deepseek-coder:33b": 64000,
      
      // Other common Ollama models
      "llama3.2:latest": 128000,
      "llama3.2:3b": 128000,
      "llama3.2:1b": 128000,
      "llama3.1:latest": 128000,
      "llama3.1:8b": 128000,
      "llama3.1:70b": 128000,
      "llama3.1:405b": 128000,
      "llama3:latest": 32000,
      "llama3:8b": 32000,
      "llama3:70b": 32000,
      "codellama:latest": 32000,
      "codellama:7b": 32000,
      "codellama:13b": 32000,
      "codellama:34b": 32000,
      "mistral:latest": 32000,
      "mistral:7b": 32000,
      "mixtral:latest": 32000,
      "mixtral:8x7b": 32000,
      "phi3:latest": 32000,
      "phi3:mini": 32000,
      "phi3:medium": 32000,
      "gemma:latest": 32000,
      "gemma:2b": 32000,
      "gemma:7b": 32000,
      
      // Default for unknown models
      "default": 4000
    };
    
    return tokenLimits[modelName] || tokenLimits["default"];
  }
  
  /**
   * Estimate token count for a given text (rough approximation)
   */
  private static estimateTokens(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    // Rough estimation: 1 token ≈ 4 characters for English
    // For Chinese and other languages, it's closer to 1 token ≈ 1.5 characters
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCharCount = text.length - chineseCharCount;
    
    return Math.ceil(chineseCharCount / 1.5 + otherCharCount / 4);
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
