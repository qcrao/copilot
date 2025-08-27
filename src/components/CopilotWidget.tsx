// src/components/CopilotWidget.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Icon, Spinner } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
// Removing chatscope imports - using custom MessageList now
import {
  ChatMessage,
  CopilotState,
  PageContext,
  ConversationListState,
} from "../types";
import { AIService } from "../services/aiService";
import { RoamService } from "../services/roamService";
import { ConversationService } from "../services/conversationService";
import { ContextManager } from "../services/contextManager";
import { aiSettings, multiProviderSettings } from "../settings";
import { AI_PROVIDERS } from "../types";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { ChatInput } from "./ChatInput";
import { ConversationList } from "./ConversationList";
import { PromptTemplatesGrid } from "./PromptTemplatesGrid";
import { MessageList } from "./MessageList";
import { ContextPreview } from "./ContextPreview";
import { PromptBuilder } from "../utils/promptBuilder";
import { useMemoryManager } from "../utils/memoryManager";
import { PerformanceMonitor } from "../utils/performance";
import { UI_CONSTANTS } from "../utils/shared/constants";

interface CopilotWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  embedMode?: "overlay" | "sidebar";
}

export const CopilotWidget: React.FC<CopilotWidgetProps> = ({
  isOpen,
  onToggle,
  onClose,
  embedMode = "overlay",
}) => {
  const isSidebar = embedMode === "sidebar";
  const { registerCleanup, createManagedTimeout } = useMemoryManager();

  const [state, setState] = useState<CopilotState>({
    isOpen,
    isMinimized: !isOpen,
    messages: [],
    isLoading: false,
  });

  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isContextLocked, setIsContextLocked] = useState(false);
  const [preservedContext, setPreservedContext] = useState<PageContext | null>(null);
  const [excludedContextUids, setExcludedContextUids] = useState<Set<string>>(
    new Set()
  );
  const handleExcludeFromContext = useCallback((uid: string) => {
    setExcludedContextUids((prev) => {
      const next = new Set(prev);
      next.add(uid);
      return next;
    });
  }, []);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null
  );
  const [showConversationList, setShowConversationList] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const conversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    conversationIdRef.current = currentConversationId;
  }, [currentConversationId]);
  const [inputValue, setInputValue] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [dateNotesCache, setDateNotesCache] = useState<{
    [date: string]: string;
  }>({});
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    prompt: string;
  } | null>(null);
  const [windowPosition, setWindowPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  }>({
    width: Math.min(window.innerWidth * 0.5, 1200),
    height: Math.min(window.innerHeight * 0.8, 1000),
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startMousePos, setStartMousePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [startWindowSize, setStartWindowSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [startWindowPos, setStartWindowPos] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [dragStartWindowPos, setDragStartWindowPos] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const [isUnmounting, setIsUnmounting] = useState(false);
  const [lastContextUpdate, setLastContextUpdate] = useState<number>(0);
  const [isUpdatingContext, setIsUpdatingContext] = useState<boolean>(false);
  const updateContextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const currentRequestAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isUnmounting) return;

    setState((prev) => {
      // Only update if the isOpen state actually changed
      if (prev.isOpen !== isOpen) {
        return {
          ...prev,
          isOpen,
          isMinimized: !isOpen,
        };
      }
      return prev;
    });

    // Calculate window position when opening (center of screen)
    if (isOpen && !windowPosition) {
      setWindowPosition(calculateCenterPosition());
    }
  }, [isOpen, windowPosition, windowSize, isUnmounting]);

  const updatePageContext = useCallback(
    async (forceUpdate: boolean = false) => {
      if (isUnmounting || isUpdatingContext) return;
      
      // Don't update context if it's locked to a conversation
      if (isContextLocked && !forceUpdate) {
        console.log('🔒 Context is locked, skipping update');
        return;
      }

      // Prevent rapid successive updates that could cause infinite loops (unless forced)
      if (!forceUpdate) {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastContextUpdate;
        // Dynamic throttling based on context: daily notes need faster updates when scrolling
        const isDailyNotesView = window.location.href.includes('/page/Daily Notes') || 
                                document.querySelector('.roam-log-page') !== null;
        // Make context refresh more responsive while avoiding thrash
        const MIN_UPDATE_INTERVAL = isDailyNotesView ? 180 : 700;

        if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
          console.log(
            `⏳ Context update throttled (${timeSinceLastUpdate}ms since last update, daily notes: ${isDailyNotesView})`
          );
          return;
        }
      }

      // Clear any pending timeout
      if (updateContextTimeoutRef.current) {
        clearTimeout(updateContextTimeoutRef.current);
        updateContextTimeoutRef.current = null;
      }

      try {
        setIsUpdatingContext(true);
        const now = Date.now();
        setLastContextUpdate(now);
        console.log("🔄 Updating page context...");

        const context = await PerformanceMonitor.measure(
          "updatePageContext",
          async () => {
            return await RoamService.getPageContext();
          }
        );

        if (!isUnmounting) {
          // Filter out excluded items if any
          const filterBlocks = (blocks: any[] | undefined) =>
            (blocks || []).filter((b: any) => !excludedContextUids.has(b.uid));

          const filtered: PageContext = {
            currentPage: context.currentPage
              ? {
                  ...context.currentPage,
                  blocks: filterBlocks(context.currentPage.blocks),
                }
              : undefined,
            visibleBlocks: filterBlocks(context.visibleBlocks),
            selectedText: context.selectedText,
            dailyNote: context.dailyNote
              ? {
                  ...context.dailyNote,
                  blocks: filterBlocks(context.dailyNote.blocks),
                }
              : undefined,
            linkedReferences: filterBlocks(context.linkedReferences) as any,
            sidebarNotes: context.sidebarNotes || [], // 🔧 Fix: Include sidebar notes!
            visibleDailyNotes: context.visibleDailyNotes
              ? context.visibleDailyNotes.map(dailyNote => ({
                  ...dailyNote,
                  blocks: filterBlocks(dailyNote.blocks),
                }))
              : undefined, // 🔧 Fix: Include visible daily notes with filtering!
          } as PageContext;

          setPageContext(filtered);
          console.log("✅ Page context updated successfully");
        }
      } catch (error) {
        console.error("❌ Failed to get page context:", error);
        // Reset throttle on error to allow retry
        setLastContextUpdate(0);
      } finally {
        setIsUpdatingContext(false);
      }
    },
    [isUnmounting, lastContextUpdate, isUpdatingContext, excludedContextUids, isContextLocked]
  );

  useEffect(() => {
    if (isOpen) {
      updatePageContext();
    }
  }, [isOpen, updatePageContext]);

    // Monitor page changes to update context for preview
  useEffect(() => {
    if (!isOpen) return; // Only monitor when widget is open

    let lastUrl = window.location.href;
    let lastTitle = document.title;

    const checkForPageChange = () => {
      const currentUrl = window.location.href;
      const currentTitle = document.title;

      if (currentUrl !== lastUrl || currentTitle !== lastTitle) {
        console.log("📄 Page change detected, updating context...");
        lastUrl = currentUrl;
        lastTitle = currentTitle;

        // Debounce the update to avoid too frequent calls
        if (updateContextTimeoutRef.current) {
          clearTimeout(updateContextTimeoutRef.current);
        }

        updateContextTimeoutRef.current = setTimeout(() => {
          updatePageContext();
        }, 500); // 500ms delay
      }
    };

    // Check for URL changes (hash changes, etc.)
    const handleHashChange = () => {
      console.log("🔗 Hash change detected");
      checkForPageChange();
    };

    // Use MutationObserver to watch for DOM changes that might indicate page navigation or content changes
    const observer = new MutationObserver((mutations) => {
      let hasSignificantChange = false;
      let hasContentChange = false;

      mutations.forEach((mutation) => {
        // Check for major page structure changes
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Look for Roam's main content indicators
              if (
                element.classList?.contains("roam-article") ||
                element.classList?.contains("rm-article-wrapper") ||
                element.querySelector?.(".roam-article, .rm-article-wrapper")
              ) {
                hasSignificantChange = true;
                break;
              }

              // Look for block content changes
              if (
                element.classList?.contains("roam-block") ||
                element.classList?.contains("rm-block") ||
                element.classList?.contains("roam-block-container") ||
                element.classList?.contains("rm-block-main") ||
                element.querySelector?.(
                  ".roam-block, .rm-block, .roam-block-container, .rm-block-main"
                )
              ) {
                hasContentChange = true;
              }
            }
          }
        }

        // Also check for removed nodes (block deletion)
        if (mutation.type === "childList" && mutation.removedNodes.length > 0) {
          for (let node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.classList?.contains("roam-block") ||
                element.classList?.contains("rm-block") ||
                element.classList?.contains("roam-block-container") ||
                element.classList?.contains("rm-block-main")
              ) {
                hasContentChange = true;
                break;
              }
            }
          }
        }
      });

      if (hasSignificantChange) {
        checkForPageChange();
      } else if (hasContentChange) {
        // Block content change detected, updating context
        // Debounce content updates with a shorter delay
        if (updateContextTimeoutRef.current) {
          clearTimeout(updateContextTimeoutRef.current);
        }
        updateContextTimeoutRef.current = setTimeout(() => {
          updatePageContext();
        }, 300); // Shorter delay for content changes
      }
    });

    // Observe the main Roam content area
    const roamApp = document.querySelector("#app, .roam-app, .rm-app");
    if (roamApp) {
      observer.observe(roamApp, {
        childList: true,
        subtree: true,
        attributes: false,
      });
    }

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Listen for text selection changes to update context
    const handleSelectionChange = () => {
      console.log("📝 Selection change detected");
      // Debounce the update to avoid too frequent calls
      if (updateContextTimeoutRef.current) {
        clearTimeout(updateContextTimeoutRef.current);
      }
      updateContextTimeoutRef.current = setTimeout(() => {
        updatePageContext();
      }, 300); // 300ms delay for selection changes
    };

    // Listen for scroll events to update context when user scrolls
    const handleScroll = () => {
      console.log("📜 Scroll detected");
      // Dynamic delay based on content type: daily notes need faster updates
      const isDailyNotesView = window.location.href.includes('/page/Daily Notes') || 
                              document.querySelector('.roam-log-page') !== null;
      const scrollDelay = isDailyNotesView ? 120 : 250; // Faster scroll response
      
      // Debounce the update to avoid too frequent calls during scrolling
      if (updateContextTimeoutRef.current) {
        clearTimeout(updateContextTimeoutRef.current);
      }
      updateContextTimeoutRef.current = setTimeout(() => {
        updatePageContext();
      }, scrollDelay);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Some Roam layouts use a scrollable main container. Observe it as well.
    const mainScrollable =
      (document.querySelector('.roam-main') as HTMLElement) ||
      (document.querySelector('.rm-main') as HTMLElement) ||
      (document.querySelector('.roam-article') as HTMLElement) ||
      (document.querySelector('[data-testid="main-content"]') as HTMLElement);
    if (mainScrollable) {
      mainScrollable.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Also check periodically as a fallback
    const intervalId = setInterval(checkForPageChange, 2000); // Check every 2 seconds

    // Use the new RoamService sidebar monitoring system
    const handleSidebarChange = () => {
      if (updateContextTimeoutRef.current) {
        clearTimeout(updateContextTimeoutRef.current);
      }
      updateContextTimeoutRef.current = setTimeout(() => {
        updatePageContext();
      }, 200); // Quick response for sidebar changes
    };

    // Register with RoamService's sidebar monitoring system
    const cleanupSidebarMonitoring =
      RoamService.onSidebarChange(handleSidebarChange);

    return () => {
      if (updateContextTimeoutRef.current) {
        clearTimeout(updateContextTimeoutRef.current);
        updateContextTimeoutRef.current = null;
      }
      window.removeEventListener("hashchange", handleHashChange);
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", handleScroll);
      if (mainScrollable) {
        mainScrollable.removeEventListener('scroll', handleScroll);
      }
      observer.disconnect();
      cleanupSidebarMonitoring(); // Cleanup the sidebar monitoring
      clearInterval(intervalId);
    };
  }, [isOpen, updatePageContext]);

  const addMessage = (
    message: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }
  ) => {
    const newMessage: ChatMessage = {
      ...message,
      id: message.id || Date.now().toString(),
      timestamp: new Date(),
    };

    setState((prev) => {
      const updatedMessages = [...prev.messages, newMessage];

      // Check if this is the first message using ref for immediate sync check
      if (!conversationIdRef.current && prev.messages.length === 0) {
        const newConversationId = `conv_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Set both ref and state immediately
        conversationIdRef.current = newConversationId;
        setCurrentConversationId(newConversationId);

        // Save immediately for new conversation to prevent race condition
        requestAnimationFrame(async () => {
          try {
            // Extract context for title generation
            const contextForTitle = pageContext ? 
              pageContext.currentPage?.title || 
              (pageContext.visibleBlocks && pageContext.visibleBlocks.length > 0 ? 
                pageContext.visibleBlocks[0]?.string : '') ||
              pageContext.selectedText ||
              'Current Page'
              : undefined;
              
            await ConversationService.saveConversationWithId(
              newConversationId,
              updatedMessages,
              contextForTitle,
              pageContext || undefined
            );
            
            // Lock context after saving first message
            if (pageContext) {
              console.log('🔒 Context locked for new conversation:', newConversationId);
              setPreservedContext(pageContext);
              setIsContextLocked(true);
            }
            console.log(
              "Immediately saved new conversation:",
              newConversationId
            );
          } catch (error) {
            console.error(
              "Failed to immediately save new conversation:",
              error
            );
          }
        });
      } else {
        // For existing conversations or subsequent messages, use debounced save
        requestAnimationFrame(() => {
          saveConversationDebounced(updatedMessages);
        });
      }

      return {
        ...prev,
        messages: updatedMessages,
      };
    });
  };

  // Helper methods for extracting references
  const extractPageReferences = (text: string): string[] => {
    const pageRefPattern = /\[\[([^\]]+)\]\]/g;
    const matches = [];
    let match;

    while ((match = pageRefPattern.exec(text)) !== null) {
      matches.push(match[1]);
    }

    return [...new Set(matches)]; // Remove duplicates
  };

  const extractBlockReferences = (text: string): string[] => {
    const blockRefPattern = /\(\(([^)]+)\)\)/g;
    const matches = [];
    let match;

    while ((match = blockRefPattern.exec(text)) !== null) {
      matches.push(match[1]);
    }

    return [...new Set(matches)]; // Remove duplicates
  };

  const handleSendMessage = async (
    messageInput: string | any,
    templateInfo?: { id: string; prompt: string }
  ) => {
    if (state.isLoading) return;

    let userMessage: string;
    let finalUserMessage: string;

    // Handle both string input (legacy) and editor JSON
    if (typeof messageInput === "string") {
      userMessage = messageInput.trim();
      if (!userMessage) return;
      finalUserMessage = userMessage;
    } else {
      // Handle TipTap editor JSON
      try {
        // Extract serialized text with references for display (preserves ((UID)) format)
        userMessage = PromptBuilder.serializeForStorage(messageInput);
        if (!userMessage.trim()) return;

        // Get model-specific token limit
        const currentModel = multiProviderSettings.currentModel;
        const provider = await AIService.getProviderForModel(currentModel);
        // console.log(`DEBUG: Model "${currentModel}" detected provider:`, provider?.provider?.id || 'null');
        const maxTokens = RoamService.getModelTokenLimit(
          provider?.provider?.id || "openai",
          currentModel
        );

        // Build expanded prompt with reference content
        const promptResult = await PromptBuilder.buildPrompt(
          messageInput,
          maxTokens
        );
        finalUserMessage = promptResult.text;

        console.log("Prompt expansion result:", {
          originalLength: userMessage.length,
          expandedLength: finalUserMessage.length,
          referencesExpanded: promptResult.metadata.referencesExpanded,
          estimatedTokens: promptResult.metadata.totalTokensEstimate,
          truncated: promptResult.metadata.truncated,
        });
      } catch (error) {
        console.error("Error processing editor content:", error);
        // Fallback to string conversion
        userMessage = String(messageInput).trim();
        if (!userMessage) return;
        finalUserMessage = userMessage;
      }
    }

    // Check if we're using a selected template
    let customPrompt: string | undefined = undefined;
    let actualUserMessage = finalUserMessage;
    let templateRequiresCurrentPage = false;

    // Check if we have template info passed directly or from state
    const currentTemplate = templateInfo || selectedTemplate;

    if (currentTemplate) {
      customPrompt = currentTemplate.prompt;
      actualUserMessage = ""; // Clear user message since we're using the template as system prompt
      console.log(
        "🎯 Using template:",
        currentTemplate.id,
        "- using as custom system prompt"
      );
      console.log(
        "🎯 Custom prompt set to:",
        customPrompt.substring(0, 100) + "..."
      );

      // Check if this template requires current page context
      const template = PROMPT_TEMPLATES.find(
        (t) => t.id === currentTemplate.id
      );
      templateRequiresCurrentPage =
        template?.requiresContext === true &&
        template?.contextType === "current-page";

      if (templateRequiresCurrentPage) {
        console.log(
          "🔄 Template requires current page context, will refresh context"
        );
      }

      // Clear the selected template state if it was used
      if (selectedTemplate) {
        setSelectedTemplate(null);
      }
    } else {
      console.log("📝 No template selected. User message will be sent as-is.");
      console.log(
        "📝 First 100 chars of user message:",
        userMessage.substring(0, 100)
      );
    }

    // If we have a custom prompt but no actual user message, provide a default prompt to trigger AI response
    if (customPrompt && !actualUserMessage.trim()) {
      actualUserMessage =
        "Please analyze the current context and provide insights.";
    }

    // Clear input value
    setInputValue("");

    // Check if message contains date references and add cached notes
    const datePattern = /\[(\d{4}-\d{2}-\d{2})\]/g;
    const dateMatches = userMessage.match(datePattern);

    if (dateMatches && !customPrompt) {
      // Only add date notes if we're not using a custom prompt template
      for (const dateMatch of dateMatches) {
        const dateString = dateMatch.slice(1, -1); // Remove brackets
        const cachedNotes = dateNotesCache[dateString];

        if (cachedNotes) {
          actualUserMessage += `\n\nHere are my notes from ${dateString}:\n${cachedNotes}`;
        } else {
          actualUserMessage += `\n\nNote: No notes found for ${dateString}.`;
        }
      }
    }

    // Add user message (display the template content if using template, otherwise original message)
    addMessage({
      role: "user",
      content: customPrompt ? customPrompt : userMessage,
    });

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // If template requires current page context, refresh it
      let currentContext = pageContext;
      if (templateRequiresCurrentPage) {
        console.log("🔄 Refreshing page context for template");
        try {
          await updatePageContext(true); // Force update for template
          // updatePageContext updates the state, but we need immediate access
          const latestContext = await RoamService.getPageContext();
          currentContext = latestContext;
          console.log(
            "✅ Got fresh context for template, current page:",
            latestContext?.currentPage?.title || "None"
          );
        } catch (error) {
          console.error("❌ Failed to refresh context for template:", error);
          // Continue with existing context
        }
      }

      // Extract page references and block references from the message
      const pageReferences = extractPageReferences(actualUserMessage);
      const blockReferences = extractBlockReferences(actualUserMessage);

      // Check if user has explicitly referenced specific content
      const hasExplicitReferences =
        pageReferences.length > 0 || blockReferences.length > 0;

      // For TipTap editor input, also check if references were expanded
      let hasEditorReferences = false;
      if (typeof messageInput !== "string") {
        try {
          // Check if the original editor JSON contains reference chips
          const promptResult = await PromptBuilder.buildPrompt(
            messageInput,
            1000
          ); // Small limit just to check
          hasEditorReferences = promptResult.metadata.referencesExpanded > 0;
        } catch (error) {
          // Ignore error, just continue
        }
      }

      const hasSpecificIntent = hasExplicitReferences || hasEditorReferences;

      // Create filtered context based on user intent
      let filteredContext = currentContext;
      if (hasSpecificIntent) {
        // User has specific intent - exclude ambient context to avoid confusion
        console.log(
          "🎯 User has specific intent, filtering out ambient context"
        );
        filteredContext = {
          currentPage: undefined, // Don't include current page content
          visibleBlocks: [], // Don't include visible blocks
          selectedText: undefined, // Don't include selected text
          dailyNote: undefined, // Don't include daily note
          linkedReferences: [], // Don't include current page's backlinks
        };
      } else {
        console.log(
          "🌍 No specific intent detected, using full ambient context"
        );
      }

      // Build enhanced context using ContextManager
      let contextString = "";
      let contextItems = [];

      console.log("🔍 Building enhanced context for:", {
        pageReferences,
        blockReferences,
        hasSpecificIntent,
        currentPage: currentContext?.currentPage?.title,
        strategy: hasSpecificIntent ? "specific-intent" : "ambient-context",
      });

      const contextManager = new ContextManager({
        maxDepth: 3,
        maxItems: 50,
        includeBacklinks: true,
        includeBlockRefs: true,
        includeParentBlocks: true,
        includeSiblingBlocks: true,
        includeAncestorPath: true,
        includeBacklinkChildren: false, // Don't include all children by default to avoid too much content
        autoIncludeMinimalBacklinkChildren: true, // But auto-include children for backlinks that only contain page references
      });

      // Determine pages to include based on user intent
      let pagesToInclude: string[] = [];
      if (hasSpecificIntent) {
        // Only include explicitly referenced pages
        pagesToInclude = pageReferences;
      } else {
        // Include current page if no specific references
        const currentPageTitle = currentContext?.currentPage?.title;
        pagesToInclude = currentPageTitle ? [currentPageTitle] : [];
      }

      contextItems = await contextManager.buildContext(
        pagesToInclude,
        blockReferences
      );

      // Respect user exclusions from the preview bar
      if (excludedContextUids.size > 0) {
        contextItems = contextItems.filter(
          (item: any) => !excludedContextUids.has(item.uid)
        );
      }

      let enhancedUserMessage = actualUserMessage;
      
      // Determine if this is the first round of conversation
      const isFirstRound = state.messages.length === 0;
      const isFirstRoundWithTemplate = isFirstRound && !!customPrompt;
      
      console.log("🔄 Conversation stage:", {
        isFirstRound,
        isFirstRoundWithTemplate,
        hasCustomPrompt: !!customPrompt,
        messagesCount: state.messages.length
      });

      // Always use enhanced context from ContextManager for consistency
      enhancedUserMessage = actualUserMessage; // Never add context to user message
      
      if (contextItems.length > 0) {
        // Use ContextManager formatting for consistent context structure
        contextString = contextManager.formatContextForAI(contextItems);
        console.log(`✅ Using enhanced context with ${contextItems.length} items (consistently through system message)`);
      } else if (filteredContext) {
        // Fallback to RoamService formatting if no enhanced context available
        const currentModel = multiProviderSettings.currentModel;
        const provider = await AIService.getProviderForModel(currentModel);
        contextString = RoamService.formatContextForAI(
          filteredContext,
          8000,
          provider?.provider?.id || "openai",
          currentModel
        );
        console.log("⚠️ Using fallback context from RoamService");
      } else {
        contextString = "No context available";
        console.log("ℹ️ No context available");
      }

      console.log("Sending message with context:", {
        isFirstRound,
        isFirstRoundWithTemplate,
        currentPage: filteredContext?.currentPage?.title,
        traditionalBlocksCount:
          filteredContext?.currentPage?.blocks?.length || 0,
        enhancedContextItems: contextItems.length,
        model: multiProviderSettings.currentModel,
        dateNotesIncluded: dateMatches ? dateMatches.length : 0,
        originalMessageLength: actualUserMessage.length,
        enhancedMessageLength: enhancedUserMessage.length,
        usingEnhancedContext: contextItems.length > 0,
        contextStringLength: contextString.length,
        contextPreview: contextString.substring(0, 300) + "...",
        conversationHistoryLength: state.messages.length,
      });

      // Create a streaming message placeholder with model info
      const streamingMessageId = `streaming_${Date.now()}`;
      let streamingContent = "";

      // Get model info before creating the streaming message
      const currentModel = multiProviderSettings.currentModel;
      const provider = await AIService.getProviderForModel(currentModel);
      const currentProvider = provider?.provider?.id || "ollama";

      addMessage({
        role: "assistant",
        content: "",
        id: streamingMessageId,
        isStreaming: true,
        model: currentModel,
        modelProvider: currentProvider,
      });

      try {
        // Create a new AbortController for this request
        const abortController = new AbortController();
        currentRequestAbortController.current = abortController;

        // Use streaming response
        console.log("🚀 Calling AI service with:", {
          userMessage: enhancedUserMessage,
          hasCustomPrompt: !!customPrompt,
          customPrompt: customPrompt,
        });

        let streamGenerator: AsyncGenerator<{
          text: string;
          isComplete: boolean;
          usage?: any;
        }>;

        try {
          streamGenerator = AIService.sendMessageWithCurrentModelStream(
            enhancedUserMessage,
            contextString,
            state.messages,
            customPrompt,
            abortController.signal
          );
        } catch (initError: any) {
          // Handle immediate errors (like invalid API key) before streaming starts
          console.error("❌ Error initializing stream:", initError);
          throw initError;
        }

        try {
          for await (const chunk of streamGenerator) {
            // Check if request was cancelled - just exit without changing content
            // The handleCancelRequest already updated the message state
            if (abortController.signal.aborted) {
              console.log("🛑 Stream processing cancelled, exiting gracefully");
              return;
            }

            if (chunk.isComplete) {
              // Check if there's an error in the chunk
              if ("error" in chunk && chunk.error) {
                console.error("❌ Stream completed with error:", chunk.error);
                // Update message with error and stop streaming
                setState((prev) => {
                  const updatedMessages = prev.messages.map((msg) =>
                    msg.id === streamingMessageId
                      ? {
                          ...msg,
                          content: `❌ Error: ${chunk.error}`,
                          isStreaming: false,
                        }
                      : msg
                  );

                  console.log(
                    "🔧 Stream error detected - setting isStreaming to false"
                  );

                  // Save conversation even after error
                  requestAnimationFrame(() => {
                    saveConversationDebounced(updatedMessages);
                  });

                  return {
                    ...prev,
                    messages: updatedMessages,
                  };
                });
                return; // Exit the function early
              }

              // Update final message with usage info (normal completion)
              setState((prev) => {
                const updatedMessages = prev.messages.map((msg) =>
                  msg.id === streamingMessageId
                    ? { ...msg, isStreaming: false, usage: chunk.usage }
                    : msg
                );

                // Save conversation after streaming is complete
                requestAnimationFrame(() => {
                  saveConversationDebounced(updatedMessages);
                });

                return {
                  ...prev,
                  messages: updatedMessages,
                };
              });
              break;
            } else {
              // Update streaming content
              streamingContent += chunk.text;
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === streamingMessageId
                    ? { ...msg, content: streamingContent }
                    : msg
                ),
              }));

              // Scrolling is handled by MessageList component
            }
          }
        } catch (streamIterationError: any) {
          console.error(
            "❌ Error during stream iteration:",
            streamIterationError
          );

          // Check if this is an abort error (user cancellation)
          const isAbortError =
            streamIterationError.name === "AbortError" ||
            streamIterationError.message.includes("aborted") ||
            streamIterationError.message.includes(
              "BodyStreamBuffer was aborted"
            ) ||
            currentRequestAbortController.current?.signal.aborted ||
            false;

          if (isAbortError) {
            console.log("🛑 Stream iteration stopped due to user cancellation");
            // Don't update the message content - handleCancelRequest already did
            return;
          }

          // Handle real errors
          setState((prev) => {
            const updatedMessages = prev.messages.map((msg) =>
              msg.id === streamingMessageId
                ? {
                    ...msg,
                    content: `❌ Error: ${streamIterationError.message}`,
                    isStreaming: false,
                  }
                : msg
            );

            console.log(
              "🔧 Stream iteration error - setting isStreaming to false"
            );

            return {
              ...prev,
              messages: updatedMessages,
            };
          });

          // Don't re-throw here, as we've handled the error
          return;
        }

        // Model info is already set when creating the streaming message, just update the final state
        setState((prev) => {
          const updatedMessages = prev.messages.map((msg) =>
            msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg
          );

          // Save conversation after streaming is complete
          requestAnimationFrame(() => {
            saveConversationDebounced(updatedMessages);
          });

          return {
            ...prev,
            messages: updatedMessages,
          };
        });
      } catch (streamingError: any) {
        console.error("❌ Streaming error caught:", streamingError);

        // Check if the error is due to cancellation
        const isAbortError =
          streamingError.name === "AbortError" ||
          streamingError.message.includes("aborted") ||
          streamingError.message.includes("BodyStreamBuffer was aborted") ||
          currentRequestAbortController.current?.signal.aborted ||
          false;

        if (isAbortError) {
          console.log("🛑 Request was cancelled - preserving partial content");
          // Don't update the message content - handleCancelRequest already did
          return;
        }

        // Handle real errors
        console.log(
          "🔧 Handling real streaming error:",
          streamingError.message
        );
        setState((prev) => {
          const updatedMessages = prev.messages.map((msg) =>
            msg.id === streamingMessageId
              ? {
                  ...msg,
                  content: `❌ Error: ${streamingError.message}`,
                  isStreaming: false,
                }
              : msg
          );

          console.log(
            "🔧 Updated streaming message with error, isStreaming set to false"
          );

          // Save conversation even after error
          requestAnimationFrame(() => {
            saveConversationDebounced(updatedMessages);
          });

          return {
            ...prev,
            messages: updatedMessages,
          };
        });
      }
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
      // Clear the abort controller if it still exists
      currentRequestAbortController.current = null;
    }
  };

  const handleCancelRequest = () => {
    if (currentRequestAbortController.current) {
      console.log("🛑 User requested cancellation");
      currentRequestAbortController.current.abort();

      // Find the currently streaming message and mark it as cancelled but keep content
      setState((prev) => {
        const updatedMessages = prev.messages.map((msg) => {
          if (msg.isStreaming) {
            const currentContent = msg.content || "";
            return {
              ...msg,
              content:
                currentContent +
                (currentContent ? "\n\n" : "") +
                "*[Request cancelled by user]*",
              isStreaming: false,
            };
          }
          return msg;
        });

        // Save conversation with current state
        requestAnimationFrame(() => {
          saveConversationDebounced(updatedMessages);
        });

        return {
          ...prev,
          messages: updatedMessages,
        };
      });

      currentRequestAbortController.current = null;
    }
  };

  const handleModelChange = (newModel: string) => {
    console.log("Model changed to:", newModel);
    // The model is already updated in the ChatInput component
    // We could add additional logic here if needed
  };

  const handleCopyMessage = async (content: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(messageIndex);
      setTimeout(() => setCopiedMessageIndex(null), 2000); // Reset after 2 seconds
      console.log("Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy message:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedMessageIndex(messageIndex);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    }
  };

  // Auto-save function to be called when new messages are added
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef<boolean>(false);

  const saveConversationDebounced = useCallback(
    (messages: ChatMessage[]) => {
      if (isUnmounting) return;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Set new timeout
      saveTimeoutRef.current = setTimeout(async () => {
        if (isUnmounting || isSavingRef.current) return;

        isSavingRef.current = true;

        try {
          // Use ref to get the latest conversation ID synchronously
          const latestConversationId = conversationIdRef.current;

          if (latestConversationId) {
            // Always try to update existing conversation first
            try {
              await ConversationService.updateConversation(
                latestConversationId,
                messages
              );
              console.log(
                "Updated existing conversation:",
                latestConversationId
              );
            } catch (updateError) {
              console.log(
                "Conversation doesn't exist yet, creating:",
                latestConversationId
              );
              // If update fails, the conversation doesn't exist yet, so create it
              // Extract context for title generation
              const contextForTitle = pageContext ? 
                pageContext.currentPage?.title || 
                (pageContext.visibleBlocks && pageContext.visibleBlocks.length > 0 ? 
                  pageContext.visibleBlocks[0]?.string : '') ||
                pageContext.selectedText ||
                'Current Page'
                : undefined;
                
              await ConversationService.saveConversationWithId(
                latestConversationId,
                messages,
                contextForTitle,
                pageContext || undefined
              );
            }
          } else {
            // This should rarely happen now due to immediate ID generation
            console.warn("No conversation ID found, creating new conversation");
            // Extract context for title generation
            const contextForTitle = pageContext ? 
              pageContext.currentPage?.title || 
              (pageContext.visibleBlocks && pageContext.visibleBlocks.length > 0 ? 
                pageContext.visibleBlocks[0]?.string : '') ||
              pageContext.selectedText ||
              'Current Page'
              : undefined;
              
            const newConversationId =
              await ConversationService.saveConversation(messages, contextForTitle, pageContext || undefined);
            if (!isUnmounting) {
              conversationIdRef.current = newConversationId;
              setCurrentConversationId(newConversationId);
            }
          }
          console.log("Conversation auto-saved");
        } catch (error) {
          console.error("Failed to auto-save conversation:", error);
        } finally {
          isSavingRef.current = false;
        }
      }, 2000);
    },
    [currentConversationId, isUnmounting]
  );

  const handleConversationSelect = async (conversationId: string) => {
    if (state.isLoading) return;

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Load conversation messages
      const messages = await ConversationService.loadConversationMessages(
        conversationId,
        0,
        100
      );

      // Try to restore preserved context
      const restoredContext = await ConversationService.restorePreservedContext(conversationId);
      if (restoredContext) {
        console.log('🔒 Context locked for conversation:', conversationId);
        setPreservedContext(restoredContext);
        setPageContext(restoredContext);
        setIsContextLocked(true);
      } else {
        console.log('🔓 No preserved context, using current context');
        setIsContextLocked(false);
        setPreservedContext(null);
        // Don't clear pageContext - keep current context as fallback
      }

      setState((prev) => ({
        ...prev,
        messages,
        isLoading: false,
      }));

      conversationIdRef.current = conversationId;
      setCurrentConversationId(conversationId);
      console.log(
        "Loaded conversation:",
        conversationId,
        messages.length,
        "messages"
      );
    } catch (error) {
      console.error("Failed to load conversation:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleNewConversation = () => {
    // Cancel any ongoing request first
    if (currentRequestAbortController.current) {
      currentRequestAbortController.current.abort();
      currentRequestAbortController.current = null;
    }

    setState((prev) => ({
      ...prev,
      messages: [],
      isLoading: false,
    }));
    conversationIdRef.current = null;
    setCurrentConversationId(null);
    setInputValue(""); // Clear input value for new conversation
    
    // Unlock context for new conversation
    console.log('🔓 Context unlocked for new conversation');
    setIsContextLocked(false);
    setPreservedContext(null);
    
    // Refresh current context
    updatePageContext(true);
    setDateNotesCache({}); // Clear date notes cache

    // Update context when starting a new conversation
    // This ensures the new conversation uses the current page's context
    updatePageContext();
  };

  const toggleConversationList = () => {
    setShowConversationList((prev) => !prev);
  };

  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Force reset any stuck resize state that might block interactions
      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }

      // Force reset any stuck drag state
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }

      // Close conversation list if open
      if (showConversationList) {
        setShowConversationList(false);
      }

      // Hide templates if showing
      if (showTemplates) {
        setShowTemplates(false);
      }

      // Call the parent's toggle function to minimize
      onToggle();
    },
    [showConversationList, showTemplates, onToggle, isResizing, isDragging]
  );

  const calculateCenterPosition = () => {
    // Position window so its bottom-right corner aligns with icon center
    const iconMargin = 20;
    const iconSize = 60;
    const iconCenterX = window.innerWidth - iconMargin - iconSize / 2;
    const iconCenterY = window.innerHeight - iconMargin - iconSize / 2;

    // Calculate window position
    const left = iconCenterX - windowSize.width;
    const top = iconCenterY - windowSize.height;

    // Ensure window doesn't go off-screen (but prioritize icon alignment)
    const finalLeft = Math.max(20, left);
    const finalTop = Math.max(20, top);

    return { top: finalTop, left: finalLeft };
  };

  const handlePromptSelect = async (prompt: string) => {
    console.log("📝 Template selected:", prompt.substring(0, 100) + "...");

    try {
      // Import UserTemplateService dynamically to avoid circular imports
      const {
        UserTemplateService,
      } = require("../services/userTemplateService");

      // Get all templates (official + custom) - now async
      const allTemplates = await UserTemplateService.getAllTemplates();

      // Find the template that matches this prompt (try exact match first)
      let template = allTemplates.find((t: any) => t.prompt === prompt);

      // If no exact match, try to find by base prompt (before language instructions)
      if (!template) {
        template = allTemplates.find((t: any) => {
          // Check if the prompt starts with the template's base prompt
          const basePrompt = t.prompt.trim();
          const normalizedPrompt = prompt.trim();

          if (normalizedPrompt.startsWith(basePrompt)) {
            // Check if the remaining part is just language instruction
            const remainingText = normalizedPrompt
              .substring(basePrompt.length)
              .trim();
            return (
              remainingText === "" ||
              remainingText.startsWith("IMPORTANT: Please respond")
            );
          }
          return false;
        });
      }

      if (template) {
        console.log("🎯 Found matching template:", template.id, template.title);

        // Hide templates since we're sending a message
        setShowTemplates(false);

        // Send the prompt directly with template info
        handleSendMessage(prompt, {
          id: template.id,
          prompt: template.prompt, // Use the original template prompt, not the modified one
        });
      } else {
        console.error(
          "❌ No matching template found for prompt:",
          prompt.substring(0, 100) + "..."
        );
        console.log(
          "Available templates:",
          allTemplates.map((t: any) => ({ id: t.id, title: t.title }))
        );
      }
    } catch (error) {
      console.error("Failed to load templates for prompt selection:", error);
      // Fallback: still send the prompt even if we can't match it to a template
      setShowTemplates(false);
      handleSendMessage(prompt);
    }
  };

  const handleDateSelect = (date: string, notes: string) => {
    // Cache the notes for this date
    setDateNotesCache((prev) => ({
      ...prev,
      [date]: notes,
    }));

    // Update input value with new date
    setInputValue((prev) => prev.replace(/\[\d{4}-\d{2}-\d{2}\]/, `[${date}]`));
  };

  const handleTemplateSelect = (templateId: string, prompt: string) => {
    console.log("📝 Template selected from slash command:", templateId);
    // Note: For slash commands, the template content is already in the input
    // We just need to set the template state so it's detected when sent
    setSelectedTemplate({
      id: templateId,
      prompt: prompt,
    });
  };

  // Handle clicks outside conversation list to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showConversationList) return;

      const target = event.target as Element;
      const conversationPanel = document.querySelector(
        ".rr-copilot-conversation-list-panel"
      );
      const menuButton = document.querySelector('[title*="chat list"]');

      // Don't close if clicking on the conversation panel itself or the menu button
      if (conversationPanel && conversationPanel.contains(target)) return;
      if (menuButton && menuButton.contains(target)) return;

      // Close the conversation list
      setShowConversationList(false);
    };

    if (showConversationList) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showConversationList]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    // Prevent resize from interfering with button clicks
    if (
      (e.target as Element).closest("button") ||
      (e.target as Element).closest(".bp4-button")
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    setResizeHandle(handle);
    setStartMousePos({ x: e.clientX, y: e.clientY });
    setStartWindowSize({ width: windowSize.width, height: windowSize.height });
    setStartWindowPos({
      top: windowPosition?.top || 0,
      left: windowPosition?.left || 0,
    });

    document.body.style.cursor = getCursor(handle);
    document.body.style.userSelect = "none";
  };

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeHandle) return;

      const deltaX = e.clientX - startMousePos.x;
      const deltaY = e.clientY - startMousePos.y;

      // Apply constraints
      const minWidth = 400;
      const minHeight = 500;
      const maxWidth = window.innerWidth - 40;
      const maxHeight = window.innerHeight - 40;

      let newWidth = startWindowSize.width;
      let newHeight = startWindowSize.height;
      let newTop = startWindowPos.top;
      let newLeft = startWindowPos.left;

      // Handle different resize directions
      switch (resizeHandle) {
        case "nw": // Northwest corner
          newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWindowSize.width - deltaX)
          );
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startWindowSize.height - deltaY)
          );
          newLeft = startWindowPos.left + (startWindowSize.width - newWidth);
          newTop = startWindowPos.top + (startWindowSize.height - newHeight);
          break;
        case "ne": // Northeast corner
          newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWindowSize.width + deltaX)
          );
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startWindowSize.height - deltaY)
          );
          newTop = startWindowPos.top + (startWindowSize.height - newHeight);
          break;
        case "sw": // Southwest corner
          newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWindowSize.width - deltaX)
          );
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startWindowSize.height + deltaY)
          );
          newLeft = startWindowPos.left + (startWindowSize.width - newWidth);
          break;
        case "se": // Southeast corner
          newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWindowSize.width + deltaX)
          );
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startWindowSize.height + deltaY)
          );
          break;
        case "n": // North edge
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startWindowSize.height - deltaY)
          );
          newTop = startWindowPos.top + (startWindowSize.height - newHeight);
          break;
        case "s": // South edge
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startWindowSize.height + deltaY)
          );
          break;
        case "w": // West edge
          newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWindowSize.width - deltaX)
          );
          newLeft = startWindowPos.left + (startWindowSize.width - newWidth);
          break;
        case "e": // East edge
          newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWindowSize.width + deltaX)
          );
          break;
      }

      // Ensure window stays within screen bounds with improved logic
      // Calculate safe boundaries
      const minLeft = 20;
      const minTop = 0; // Allow touching the top edge
      const maxLeft = Math.max(minLeft, window.innerWidth - newWidth - 20);
      const maxTop = Math.max(minTop, window.innerHeight - newHeight - 40); // Leave more space at bottom

      // Apply boundary constraints more carefully
      // Only constrain if the new position is significantly out of bounds
      if (newLeft < minLeft) {
        newLeft = minLeft;
      } else if (newLeft > maxLeft) {
        newLeft = maxLeft;
      }

      if (newTop < minTop) {
        newTop = minTop;
      } else if (newTop > maxTop) {
        newTop = maxTop;
      }

      setWindowSize({ width: newWidth, height: newHeight });
      setWindowPosition({ top: newTop, left: newLeft });
    },
    [
      isResizing,
      resizeHandle,
      startMousePos.x,
      startMousePos.y,
      startWindowSize.width,
      startWindowSize.height,
      startWindowPos.top,
      startWindowPos.left,
    ]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const getCursor = (handle: string) => {
    switch (handle) {
      case "nw":
        return "nw-resize";
      case "ne":
        return "ne-resize";
      case "sw":
        return "sw-resize";
      case "se":
        return "se-resize";
      case "n":
        return "n-resize";
      case "s":
        return "s-resize";
      case "w":
        return "w-resize";
      case "e":
        return "e-resize";
      default:
        return "default";
    }
  };

  // Window drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons or interactive elements
    const target = e.target as Element;
    if (
      target.closest("button") ||
      target.closest(".bp4-button") ||
      target.closest("input") ||
      target.closest("textarea")
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartWindowPos({
      top: windowPosition?.top || 0,
      left: windowPosition?.left || 0,
    });

    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";
  };

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = e.clientY - dragStartPos.y;

      const newLeft = dragStartWindowPos.left + deltaX;
      const newTop = dragStartWindowPos.top + deltaY;

      // Ensure window doesn't go completely off-screen but allow free movement
      const minVisible = 50; // Keep at least 50px visible
      const maxLeft = window.innerWidth - minVisible; // Can go mostly off right edge
      const maxTop = window.innerHeight - minVisible; // Can go mostly off bottom edge
      const minLeft = -windowSize.width + minVisible; // Can go mostly off left edge
      const minTop = -windowSize.height + minVisible; // Can go mostly off top edge (this is key!)

      const finalLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      const finalTop = Math.max(minTop, Math.min(newTop, maxTop));

      setWindowPosition({ top: finalTop, left: finalLeft });
    },
    [
      isDragging,
      dragStartPos.x,
      dragStartPos.y,
      dragStartWindowPos.left,
      dragStartWindowPos.top,
      windowSize.width,
    ]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Manage resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      // Add mouseleave to handle cases where mouse exits window during resize
      document.addEventListener("mouseleave", handleResizeEnd);
      // Add window blur to reset state if user switches windows
      window.addEventListener("blur", handleResizeEnd);

      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.removeEventListener("mouseleave", handleResizeEnd);
        window.removeEventListener("blur", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Manage drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd);
      // Add mouseleave to handle cases where mouse exits window during drag
      document.addEventListener("mouseleave", handleDragEnd);
      // Add window blur to reset state if user switches windows
      window.addEventListener("blur", handleDragEnd);

      return () => {
        document.removeEventListener("mousemove", handleDragMove);
        document.removeEventListener("mouseup", handleDragEnd);
        document.removeEventListener("mouseleave", handleDragEnd);
        window.removeEventListener("blur", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Cleanup only on actual unmount (no dependencies)
  useEffect(() => {
    return () => {
      setIsUnmounting(true);

      // Clear any pending timeouts
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      if (updateContextTimeoutRef.current) {
        clearTimeout(updateContextTimeoutRef.current);
        updateContextTimeoutRef.current = null;
      }

      // Cancel any ongoing requests
      if (currentRequestAbortController.current) {
        currentRequestAbortController.current.abort();
        currentRequestAbortController.current = null;
      }

      // Cleanup resize state
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []); // Empty dependency array - only runs on actual mount/unmount

  if (state.isMinimized) {
    return (
      <div className="roam-copilot-minimized-container">
        <div
          className="roam-copilot-minimized"
          style={{ position: "relative" }}
        >
          <div
            onClick={onToggle}
            title="Open Roam Copilot"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "60px",
              height: "60px",
              cursor: "pointer",
            }}
          >
            <Icon icon={IconNames.LIGHTBULB} size={24} color="white" />
          </div>
          <Button
            minimal
            small
            icon="cross"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close Copilot"
            style={{
              position: "absolute",
              top: "-8px",
              right: "-8px",
              backgroundColor: "#f55656",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              minWidth: "20px",
              minHeight: "20px",
              padding: "0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="roam-copilot-expanded"
      style={
        isSidebar
          ? {
              position: "relative",
              top: "auto",
              left: "auto",
              transform: "none",
              width: "100%",
              height: "100%",
            }
          : {
              top: windowPosition?.top || "50%",
              left: windowPosition?.left || "50%",
              transform: windowPosition ? "none" : "translate(-50%, -50%)",
              width: windowSize.width,
              height: windowSize.height,
            }
      }
    >
      {/* Resize Handles - disabled in sidebar mode */}
      {!isSidebar && (
        <>
          {/* Corner handles */}
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-nw"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
          />
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-ne"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
          />
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-sw"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
          />
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-se"
            onMouseDown={(e) => handleResizeStart(e, "se")}
          />
          {/* Edge handles */}
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-n"
            onMouseDown={(e) => handleResizeStart(e, "n")}
          />
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-s"
            onMouseDown={(e) => handleResizeStart(e, "s")}
          />
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-w"
            onMouseDown={(e) => handleResizeStart(e, "w")}
          />
          <div
            className="rr-copilot-resize-handle rr-copilot-resize-e"
            onMouseDown={(e) => handleResizeStart(e, "e")}
          />
        </>
      )}

      {/* Conversation List Panel */}
      <ConversationList
        isVisible={showConversationList}
        onToggle={toggleConversationList}
        currentConversationId={currentConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
        isLoading={state.isLoading}
      />

      {/* Main Chat Area */}
      <div
        className="roam-copilot-content-wrapper"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="roam-copilot-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            cursor: isDragging ? "move" : "default",
          }}
          onMouseDown={isSidebar ? undefined : handleDragStart}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Button
              minimal
              small
              icon="menu"
              onClick={toggleConversationList}
              title={showConversationList ? "Hide chat list" : "Show chat list"}
              style={{ marginRight: "4px" }}
            />
            <Button
              minimal
              small
              icon="plus"
              onClick={handleNewConversation}
              title="New Chat"
              disabled={state.isLoading}
              style={{ marginRight: "4px" }}
            />
            <Icon icon={IconNames.LIGHTBULB} size={16} />
            <span>Roam Copilot</span>
            {currentConversationId && (
              <span
                style={{
                  fontSize: "12px",
                  color: "#666",
                  marginLeft: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#69B58E",
                    display: "inline-block",
                  }}
                ></span>
                Saved
              </span>
            )}
          </div>
          <Button
            minimal
            small
            icon="minimize"
            onClick={handleMinimize}
            title="Minimize Copilot"
            style={{
              transition: "all 0.2s ease",
              borderRadius: "4px",
            }}
          />
        </div>

        <div
          className="roam-copilot-content"
          style={{
            position: "relative",
            height: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {state.messages.length === 0 || showTemplates ? (
              <div
                style={{
                  height: "100%",
                  overflow: "auto",
                  position: "relative",
                }}
              >
                {/* Close button for templates when in overlay mode */}
                {state.messages.length > 0 && showTemplates && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      zIndex: 10,
                    }}
                  >
                    <Button
                      minimal
                      small
                      icon="cross"
                      onClick={() => setShowTemplates(false)}
                      title="Hide prompt templates"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                        border: "1px solid #e1e4e8",
                      }}
                    />
                  </div>
                )}
                <PromptTemplatesGrid onPromptSelect={handlePromptSelect} />
              </div>
            ) : (
              <>
                <MessageList
                  messages={state.messages}
                  isLoading={state.isLoading}
                  onCopyMessage={handleCopyMessage}
                  copiedMessageIndex={copiedMessageIndex}
                  currentModel={multiProviderSettings.currentModel}
                  currentProvider={(() => {
                    const currentModel = multiProviderSettings.currentModel;

                    // First check if the model is in any provider's static models list
                    const staticProvider = AI_PROVIDERS.find((p) =>
                      p.models.includes(currentModel)
                    );
                    if (staticProvider) {
                      return staticProvider.id;
                    }

                    // Use pattern matching to determine provider
                    const modelLower = currentModel.toLowerCase();

                    if (modelLower.includes("gpt")) return "openai";
                    if (modelLower.includes("claude")) return "anthropic";
                    if (
                      modelLower.includes("llama") &&
                      !modelLower.includes("meta-llama")
                    )
                      return "groq";
                    if (modelLower.includes("grok")) return "xai";
                    if (
                      modelLower.includes("phi") ||
                      modelLower.includes("meta-llama")
                    )
                      return "github";
                    if (modelLower.includes("gemini")) return "gemini";

                    // Default to ollama for unrecognized models (likely local)
                    return "ollama";
                  })()}
                />
              </>
            )}
          </div>

          {/* Context Preview moved into ChatInput for placement control */}

          <ChatInput
            placeholder={UI_CONSTANTS.CHAT_INPUT.PLACEHOLDER_TEXT}
            onSend={handleSendMessage}
            disabled={false} // Don't disable input while loading
            onModelChange={handleModelChange}
            value={inputValue}
            onChange={setInputValue}
            onDateSelect={handleDateSelect}
            onTemplateSelect={handleTemplateSelect}
            isLoading={state.isLoading} // Pass loading state for send button
            onCancel={handleCancelRequest} // Pass cancel handler
            context={pageContext}
            onExcludeContextBlock={handleExcludeFromContext}
            isContextLocked={isContextLocked}
          />
        </div>
      </div>
    </div>
  );
};
