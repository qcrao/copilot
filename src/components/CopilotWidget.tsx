// src/components/CopilotWidget.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Icon, Spinner } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
// Removing chatscope imports - using custom MessageList now
import { ChatMessage, CopilotState, PageContext, ConversationListState } from "../types";
import { AIService } from "../services/aiService";
import { RoamService } from "../services/roamService";
import { ConversationService } from "../services/conversationService";
import { aiSettings, multiProviderSettings } from "../settings";
import { AI_PROVIDERS } from "../types";
import { ChatInput } from "./ChatInput";
import { ConversationList } from "./ConversationList";
import { PromptTemplatesGrid } from "./PromptTemplatesGrid";
import { MessageList } from "./MessageList";
import { PromptBuilder } from "../utils/promptBuilder";

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

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isOpen,
      isMinimized: !isOpen,
    }));
    
    // Calculate window position when opening (center of screen)
    if (isOpen && !windowPosition) {
      setWindowPosition(calculateCenterPosition());
    }
  }, [isOpen, windowPosition, windowSize]);

  useEffect(() => {
    if (isOpen) {
      updatePageContext();
    }
  }, [isOpen]);

  useEffect(() => {
    // Listen for page changes in Roam
    const handlePageChange = () => {
      console.log("Page change detected, updating context...");
      updatePageContext();
    };

    // Listen for URL changes (page navigation)
    const handlePopState = () => {
      console.log("URL change detected, updating context...");
      setTimeout(updatePageContext, 100); // Small delay to ensure page is loaded
    };

    // Listen for focus changes (switching between pages)
    const handleFocus = () => {
      if (isOpen) {
        console.log("Focus change detected, updating context...");
        updatePageContext();
      }
    };

    // Add event listeners
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("focus", handleFocus);

    // Also listen for hash changes (Roam uses hash routing)
    window.addEventListener("hashchange", handlePageChange);

    // Use MutationObserver to detect DOM changes that indicate page changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          // Check if the main content area changed
          const hasPageContent = Array.from(mutation.addedNodes).some(
            (node) =>
              node instanceof Element &&
              (node.classList?.contains("roam-main") ||
                node.classList?.contains("rm-title-display") ||
                node.querySelector?.(".rm-title-display"))
          );

          if (hasPageContent) {
            console.log("Page content change detected, updating context...");
            setTimeout(updatePageContext, 200); // Delay to ensure content is rendered
          }
        }
      });
    });

    // Start observing the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("hashchange", handlePageChange);
      observer.disconnect();
    };
  }, [isOpen]);

  const updatePageContext = async () => {
    try {
      const context = await RoamService.getPageContext();
      setPageContext(context);
    } catch (error) {
      console.error("Failed to get page context:", error);
    }
  };

  const addMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setState((prev) => {
      const updatedMessages = [...prev.messages, newMessage];
      // Defer auto-save to avoid render blocking
      requestAnimationFrame(() => {
        saveConversationDebounced(updatedMessages);
      });
      return {
        ...prev,
        messages: updatedMessages,
      };
    });
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
        console.log(`DEBUG: Model "${currentModel}" detected provider:`, provider?.provider?.id || 'null');
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
      // Get fresh context before sending to AI
      const freshContext = await RoamService.getPageContext();
      setPageContext(freshContext);

      // Get model-specific token limit for context
      const currentModel = multiProviderSettings.currentModel;
      const provider = await AIService.getProviderForModel(currentModel);
      const maxContextTokens = RoamService.getModelTokenLimit(
        provider?.provider?.id || 'openai', 
        currentModel
      );

      const contextString = freshContext
        ? RoamService.formatContextForAI(freshContext, maxContextTokens)
        : "No context available";

      console.log("Sending message with context:", {
        currentPage: freshContext?.currentPage?.title,
        blocksCount: freshContext?.currentPage?.blocks?.length || 0,
        model: currentModel,
        dateNotesIncluded: dateMatches ? dateMatches.length : 0,
        messageLength: finalUserMessage.length,
      });

      const response = await AIService.sendMessageWithCurrentModel(
        finalUserMessage,
        contextString,
        state.messages
      );

      const finalProvider = provider?.provider?.id || 'ollama';
      console.log(`DEBUG: Saving message with provider: "${finalProvider}" for model: "${currentModel}"`);
      
      addMessage({
        role: "assistant",
        content: response,
        model: currentModel,
        modelProvider: finalProvider,
      });
    } catch (error: any) {
      const currentModel = multiProviderSettings.currentModel;
      const provider = await AIService.getProviderForModel(currentModel);
      const finalProvider = provider?.provider?.id || 'ollama';
      
      addMessage({
        role: "assistant",
        content: `❌ Error: ${error.message}`,
        model: currentModel,
        modelProvider: finalProvider,
      });
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
  const saveTimeoutRef = useRef<any>(null);
  
  const saveConversationDebounced = useCallback(
    (messages: ChatMessage[]) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new timeout
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (currentConversationId) {
            // Update existing conversation
            await ConversationService.updateConversation(currentConversationId, messages);
          } else {
            // Save new conversation
            const newConversationId = await ConversationService.saveConversation(messages);
            setCurrentConversationId(newConversationId);
          }
          console.log("Conversation auto-saved");
        } catch (error) {
          console.error("Failed to auto-save conversation:", error);
        }
      }, 2000);
    },
    [currentConversationId]
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
    setCurrentConversationId(null);
    setInputValue(""); // Clear input value for new conversation
    setDateNotesCache({}); // Clear date notes cache
  };

  const toggleConversationList = () => {
    setShowConversationList(prev => !prev);
  };

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
    // Don't start drag if clicking on buttons
    if ((e.target as Element).closest('button')) return;
    
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
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Manage drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Cleanup resize state on unmount
  useEffect(() => {
    return () => {
      if (isResizing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

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
              icon="minus"
              onClick={onToggle}
              title="Minimize"
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
