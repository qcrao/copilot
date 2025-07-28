// src/components/CopilotWidget.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Icon, Spinner } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
// Removing chatscope imports - using custom MessageList now
import { ChatMessage, CopilotState, PageContext, ConversationListState } from "../types";
import { AIService } from "../services/aiService";
import { RoamService } from "../services/roamService";
import { ConversationService } from "../services/conversationService";
import { ContextManager } from "../services/contextManager";
import { aiSettings, multiProviderSettings } from "../settings";
import { AI_PROVIDERS } from "../types";
import { ChatInput } from "./ChatInput";
import { ConversationList } from "./ConversationList";
import { PromptTemplatesGrid } from "./PromptTemplatesGrid";
import { MessageList } from "./MessageList";
import { PromptBuilder } from "../utils/promptBuilder";
import { useMemoryManager } from "../utils/memoryManager";
import { PerformanceMonitor } from "../utils/performance";

interface CopilotWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const CopilotWidget: React.FC<CopilotWidgetProps> = ({
  isOpen,
  onToggle,
  onClose,
}) => {
  const { registerCleanup, createManagedTimeout } = useMemoryManager();
  
  const [state, setState] = useState<CopilotState>({
    isOpen,
    isMinimized: !isOpen,
    messages: [],
    isLoading: false,
  });

  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    conversationIdRef.current = currentConversationId;
  }, [currentConversationId]);
  const [inputValue, setInputValue] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [dateNotesCache, setDateNotesCache] = useState<{[date: string]: string}>({});
  const [windowPosition, setWindowPosition] = useState<{top: number, left: number} | null>(null);
  const [windowSize, setWindowSize] = useState<{width: number, height: number}>({
    width: Math.min(window.innerWidth * 0.5, 1200),
    height: Math.min(window.innerHeight * 0.8, 1000)
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startMousePos, setStartMousePos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [startWindowSize, setStartWindowSize] = useState<{width: number, height: number}>({width: 0, height: 0});
  const [startWindowPos, setStartWindowPos] = useState<{top: number, left: number}>({top: 0, left: 0});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [dragStartWindowPos, setDragStartWindowPos] = useState<{top: number, left: number}>({top: 0, left: 0});
  const [isUnmounting, setIsUnmounting] = useState(false);
  const [lastContextUpdate, setLastContextUpdate] = useState<number>(0);
  const [isUpdatingContext, setIsUpdatingContext] = useState<boolean>(false);
  const updateContextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const updatePageContext = useCallback(async () => {
    if (isUnmounting || isUpdatingContext) return;
    
    // Prevent rapid successive updates that could cause infinite loops
    const now = Date.now();
    const timeSinceLastUpdate = now - lastContextUpdate;
    const MIN_UPDATE_INTERVAL = 1000; // 1 second minimum between updates
    
    if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
      console.log(`⏳ Context update throttled (${timeSinceLastUpdate}ms since last update)`);
      return;
    }
    
    // Clear any pending timeout
    if (updateContextTimeoutRef.current) {
      clearTimeout(updateContextTimeoutRef.current);
      updateContextTimeoutRef.current = null;
    }
    
    try {
      setIsUpdatingContext(true);
      setLastContextUpdate(now);
      console.log("🔄 Updating page context...");
      
      const context = await PerformanceMonitor.measure("updatePageContext", async () => {
        return await RoamService.getPageContext();
      });
      
      if (!isUnmounting) {
        setPageContext(context);
        console.log("✅ Page context updated successfully");
      }
    } catch (error) {
      console.error("❌ Failed to get page context:", error);
      // Reset throttle on error to allow retry
      setLastContextUpdate(0);
    } finally {
      setIsUpdatingContext(false);
    }
  }, [isUnmounting, lastContextUpdate, isUpdatingContext]);

  useEffect(() => {
    if (isOpen) {
      updatePageContext();
    }
  }, [isOpen, updatePageContext]);

  // Remove all page change listeners - context should only update on widget open or new conversation
  // This prevents context from changing while user is in the middle of a conversation

  const addMessage = (message: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }) => {
    const newMessage: ChatMessage = {
      ...message,
      id: message.id || Date.now().toString(),
      timestamp: new Date(),
    };

    setState((prev) => {
      const updatedMessages = [...prev.messages, newMessage];
      
      // Check if this is the first message using ref for immediate sync check
      if (!conversationIdRef.current && prev.messages.length === 0) {
        const newConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Set both ref and state immediately
        conversationIdRef.current = newConversationId;
        setCurrentConversationId(newConversationId);
        
        // Save immediately for new conversation to prevent race condition
        requestAnimationFrame(async () => {
          try {
            await ConversationService.saveConversationWithId(newConversationId, updatedMessages);
            console.log("Immediately saved new conversation:", newConversationId);
          } catch (error) {
            console.error("Failed to immediately save new conversation:", error);
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

  const handleSendMessage = async (messageInput: string | any) => {
    if (state.isLoading) return;

    let userMessage: string;
    let finalUserMessage: string;

    // Handle both string input (legacy) and editor JSON
    if (typeof messageInput === 'string') {
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
          provider?.provider?.id || 'openai', 
          currentModel
        );

        // Build expanded prompt with reference content
        const promptResult = await PromptBuilder.buildPrompt(messageInput, maxTokens);
        finalUserMessage = promptResult.text;

        console.log("Prompt expansion result:", {
          originalLength: userMessage.length,
          expandedLength: finalUserMessage.length,
          referencesExpanded: promptResult.metadata.referencesExpanded,
          estimatedTokens: promptResult.metadata.totalTokensEstimate,
          truncated: promptResult.metadata.truncated
        });
      } catch (error) {
        console.error("Error processing editor content:", error);
        // Fallback to string conversion
        userMessage = String(messageInput).trim();
        if (!userMessage) return;
        finalUserMessage = userMessage;
      }
    }

    // Clear input value
    setInputValue("");

    // Check if message contains date references and add cached notes
    const datePattern = /\[(\d{4}-\d{2}-\d{2})\]/g;
    const dateMatches = userMessage.match(datePattern);
    
    if (dateMatches) {
      for (const dateMatch of dateMatches) {
        const dateString = dateMatch.slice(1, -1); // Remove brackets
        const cachedNotes = dateNotesCache[dateString];
        
        if (cachedNotes) {
          finalUserMessage += `\n\nHere are my notes from ${dateString}:\n${cachedNotes}`;
        } else {
          finalUserMessage += `\n\nNote: No notes found for ${dateString}.`;
        }
      }
    }

    // Add user message (display the original without expanded references)
    addMessage({
      role: "user",
      content: userMessage,
    });

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Extract page references and block references from the message
      const pageReferences = extractPageReferences(finalUserMessage);
      const blockReferences = extractBlockReferences(finalUserMessage);
      
      // Check if user has explicitly referenced specific content
      const hasExplicitReferences = pageReferences.length > 0 || blockReferences.length > 0;
      
      // For TipTap editor input, also check if references were expanded
      let hasEditorReferences = false;
      if (typeof messageInput !== 'string') {
        try {
          // Check if the original editor JSON contains reference chips
          const promptResult = await PromptBuilder.buildPrompt(messageInput, 1000); // Small limit just to check
          hasEditorReferences = promptResult.metadata.referencesExpanded > 0;
        } catch (error) {
          // Ignore error, just continue
        }
      }

      const hasSpecificIntent = hasExplicitReferences || hasEditorReferences;

      // Use existing pageContext but filter based on user intent
      const currentContext = pageContext;
      
      // Create filtered context based on user intent
      let filteredContext = currentContext;
      if (hasSpecificIntent) {
        // User has specific intent - exclude ambient context to avoid confusion
        console.log("🎯 User has specific intent, filtering out ambient context");
        filteredContext = {
          currentPage: undefined, // Don't include current page content
          visibleBlocks: [], // Don't include visible blocks
          selectedText: undefined, // Don't include selected text
          dailyNote: undefined, // Don't include daily note
          linkedReferences: [], // Don't include current page's backlinks
        };
      } else {
        console.log("🌍 No specific intent detected, using full ambient context");
      }

      // Build enhanced context using ContextManager
      let contextString = "";
      let contextItems = [];
      
      console.log("🔍 Building enhanced context for:", {
        pageReferences,
        blockReferences,
        hasSpecificIntent,
        currentPage: currentContext?.currentPage?.title,
        strategy: hasSpecificIntent ? "specific-intent" : "ambient-context"
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

      let enhancedUserMessage = finalUserMessage;
      
      if (contextItems.length > 0) {
        // Add key context information directly to user message
        const contextForUser = contextManager.formatContextForAI(contextItems);
        
        // Build enhanced user message with context information embedded
        enhancedUserMessage = `${finalUserMessage}

**Please answer based on the following relevant information:**

${contextForUser}`;

        // Use simplified context for system message
        contextString = filteredContext
          ? RoamService.formatContextForAI(filteredContext, 8000) // Reduce system message context
          : "No additional context available";
          
        console.log("✅ Using enhanced context with", contextItems.length, "items in USER MESSAGE");
      } else {
        // Fallback to traditional context only if enhanced context fails
        console.log("⚠️ Enhanced context failed, falling back to traditional context");
        const currentModel = multiProviderSettings.currentModel;
        const provider = await AIService.getProviderForModel(currentModel);
        const maxContextTokens = RoamService.getModelTokenLimit(
          provider?.provider?.id || 'openai', 
          currentModel
        );

        contextString = filteredContext
          ? RoamService.formatContextForAI(filteredContext, maxContextTokens)
          : "No context available";
      }

      console.log("Sending message with context:", {
        currentPage: filteredContext?.currentPage?.title,
        traditionalBlocksCount: filteredContext?.currentPage?.blocks?.length || 0,
        enhancedContextItems: contextItems.length,
        model: multiProviderSettings.currentModel,
        dateNotesIncluded: dateMatches ? dateMatches.length : 0,
        originalMessageLength: finalUserMessage.length,
        enhancedMessageLength: enhancedUserMessage.length,
        usingEnhancedContext: contextItems.length > 0,
        contextStringLength: contextString.length,
        contextPreview: contextString.substring(0, 300) + "..."
      });

      // Create a streaming message placeholder with model info
      const streamingMessageId = `streaming_${Date.now()}`;
      let streamingContent = "";
      
      // Get model info before creating the streaming message
      const currentModel = multiProviderSettings.currentModel;
      const provider = await AIService.getProviderForModel(currentModel);
      const currentProvider = provider?.provider?.id || 'ollama';
      
      addMessage({
        role: "assistant",
        content: "",
        id: streamingMessageId,
        isStreaming: true,
        model: currentModel,
        modelProvider: currentProvider,
      });

      try {
        // Use streaming response
        const streamGenerator = AIService.sendMessageWithCurrentModelStream(
          enhancedUserMessage,
          contextString,
          state.messages
        );

        for await (const chunk of streamGenerator) {
          if (chunk.isComplete) {
            // Update final message with usage info
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

        // Model info is already set when creating the streaming message, just update the final state
        setState((prev) => {
          const updatedMessages = prev.messages.map((msg) =>
            msg.id === streamingMessageId
              ? { ...msg, isStreaming: false }
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
      } catch (streamingError: any) {
        // Model info is already set when creating the streaming message, just update with error
        setState((prev) => {
          const updatedMessages = prev.messages.map((msg) =>
            msg.id === streamingMessageId
              ? { 
                  ...msg, 
                  content: `❌ Error: ${streamingError.message}`,
                  isStreaming: false
                }
              : msg
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
              await ConversationService.updateConversation(latestConversationId, messages);
              console.log("Updated existing conversation:", latestConversationId);
            } catch (updateError) {
              console.log("Conversation doesn't exist yet, creating:", latestConversationId);
              // If update fails, the conversation doesn't exist yet, so create it
              await ConversationService.saveConversationWithId(latestConversationId, messages);
            }
          } else {
            // This should rarely happen now due to immediate ID generation
            console.warn("No conversation ID found, creating new conversation");
            const newConversationId = await ConversationService.saveConversation(messages);
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
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Load conversation messages
      const messages = await ConversationService.loadConversationMessages(conversationId, 0, 100);
      
      setState(prev => ({
        ...prev,
        messages,
        isLoading: false
      }));
      
      conversationIdRef.current = conversationId;
      setCurrentConversationId(conversationId);
      console.log("Loaded conversation:", conversationId, messages.length, "messages");
    } catch (error) {
      console.error("Failed to load conversation:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleNewConversation = () => {
    setState(prev => ({
      ...prev,
      messages: []
    }));
    conversationIdRef.current = null;
    setCurrentConversationId(null);
    setInputValue(""); // Clear input value for new conversation
    setDateNotesCache({}); // Clear date notes cache
    
    // Update context when starting a new conversation
    // This ensures the new conversation uses the current page's context
    updatePageContext();
  };

  const toggleConversationList = () => {
    setShowConversationList(prev => !prev);
  };

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Force reset any stuck resize state that might block interactions
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    // Force reset any stuck drag state
    if (isDragging) {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
  }, [showConversationList, showTemplates, onToggle, isResizing, isDragging]);

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

  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt);
    
    // Only hide templates if we're in an existing conversation (has messages)
    // Keep templates visible for new conversations (no messages)
    if (state.messages.length > 0) {
      setShowTemplates(false);
    }
  };

  const handleDateSelect = (date: string, notes: string) => {
    // Cache the notes for this date
    setDateNotesCache(prev => ({
      ...prev,
      [date]: notes
    }));
    
    // Update input value with new date
    setInputValue(prev => prev.replace(/\[\d{4}-\d{2}-\d{2}\]/, `[${date}]`));
  };

  // Handle clicks outside conversation list to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showConversationList) return;
      
      const target = event.target as Element;
      const conversationPanel = document.querySelector('.rr-copilot-conversation-list-panel');
      const menuButton = document.querySelector('[title*="chat list"]');
      
      // Don't close if clicking on the conversation panel itself or the menu button
      if (conversationPanel && conversationPanel.contains(target)) return;
      if (menuButton && menuButton.contains(target)) return;
      
      // Close the conversation list
      setShowConversationList(false);
    };

    if (showConversationList) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConversationList]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    // Prevent resize from interfering with button clicks
    if ((e.target as Element).closest('button') || (e.target as Element).closest('.bp4-button')) {
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
      left: windowPosition?.left || 0 
    });
    
    document.body.style.cursor = getCursor(handle);
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
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
      case 'nw': // Northwest corner
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWindowSize.width - deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startWindowSize.height - deltaY));
        newLeft = startWindowPos.left + (startWindowSize.width - newWidth);
        newTop = startWindowPos.top + (startWindowSize.height - newHeight);
        break;
      case 'ne': // Northeast corner
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWindowSize.width + deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startWindowSize.height - deltaY));
        newTop = startWindowPos.top + (startWindowSize.height - newHeight);
        break;
      case 'sw': // Southwest corner
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWindowSize.width - deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startWindowSize.height + deltaY));
        newLeft = startWindowPos.left + (startWindowSize.width - newWidth);
        break;
      case 'se': // Southeast corner
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWindowSize.width + deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startWindowSize.height + deltaY));
        break;
      case 'n': // North edge
        newHeight = Math.max(minHeight, Math.min(maxHeight, startWindowSize.height - deltaY));
        newTop = startWindowPos.top + (startWindowSize.height - newHeight);
        break;
      case 's': // South edge
        newHeight = Math.max(minHeight, Math.min(maxHeight, startWindowSize.height + deltaY));
        break;
      case 'w': // West edge
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWindowSize.width - deltaX));
        newLeft = startWindowPos.left + (startWindowSize.width - newWidth);
        break;
      case 'e': // East edge
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWindowSize.width + deltaX));
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
  }, [isResizing, resizeHandle, startMousePos.x, startMousePos.y, startWindowSize.width, startWindowSize.height, startWindowPos.top, startWindowPos.left]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const getCursor = (handle: string) => {
    switch (handle) {
      case 'nw': return 'nw-resize';
      case 'ne': return 'ne-resize';
      case 'sw': return 'sw-resize';
      case 'se': return 'se-resize';
      case 'n': return 'n-resize';
      case 's': return 's-resize';
      case 'w': return 'w-resize';
      case 'e': return 'e-resize';
      default: return 'default';
    }
  };

  // Window drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons or interactive elements
    const target = e.target as Element;
    if (target.closest('button') || target.closest('.bp4-button') || target.closest('input') || target.closest('textarea')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartWindowPos({ 
      top: windowPosition?.top || 0, 
      left: windowPosition?.left || 0 
    });
    
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
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
  }, [isDragging, dragStartPos.x, dragStartPos.y, dragStartWindowPos.left, dragStartWindowPos.top, windowSize.width]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Manage resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      // Add mouseleave to handle cases where mouse exits window during resize
      document.addEventListener('mouseleave', handleResizeEnd);
      // Add window blur to reset state if user switches windows
      window.addEventListener('blur', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.removeEventListener('mouseleave', handleResizeEnd);
        window.removeEventListener('blur', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Manage drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      // Add mouseleave to handle cases where mouse exits window during drag
      document.addEventListener('mouseleave', handleDragEnd);
      // Add window blur to reset state if user switches windows
      window.addEventListener('blur', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('mouseleave', handleDragEnd);
        window.removeEventListener('blur', handleDragEnd);
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
      
      // Cleanup resize state
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
              cursor: "pointer"
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
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="roam-copilot-expanded" 
      style={{ 
        top: windowPosition?.top || '50%',
        left: windowPosition?.left || '50%',
        transform: windowPosition ? 'none' : 'translate(-50%, -50%)',
        width: windowSize.width,
        height: windowSize.height
      }}
    >
        {/* Resize Handles - 8 directions */}
        {/* Corner handles */}
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-nw" 
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
        />
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-ne" 
          onMouseDown={(e) => handleResizeStart(e, 'ne')}
        />
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-sw" 
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
        />
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-se" 
          onMouseDown={(e) => handleResizeStart(e, 'se')}
        />
        
        {/* Edge handles */}
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-n" 
          onMouseDown={(e) => handleResizeStart(e, 'n')}
        />
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-s" 
          onMouseDown={(e) => handleResizeStart(e, 's')}
        />
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-w" 
          onMouseDown={(e) => handleResizeStart(e, 'w')}
        />
        <div 
          className="rr-copilot-resize-handle rr-copilot-resize-e" 
          onMouseDown={(e) => handleResizeStart(e, 'e')}
        />
        
        {/* Conversation List Panel */}
        <ConversationList
          isVisible={showConversationList}
          onToggle={toggleConversationList}
          currentConversationId={currentConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
        />

        {/* Main Chat Area */}
        <div 
          style={{ 
            height: "100%",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div 
            className="roam-copilot-header" 
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", cursor: isDragging ? 'move' : 'default' }}
            onMouseDown={handleDragStart}
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
                style={{ marginRight: "4px" }}
              />
              <Icon icon={IconNames.LIGHTBULB} size={16} />
              <span>Roam Copilot</span>
              {currentConversationId && (
                <span style={{ fontSize: "12px", color: "#666", marginLeft: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span 
                    style={{ 
                      width: "8px", 
                      height: "8px", 
                      borderRadius: "50%", 
                      backgroundColor: "#69B58E",
                      display: "inline-block"
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
                borderRadius: "4px"
              }}
            />
          </div>

        <div
          style={{
            position: "relative",
            height: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {(state.messages.length === 0 || showTemplates) ? (
              <div style={{ height: "100%", overflow: "auto", position: "relative" }}>
                {/* Close button for templates when in overlay mode */}
                {state.messages.length > 0 && showTemplates && (
                  <div style={{ 
                    position: "absolute", 
                    top: "8px", 
                    right: "8px", 
                    zIndex: 10 
                  }}>
                    <Button
                      minimal
                      small
                      icon="cross"
                      onClick={() => setShowTemplates(false)}
                      title="Hide prompt templates"
                      style={{ 
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                        border: "1px solid #e1e4e8"
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
                  // First check if the model is in any provider's static models list
                  const staticProvider = AI_PROVIDERS.find(p => 
                    p.models.includes(multiProviderSettings.currentModel)
                  );
                  if (staticProvider) {
                    return staticProvider.id;
                  }
                  // If not found in static models, assume it's an Ollama model
                  return 'ollama';
                })()}
                />
              </>
            )}
          </div>

                        <ChatInput
                placeholder="Ask anything — @ for pages, drag blocks, / for prompts"
                onSend={handleSendMessage}
                disabled={false} // Don't disable input while loading
                onModelChange={handleModelChange}
                value={inputValue}
                onChange={setInputValue}
                onDateSelect={handleDateSelect}
                isLoading={state.isLoading} // Pass loading state for send button
              />
        </div>
      </div>
    </div>
  );
};
