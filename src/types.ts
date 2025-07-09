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
  model?: string; // AI model used for this message
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
    models: [
      "gpt-4o", // ✅ Supports tools
      "gpt-4o-mini", // ✅ Supports tools
      "gpt-4-turbo", // ✅ Supports tools
      "gpt-4", // ✅ Supports tools
      "gpt-3.5-turbo", // ✅ Supports tools
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
      "claude-3-5-sonnet-20241022", // ✅ Supports tools
      "claude-3-5-haiku-20241022", // ✅ Supports tools
      "claude-3-opus-20240229", // ✅ Supports tools
      "claude-3-sonnet-20240229", // ✅ Supports tools
      "claude-3-haiku-20240307", // ✅ Supports tools
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
      "llama-3.3-70b-versatile", // ✅ Supports tools
      "llama-3.1-70b-versatile", // ✅ Supports tools
      "llama-3.1-8b-instant", // ✅ Supports tools
      "llama3-groq-70b-8192-tool-use-preview", // ✅ Supports tools
      "llama3-groq-8b-8192-tool-use-preview", // ✅ Supports tools
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
      "grok-3", // ✅ Supports tools - Latest main model
      "grok-3-beta", // ✅ Supports tools - Beta version
      "grok-2-vision-1212", // ✅ Supports tools - Vision support
      "grok-2", // ✅ Supports tools - Previous generation
    ],
    apiKeyUrl: "https://console.x.ai/",
    billingUrl: "https://console.x.ai/",
    requiresApiKey: true,
    supportsTools: true,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    models: [
      "llama3.2:latest",
      "llama3.1:latest",
      "qwen2.5:latest",
      "deepseek-r1:latest",
      "gemma2:latest",
    ],
    isLocal: true,
    requiresApiKey: false,
    supportsDynamicModels: true,
    supportsTools: false, // Uses simulation instead
  },
];
