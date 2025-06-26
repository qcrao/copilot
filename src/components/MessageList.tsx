// src/components/MessageList.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@blueprintjs/core";
import { ChatMessage } from '../types';
import { MessageRenderer } from './MessageRenderer';
import { UserService } from '../services/userService';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onCopyMessage: (content: string, messageIndex: number) => void;
  copiedMessageIndex: number | null;
}

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  onCopyMessage: (content: string, messageIndex: number) => void;
  copiedMessageIndex: number | null;
}

// Get model display info
const getModelDisplayInfo = (model?: string, provider?: string) => {
  if (!model) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'Unknown Model', 
      color: '#666' 
    };
  }

  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase();
  
  if (normalizedModel.includes('gpt-4o')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-4o', 
      color: '#10A37F' 
    };
  }
  if (normalizedModel.includes('gpt-4')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-4', 
      color: '#10A37F' 
    };
  }
  if (normalizedModel.includes('gpt-3.5')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-3.5', 
      color: '#10A37F' 
    };
  }
  if (normalizedModel.includes('claude-3.5-haiku')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude 3.5 Haiku', 
      color: '#CC785C' 
    };
  }
  if (normalizedModel.includes('claude-3-haiku')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude 3 Haiku', 
      color: '#CC785C' 
    };
  }
  if (normalizedModel.includes('claude')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude', 
      color: '#CC785C' 
    };
  }
  if (normalizedModel.includes('llama')) {
    return { 
      iconUrl: 'https://llama.meta.com/llama-logo.png', 
      fallbackIcon: '⚡', 
      name: 'Llama', 
      color: '#FF6B6B' 
    };
  }
  if (normalizedModel.includes('gemma')) {
    return { 
      iconUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_red_4ed1cbfcbc6c9e84c31b987da73fc4168e45e803.svg', 
      fallbackIcon: '💎', 
      name: 'Gemma', 
      color: '#4285F4' 
    };
  }
  if (normalizedModel.includes('grok')) {
    return { 
      iconUrl: 'https://x.ai/favicon.ico', 
      fallbackIcon: '🚀', 
      name: 'Grok', 
      color: '#1D9BF0' 
    };
  }

  // Default for unknown models
  return { 
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
    fallbackIcon: '🤖', 
    name: model, 
    color: '#666' 
  };
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
    <div className="rr-copilot-message-item" style={{ marginBottom: '20px' }}>
      {/* Message Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        gap: '8px'
      }}>
        {/* Avatar/Icon */}
        <div className="rr-copilot-avatar" style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isUser ? '#393a3d' : (modelInfo?.color || '#666'),
          color: 'white',
          fontSize: '16px',
          flexShrink: 0,
          overflow: 'hidden'
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
            modelInfo?.iconUrl ? (
              <img 
                src={modelInfo.iconUrl} 
                alt={`${modelInfo.name} logo`}
                style={{
                  width: '20px',
                  height: '20px',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = modelInfo.fallbackIcon || '🤖';
                }}
              />
            ) : (
              modelInfo?.fallbackIcon || '🤖'
            )
          )}
        </div>

        {/* Name and Model */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: '#333'
          }}>
            {isUser ? 'You' : (modelInfo?.name || 'AI Assistant')}
          </div>
          {!isUser && message.model && (
            <div style={{
              fontSize: '12px',
              color: '#666',
              marginTop: '1px'
            }}>
              {message.model}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div style={{
          fontSize: '12px',
          color: '#999',
          flexShrink: 0
        }}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>

      {/* Message Content */}
      <div className="rr-copilot-message-container" style={{
        marginLeft: '40px', // Align with content under avatar
        marginRight: '40px', // Balance with left margin for symmetry
      }}>
        <div style={{
          width: '100%',
          padding: isUser ? '12px 16px' : '12px 16px 12px 0', // Add right padding for AI messages
          backgroundColor: isUser ? '#f8f9fa' : 'transparent',
          borderRadius: isUser ? '12px' : '0',
          border: isUser ? '1px solid #e1e4e8' : 'none',
          fontSize: '14px',
          lineHeight: '1.6',
          wordBreak: 'break-word',
          marginBottom: '8px'
        }}>
          <MessageRenderer 
            content={message.content} 
            isUser={isUser}
          />
        </div>

        {/* Copy Button Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: '4px'
        }}>
          <Button
            minimal
            small
            icon={copiedMessageIndex === index ? "tick" : "duplicate"}
            onClick={() => onCopyMessage(message.content, index)}
            className="rr-copilot-copy-button"
            style={{
              minWidth: "24px",
              minHeight: "24px",
              color: "#666",
              opacity: 0.7,
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
  copiedMessageIndex 
}) => {
  return (
    <div className="rr-copilot-message-list" style={{
      height: '100%',
      overflowY: 'auto',
      padding: '16px',
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
        <div style={{ marginBottom: '20px' }}>
          {/* Loading Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            gap: '8px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#666',
              color: 'white',
              fontSize: '16px'
            }}>
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg" 
                alt="AI logo"
                style={{
                  width: '20px',
                  height: '20px',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '🤖';
                }}
              />
            </div>
            <div style={{
              fontWeight: '600',
              fontSize: '14px',
              color: '#333'
            }}>
              AI Assistant
            </div>
          </div>

          {/* Loading Content */}
          <div style={{ marginLeft: '40px', marginRight: '40px' }}>
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              border: '1px solid #e1e4e8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>Thinking</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0s" }}>.</span>
                <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "blink 1.4s infinite both", animationDelay: "0.4s" }}>.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};