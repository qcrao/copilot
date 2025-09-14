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
  supportsTools?: boolean; // Whether the provider supports tool calling
}

export interface AISettings {
  provider: string;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  maxInputTokens?: number;
}

export interface MultiProviderSettings {
  apiKeys: { [providerId: string]: string };
  currentModel: string;
  currentModelProvider?: string; // Provider ID for the current model
  temperature?: number;
  maxTokens?: number;
  maxInputTokens?: number; // Maximum input tokens for requests
  responseLanguage?: string;
  ollamaBaseUrl?: string; // Ollama local service address
  customOpenAIBaseUrl?: string; // Custom OpenAI compatible API base URL
  customModels?: { [providerId: string]: string }; // Custom model lists for each provider (comma-separated)
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string; // AI model used for this message
  modelProvider?: string; // Provider of the model (openai, anthropic, etc.)
  isStreaming?: boolean; // Whether this message is currently being streamed
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
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
  linkedReferencesTotal?: number; // Total backlinks count (may exceed array length)
  sidebarNotes?: RoamPage[];
  visibleDailyNotes?: RoamPage[]; // New: visible daily notes for daily notes view
}

export interface CopilotState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
}

// getRoamNotes tool interfaces
export interface RoamNoteContent {
  type: "page" | "block" | "daily-note" | "referenced-block" | "search-result";
  title?: string;
  uid: string;
  content: string;
  date?: string;
  path?: string;

  // Metadata
  createdTime?: string;
  lastModified?: string;
  wordCount?: number;
  hasChildren?: boolean;
  referenceCount?: number;
  tags?: string[];
  parentPage?: string;

  // Associated data
  children?: RoamNoteContent[];
  references?: RoamNoteContent[];
  backlinks?: RoamNoteContent[];
}

export interface RoamQueryResult {
  success: boolean;
  data: RoamNoteContent[];
  totalFound: number;
  executionTime: number;
  metadata: {
    queryType: string;
    dateRange?: string;
    sourcePage?: string;
  };
  warnings?: string[];
}

// Context preservation interfaces
export interface PreservedContextItem {
  uid: string;
  type: "page" | "block" | "dailyNote" | "linkedReference" | "sidebarNote";
  title?: string;
  content?: string; // Optional: can be reconstructed from UID
  timestamp: string;
}

export interface PreservedContext {
  timestamp: string;
  currentPageUid?: string;
  visibleBlockUids: string[];
  selectedText?: string;
  dailyNoteUid?: string;
  linkedReferenceUids: string[];
  sidebarNoteUids: string[];
  visibleDailyNoteUids?: string[];
  contextItems?: PreservedContextItem[]; // Full context items for fallback
}

// Conversation management interfaces
export interface ConversationMetadata {
  id: string;
  title: string;
  lastUpdated: string;
  messageCount: number;
  createdAt: string;
  tags?: string[];
  preservedContext?: PreservedContext;
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

// Reference chip interfaces for TipTap editor
export interface ReferenceChipAttributes {
  uid: string;
  preview: string;
}

export interface ReferenceChipData {
  uid: string;
  blockContent: string;
  children?: RoamBlock[];
  referencedPages?: RoamPage[];
}

export interface ExpandedReference {
  uid: string;
  content: string;
  type: "block" | "page";
  title?: string;
}

// Prompt Template interfaces

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  color: string;
  requiresContext: boolean;
  contextType?: "current-page" | "date-range" | "selected-text";
}

export interface PromptTemplateSettings {
  hiddenTemplates: string[]; // Array of template IDs that are hidden
}

export interface CustomPromptTemplate extends PromptTemplate {
  isCustom: true;
  createdAt: string;
  updatedAt: string;
}

export interface UserTemplateSettings {
  customTemplates: CustomPromptTemplate[];
  hiddenCustomTemplates: string[]; // Array of custom template IDs that are hidden
}

// Universal search interfaces for @ symbol triggered search
export interface UniversalSearchResult {
  type: "page" | "block" | "daily-note";
  uid: string;
  title?: string; // for pages and daily notes
  content?: string; // for blocks
  preview: string; // formatted preview text for display
  pageTitle?: string; // parent page title for blocks
  highlightedText?: string; // text with search term highlighted
}

export interface UniversalSearchResponse {
  results: UniversalSearchResult[];
  totalFound: number;
  searchTerm: string;
  executionTime: number;
}

// Cost-effective models selection, suitable for cost-sensitive Roam extensions
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      "gpt-4o", // Best model
      "gpt-4o-mini", // Most cost-effective
    ],
    apiKeyUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/usage",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      "claude-3-5-sonnet-20241022", // Best model
      "claude-3-5-haiku-20241022", // Most cost-effective
    ],
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "groq",
    name: "Groq",
    models: [
      "llama-3.3-70b-versatile", // Best model
      "llama-3.1-8b-instant", // Most cost-effective
    ],
    apiKeyUrl: "https://console.groq.com/keys",
    billingUrl: "https://console.groq.com/settings/billing",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    models: [
      "grok-3", // Best model
      "grok-2", // Most cost-effective
    ],
    apiKeyUrl: "https://console.x.ai/",
    billingUrl: "https://console.x.ai/",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "github",
    name: "GitHub Models",
    baseUrl: "https://models.inference.ai.azure.com",
    models: [
      "gpt-4o", // GPT-4o (OpenAI's flagship model)
      "Phi-3.5-mini-instruct", // Phi-3.5 Mini (Microsoft's efficient SLM)
      "Meta-Llama-3.1-8B-Instruct", // Llama 3.1 8B (Meta's popular open model)
    ],
    apiKeyUrl: "https://github.com/settings/tokens",
    billingUrl: "https://github.com/settings/billing",
    requiresApiKey: true,
    supportsTools: false,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      "gemini-2.0-flash-exp", // Latest experimental model
      "gemini-1.5-flash", // Fast and efficient
      "gemini-1.5-pro", // Most capable
    ],
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    billingUrl: "https://console.cloud.google.com/billing",
    requiresApiKey: true,
    supportsTools: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: [
      "deepseek-chat", // Main chat model
      "deepseek-reasoner", // Reasoning model
    ],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    billingUrl: "https://platform.deepseek.com/usage",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "custom-openai",
    name: "Custom OpenAI",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
    ],
    apiKeyUrl: "",
    billingUrl: "",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    models: [], // 动态获取模型，不在这里硬编码
    isLocal: true,
    requiresApiKey: false,
    supportsDynamicModels: true,
    supportsTools: true, // Native tool calling support
  },
];
