// src/components/ConversationItem.tsx
import React, { useState } from "react";
import { Button, Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { ConversationMetadata } from "../types";

interface ConversationItemProps {
  conversation: ConversationMetadata;
  isActive: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onDelete
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete(conversation.id);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: "6px",
        cursor: "pointer",
        backgroundColor: isActive ? "#f5f5f5" : "transparent",
        borderLeft: isActive ? "3px solid #393a3d" : "3px solid transparent",
        margin: "2px 0",
        transition: "all 0.2s ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "#f5f5f5";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {/* Main content */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: isActive ? "600" : "500",
              color: "#333",
              lineHeight: "1.2",
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical"
            }}
            title={conversation.title}
          >
            {conversation.title}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                color: "#666",
                fontWeight: "400"
              }}
            >
              {formatDate(conversation.lastUpdated)}
            </span>
            
            <span
              style={{
                fontSize: "10px",
                color: "#888",
                backgroundColor: "#f0f0f0",
                padding: "1px 4px",
                borderRadius: "8px",
                fontWeight: "400"
              }}
            >
              {conversation.messageCount} msgs
            </span>
          </div>
        </div>

        {/* Delete button */}
        {!showDeleteConfirm ? (
          <Button
            minimal
            small
            icon="trash"
            onClick={handleDeleteClick}
            style={{
              minWidth: "24px",
              minHeight: "24px",
              color: "#999",
              opacity: 0.7,
              marginLeft: "8px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.color = "#f44336";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.7";
              e.currentTarget.style.color = "#999";
            }}
            title="Delete conversation"
          />
        ) : (
          <div 
            style={{ 
              display: "flex", 
              gap: "4px",
              marginLeft: "8px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              minimal
              small
              icon={isDeleting ? "refresh" : "tick"}
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              style={{
                minWidth: "24px",
                minHeight: "24px",
                color: "#f44336"
              }}
              title="Confirm delete"
            />
            <Button
              minimal
              small
              icon="cross"
              onClick={handleCancelDelete}
              disabled={isDeleting}
              style={{
                minWidth: "24px",
                minHeight: "24px",
                color: "#666"
              }}
              title="Cancel"
            />
          </div>
        )}
      </div>

      {/* Tags if available */}
      {conversation.tags && conversation.tags.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {conversation.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              style={{
                fontSize: "10px",
                color: "#393a3d",
                backgroundColor: "#f0f0f0",
                padding: "2px 6px",
                borderRadius: "8px",
                fontWeight: "400"
              }}
            >
              {tag}
            </span>
          ))}
          {conversation.tags.length > 3 && (
            <span
              style={{
                fontSize: "10px",
                color: "#999",
                fontWeight: "400"
              }}
            >
              +{conversation.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};