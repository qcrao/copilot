// src/utils/shared/constants.ts

/**
 * Centralized constants for Roam Copilot
 * Consolidates magic numbers and shared values across the codebase
 */

// UID and Reference Constants
export const UID_CONSTRAINTS = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 20,
  VALID_CHARS: /^[a-zA-Z0-9_-]+$/,
} as const;

// Content Length Limits
export const CONTENT_LIMITS = {
  BLOCK_PREVIEW: 100,
  BLOCK_CONTENT: 10000,
  PAGE_CONTENT: 50000,
  COMMENT_CONTENT: 1000,
  AI_PROMPT: 100000,
  FILENAME: 255,
  PAGE_TITLE: 500,
} as const;

// Regex Patterns
export const REGEX_PATTERNS = {
  // Roam-specific patterns
  BLOCK_REFERENCE: /\({2,3}([^)]+)\){2,3}/g,
  PAGE_REFERENCE: /\[\[([^\]]+)\]\]/g,
  ROAM_URL: /^https:\/\/roamresearch\.com\/#\/(app|graph)\/([^\/]+)\/page\/([a-zA-Z0-9_-]+)/,
  ROAM_DATE: /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th),\s+\d{4}$/,
  
  // General patterns
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  FILENAME_INVALID: /[<>:"/\\|?*]/,
  ELLIPSIS: /\.{3,}$/,
  
  // Content cleaning
  WHITESPACE_CLEANUP: /\s+/g,
  QUOTE_CLEANUP: /^["'\s]+|["'\s]+$/g,
} as const;

// AI Provider Constants
export const AI_CONSTRAINTS = {
  MAX_TOKENS: {
    GPT4: 128000,
    GPT4_MINI: 128000,
    CLAUDE_SONNET: 200000,
    CLAUDE_HAIKU: 200000,
    GROQ_LLAMA: 32768,
    GEMINI: 1000000,
    DEFAULT: 8192,
  },
  
  TEMPERATURE: {
    MIN: 0.0,
    MAX: 2.0,
    DEFAULT: 0.7,
  },
  
  RETRY_ATTEMPTS: 3,
  TIMEOUT_MS: 30000,
} as const;

// Performance and Caching
export const PERFORMANCE_CONSTANTS = {
  DEBOUNCE_DELAY: {
    SEARCH: 300,
    CONTEXT_UPDATE: 500,
    SETTINGS_SAVE: 1000,
  },
  
  CACHE_TTL: {
    BLOCK_CONTENT: 5 * 60 * 1000,      // 5 minutes
    PAGE_CONTENT: 10 * 60 * 1000,     // 10 minutes
    USER_INFO: 60 * 60 * 1000,        // 1 hour
    OLLAMA_MODELS: 30 * 60 * 1000,    // 30 minutes
  },
  
  BATCH_SIZE: {
    BLOCKS: 50,
    PAGES: 20,
    CONVERSATIONS: 100,
  },
  
  MEMORY_THRESHOLDS: {
    WARNING_MB: 100,
    CRITICAL_MB: 200,
    GC_TRIGGER_MB: 150,
  },
} as const;

// UI Constants
export const UI_CONSTANTS = {
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  
  Z_INDEX: {
    COPILOT_WIDGET: 99999,
    MODAL: 100000,
    DROPDOWN: 100001,
    TOOLTIP: 100002,
  },
  
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1440,
  },
  
  CHAT_INPUT: {
    MIN_HEIGHT: 40,
    MAX_HEIGHT: 200,
    PLACEHOLDER_ROTATION_INTERVAL: 3000,
    PLACEHOLDER_TEXT: "Ask anything — @ for pages, drag blocks, / for prompts",
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Validation errors
  INVALID_UID: 'Invalid block UID format',
  INVALID_PAGE_NAME: 'Invalid page name',
  CONTENT_TOO_LONG: 'Content exceeds maximum length',
  
  // AI service errors
  NO_MODEL_SELECTED: 'No AI model selected',
  API_KEY_MISSING: 'API key not configured',
  MODEL_NOT_FOUND: 'Model not available',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded, please try again later',
  
  // Roam API errors
  BLOCK_NOT_FOUND: 'Block not found in database',
  PAGE_NOT_FOUND: 'Page not found',
  QUERY_FAILED: 'Database query failed',
  
  // General errors
  NETWORK_ERROR: 'Network connection error',
  PARSE_ERROR: 'Failed to parse response',
  UNKNOWN_ERROR: 'An unexpected error occurred',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  CONVERSATION_SAVED: 'Conversation saved successfully',
  SETTINGS_UPDATED: 'Settings updated',
  EXPORT_COMPLETED: 'Export completed successfully',
  COPY_SUCCESS: 'Copied to clipboard',
} as const;

// Debug Categories
export const DEBUG_CATEGORIES = {
  AI_SERVICE: 'AI_SERVICE',
  ROAM_QUERY: 'ROAM_QUERY',
  CONTEXT_MANAGER: 'CONTEXT_MANAGER',
  CONVERSATION: 'CONVERSATION',
  PERFORMANCE: 'PERFORMANCE',
  MEMORY: 'MEMORY',
  UI: 'UI',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_MEMORY_MONITORING: true,
  ENABLE_PERFORMANCE_LOGGING: false,
  ENABLE_DEBUG_LOGGING: false,
  ENABLE_OLLAMA_AUTO_DISCOVERY: true,
  ENABLE_CONVERSATION_COMPRESSION: true,
  ENABLE_CONTEXT_CACHING: true,
} as const;

// Conversation Management
export const CONVERSATION_CONSTANTS = {
  MAX_CONVERSATIONS: 50,
  MAX_MESSAGES_PER_CONVERSATION: 100,
  AUTO_CLEANUP_ENABLED: true,
  COMPRESSION_THRESHOLD: 10000, // characters
  MAX_AGE_DAYS: 30,
  TITLE_MAX_LENGTH: 100,
} as const;

// Export formats and options
export const EXPORT_FORMATS = {
  MARKDOWN: 'markdown',
  JSON: 'json',
  HTML: 'html',
  TXT: 'txt',
} as const;

// Date and Time
export const DATE_FORMATS = {
  ROAM: 'MMMM Do, YYYY',
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'MMM D, YYYY',
  TIMESTAMP: 'YYYY-MM-DD HH:mm:ss',
} as const;

// Ollama specific constants
export const OLLAMA_CONSTANTS = {
  DEFAULT_BASE_URL: 'http://localhost:11434',
  MODEL_LIST_ENDPOINT: '/api/tags',
  HEALTH_CHECK_ENDPOINT: '/api/version',
  TIMEOUT_MS: 5000,
} as const;

export default {
  UID_CONSTRAINTS,
  CONTENT_LIMITS,
  REGEX_PATTERNS,
  AI_CONSTRAINTS,
  PERFORMANCE_CONSTANTS,
  UI_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEBUG_CATEGORIES,
  FEATURE_FLAGS,
  CONVERSATION_CONSTANTS,
  EXPORT_FORMATS,
  DATE_FORMATS,
  OLLAMA_CONSTANTS,
};