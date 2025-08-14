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
  disabled?: boolean;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onDelete,
  disabled = false
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
      return date.toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      return date.toLocaleDateString('zh-CN', { 
        year: 'numeric',
        month: 'short'
      });
    }
  };

  return (
    <div
      className={`rr-copilot-conversation-item ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "10px 14px",
        borderRadius: "6px", // Softer corners like Roam
        cursor: disabled ? "not-allowed" : "pointer",
        backgroundColor: isActive ? "#ffffff" : "transparent",
        border: isActive ? "1px solid #d1d9e0" : "1px solid transparent", 
        borderLeft: isActive ? "3px solid #5c7cfa" : "3px solid transparent", // Blue accent for active state
        margin: "2px 6px", // Better spacing
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", // Smoother easing
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        opacity: disabled ? 0.5 : 1,
        boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.06)" : "none", // Subtle shadow for active
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "#f8f9fa";
          e.currentTarget.style.border = "1px solid #e8eaed";
          e.currentTarget.style.borderLeft = "3px solid #e1e5e9";
        }
        // Show delete button on hover
        const deleteBtn = e.currentTarget.querySelector('button[title="Delete conversation"]') as HTMLElement;
        if (deleteBtn) {
          deleteBtn.style.opacity = "0.7";
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.border = "1px solid transparent";
          e.currentTarget.style.borderLeft = "3px solid transparent";
        }
        // Hide delete button when not hovering
        const deleteBtn = e.currentTarget.querySelector('button[title="Delete conversation"]') as HTMLElement;
        if (deleteBtn) {
          deleteBtn.style.opacity = "0.0";
        }
      }}
    >
      {/* Main content */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: isActive ? "500" : "400", // Softer weight
              color: isActive ? "#202124" : "#5f6368", // More subtle color hierarchy
              lineHeight: "1.4",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
            title={conversation.title}
          >
            {conversation.title}
          </div>
          
          {/* Date display */}
          <div
            style={{
              fontSize: "11px",
              color: "#9aa0a6",
              marginTop: "2px",
              fontWeight: "400",
            }}
          >
            {formatDate(conversation.lastUpdated)}
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
              minWidth: "20px",
              minHeight: "20px",
              color: "#9ca3af",
              opacity: 0.0,
              marginLeft: "8px",
              transition: "opacity 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.color = "#f44336";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.0";
              e.currentTarget.style.color = "#9ca3af";
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
                minWidth: "20px",
                minHeight: "20px",
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
                minWidth: "20px",
                minHeight: "20px",
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