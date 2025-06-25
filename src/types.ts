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
  responseLanguage?: string;
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

// Conversation management interfaces
export interface ConversationMetadata {
  id: string;
  title: string;
  lastUpdated: string;
  messageCount: number;
  createdAt: string;
  tags?: string[];
}

export interface ConversationData {
  id: string;
  messages: ChatMessage[];
  metadata: ConversationMetadata;
}

export interface ConversationSettings {
  maxConversations: number; // 默认50个
  maxMessagesPerConversation: number; // 默认100条
  autoCleanup: boolean; // 自动清理旧对话
  compressionThreshold: number; // 压缩阈值 (字符数)
  maxAge: number; // 最大保存天数
}

export interface CompressedMessage {
  id: string;
  role: "user" | "assistant";
  summary: string; // 压缩后的摘要
  originalLength: number;
  timestamp: Date;
  isCompressed: boolean;
}

export interface ConversationListState {
  conversations: ConversationMetadata[];
  currentConversationId: string | null;
  isLoading: boolean;
  searchQuery: string;
  showList: boolean;
}

// Prompt Template interfaces
export interface PromptVariable {
  name: string;
  type: 'text' | 'date' | 'select';
  placeholder: string;
  options?: string[];
  required: boolean;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: 'writing' | 'analysis' | 'planning' | 'research' | 'reflection';
  icon: string;
  color: string;
  requiresContext: boolean;
  contextType?: 'current-page' | 'date-range' | 'selected-text';
  variables?: PromptVariable[];
}

export interface PromptTemplateState {
  selectedTemplate: PromptTemplate | null;
  isModalOpen: boolean;
  variableValues: Record<string, any>;
  isProcessing: boolean;
}

// 低价模型精选，适合成本敏感的 Roam 扩展
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/account/billing",
    // ≤ $0.40 / 1M tokens 输入，≤ $1.60 输出
    models: ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing",
    // Haiku 系列是 Claude 中速度最快、价格最低的分支
    models: ["claude-3-haiku-20240307", "claude-3.5-haiku-20241022"],
  },
  {
    id: "groq",
    name: "Groq (Ultra Fast & Cheap)",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyUrl: "https://console.groq.com/keys",
    billingUrl: "https://console.groq.com/settings/billing",
    // Llama-3 8B Instant 仅 $0.05 / 1M tokens 输入
    models: ["llama-3.1-8b-instant", "gemma2-9b-it"],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    apiKeyUrl: "https://console.x.ai/team/default/api-keys",
    billingUrl: "https://console.x.ai/team/default/billing/credits",
    // Grok-3 Mini 每百万输入仅 $0.30
    models: ["grok-3-mini", "grok-3-mini-fast"],
  },
];
