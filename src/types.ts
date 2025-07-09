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
    id: "ollama",
    name: "Ollama (Local)",
    models: [
      "llama3.2:latest", // Best balance
      "qwen2.5:latest", // Good alternative
    ],
    isLocal: true,
    requiresApiKey: false,
    supportsDynamicModels: true,
    supportsTools: false, // Uses simulation instead
  },
];
