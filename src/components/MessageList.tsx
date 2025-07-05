// src/components/MessageList.tsx
import React, { useState, useEffect } from 'react';
import { Button, Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { ChatMessage } from '../types';
import { EnhancedMessageRenderer } from './EnhancedMessageRenderer';
import { UserService } from '../services/userService';
import { getModelDisplayInfo } from '../utils/iconUtils';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onCopyMessage: (content: string, messageIndex: number) => void;
  copiedMessageIndex: number | null;
  currentModel?: string;
  currentProvider?: string;
}

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  onCopyMessage: (content: string, messageIndex: number) => void;
  copiedMessageIndex: number | null;
}

// Note: getModelDisplayInfo is now imported from iconUtils

// Loading Indicator Component
const LoadingIndicator: React.FC<{ currentModel?: string; currentProvider?: string }> = ({ 
  currentModel, 
  currentProvider 
}) => {
  const loadingModelInfo = getModelDisplayInfo(currentModel, currentProvider);
  
  return (
    <div style={{ marginBottom: '8px' }}>
      {/* Loading Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '6px',
        gap: '6px'
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          color: '#666',
          fontSize: '16px',
          border: '1px solid #e1e4e8'
        }}>
          {loadingModelInfo?.blueprintIcon ? (
            <Icon 
              icon={loadingModelInfo.blueprintIcon}
              size={16}
              style={{ 
                color: loadingModelInfo.color || '#666'
              }}
            />
          ) : loadingModelInfo?.iconUrl ? (
            <img 
              src={loadingModelInfo.iconUrl} 
              alt={`${loadingModelInfo.name} logo`}
              style={{
                width: '20px',
                height: '20px',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = loadingModelInfo.fallbackIcon || '🤖';
                e.currentTarget.parentElement!.style.color = '#666';
              }}
            />
          ) : (
            <span style={{ color: '#666', fontSize: '16px' }}>
              {loadingModelInfo?.fallbackIcon || '🤖'}
            </span>
          )}
        </div>
        <div style={{
          fontWeight: '600',
          fontSize: '13px',
          color: '#333'
        }}>
          {loadingModelInfo?.name || 'AI Assistant'}
        </div>
        {currentProvider && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '1px'
          }}>
            {currentProvider}
          </div>
        )}
      </div>

      {/* Loading Content */}
      <div style={{ marginLeft: '34px', marginRight: '8px' }}>
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#f1f3f5',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
          }}>
            ⚡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>Generating response</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0s" }}>.</span>
                <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0.4s" }}>.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageItem: React.FC<MessageItemProps> = ({ message, index, onCopyMessage, copiedMessageIndex }) => {
  const isUser = message.role === 'user';
  const modelInfo = isUser ? null : getModelDisplayInfo(message.model, message.modelProvider);
  const [userAvatar, setUserAvatar] = useState<string>('👤');

  // Load user avatar on mount
  useEffect(() => {
    if (isUser) {
      UserService.getUserAvatar().then(setUserAvatar);
    }
  }, [isUser]);

  return (
    <div className="rr-copilot-message-item" style={{ marginBottom: '6px' }}>
      {/* Message Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '6px',
        gap: '6px'
      }}>
        {/* Avatar/Icon */}
        <div className="rr-copilot-avatar" style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isUser ? '#393a3d' : 'white', // White background for AI model logos
          color: 'white',
          fontSize: '16px',
          flexShrink: 0,
          overflow: 'hidden',
          border: isUser ? 'none' : '1px solid #e1e4e8' // Subtle border for AI avatars
        }}>
          {isUser ? (
            userAvatar.startsWith('data:') || userAvatar.startsWith('http') ? (
              <img 
                src={userAvatar} 
                alt="User avatar"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '👤';
                }}
              />
            ) : (
              userAvatar
            )
          ) : (
            modelInfo?.blueprintIcon ? (
              <Icon 
                icon={modelInfo.blueprintIcon}
                size={16}
                style={{ 
                  color: modelInfo.color || '#666'
                }}
              />
            ) : modelInfo?.iconUrl ? (
              <img 
                src={modelInfo.iconUrl} 
                alt={`${modelInfo.name} logo`}
                style={{
                  width: '20px',
                  height: '20px',
                  objectFit: 'contain',
                  borderRadius: '4px' // Subtle rounding for square logos
                }}
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = modelInfo.fallbackIcon || '🤖';
                  // Reset text color for emoji fallback
                  e.currentTarget.parentElement!.style.color = '#666';
                }}
              />
            ) : (
              <span style={{ color: '#666', fontSize: '16px' }}>
                {modelInfo?.fallbackIcon || '🤖'}
              </span>
            )
          )}
        </div>

        {/* Name and Model */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: '600',
            fontSize: '13px',
            color: '#333'
          }}>
            {isUser ? 'You' : (modelInfo?.name || 'AI Assistant')}
          </div>
          {!isUser && message.model && (
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '1px'
            }}>
              {message.modelProvider || 'ollama'}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div style={{
          fontSize: '11px',
          color: '#999',
          flexShrink: 0
        }}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>

      {/* Message Content */}
      <div className="rr-copilot-message-container" style={{
        marginLeft: '34px', // Align with content under avatar
        marginRight: '6px', // Further reduced for compactness
      }}>
        <div style={{
          width: '100%',
          padding: isUser ? '6px 0' : '6px 12px 6px 0', // Reduced padding
          backgroundColor: 'transparent',
          borderRadius: '0',
          border: 'none',
          fontSize: '14px',
          lineHeight: '1.5', // Tighter line height
          wordBreak: 'break-word',
          marginBottom: '3px', // Reduced spacing
          color: isUser ? '#374151' : '#374151'
        }}>
          <EnhancedMessageRenderer 
            content={message.content} 
            isUser={isUser}
            model={message.model}
          />
        </div>

        {/* Copy Button Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: '0px',
          marginTop: '-2px' // Pull button closer to content
        }}>
          <Button
            minimal
            small
            icon={copiedMessageIndex === index ? "tick" : "duplicate"}
            onClick={() => onCopyMessage(message.content, index)}
            className="rr-copilot-copy-button"
            style={{
              minWidth: "20px",
              minHeight: "20px",
              color: "#666",
              opacity: 0.7,
              backgroundColor: 'white',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              padding: '2px'
            }}
            title="Copy message"
          />
        </div>
      </div>
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  onCopyMessage, 
  copiedMessageIndex,
  currentModel,
  currentProvider
}) => {
  return (
    <div className="rr-copilot-message-list" style={{
      height: '100%',
      overflowY: 'auto',
      padding: '12px 14px',
      scrollBehavior: 'smooth'
    }}>
      {/* Render Messages */}
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          index={index}
          onCopyMessage={onCopyMessage}
          copiedMessageIndex={copiedMessageIndex}
        />
      ))}

      {/* Loading Indicator */}
      {isLoading && (
        <LoadingIndicator currentModel={currentModel} currentProvider={currentProvider} />
      )}
    </div>
  );
};