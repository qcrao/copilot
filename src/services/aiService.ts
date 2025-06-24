// src/services/aiService.ts
import { AISettings, AI_PROVIDERS } from "../types";
import { multiProviderSettings } from "../settings";

export class AIService {
  // Helper function to get provider for a specific model
  static getProviderForModel(model: string): {provider: any, apiKey: string} | null {
    for (const provider of AI_PROVIDERS) {
      if (provider.models.includes(model)) {
        const apiKey = multiProviderSettings.apiKeys[provider.id];
        if (apiKey && apiKey.trim() !== '') {
          return { provider, apiKey };
        }
      }
    }
    return null;
  }

  private static async callOpenAI(settings: AISettings, messages: any[]): Promise<string> {
    const provider = AI_PROVIDERS.find(p => p.id === 'openai');
    if (!provider?.baseUrl) throw new Error('OpenAI provider not configured');

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  private static async callAnthropic(settings: AISettings, messages: any[]): Promise<string> {
    const provider = AI_PROVIDERS.find(p => p.id === 'anthropic');
    if (!provider?.baseUrl) throw new Error('Anthropic provider not configured');

    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: conversationMessages,
        system: systemMessage?.content,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || 'No response generated';
  }

  private static async callGroq(settings: AISettings, messages: any[]): Promise<string> {
    const provider = AI_PROVIDERS.find(p => p.id === 'groq');
    if (!provider?.baseUrl) throw new Error('Groq provider not configured');

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${response.status} ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  private static async callXAI(settings: AISettings, messages: any[]): Promise<string> {
    const provider = AI_PROVIDERS.find(p => p.id === 'xai');
    if (!provider?.baseUrl) throw new Error('xAI provider not configured');

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`xAI API error: ${response.status} ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  // New method that uses the currently selected model from multiProviderSettings
  static async sendMessageWithCurrentModel(
    userMessage: string,
    context: string
  ): Promise<string> {
    const model = multiProviderSettings.currentModel;
    if (!model) {
      throw new Error('No model selected. Please select a model from the dropdown.');
    }

    const providerInfo = this.getProviderForModel(model);
    if (!providerInfo) {
      throw new Error(`No API key configured for model: ${model}. Please configure the API key in settings.`);
    }

    // Create temporary settings object for the selected model
    const tempSettings: AISettings = {
      provider: providerInfo.provider.id,
      model: model,
      apiKey: providerInfo.apiKey,
      temperature: multiProviderSettings.temperature || 0.7,
      maxTokens: multiProviderSettings.maxTokens || 2000,
    };

    return this.sendMessage(tempSettings, userMessage, context);
  }

  static async sendMessage(
    settings: AISettings,
    userMessage: string,
    context: string
  ): Promise<string> {
    if (!settings.apiKey) {
      throw new Error('API key not configured. Please set your API key in the extension settings.');
    }

    // Prepare messages
    const messages = [
      {
        role: 'system',
        content: `You are a personal growth companion integrated into Roam Research, designed to help users discover profound insights from their notes and thoughts. Your role is to act as a reflective mirror that reveals patterns, strengths, and growth opportunities hidden within their personal knowledge graph.

CORE MISSION:
- Analyze the user's notes to uncover deep insights about their thinking patterns, values, and development areas
- Help users recognize their unique strengths and potential blind spots
- Provide thoughtful observations that promote self-awareness and personal growth
- Identify recurring themes, contradictions, or evolving perspectives in their notes

LANGUAGE ADAPTATION:
- Automatically detect the primary language used in the user's notes from the context
- Respond in the same language as the majority of the user's content
- If notes are multilingual, use the language of the most recent or relevant content

ANALYSIS APPROACH:
1. **Pattern Recognition**: Look for recurring themes, interests, concerns, or behavioral patterns
2. **Growth Indicators**: Identify areas where the user shows development, learning, or positive change
3. **Strength Identification**: Highlight unique abilities, consistent positive traits, or areas of expertise
4. **Opportunity Areas**: Gently point out potential areas for growth or contradictions in thinking
5. **Connection Building**: Help users see unexpected connections between different areas of their life/work
6. **Perspective Evolution**: Track how their thinking has evolved over time

RESPONSE STYLE:
- Be insightful yet gentle, encouraging rather than judgmental
- Ask thought-provoking questions that stimulate self-reflection
- Provide specific examples from their notes to support your observations
- Offer practical suggestions for personal development when appropriate
- Maintain a warm, supportive tone that feels like a wise mentor

Current Context:
${context}

IMPORTANT: When referencing information from the context, ALWAYS include the appropriate source citations with clickable links in these formats:
- Page links: [🔗 Web](https://roamresearch.com/#/app/graph/page/uid) | [🔗 Desktop](roam://#/app/graph/page/uid)
- Block links: [🔗 Web](https://roamresearch.com/#/app/graph/page/uid) | [🔗 App](roam://#/app/graph/page/uid)
- Simple links: [🔗](roam://#/app/graph/page/uid) for desktop users

When you mention specific insights derived from their notes, include the exact clickable link from the context to allow users to revisit the source material.

Remember: Your goal is to help users gain meaningful self-awareness and facilitate their personal growth journey through thoughtful analysis of their own documented thoughts and experiences.`
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    try {
      switch (settings.provider) {
        case 'openai':
          return await this.callOpenAI(settings, messages);
        case 'anthropic':
          return await this.callAnthropic(settings, messages);
        case 'groq':
          return await this.callGroq(settings, messages);
        case 'xai':
          return await this.callXAI(settings, messages);
        default:
          throw new Error(`Unsupported AI provider: ${settings.provider}`);
      }
    } catch (error: any) {
      console.error('AI Service Error:', error);
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  static validateSettings(settings: AISettings): { isValid: boolean; error?: string } {
    if (!settings.apiKey?.trim()) {
      return { isValid: false, error: 'API key is required' };
    }

    if (!settings.provider) {
      return { isValid: false, error: 'AI provider is required' };
    }

    if (!settings.model) {
      return { isValid: false, error: 'AI model is required' };
    }

    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) {
      return { isValid: false, error: 'Invalid AI provider' };
    }

    if (!provider.models.includes(settings.model)) {
      return { isValid: false, error: 'Invalid model for selected provider' };
    }

    return { isValid: true };
  }
}