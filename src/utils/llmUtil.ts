// src/utils/llmUtil.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { CoreMessage, generateText, streamText, LanguageModel } from "ai";
import { multiProviderSettings } from "../settings";
import { AI_PROVIDERS } from "../types";
import {
  DEFAULT_MAX_COMPLETION_TOKENS,
  getSafeMaxCompletionTokens,
} from "./tokenLimits";

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
      const [year, month, day] = isoDate.split("-").map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed

      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const dayNum = date.getDate();
      const monthName = months[date.getMonth()];
      const yearNum = date.getFullYear();

      // Add ordinal suffix (st, nd, rd, th)
      const getOrdinalSuffix = (day: number): string => {
        if (day > 3 && day < 21) return "th";
        switch (day % 10) {
          case 1:
            return "st";
          case 2:
            return "nd";
          case 3:
            return "rd";
          default:
            return "th";
        }
      };

      const roamFormat = `${monthName} ${dayNum}${getOrdinalSuffix(
        dayNum
      )}, ${yearNum}`;
      console.log(`🗓️ Date format conversion: ${isoDate} → ${roamFormat}`);

      return roamFormat;
    } catch (error) {
      console.error("❌ Error converting date to Roam format:", error);
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
      const [year, month, day] = isoDate.split("-").map(Number);
      const date = new Date(year, month - 1, day);

      const formats = [
        // Standard Roam format: "July 8th, 2025"
        this.convertToRoamDateFormat(isoDate),

        // MM-dd-yyyy format
        `${String(month).padStart(2, "0")}-${String(day).padStart(
          2,
          "0"
        )}-${year}`,

        // yyyy-mm-dd format
        isoDate,

        // dd-mm-yyyy format
        `${String(day).padStart(2, "0")}-${String(month).padStart(
          2,
          "0"
        )}-${year}`,

        // Month dd, yyyy (without ordinal)
        `${date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`,

        // Just year-month-day without leading zeros
        `${year}-${month}-${day}`,
      ];

      // Remove duplicates
      const uniqueFormats = [...new Set(formats)];
      console.log(
        `🗓️ Generated ${uniqueFormats.length} date formats for ${isoDate}:`,
        uniqueFormats
      );

      return uniqueFormats;
    } catch (error) {
      console.error("❌ Error generating Roam date formats:", error);
      return [isoDate];
    }
  }

  // Removed unused getLocalDateString

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
        const ollamaBaseUrl =
          baseUrl ||
          multiProviderSettings.ollamaBaseUrl ||
          "http://localhost:11434";
        const ollama = createOpenAI({
          baseURL: `${ollamaBaseUrl}/v1`,
          apiKey: "ollama", // Ollama doesn't require a real API key
        });
        return ollama(model);

      case "gemini":
        const gemini = createGoogleGenerativeAI({
          apiKey: apiKey,
          baseURL:
            baseUrl || "https://generativelanguage.googleapis.com/v1beta",
        });
        return gemini(model);

      case "github":
        const github = createOpenAI({
          baseURL: baseUrl || "https://models.inference.ai.azure.com",
          apiKey: apiKey,
        });
        return github(model);

      case "deepseek":
        const deepseek = createOpenAI({
          baseURL: baseUrl || "https://api.deepseek.com",
          apiKey: apiKey,
        });
        return deepseek(model);

      case "custom-openai":
        const customOpenAI = createOpenAI({
          baseURL: baseUrl || multiProviderSettings.customOpenAIBaseUrl || "https://api.openai.com/v1",
          apiKey: apiKey,
        });
        return customOpenAI(model);

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
    const { temperature = 0.7, maxTokens } = config;
    const requestedMaxTokens =
      typeof maxTokens === "number" ? maxTokens : DEFAULT_MAX_COMPLETION_TOKENS;
    const safeMaxTokens = getSafeMaxCompletionTokens(
      config.provider,
      config.model,
      requestedMaxTokens,
      DEFAULT_MAX_COMPLETION_TOKENS
    );

    try {
      const model = this.getProviderClient(config);
      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      const result = await generateText({
        model,
        system: systemMessage?.content,
        messages: this.convertToAISDKMessages(conversationMessages),
        temperature,
        maxTokens: safeMaxTokens,
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

  static async *generateStreamResponse(
    config: LLMConfig,
    messages: any[],
    signal?: AbortSignal
  ): AsyncGenerator<{
    text: string;
    isComplete: boolean;
    usage?: any;
    error?: string;
  }> {
    const { temperature = 0.7, maxTokens } = config;
    const requestedMaxTokens =
      typeof maxTokens === "number" ? maxTokens : DEFAULT_MAX_COMPLETION_TOKENS;
    const safeMaxTokens = getSafeMaxCompletionTokens(
      config.provider,
      config.model,
      requestedMaxTokens,
      DEFAULT_MAX_COMPLETION_TOKENS
    );

    try {
      const model = this.getProviderClient(config);
      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      let streamError: string | null = null;

      const result = await streamText({
        model,
        system: systemMessage?.content,
        messages: this.convertToAISDKMessages(conversationMessages),
        temperature,
        maxTokens: safeMaxTokens,
        abortSignal: signal,
        onError({ error }) {
          console.error("❌ AI SDK onError callback:", error);
          streamError = (error as any)?.message || "Unknown streaming error";
        },
      });

      try {
        // Use fullStream to handle error parts properly
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-delta":
              yield {
                text: part.textDelta,
                isComplete: false,
              };
              break;
            case "finish":
              yield {
                text: "",
                isComplete: true,
                usage: part.usage && {
                  promptTokens: part.usage.promptTokens,
                  completionTokens: part.usage.completionTokens,
                  totalTokens: part.usage.totalTokens,
                },
              };
              break;
            case "error":
              console.error("❌ Stream error part:", part.error);
              yield {
                text: "",
                isComplete: true,
                error:
                  (part.error as any)?.message || "Streaming error occurred",
              };
              return;
          }
        }

        // If onError was called but no error part was yielded
        if (streamError) {
          yield {
            text: "",
            isComplete: true,
            error: streamError,
          };
          return;
        }
      } catch (streamError: any) {
        console.error("❌ Stream processing error:", streamError);
        yield {
          text: "",
          isComplete: true,
          error: streamError.message || "Stream processing failed",
        };
      }
    } catch (error: any) {
      console.error("❌ LLM streaming setup error:", error);
      yield {
        text: "",
        isComplete: true,
        error: `LLM streaming failed: ${error.message}`,
      };
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
      maxTokens: getSafeMaxCompletionTokens(
        providerInfo.provider.id,
        model,
        multiProviderSettings.maxTokens,
        DEFAULT_MAX_COMPLETION_TOKENS
      ),
    };

    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ];

    // Use regular generation without tools
    return this.generateResponse(config, messages);
  }

  static async getProviderForModel(
    model: string
  ): Promise<{ provider: any; apiKey: string } | null> {
    // First, check if we have a saved provider for the current model
    if (multiProviderSettings.currentModel === model && multiProviderSettings.currentModelProvider) {
      const savedProvider = AI_PROVIDERS.find(p => p.id === multiProviderSettings.currentModelProvider);
      if (savedProvider) {
        if (savedProvider.id === "ollama") {
          console.log(`✅ Using saved provider "${savedProvider.id}" for model "${model}"`);
          return { provider: savedProvider, apiKey: "" };
        }
        
        // Special handling for custom-openai: set dynamic baseUrl
        if (savedProvider.id === "custom-openai") {
          const customProvider = {
            ...savedProvider,
            baseUrl: multiProviderSettings.customOpenAIBaseUrl || "https://api.openai.com/v1"
          };
          const apiKey = multiProviderSettings.apiKeys[savedProvider.id];
          if (apiKey && apiKey.trim() !== "") {
            console.log(`✅ Using saved custom OpenAI provider for model "${model}" with baseUrl "${customProvider.baseUrl}"`);
            return { provider: customProvider, apiKey };
          }
        }
        
        const apiKey = multiProviderSettings.apiKeys[savedProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(`✅ Using saved provider "${savedProvider.id}" for model "${model}"`);
          return { provider: savedProvider, apiKey };
        }
      }
    }

    // Second, try exact model match in AI_PROVIDERS (default models)
    for (const provider of AI_PROVIDERS) {
      if (provider.models.includes(model)) {
        if (provider.id === "ollama") {
          return { provider, apiKey: "" };
        }

        const apiKey = multiProviderSettings.apiKeys[provider.id];
        if (apiKey && apiKey.trim() !== "") {
          // Special handling for custom-openai: set dynamic baseUrl
          if (provider.id === "custom-openai") {
            const customProvider = {
              ...provider,
              baseUrl: multiProviderSettings.customOpenAIBaseUrl || "https://api.openai.com/v1"
            };
            return { provider: customProvider, apiKey };
          }
          
          return { provider, apiKey };
        }
      }
    }

    // Second, check custom models for each provider
    const customModels = multiProviderSettings.customModels || {};
    for (const provider of AI_PROVIDERS) {
      const customModelList = customModels[provider.id];
      if (customModelList && customModelList.trim()) {
        const models = customModelList.split(',').map(m => m.trim()).filter(m => m);
        if (models.includes(model)) {
          if (provider.id === "ollama") {
            return { provider, apiKey: "" };
          }

          const apiKey = multiProviderSettings.apiKeys[provider.id];
          if (apiKey && apiKey.trim() !== "") {
            console.log(
              `✅ Found custom model "${model}" for provider "${provider.id}"`
            );
            
            // Special handling for custom-openai: set dynamic baseUrl
            if (provider.id === "custom-openai") {
              const customProvider = {
                ...provider,
                baseUrl: multiProviderSettings.customOpenAIBaseUrl || "https://api.openai.com/v1"
              };
              return { provider: customProvider, apiKey };
            }
            
            return { provider, apiKey };
          }
        }
      }
    }

    // IMPORTANT: Check Ollama dynamic models FIRST before pattern matching
    // This prevents models like "gpt-oss:20b" from being misidentified as OpenAI models
    const ollamaProvider = AI_PROVIDERS.find((p) => p.id === "ollama");
    if (ollamaProvider?.supportsDynamicModels) {
      try {
        const dynamicModels = await this.getOllamaModels();
        if (dynamicModels.includes(model)) {
          console.log(
            `✅ Found model "${model}" in Ollama dynamic models list`
          );
          return { provider: ollamaProvider, apiKey: "" };
        }
      } catch (error) {
        console.log("⚠️ Failed to check Ollama dynamic models:", error);
        // Continue to pattern matching if Ollama is not available
      }
    }

    // If no exact match and not in Ollama, try model name pattern matching to determine provider
    const modelLower = model.toLowerCase();

    // Check for OpenAI models
    if (modelLower.includes("gpt")) {
      const openaiProvider = AI_PROVIDERS.find((p) => p.id === "openai");
      if (openaiProvider) {
        const apiKey = multiProviderSettings.apiKeys[openaiProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(
            `🔍 Pattern match: "${model}" identified as OpenAI model`
          );
          return { provider: openaiProvider, apiKey };
        }
      }
    }

    // Check for Anthropic models
    if (modelLower.includes("claude")) {
      const anthropicProvider = AI_PROVIDERS.find((p) => p.id === "anthropic");
      if (anthropicProvider) {
        const apiKey = multiProviderSettings.apiKeys[anthropicProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(
            `🔍 Pattern match: "${model}" identified as Anthropic model`
          );
          return { provider: anthropicProvider, apiKey };
        }
      }
    }

    // Check for Groq models
    if (modelLower.includes("llama") && !modelLower.includes("meta-llama")) {
      const groqProvider = AI_PROVIDERS.find((p) => p.id === "groq");
      if (groqProvider) {
        const apiKey = multiProviderSettings.apiKeys[groqProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(`🔍 Pattern match: "${model}" identified as Groq model`);
          return { provider: groqProvider, apiKey };
        }
      }
    }

    // Check for xAI models
    if (modelLower.includes("grok")) {
      const xaiProvider = AI_PROVIDERS.find((p) => p.id === "xai");
      if (xaiProvider) {
        const apiKey = multiProviderSettings.apiKeys[xaiProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(`🔍 Pattern match: "${model}" identified as xAI model`);
          return { provider: xaiProvider, apiKey };
        }
      }
    }

    // Check for GitHub models
    if (modelLower.includes("phi") || modelLower.includes("meta-llama")) {
      const githubProvider = AI_PROVIDERS.find((p) => p.id === "github");
      if (githubProvider) {
        const apiKey = multiProviderSettings.apiKeys[githubProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(
            `🔍 Pattern match: "${model}" identified as GitHub model`
          );
          return { provider: githubProvider, apiKey };
        }
      }
    }

    // Check for Google Gemini models
    if (modelLower.includes("gemini")) {
      const geminiProvider = AI_PROVIDERS.find((p) => p.id === "gemini");
      if (geminiProvider) {
        const apiKey = multiProviderSettings.apiKeys[geminiProvider.id];
        if (apiKey && apiKey.trim() !== "") {
          console.log(
            `🔍 Pattern match: "${model}" identified as Gemini model`
          );
          return { provider: geminiProvider, apiKey };
        }
      }
    }

    // If no provider found, model is not supported
    console.log(`❌ Model "${model}" not found in any provider`);
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
      // Check if this is a CORS error
      if (this.isCorsError(error)) {
        console.warn(
          "CORS error detected when fetching Ollama models. Please configure CORS on your Ollama instance."
        );
        // Throw a specific error that can be caught upstream
        throw new Error("CORS_ERROR");
      }

      console.warn("Failed to fetch Ollama models:", error.message);
      return [];
    }
  }

  // Helper method to detect CORS errors
  private static isCorsError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || "";

    // Common CORS error patterns
    return (
      errorMessage.includes("cors") ||
      errorMessage.includes("cross-origin") ||
      errorMessage.includes("failed to fetch") ||
      (error.name === "TypeError" && errorMessage.includes("fetch"))
    );
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

  static async *handleOllamaStreamRequest(
    config: LLMConfig,
    messages: any[],
    signal?: AbortSignal
  ): AsyncGenerator<{ text: string; isComplete: boolean; usage?: any }> {
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
          stream: true,
          options: {
            temperature: temperature,
            num_predict: maxTokens,
          },
        }),
        signal: signal,
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "");
        throw new Error(
          `Ollama API error: ${response.status} ${error || response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body available");
      }

      try {
        while (true) {
          // Check if request was cancelled
          if (signal?.aborted) {
            yield {
              text: "",
              isComplete: true,
            };
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.message?.content) {
                yield {
                  text: data.message.content,
                  isComplete: false,
                };
              }

              if (data.done) {
                yield {
                  text: "",
                  isComplete: true,
                  usage: data.usage && {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                  },
                };
                return;
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
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
}
