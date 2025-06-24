// src/components/CopilotWidget.tsx
import React, { useState, useEffect, useRef } from "react";
import { Button, Icon, Spinner } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  TypingIndicator,
  Avatar,
  MessageModel,
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { ChatMessage, CopilotState, PageContext } from "../types";
import { AIService } from "../services/aiService";
import { RoamService } from "../services/roamService";
import { aiSettings } from "../settings";
import { CustomMessageInput } from "./CustomMessageInput";

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

    // Add user message
    addMessage({
      role: "user",
      content: userMessage,
    });

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Get fresh context before sending to AI
      const freshContext = await RoamService.getPageContext();
      setPageContext(freshContext);

      const contextString = freshContext
        ? RoamService.formatContextForAI(freshContext)
        : "No context available";

      console.log("Sending message with context:", {
        currentPage: freshContext?.currentPage?.title,
        blocksCount: freshContext?.currentPage?.blocks?.length || 0,
      });

      const response = await AIService.sendMessage(
        aiSettings,
        userMessage,
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

  // Convert our ChatMessage format to chatscope Message format
  const convertToChatscopeMessages = (): MessageModel[] => {
    return state.messages.map((msg) => ({
      message: msg.content,
      sentTime: msg.timestamp.toLocaleTimeString(),
      sender: msg.role === "user" ? "You" : "Roam Copilot",
      direction: (msg.role === "user" ? "outgoing" : "incoming") as
        | "outgoing"
        | "incoming",
      position: "single" as "single",
    }));
  };

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
      <div className="roam-copilot-expanded">
        <div className="roam-copilot-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <span className="flex items-center gap-2">
            <Icon icon={IconNames.LIGHTBULB} size={16} />
            Roam Copilot
          </span>
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
                    <div
                      style={{
                        textAlign: "center",
                        color: "#666",
                        padding: "40px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <Icon icon={IconNames.LIGHTBULB} size={48} style={{ opacity: 0.5 }} />
                      <p>Hello! I'm your Roam Research assistant.</p>
                      <p style={{ fontSize: "14px", marginTop: "8px" }}>
                        I can help you with your notes and answer questions
                        based on your current page content.
                      </p>
                    </div>
                  )}

                  {convertToChatscopeMessages().map((msg, index) => (
                    <Message key={index} model={msg}>
                      {msg.direction === "incoming" && (
                        <Avatar
                          src=""
                          name="RC"
                          style={{
                            backgroundColor: "#106ba3",
                            color: "white",
                            fontSize: "14px",
                            fontWeight: "bold",
                          }}
                        />
                      )}
                    </Message>
                  ))}

                  {state.isLoading && (
                    <TypingIndicator content="Roam Copilot is thinking..." />
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
          />
        </div>
      </div>
    </div>
  );
};
