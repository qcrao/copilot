// src/types.ts

export interface AIProvider {
  id: string;
  name: string;
  baseUrl?: string;
  models: string[];
  apiKeyUrl?: string; // URL to generate/manage API keys
  billingUrl?: string; // URL to view billing/usage
  isLocal?: boolean; // Indicates whether it's a local service
  requiresApiKey?: boolean; // Whether API key is required
  supportsDynamicModels?: boolean; // Whether models can be fetched dynamically
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
  ollamaBaseUrl?: string; // Ollama local service address
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;        // AI model used for this message
  modelProvider?: string; // Provider of the model (openai, anthropic, etc.)
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
  maxConversations: number; // Default 50
  maxMessagesPerConversation: number; // Default 100
  autoCleanup: boolean; // Auto clean old conversation
  compressionThreshold: number; // Compression threshold (character count)
  maxAge: number; // Maximum save days
}

export interface CompressedMessage {
  id: string;
  role: "user" | "assistant";
  summary: string; // Compressed summary
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
  type: "text" | "date" | "select";
  placeholder: string;
  options?: string[];
  required: boolean;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: "writing" | "analysis" | "planning" | "research" | "reflection";
  icon: string;
  color: string;
  requiresContext: boolean;
  contextType?: "current-page" | "date-range" | "selected-text";
  variables?: PromptVariable[];
}

export interface PromptTemplateState {
  selectedTemplate: PromptTemplate | null;
  isModalOpen: boolean;
  variableValues: Record<string, any>;
  isProcessing: boolean;
}

// Cost-effective models selection, suitable for cost-sensitive Roam extensions
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/account/billing",
    requiresApiKey: true,
    // ≤ $0.40 / 1M tokens input, ≤ $1.60 output
    models: ["gpt-4o-mini", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing",
    requiresApiKey: true,
    // Haiku series is the fastest and most cost-effective branch in Claude
    models: ["claude-3-haiku-20240307", "claude-3-5-haiku-20241022"],
  },
  {
    id: "groq",
    name: "Groq (Ultra Fast & Cheap)",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyUrl: "https://console.groq.com/keys",
    billingUrl: "https://console.groq.com/settings/billing",
    requiresApiKey: true,
    // Llama-3 8B Instant only $0.05 / 1M tokens input
    models: ["llama-3.1-8b-instant", "gemma2-9b-it"],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    apiKeyUrl: "https://console.x.ai/team/default/api-keys",
    billingUrl: "https://console.x.ai/team/default/billing/credits",
    requiresApiKey: true,
    // Grok-3 Mini only $0.30 per million inputs
    models: ["grok-3-mini", "grok-beta"],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    isLocal: true,
    requiresApiKey: false,
    supportsDynamicModels: true,
    // Models will be fetched dynamically from the service
    models: [],
  },
];
