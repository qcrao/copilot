// src/services/aiService.ts
import { AISettings, AI_PROVIDERS } from "../types";

export class AIService {
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

  private static async callGrok(settings: AISettings, messages: any[]): Promise<string> {
    const provider = AI_PROVIDERS.find(p => p.id === 'grok');
    if (!provider?.baseUrl) throw new Error('Grok provider not configured');

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
      throw new Error(`Grok API error: ${response.status} ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
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
        content: `You are a helpful AI assistant integrated into Roam Research. You have access to the user's current page content and visible notes. Use this context to provide relevant and helpful responses.

Current Context:
${context}

Please provide helpful, accurate responses based on the context provided. If the context doesn't contain relevant information for the user's question, feel free to provide general assistance.`
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
        case 'grok':
          return await this.callGrok(settings, messages);
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