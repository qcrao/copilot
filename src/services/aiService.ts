// src/services/aiService.ts
import { AISettings, AI_PROVIDERS, ChatMessage } from "../types";
import { multiProviderSettings } from "../settings";
import { RoamService } from "./roamService";
import { LLMUtil } from "../utils/llmUtil";

// Default universal assistant prompt (not shown in template panel)
const UNIVERSAL_ASSISTANT_PROMPT = `You are an intelligent note assistant designed to help with various knowledge work tasks. Your role is to provide helpful, contextual assistance based on the user's notes and current needs.

**YOUR CAPABILITIES:**

**Analysis & Research:**
- Synthesize information from notes and identify key insights
- Find connections between ideas and concepts
- Suggest research directions and knowledge gaps
- Extract actionable information from complex content

**Content & Writing:**
- Help organize and structure thoughts
- Improve clarity and coherence of ideas
- Suggest improvements to existing content
- Generate outlines and frameworks for new content

**Planning & Organization:**
- Break down complex goals into actionable steps
- Identify priorities and dependencies
- Suggest task sequences and timelines
- Help with decision-making processes

**Learning Support:**
- Explain complex concepts clearly
- Provide examples and analogies
- Suggest learning resources and next steps
- Help consolidate and review knowledge

**YOUR APPROACH:**
1. **Context-Aware**: Always consider the full context of available notes and information
2. **Adaptive**: Adjust your assistance style based on the specific task and user needs
3. **Actionable**: Focus on providing practical, implementable suggestions
4. **Insightful**: Look for patterns, connections, and opportunities the user might miss
5. **Concise**: Be thorough but respect the user's time with clear, focused responses

**RESPONSE FORMAT:**
- Start with a **bold title** that captures the main insight or action
- Provide clear, well-structured analysis or suggestions
- Include specific next steps when appropriate
- Reference relevant parts of the user's notes when helpful

**GOAL:** Be genuinely useful in advancing the user's knowledge work, whether that's research, writing, planning, learning, or creative thinking.`;

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
    conversationHistory: ChatMessage[] = [],
    customPrompt?: string
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

    // Analyze context to provide better guidance
    const contextAnalysis = this.analyzeContext(context);
    
    // Determine if this is first round with template
    const isFirstRound = conversationHistory.length === 0;
    const isFirstRoundWithTemplate = isFirstRound && !!customPrompt;
    
    // Use LLMUtil without tool calling for better compatibility
    const systemMessage = this.getSystemMessage(context, customPrompt, contextAnalysis, conversationHistory);
    const finalUserMessage = userMessage;
    const messagesWithHistory = this.buildMessagesWithHistory(
      systemMessage,
      finalUserMessage,
      conversationHistory,
      model,
      context,
      isFirstRoundWithTemplate
    );

    try {
      // Simplified logging for better performance and consistency
      console.log("🔧 AI Service sending message:", {
        provider: providerInfo.provider.id,
        model: model,
        hasApiKey: !!providerInfo.apiKey,
        userMessageLength: finalUserMessage.length,
        systemMessageLength: systemMessage.length,
        contextLength: context.length,
      });

      // 打印发送给AI的完整消息历史
      this.logCompleteMessageHistory(messagesWithHistory);

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
  static async *sendMessageWithCurrentModelStream(
    userMessage: string,
    context: string,
    conversationHistory: ChatMessage[] = [],
    customPrompt?: string,
    signal?: AbortSignal
  ): AsyncGenerator<{
    text: string;
    isComplete: boolean;
    usage?: any;
    error?: string;
  }> {
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

    // Analyze context to provide better guidance
    const contextAnalysis = this.analyzeContext(context);
    
    // Determine if this is first round with template
    const isFirstRound = conversationHistory.length === 0;
    const isFirstRoundWithTemplate = isFirstRound && !!customPrompt;
    
    // Use LLMUtil streaming
    const systemMessage = this.getSystemMessage(context, customPrompt, contextAnalysis, conversationHistory);
    const finalUserMessage = userMessage;
    const messagesWithHistory = this.buildMessagesWithHistory(
      systemMessage,
      finalUserMessage,
      conversationHistory,
      model,
      context,
      isFirstRoundWithTemplate
    );

    try {
      console.log("🔧 AI Service sending streaming message:", {
        provider: providerInfo.provider.id,
        model: model,
        hasApiKey: !!providerInfo.apiKey,
        userMessageLength: finalUserMessage.length,
        systemMessageLength: systemMessage.length,
        systemMessagePreview: systemMessage.substring(0, 200) + "...",
        customPromptProvided: !!customPrompt,
        customPromptPreview: customPrompt
          ? customPrompt.substring(0, 100) + "..."
          : "none",
        contextInSystemMessage: {
          hasAvailableContext: systemMessage.includes("**Available Context:**"),
          contextStartIndex: systemMessage.indexOf("**Available Context:**"),
          contextLength: context.length,
          contextPreview: context.substring(0, 500) + "...",
        },
      });

      // 打印发送给AI的完整消息历史
      this.logCompleteMessageHistory(messagesWithHistory);

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
        yield* LLMUtil.handleOllamaStreamRequest(config, messagesWithHistory, signal);
      } else {
        yield* LLMUtil.generateStreamResponse(config, messagesWithHistory, signal);
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
    conversationHistory: ChatMessage[] = [],
    customPrompt?: string
  ): Promise<string> {
    // Ollama doesn't need API key validation
    if (settings.provider !== "ollama" && !settings.apiKey) {
      throw new Error(
        "API key not configured. Please set your API key in the extension settings."
      );
    }

    const contextAnalysis = this.analyzeContext(context);
    
    // Determine if this is first round with template
    const isFirstRound = conversationHistory.length === 0;
    const isFirstRoundWithTemplate = isFirstRound && !!customPrompt;
    
    const systemMessage = this.getSystemMessage(context, customPrompt, contextAnalysis, conversationHistory);
    const messagesWithHistory = this.buildMessagesWithHistory(
      systemMessage,
      userMessage,
      conversationHistory,
      settings.model,
      context,
      isFirstRoundWithTemplate
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

  private static getSystemMessage(
    context: string,
    customPrompt?: string,
    contextAnalysis?: {
      hasSelectedText: boolean;
      hasCurrentPage: boolean;
      hasSidebarNotes: boolean;
      hasBacklinks: boolean;
      hasVisibleBlocks: boolean;
      contextType: 'minimal' | 'focused' | 'comprehensive';
    },
    conversationHistory: ChatMessage[] = []
  ): string {
    // Get response language setting
    const responseLanguage =
      multiProviderSettings.responseLanguage || "English";
    const languageInstruction = `\n\n**LANGUAGE REQUIREMENT:** Please respond in ${responseLanguage}.`;

    // Generate context-specific guidance
    const contextGuidance = this.generateContextGuidance(contextAnalysis);

    // Determine conversation stage
    const isFirstRound = conversationHistory.length === 0;
    
    // Debug: Log context information
    console.log("🐛 getSystemMessage Debug (context moved to user message):", {
      isFirstRound,
      hasContext: !!context,
      contextLength: context?.length || 0,
      contextPreview: context ? context.substring(0, 200) + "..." : "NO CONTEXT"
    });

    // NEW OPTIMIZATION: Context is now always placed in user message, not system message
    // This prevents context from being truncated in long conversations
    
    if (context && context.trim()) {
      if (isFirstRound) {
        console.log("✅ Context will be included in first round user message");
      } else {
        console.log("🔄 Context will be included in subsequent round user message");
      }
    } else if (!isFirstRound) {
      console.log("⚠️ No context available for subsequent round");
    }

    // First round with custom prompt (Template): Use template as system message (without context)
    if (isFirstRound && customPrompt) {
      return `${customPrompt}${contextGuidance}${languageInstruction}`;
    }
    
    // For all other cases (second round onwards, or first round without template), use universal assistant (without context)
    return `${UNIVERSAL_ASSISTANT_PROMPT}${contextGuidance}${languageInstruction}`;
  }

  /**
   * Generate context-specific guidance for the AI based on available context types
   */
  private static generateContextGuidance(contextAnalysis?: {
    hasSelectedText: boolean;
    hasCurrentPage: boolean;
    hasSidebarNotes: boolean;
    hasBacklinks: boolean;
    hasVisibleBlocks: boolean;
    contextType: 'minimal' | 'focused' | 'comprehensive';
  }): string {
    if (!contextAnalysis) {
      return "";
    }

    let guidance = "\n\n**CONTEXT-SPECIFIC GUIDANCE:**\n";

    // Priority-based guidance (removed selectedText references)
    if (contextAnalysis.hasCurrentPage) {
      guidance += "• **PRIMARY FOCUS**: Focus on the current page content as the main subject of analysis.\n";
      guidance += "• **PAGE CONTEXT**: Consider the page structure, content organization, and key concepts presented.\n";
    }

    if (contextAnalysis.hasSidebarNotes) {
      guidance += "• **CROSS-REFERENCE**: Multiple notes are open in sidebar - look for connections and patterns across different topics.\n";
      guidance += "• **NETWORK THINKING**: Consider how ideas from different sidebar notes might relate to the main query.\n";
    }

    if (contextAnalysis.hasBacklinks) {
      guidance += "• **RELATIONSHIP ANALYSIS**: This content has backlinks - consider the broader knowledge network and recurring themes.\n";
      guidance += "• **PATTERN RECOGNITION**: Look for how this topic connects to other ideas in the user's knowledge base.\n";
    }

    if (contextAnalysis.hasVisibleBlocks) {
      guidance += "• **VIEWPORT CONTEXT**: Consider what's currently visible to the user and how it relates to their immediate focus.\n";
    }

    // Context type specific guidance
    switch (contextAnalysis.contextType) {
      case 'minimal':
        guidance += "• **FOCUSED RESPONSE**: Limited context available - provide direct, actionable insights based on what's given.\n";
        break;
      
      case 'focused':
        guidance += "• **TARGETED ANALYSIS**: Moderate context available - balance depth with relevance to the specific content.\n";
        break;
      
      case 'comprehensive':
        guidance += "• **SYSTEMS THINKING**: Rich context available - synthesize insights across multiple sources and identify meta-patterns.\n";
        guidance += "• **INTEGRATION**: Look for opportunities to connect different pieces of information into coherent insights.\n";
        break;
    }

    // Thinking framework suggestions (updated without selectedText)
    guidance += "\n**RECOMMENDED THINKING FRAMEWORK:**\n";
    
    if (contextAnalysis.hasSidebarNotes || contextAnalysis.hasBacklinks) {
      guidance += "1. **Pattern Recognition**: What themes and patterns emerge across the content?\n";
      guidance += "2. **Connection Mapping**: How do different pieces of information relate?\n";
      guidance += "3. **Synthesis**: What new insights emerge from these connections?\n";
      guidance += "4. **Application**: How can these insights be practically applied?\n";
    } else if (contextAnalysis.hasCurrentPage) {
      guidance += "1. **Content Analysis**: What are the core concepts and insights in the current page?\n";
      guidance += "2. **Context Integration**: How does this relate to broader knowledge patterns?\n";
      guidance += "3. **Actionable Insights**: What specific steps or considerations emerge?\n";
    } else {
      guidance += "1. **Core Analysis**: What are the key insights from the available content?\n";
      guidance += "2. **Implications**: What are the broader implications or applications?\n";
      guidance += "3. **Next Steps**: What actions or further exploration would be valuable?\n";
    }

    return guidance;
  }

  /**
   * Analyze context to determine its characteristics and generate appropriate guidance
   */
  private static analyzeContext(context: string): {
    hasSelectedText: boolean;
    hasCurrentPage: boolean;
    hasSidebarNotes: boolean;
    hasBacklinks: boolean;
    hasVisibleBlocks: boolean;
    contextType: 'minimal' | 'focused' | 'comprehensive';
  } {
    if (!context) {
      return {
        hasSelectedText: false,
        hasCurrentPage: false,
        hasSidebarNotes: false,
        hasBacklinks: false,
        hasVisibleBlocks: false,
        contextType: 'minimal'
      };
    }

    // Analyze content types (removed selectedText analysis)
    const hasSelectedText = false; // Always false since we removed this feature
    const hasCurrentPage = context.includes("**Current Page:") || context.includes("**Page Content:");
    const hasSidebarNotes = context.includes("**Sidebar Notes") || context.includes("**Sidebar:");
    const hasBacklinks = context.includes("**Linked References");
    const hasVisibleBlocks = context.includes("**Visible Content:");

    // Determine context complexity
    let contextType: 'minimal' | 'focused' | 'comprehensive' = 'minimal';
    const contextSections = [hasCurrentPage, hasSidebarNotes, hasBacklinks, hasVisibleBlocks].filter(Boolean).length;
    
    if (contextSections >= 3) {
      contextType = 'comprehensive';
    } else if (contextSections >= 1) {
      contextType = 'focused';
    }

    return {
      hasSelectedText,
      hasCurrentPage,
      hasSidebarNotes,
      hasBacklinks,
      hasVisibleBlocks,
      contextType
    };
  }

  /**
   * Build messages array with conversation history, respecting token limits
   * NEW OPTIMIZATION: Context is now placed in the last user message to prevent truncation
   */
  private static buildMessagesWithHistory(
    systemMessage: string,
    currentUserMessage: string,
    conversationHistory: ChatMessage[],
    modelName: string,
    context?: string,
    isFirstRoundWithTemplate?: boolean
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system message (no longer contains context)
    messages.push({ role: "system", content: systemMessage });

    // Get token limit for the model
    const tokenLimit = this.getModelTokenLimit(modelName);
    const reservedTokens = 1000; // Reserve tokens for response
    const availableTokens = tokenLimit - reservedTokens;

    // NEW OPTIMIZATION: Build final user message with context at the end
    // This ensures context is always preserved even in long conversations
    let finalUserMessage = currentUserMessage;
    
    if (context && context.trim()) {
      finalUserMessage = `${currentUserMessage}\n\n**Please answer based on the following relevant information:**\n\n${context}`;
      console.log("✅ Context appended to user message", {
        originalLength: currentUserMessage.length,
        contextLength: context.length,
        finalLength: finalUserMessage.length
      });
    } else {
      console.log("⚠️ No context to append to user message");
    }

    // Estimate tokens for system message and current user message (with context)
    const systemTokens = this.estimateTokens(systemMessage);
    const currentMessageTokens = this.estimateTokens(finalUserMessage);
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
        content: message.content,
      });
    }

    // Add current user message (now contains context at the end)
    messages.push({ role: "user", content: finalUserMessage });

    console.log("🔧 Context Management (NEW APPROACH):", {
      totalMessages: messages.length,
      historyMessages: relevantHistory.length,
      estimatedTokens: usedTokens,
      tokenLimit: tokenLimit,
      model: modelName,
      contextInUserMessage: !!context && context.trim().length > 0,
      contextLength: context?.length || 0
    });

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
      default: 4000,
    };

    return tokenLimits[modelName] || tokenLimits["default"];
  }

  /**
   * Estimate token count for a given text (rough approximation)
   */
  private static estimateTokens(text: string): number {
    if (!text || typeof text !== "string") {
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

  /**
   * Log complete message history sent to AI for debugging
   */
  private static logCompleteMessageHistory(messages: Array<{ role: string; content: string }>): void {
    console.log("🚀 SENDING TO AI - Complete Message History:");
    console.log("═".repeat(80));
    
    let totalChars = 0;
    let estimatedTokens = 0;
    
    messages.forEach((message, index) => {
      const charCount = message.content.length;
      totalChars += charCount;
      estimatedTokens += this.estimateTokens(message.content);
      
      // Format role display
      let roleDisplay = "";
      switch (message.role) {
        case "system":
          roleDisplay = "SYSTEM MESSAGE";
          break;
        case "user":
          roleDisplay = `USER MESSAGE${index === messages.length - 1 ? " - Current" : ` - Round ${Math.floor(index / 2)}`}`;
          break;
        case "assistant":
          roleDisplay = `ASSISTANT MESSAGE - Round ${Math.floor(index / 2)}`;
          break;
        default:
          roleDisplay = message.role.toUpperCase();
      }
      
      console.log(`[${index + 1}] ${roleDisplay} (${charCount} chars):`);
      console.log(message.content);
      console.log("─".repeat(80));
    });
    
    console.log(`📊 Summary: ${messages.length} messages, ${totalChars} total chars, ~${estimatedTokens} estimated tokens`);
    console.log("═".repeat(80));
  }
}
