// src/components/PromptCard.tsx
import React from "react";
import { Icon } from "@blueprintjs/core";
import { PromptTemplate } from "../types";

interface PromptCardProps {
  template: PromptTemplate;
  onClick: (template: PromptTemplate) => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({ template, onClick }) => {
  const handleClick = () => {
    onClick(template);
  };

  return (
    <div
      className="rr-copilot-prompt-card"
      onClick={handleClick}
      style={{
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        padding: "12px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        minHeight: "60px",
        display: "flex",
        alignItems: "center"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#d1d5db";
        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e7eb";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
      }}
    >
      <div style={{ flex: 1 }}>
        <h4 style={{ 
          fontSize: "14px", 
          fontWeight: "600",
          margin: "0 0 4px 0",
          color: "#1f2937",
          lineHeight: "1.3"
        }}>
          {template.title}
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