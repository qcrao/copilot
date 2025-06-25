// src/components/CopilotWidget.tsx
import React, { useState, useEffect, useRef } from "react";
import { Button, Icon, Spinner } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { ChatMessage, CopilotState, PageContext, ConversationListState } from "../types";
import { AIService } from "../services/aiService";
import { RoamService } from "../services/roamService";
import { ConversationService } from "../services/conversationService";
import { aiSettings, multiProviderSettings } from "../settings";
import { CustomMessageInput } from "./CustomMessageInput";
import { MessageRenderer } from "./MessageRenderer";
import { ConversationList } from "./ConversationList";
import { PromptTemplatesGrid } from "./PromptTemplatesGrid";

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
  const [isHoveringMinimized, setIsHoveringMinimized] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [dateNotesCache, setDateNotesCache] = useState<{[date: string]: string}>({});

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isOpen,
      isMinimized: !isOpen,
    }));
  }, [isOpen]);

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

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || state.isLoading) return;

    const userMessage = message.trim();

    // Clear input value
    setInputValue("");

    // Check if message contains date references and add cached notes
    let finalUserMessage = userMessage;
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

    // Add user message (display the original without notes)
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
      const provider = AIService.getProviderForModel(currentModel);
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
      });

      const response = await AIService.sendMessageWithCurrentModel(
        finalUserMessage,
        contextString
      );

      addMessage({
        role: "assistant",
        content: response,
      });
    } catch (error: any) {
      addMessage({
        role: "assistant",
        content: `❌ Error: ${error.message}`,
      });
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleModelChange = (newModel: string) => {
    console.log("Model changed to:", newModel);
    // The model is already updated in the CustomMessageInput component
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

  // Auto-save current conversation when messages change
  useEffect(() => {
    if (state.messages.length === 0) return;
    
    const saveConversation = async () => {
      try {
        if (currentConversationId) {
          // Update existing conversation
          await ConversationService.updateConversation(currentConversationId, state.messages);
        } else {
          // Save new conversation
          const newConversationId = await ConversationService.saveConversation(state.messages);
          setCurrentConversationId(newConversationId);
        }
        console.log("Conversation auto-saved");
      } catch (error) {
        console.error("Failed to auto-save conversation:", error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(saveConversation, 2000);
    return () => clearTimeout(timeoutId);
  }, [state.messages, currentConversationId]);

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
    console.log("Started new conversation");
  };

  const toggleConversationList = () => {
    setShowConversationList(prev => !prev);
  };

  const handlePromptSelect = (prompt: string) => {
    // Populate the input with the selected prompt
    setInputValue(prompt);
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
      const conversationPanel = document.querySelector('.conversation-list-panel');
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



  if (state.isMinimized) {
    return (
      <div className="roam-copilot-container">
        <div
          className="roam-copilot-minimized"
          onMouseEnter={() => setIsHoveringMinimized(true)}
          onMouseLeave={() => setIsHoveringMinimized(false)}
          style={{ position: "relative" }}
        >
          <div
            onClick={onToggle}
            title="Open Roam Copilot"
            style={{ 
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              cursor: "pointer"
            }}
          >
            <Icon icon={IconNames.LIGHTBULB} size={24} color="white" />
          </div>
          {isHoveringMinimized && (
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
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="roam-copilot-container">
      <div className="roam-copilot-expanded" style={{ position: "relative" }}>
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
          <div className="roam-copilot-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
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
          <div style={{ flex: 1, overflow: "hidden" }}>
            <MainContainer>
              <ChatContainer>
                <MessageList>
                  {state.messages.length === 0 && (
                    <div style={{ height: "100%", overflow: "auto" }}>
                      <PromptTemplatesGrid onPromptSelect={handlePromptSelect} />
                    </div>
                  )}

                  {state.messages.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        flexDirection: msg.role === "user" ? "row-reverse" : "row",
                        alignItems: "flex-start",
                        margin: "8px 0",
                        gap: "8px",
                        // Symmetric padding and ensure no overlap with scrollbar
                        paddingLeft: msg.role === "user" ? "0" : "12px",
                        paddingRight: msg.role === "user" ? "20px" : "0"
                      }}
                    >
                      <div
                        style={{
                          maxWidth: msg.role === "user" ? "75%" : "80%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: msg.role === "user" ? "flex-end" : "flex-start"
                        }}
                      >
                        {/* Timestamp above bubble */}
                        <div
                          style={{
                            fontSize: "11px",
                            opacity: 0.7,
                            color: "#666",
                            marginBottom: "4px",
                            paddingLeft: msg.role === "user" ? "0" : "4px",
                            paddingRight: msg.role === "user" ? "4px" : "0"
                          }}
                        >
                          {msg.timestamp.toLocaleTimeString()}
                        </div>

                        {/* Message bubble */}
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: "12px",
                            backgroundColor: msg.role === "user" ? "#393A3D" : "#f1f3f4",
                            color: msg.role === "user" ? "white" : "#333",
                            fontSize: "14px",
                            lineHeight: "1.4",
                            wordBreak: "break-word"
                          }}
                        >
                          <MessageRenderer 
                            content={msg.content} 
                            isUser={msg.role === "user"}
                          />
                        </div>
                        
                        {/* Action buttons below bubble */}
                        <div
                          style={{
                            marginTop: "4px",
                            paddingLeft: msg.role === "user" ? "0" : "4px",
                            paddingRight: msg.role === "user" ? "4px" : "0"
                          }}
                        >
                          <Button
                            minimal
                            small
                            icon={copiedMessageIndex === index ? "tick" : "duplicate"}
                            onClick={() => handleCopyMessage(msg.content, index)}
                            style={{
                              minWidth: "24px",
                              minHeight: "24px",
                              color: "#666",
                              opacity: 0.7
                            }}
                            title="Copy message"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {state.isLoading && (
                    <div style={{ 
                      display: "flex", 
                      alignItems: "flex-start", 
                      margin: "8px 0", 
                      gap: "8px",
                      paddingLeft: "12px",
                      paddingRight: "0"
                    }}>
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "8px 12px",
                          borderRadius: "12px",
                          backgroundColor: "#f1f3f4",
                          color: "#393A3D",
                          fontSize: "14px",
                          lineHeight: "1.4"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>Roam Copilot is thinking</span>
                          <div style={{ display: "flex", gap: "2px" }}>
                            <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0s" }}>.</span>
                            <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0.2s" }}>.</span>
                            <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0.4s" }}>.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </MessageList>
              </ChatContainer>
            </MainContainer>
          </div>

          <CustomMessageInput
            placeholder="Ask me anything about your notes..."
            onSend={handleSendMessage}
            disabled={state.isLoading}
            onModelChange={handleModelChange}
            value={inputValue}
            onChange={setInputValue}
            onDateSelect={handleDateSelect}
          />
        </div>
        </div>
      </div>
    </div>
  );
};
