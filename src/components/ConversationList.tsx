// src/components/ConversationList.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Icon,
  InputGroup,
  Spinner,
  Toast,
  Toaster,
  Position,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { ConversationMetadata, ConversationListState } from "../types";
import { ConversationService } from "../services/conversationService";
import { ConversationItem } from "./ConversationItem";

interface ConversationListProps {
  isVisible: boolean;
  onToggle: () => void;
  currentConversationId: string | null;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  isLoading: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  isVisible,
  onToggle,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  isLoading,
}) => {
  const [state, setState] = useState<ConversationListState>({
    conversations: [],
    currentConversationId,
    isLoading: false,
    searchQuery: "",
    showList: isVisible,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadConversations = useCallback(async () => {
    setIsRefreshing(true);
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const conversations = await ConversationService.loadConversations();
      setState((prev) => ({
        ...prev,
        conversations,
        isLoading: false,
      }));

      // Show success feedback
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 1500);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Update current conversation ID when prop changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      currentConversationId,
    }));
  }, [currentConversationId]);

  // Update visibility when prop changes and refresh list when shown
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      showList: isVisible,
    }));

    // Auto-refresh when conversation list is shown
    if (isVisible) {
      loadConversations();
    }
  }, [isVisible, loadConversations]);

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await ConversationService.deleteConversation(conversationId);

        // Reload conversations
        await loadConversations();

        // If deleted conversation was current, start new conversation
        if (conversationId === currentConversationId) {
          onNewConversation();
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
        throw error;
      }
    },
    [currentConversationId, onNewConversation, loadConversations]
  );

  const handleDeleteAll = useCallback(async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    setShowDeleteConfirm(false);

    try {
      // Delete all conversations using service method
      await ConversationService.deleteAllConversations();

      // Reload conversations
      await loadConversations();

      // Start new conversation
      onNewConversation();
    } catch (error) {
      console.error("Failed to delete all conversations:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [showDeleteConfirm, loadConversations, onNewConversation]);

  const handleCancelDeleteAll = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev) => ({
        ...prev,
        searchQuery: event.target.value,
      }));
    },
    []
  );

  const filteredConversations = state.conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (conv.tags &&
        conv.tags.some((tag) =>
          tag.toLowerCase().includes(state.searchQuery.toLowerCase())
        ))
  );

  const handleConversationClick = useCallback(
    (conversationId: string) => {
      onConversationSelect(conversationId);
    },
    [onConversationSelect]
  );

  return (
    <div
      className="rr-copilot-conversation-list-panel"
      style={{
        position: "absolute",
        left: "0",
        top: "0",
        bottom: "0",
        width: "280px",
        backgroundColor: "#fbfcfd", // Softer background like Roam sidebars
        borderLeft: "1px solid #e1e5e9", // Add left border to separate from Roam
        borderRight: "1px solid #e1e5e9", // Match the content-wrapper border color
        display: "flex",
        flexDirection: "column",
        zIndex: 1001,
        boxShadow: "0 0 12px rgba(0,0,0,0.04), 1px 0 4px rgba(0,0,0,0.06)", // Softer, more Roam-like shadow
        transform: isVisible ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: "45px", // Match main copilot header height
          padding: "0 16px",
          borderBottom: "1px solid #e8eaed", // More subtle divider
          backgroundColor: "#f1f3f4", // Match Roam's subtle header background
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0, // Prevent shrinking like main header
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon icon="chat" size={16} color="#5c7080" />
          <span
            style={{ fontSize: "13px", fontWeight: "500", color: "#5c7080", letterSpacing: "0.3px" }}
          >
            Chat History
          </span>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          <Button
            minimal
            small
            icon="plus"
            onClick={onNewConversation}
            title="New Chat"
            disabled={isLoading}
            style={{ color: "#5c7080" }}
          />
          <Button
            minimal
            small
            icon={refreshSuccess ? "confirm" : "refresh"}
            onClick={loadConversations}
            title={
              isRefreshing
                ? "Refreshing..."
                : refreshSuccess
                ? "Refreshed!"
                : "Refresh List"
            }
            disabled={isRefreshing}
            className={isRefreshing ? "rr-copilot-refresh-spinning" : ""}
            style={{
              color: refreshSuccess ? "#0f9960" : "#393a3d",
              transition: "color 0.2s ease",
            }}
          />
          {state.conversations.length > 0 && !showDeleteConfirm && (
            <Button
              minimal
              small
              icon="trash"
              onClick={handleDeleteAll}
              title="Delete All Conversations"
              style={{ color: "#5c7080" }}
            />
          )}
          {showDeleteConfirm && (
            <>
              <Button
                minimal
                small
                icon={isDeleting ? "refresh" : "tick"}
                onClick={handleDeleteAll}
                disabled={isDeleting}
                style={{
                  minWidth: "20px",
                  minHeight: "20px"
                }}
                title="Confirm Delete All"
                className={`${isDeleting ? "rr-copilot-refresh-spinning" : ""} rr-copilot-delete-confirm`}
              />
              <Button
                minimal
                small
                icon="cross"
                onClick={handleCancelDeleteAll}
                disabled={isDeleting}
                style={{
                  minWidth: "20px",
                  minHeight: "20px",
                  color: "#666"
                }}
                title="Cancel"
              />
            </>
          )}
          <Button
            minimal
            small
            icon="chevron-left"
            onClick={onToggle}
            title="Hide Chat List"
            style={{ color: "#5c7080" }}
          />
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px", backgroundColor: "#fbfcfd" }}>
        <InputGroup
          placeholder="Search conversations..."
          value={state.searchQuery}
          onChange={handleSearchChange}
          leftIcon="search"
          style={{
            fontSize: "13px",
            height: "34px",
          }}
        />
      </div>

      {/* Conversation List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 6px", // Better padding for new item styles
        }}
      >
        {state.isLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100px",
            }}
          >
            <Spinner size={24} />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: "13px",
              padding: "40px 20px",
              lineHeight: "1.5",
            }}
          >
            {state.searchQuery ? (
              <>
                <Icon
                  icon="search"
                  size={32}
                  style={{ opacity: 0.3, marginBottom: "12px" }}
                />
                <div>No matching conversations found</div>
              </>
            ) : (
              <>
                <Icon
                  icon="chat"
                  size={32}
                  style={{ opacity: 0.3, marginBottom: "12px" }}
                />
                <div>No saved conversations yet</div>
                <div style={{ marginTop: "8px", fontSize: "12px" }}>
                  Conversations will be auto-saved after chatting
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onClick={() => handleConversationClick(conversation.id)}
                onDelete={handleDeleteConversation}
                disabled={isLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid #e8eaed",
          backgroundColor: "#f1f3f4",
          fontSize: "11px",
          color: "#5c7080",
          textAlign: "center",
          fontWeight: "400",
        }}
      >
        {filteredConversations.length} conversation
        {filteredConversations.length !== 1 ? "s" : ""}
        {state.searchQuery && ` (filtered from ${state.conversations.length})`}
      </div>
    </div>
  );
};
