// src/components/PromptMenu.tsx
import React from "react";
import { PromptTemplate } from "../types";

interface PromptMenuProps {
  isVisible: boolean;
  prompts: PromptTemplate[];
  selectedIndex: number;
  onSelect: (prompt: PromptTemplate) => void;
  onClose: () => void;
  position: { top: number; left: number };
  filter: string;
}

export const PromptMenu: React.FC<PromptMenuProps> = ({
  isVisible,
  prompts,
  selectedIndex,
  onSelect,
  onClose,
  position,
  filter,
}) => {
  if (!isVisible) {
    return null;
  }
  
  if (prompts.length === 0) {
    return (
      <div
        className="prompt-menu"
        style={{
          position: 'fixed', // Use fixed positioning instead of absolute
          top: position.top,
          left: position.left,
          zIndex: 999999, // Higher z-index to ensure it's above everything
          minWidth: '300px',
          backgroundColor: '#ffffff',
          border: '1px solid #e1e4e8',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          fontSize: '14px',
          padding: '12px',
          color: '#586069'
        }}
      >
        No prompts found{filter ? ` for "${filter}"` : ''}
      </div>
    );
  }


  const highlightMatch = (text: string, filter: string) => {
    if (!filter) return text;
    
    const regex = new RegExp(`(${filter})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} style={{ 
          backgroundColor: '#ffd700', 
          color: '#333',
          fontWeight: 'bold'
        }}>
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div
      className="prompt-menu"
      style={{
        position: 'fixed', // Use fixed positioning instead of absolute
        top: position.top,
        left: position.left,
        zIndex: 999999, // Higher z-index to ensure it's above everything
        minWidth: '300px',
        maxWidth: '400px',
        maxHeight: '300px',
        overflowY: 'auto',
        backgroundColor: '#ffffff',
        border: '1px solid #e1e4e8',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        fontSize: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e1e4e8',
        backgroundColor: '#f6f8fa',
        fontSize: '12px',
        color: '#586069',
        fontWeight: '600'
      }}>
        {filter ? `Prompts matching "${filter}"` : 'Select a prompt template'}
        <span style={{ float: 'right', color: '#8e9297' }}>
          {prompts.length} result{prompts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Prompt list */}
      <div>
        {prompts.map((prompt, index) => (
          <div
            key={prompt.id}
            className={`prompt-menu-item ${index === selectedIndex ? 'selected' : ''}`}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderBottom: index < prompts.length - 1 ? '1px solid #f1f3f4' : 'none',
              backgroundColor: index === selectedIndex ? '#f1f3f4' : 'transparent',
              display: 'flex',
              alignItems: 'flex-start',
              transition: 'background-color 0.1s ease'
            }}
            onClick={() => onSelect(prompt)}
            onMouseEnter={() => {
              // Could update selectedIndex on hover if needed
            }}
          >

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: '600',
                color: '#24292e',
                marginBottom: '2px',
                lineHeight: '1.2'
              }}>
                {highlightMatch(prompt.title, filter)}
              </div>
              <div style={{
                color: '#586069',
                fontSize: '12px',
                lineHeight: '1.3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {highlightMatch(prompt.description, filter)}
              </div>
              
            </div>

            {/* Keyboard hint */}
            {index === selectedIndex && (
              <div style={{
                color: '#8e9297',
                fontSize: '10px',
                alignSelf: 'center',
                flexShrink: 0
              }}>
                ⏎
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 12px',
        borderTop: '1px solid #e1e4e8',
        backgroundColor: '#f6f8fa',
        fontSize: '10px',
        color: '#8e9297',
        textAlign: 'center'
      }}>
        ↑↓ navigate • ⏎ select • esc cancel
      </div>
    </div>
  );
};