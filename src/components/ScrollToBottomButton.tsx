// src/components/ScrollToBottomButton.tsx
import React from 'react';
import { Button, Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
  hasNewMessages?: boolean;
  className?: string;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  visible,
  onClick,
  hasNewMessages = false,
  className = ''
}) => {
  return (
    <div 
      className={`rr-copilot-scroll-to-bottom ${className}`}
      style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        zIndex: 10,
        transition: 'all 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.8)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      <Button
        minimal
        large
        intent={hasNewMessages ? "primary" : undefined}
        icon={
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={IconNames.CHEVRON_DOWN} size={16} />
            {hasNewMessages && (
              <div 
                className="rr-copilot-new-message-indicator"
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#f44336',
                  animation: 'pulse 2s infinite'
                }}
              />
            )}
          </div>
        }
        onClick={onClick}
        title={hasNewMessages ? "New messages • Scroll to bottom" : "Scroll to bottom"}
        style={{
          backgroundColor: hasNewMessages ? '#393a3d' : 'rgba(255, 255, 255, 0.95)',
          color: hasNewMessages ? 'white' : '#666',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          border: hasNewMessages ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          minWidth: '48px',
          minHeight: '48px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.15)';
        }}
      />
    </div>
  );
};