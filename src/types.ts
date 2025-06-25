// src/types.ts

export interface AIProvider {
  id: string;
  name: string;
  baseUrl?: string;
  models: string[];
  apiKeyUrl?: string; // URL to generate/manage API keys
  billingUrl?: string; // URL to view billing/usage
}

export interface AISettings {
  provider: string;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface MultiProviderSettings {
  apiKeys: { [providerId: string]: string };
  currentModel: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface RoamBlock {
  uid: string;
  string: string;
  children?: RoamBlock[];
  order?: number;
}

export interface RoamPage {
  title: string;
  uid: string;
  blocks: RoamBlock[];
}

export interface PageContext {
  currentPage?: RoamPage;
  visibleBlocks: RoamBlock[];
  selectedText?: string;
  dailyNote?: RoamPage;
  linkedReferences: RoamBlock[];
}

export interface CopilotState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-3.5-turbo"],
    apiKeyUrl: "https://platform.openai.com/account/api-keys", // ✅ 个人 API Keys [oai_citation:0‡platform.openai.com](https://platform.openai.com/account/api-keys?utm_source=chatgpt.com)
    billingUrl: "https://platform.openai.com/account/billing", // ✅ 账单/充值中心 [oai_citation:1‡platform.openai.com](https://platform.openai.com/account/billing?utm_source=chatgpt.com)
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-haiku-20240307", "claude-3-5-haiku-20241022"],
    apiKeyUrl: "https://console.anthropic.com/settings/keys", // ✅ 个人 API Keys [oai_citation:2‡heyalice.app](https://heyalice.app/academy/setup-api-keys?utm_source=chatgpt.com)
    billingUrl: "https://console.anthropic.com/settings/billing", // ✅ 账单/支付信息 [oai_citation:3‡console.anthropic.com](https://console.anthropic.com/settings/billing)
  },
  {
    id: "groq",
    name: "Groq (Ultra Fast & Cheap)",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.1-8b-instant", "gemma2-9b-it"],
    apiKeyUrl: "https://console.groq.com/keys", // ✅ API Keys [oai_citation:4‡console.groq.com](https://console.groq.com/keys)
    billingUrl: "https://console.groq.com/settings/billing", // ✅ 账单页面（会跳转到 /plans） [oai_citation:5‡console.groq.com](https://console.groq.com/settings/billing)
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-beta", "grok-3-mini"],
    apiKeyUrl: "https://console.x.ai/team/default/api-keys", // ✅ 默认团队 API Keys [oai_citation:6‡integrations.discourse.group](https://integrations.discourse.group/t/getting-started-with-xai/635?utm_source=chatgpt.com)
    billingUrl: "https://console.x.ai/team/default/billing/credits", // ✅ 充值 / Credits 页面 [oai_citation:7‡mql5.com](https://www.mql5.com/en/blogs/post/761552?utm_source=chatgpt.com)
  },
];
