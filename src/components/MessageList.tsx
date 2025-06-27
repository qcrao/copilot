// src/components/MessageList.tsx
import React, { useState, useEffect } from 'react';
import { Button, Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { ChatMessage } from '../types';
import { MessageRenderer } from './MessageRenderer';
import { UserService } from '../services/userService';

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

// Get model display info
const getModelDisplayInfo = (model?: string, provider?: string) => {
  if (!model) {
    return { 
      iconUrl: null,
      fallbackIcon: '🤖', 
      name: 'AI Assistant', 
      color: '#666',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Check if it's a local model (Ollama)
  const isLocal = provider === 'ollama';
  
  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase();
  
  if (isLocal) {
    // For local models, use home icon from BlueprintJS
    return {
      iconUrl: null,
      fallbackIcon: '🏠',
      name: model,
      color: '#2E7D32',
      isLocal: true,
      blueprintIcon: IconNames.HOME
    };
  }
  
  if (normalizedModel.includes('gpt-4o')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-4o', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-4')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-4', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-3.5')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-3.5', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3.5-haiku')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude 3.5 Haiku', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3-haiku')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude 3 Haiku', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('llama')) {
    return { 
      iconUrl: 'https://llama.meta.com/llama-logo.png', 
      fallbackIcon: '⚡', 
      name: 'Llama', 
      color: '#FF6B6B',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gemma')) {
    return { 
      iconUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_red_4ed1cbfcbc6c9e84c31b987da73fc4168e45e803.svg', 
      fallbackIcon: '💎', 
      name: 'Gemma', 
      color: '#4285F4',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('grok')) {
    return { 
      iconUrl: 'https://x.ai/favicon.ico', 
      fallbackIcon: '🚀', 
      name: 'Grok', 
      color: '#1D9BF0',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Default for unknown models
  return { 
    iconUrl: null,
    fallbackIcon: '🤖', 
    name: model, 
    color: '#666',
    isLocal: false,
    blueprintIcon: null
  };
};

// Loading Indicator Component
const LoadingIndicator: React.FC<{ currentModel?: string; currentProvider?: string }> = ({ 
  currentModel, 
  currentProvider 
}) => {
  const loadingModelInfo = getModelDisplayInfo(currentModel, currentProvider);
  
  // Helper function to check if model supports thinking
  const supportsThinking = (modelName?: string): boolean => {
    if (!modelName) return false;
    const thinkingModels = [
      'deepseek-r1', 'deepseek-reasoner', 'r1', 'qwq', 'marco-o1'
    ];
    return thinkingModels.some(pattern => 
      modelName.toLowerCase().includes(pattern.toLowerCase())
    );
  };
  
  return (
    <div style={{ marginBottom: '12px' }}>
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
          backgroundColor: 'white',
          color: '#666',
          fontSize: '16px',
          border: '1px solid #e1e4e8'
        }}>
          {loadingModelInfo?.blueprintIcon ? (
            <Icon 
              icon={loadingModelInfo.blueprintIcon}
              size={18}
              style={{ 
                color: loadingModelInfo.color || '#666'
              }}
            />
          ) : loadingModelInfo?.iconUrl ? (
            <img 
              src={loadingModelInfo.iconUrl} 
              alt={`${loadingModelInfo.name} logo`}
              style={{
                width: '24px',
                height: '24px',
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
            <span style={{ color: '#666', fontSize: '18px' }}>
              {loadingModelInfo?.fallbackIcon || '🤖'}
            </span>
          )}
        </div>
        <div style={{
          fontWeight: '600',
          fontSize: '14px',
          color: '#333'
        }}>
          {loadingModelInfo?.name || 'AI Assistant'}
        </div>
        {currentModel && (
          <div style={{
            fontSize: '12px',
            color: '#666',
            marginTop: '1px'
          }}>
            {currentModel}
          </div>
        )}
      </div>

      {/* Loading Content - New thinking style */}
      <div style={{ marginLeft: '40px', marginRight: '8px' }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f1f3f5',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
          }}>
            {supportsThinking(currentModel) ? '🧠' : '⚡'}
          </div>
          <div style={{ flex: 1 }}>
            {supportsThinking(currentModel) && (
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '2px'
              }}>
                Deep thinking
              </div>
            )}
            <div style={{
              fontSize: '12px',
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
    <div className="rr-copilot-message-item" style={{ marginBottom: '8px' }}>
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
                size={18}
                style={{ 
                  color: modelInfo.color || '#666'
                }}
              />
            ) : modelInfo?.iconUrl ? (
              <img 
                src={modelInfo.iconUrl} 
                alt={`${modelInfo.name} logo`}
                style={{
                  width: '24px', // Slightly larger for better visibility
                  height: '24px',
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
              <span style={{ color: '#666', fontSize: '18px' }}>
                {modelInfo?.fallbackIcon || '🤖'}
              </span>
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
        marginRight: '8px', // Reduced right margin for more compact layout
      }}>
        <div style={{
          width: '100%',
          padding: isUser ? '8px 0' : '8px 16px 8px 0', // No background padding for user, right padding for AI
          backgroundColor: 'transparent', // No background for both user and AI
          borderRadius: '0', // No border radius
          border: 'none', // No border
          fontSize: '14px',
          lineHeight: '1.6',
          wordBreak: 'break-word',
          marginBottom: '4px', // Slightly increased for copy button spacing
          color: isUser ? '#374151' : '#374151' // Same text color for both
        }}>
          <MessageRenderer 
            content={message.content} 
            isUser={isUser}
            model={message.model}
          />
        </div>

        {/* Copy Button Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: '0px' // Remove padding to make it closer
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
  copiedMessageIndex,
  currentModel,
  currentProvider
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
        <LoadingIndicator currentModel={currentModel} currentProvider={currentProvider} />
      )}
    </div>
  );
};