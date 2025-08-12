// src/components/PromptCard.tsx
import React from "react";
import { Icon } from "@blueprintjs/core";
import { PromptTemplate } from "../types";

interface PromptCardProps {
  template: PromptTemplate;
  onClick: (template: PromptTemplate) => void;
  isCustom?: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ template, onClick, isCustom = false }) => {
  const handleClick = () => {
    onClick(template);
  };

  const baseStyle = {
    backgroundColor: isCustom ? "#fafbfc" : "white",
    border: isCustom ? "2px dashed #d1d5db" : "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    minHeight: "60px",
    display: "flex",
    alignItems: "center",
    position: "relative" as const,
  };

  return (
    <div
      className="rr-copilot-prompt-card"
      onClick={handleClick}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (isCustom) {
          e.currentTarget.style.borderColor = "#9ca3af";
          e.currentTarget.style.backgroundColor = "#f3f4f6";
        } else {
          e.currentTarget.style.borderColor = "#d1d5db";
        }
        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
      }}
      onMouseLeave={(e) => {
        if (isCustom) {
          e.currentTarget.style.borderColor = "#d1d5db";
          e.currentTarget.style.backgroundColor = "#fafbfc";
        } else {
          e.currentTarget.style.borderColor = "#e5e7eb";
        }
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
      }}
    >
      <div style={{ flex: 1 }}>
        <h4 style={{ 
          fontSize: "14px", 
          fontWeight: "600",
          margin: "0 0 4px 0",
          color: "#1f2937",
          lineHeight: "1.3",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          {template.title}
          {isCustom && (
            <span style={{
              fontSize: "9px",
              fontWeight: "500",
              color: "#137cbd",
              backgroundColor: "#e1f5fe",
              padding: "2px 6px",
              borderRadius: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              CUSTOM
            </span>
          )}
        </h4>
        
        <p style={{ 
          fontSize: "12px", 
          lineHeight: "1.4", 
          margin: 0,
          color: "#6b7280",
          display: "-webkit-box",
          WebkitLineClamp: 1,
          WebkitBoxOrient: "vertical",
          overflow: "hidden"
        }}>
          {template.description}
        </p>
      </div>
    </div>
  );
};