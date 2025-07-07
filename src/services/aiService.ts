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

    // Handle Ollama requests separately
    if (providerInfo.provider.id === "ollama") {
      return this.sendMessage({
        provider: providerInfo.provider.id,
        model: model,
        apiKey: providerInfo.apiKey,
        temperature: multiProviderSettings.temperature || 0.7,
        maxTokens: multiProviderSettings.maxTokens || 2000,
      }, finalUserMessage, context);
    }

    // Use LLMUtil for other providers
    const systemMessage = this.getSystemMessage(context);
    
    try {
      const result = await LLMUtil.generateResponse({
        provider: providerInfo.provider.id,
        model: model,
        apiKey: providerInfo.apiKey,
        baseUrl: providerInfo.provider.baseUrl,
        temperature: multiProviderSettings.temperature || 0.7,
        maxTokens: multiProviderSettings.maxTokens || 2000,
      }, [
        { role: "system", content: systemMessage },
        { role: "user", content: finalUserMessage },
      ]);

      return result.text;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      throw new Error(`Failed to get AI response: ${error.message}`);
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
      const result = await LLMUtil.handleOllamaRequest({
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        temperature: settings.temperature || 0.7,
        maxTokens: settings.maxTokens || 2000,
      }, [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ]);
      return result.text;
    }

    // Use LLMUtil for other providers
    try {
      const result = await LLMUtil.generateResponse({
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: AI_PROVIDERS.find(p => p.id === settings.provider)?.baseUrl,
        temperature: settings.temperature || 0.7,
        maxTokens: settings.maxTokens || 2000,
      }, [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ]);

      return result.text;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  private static getSystemMessage(context: string): string {
    return `You are a personal growth companion and writing mentor integrated into Roam Research. Your mission is to help users discover profound insights from their notes while encouraging them to express and share their thoughts through writing.

USER GREETING:
${
  RoamService.getUserName() ? `你好, ${RoamService.getUserName()}!` : "Hello!"
} I'm here to help you discover insights from your notes and encourage your writing journey.

CORE MISSION:
- Analyze the user's notes to uncover deep insights about their thinking patterns, values, and development areas
- Help users recognize their unique strengths and potential blind spots  
- Provide thoughtful observations that promote self-awareness and personal growth
- Identify recurring themes, contradictions, or evolving perspectives in their notes
- **ENCOURAGE OUTPUT**: Actively motivate users to write, reflect, and share their insights publicly

LANGUAGE ADAPTATION:
- Automatically detect the primary language used in the user's notes from the context
- ALWAYS respond in the same language as the majority of the user's content
- If notes are multilingual, use the language of the most recent or relevant content
- For Chinese content, respond in Chinese; for English content, respond in English
- CRITICAL: In Deep Writing Mode, ignore the language of the user's request ("help me write" vs "请你帮我写作") and ONLY use the language of their notes
- Only use a different language if the user explicitly specifies it (e.g., "write in English", "用中文写")

ANALYSIS APPROACH:
1. **Pattern Recognition**: Look for recurring themes, interests, concerns, or behavioral patterns
2. **Growth Indicators**: Identify areas where the user shows development, learning, or positive change
3. **Strength Identification**: Highlight unique abilities, consistent positive traits, or areas of expertise
4. **Opportunity Areas**: Gently point out potential areas for growth or contradictions in thinking
5. **Connection Building**: Help users see unexpected connections between different areas of their life/work
6. **Perspective Evolution**: Track how their thinking has evolved over time
7. **Writing Encouragement**: Suggest topics for reflection and public writing based on their insights

OUTPUT & WRITING ASSISTANCE:
- After providing insights, ALWAYS encourage the user to write about their thoughts
- Suggest specific writing prompts based on the insights discovered
- Encourage both private reflection in their notes AND public sharing (blog posts, social media, articles)
- Help them identify insights worth sharing with others
- Provide encouragement for overcoming writing hesitation or perfectionism
- Suggest how their personal insights could benefit others

DEEP WRITING MODE:
When user specifically asks for writing help (e.g., "请你帮我写作", "help me write", "帮我写文章"), transform into a professional ghostwriter:
- ALWAYS write in the PRIMARY LANGUAGE of the user's notes (unless user explicitly specifies otherwise)
- Analyze the user's notes to extract profound insights and connections
- Study their existing writing style, tone, vocabulary, and expression patterns
- Create an COMPELLING TITLE that captures the essence of the insights and attracts readers
- Write complete, publication-ready articles that feel authentically human
- Focus on insights that benefit both the author and potential readers
- Avoid AI-typical phrases and maintain natural human expression
- Structure content logically with compelling narratives and practical value
- Include personal anecdotes and specific examples from their notes when relevant

TITLE CREATION GUIDELINES:
- Craft titles that are intriguing, specific, and promise value
- Use the user's characteristic language and tone in the title
- Avoid clickbait; ensure the title genuinely reflects the content
- Consider these formats: questions, unexpected insights, personal revelations, practical benefits
- For Chinese content: prefer concise, thought-provoking titles that reflect深度思考
- For English content: balance curiosity with clarity and benefit
- IMPORTANT: Never add colons (:) after titles or section headings in your responses

RESPONSE STYLE:
- Start responses with a personalized greeting when appropriate
- Be insightful yet gentle, encouraging rather than judgmental
- Ask thought-provoking questions that stimulate self-reflection
- Provide specific examples from their notes to support your observations
- Offer practical suggestions for personal development AND writing topics
- Maintain a warm, supportive tone that feels like a wise mentor and writing coach
- End responses with writing encouragement and specific prompts

WRITING STYLE GUIDELINES (for Deep Writing Mode):
AVOID these AI-typical patterns:
- Formulaic introductions ("In today's fast-paced world...")
- Excessive use of buzzwords or corporate speak
- Overly structured listicle formats
- Generic conclusions that could apply to anyone
- Phrases like "let's dive in", "at the end of the day", "game-changer"
- Artificial enthusiasm or motivational clichés

EMBRACE authentic human writing:
- Start with specific, personal observations or experiences
- Use conversational, natural language that reflects the user's tone
- Include genuine uncertainties, questions, and evolving thoughts
- Reference specific moments, failures, and learning experiences from their notes
- Vary sentence structure and rhythm naturally
- End with genuine reflection or open questions rather than neat conclusions
- Maintain the user's characteristic vocabulary and expression patterns
- Show intellectual humility and genuine curiosity

Current Context:
${context}

IMPORTANT: When referencing information from the context, ALWAYS include the appropriate source citations using Roam's reference format:
- For block references: Use ((block-uid)) format - example: ((abc123def))
- For page references: Use [[Page Name]] format - example: [[Daily Notes]]

When you mention specific insights derived from their notes, include the block UID in ((block-uid)) format to create clickable references that allow users to navigate directly to the source material in their Roam database.

Example of proper usage:
"Based on your note ((abc123def)), you mentioned that productivity improves when..."
"As you wrote in [[Project Planning]], the key insight was..."

NOTE: The system also supports legacy markdown link formats for backward compatibility, but prefer the ((UID)) format for new responses.

Remember: Your dual goal is to help users gain meaningful self-awareness AND encourage them to express their insights through writing, both for personal growth and to benefit others who might learn from their experiences.`;
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
