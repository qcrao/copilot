// src/components/MessageList.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from "@blueprintjs/core";
import { ChatMessage } from '../types';
import { CollapsibleMessage } from './CollapsibleMessage';
import { UserService } from '../services/userService';
import { getModelDisplayInfo, getProviderDisplayName } from '../utils/iconUtils';
import { useSimpleScroll } from '../hooks/useSimpleScroll';
import { ScrollToBottomButton } from './ScrollToBottomButton';

// Helper function to format timestamp with Yesterday support
const formatTimestamp = (timestamp: Date): string => {
  const now = new Date();
  const messageDate = new Date(timestamp);
  
  // Reset time to compare dates only
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  
  const timeString = messageDate.toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (msgDate.getTime() === today.getTime()) {
    // Today - just show time
    return timeString;
  } else if (msgDate.getTime() === yesterday.getTime()) {
    // Yesterday
    return `Yesterday, ${timeString}`;
  } else {
    // Other dates - show full date
    const dateString = messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric', 
      year: 'numeric'
    });
    return `${dateString}, ${timeString}`;
  }
};

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
    <div style={{ marginBottom: '6px' }}>
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

        {/* Model Name and Provider - Single Line */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              fontWeight: '600',
              fontSize: '13px',
              color: '#333'
            }}>
              {loadingModelInfo?.name || 'AI Assistant'}
            </span>
            <span style={{
              fontSize: '11px',
              color: '#666'
            }}>
              {currentProvider}
            </span>
          </div>
        </div>
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

const MessageItem: React.FC<MessageItemProps> = React.memo(({ message, index, onCopyMessage, copiedMessageIndex }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
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

        {/* Model Name and Provider - Single Line */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              fontWeight: '600',
              fontSize: '13px',
              color: '#333'
            }}>
              {isUser ? 'You' : (modelInfo?.name || 'AI Assistant')}
            </span>
            {!isUser && message.modelProvider && (
              <span style={{
                fontSize: '11px',
                color: '#666'
              }}>
                {getProviderDisplayName(message.modelProvider)}
              </span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div style={{
          fontSize: '11px',
          color: '#999',
          flexShrink: 0
        }}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>

      {/* Message Content */}
      <div className="rr-copilot-message-container" style={{
        marginLeft: '34px', // Align with content under avatar
        marginRight: '6px', // Further reduced for compactness
        position: 'relative'
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
          color: isUser ? '#374151' : '#374151',
          paddingRight: '32px' // Make room for copy button
        }}>
          <CollapsibleMessage 
            content={message.content} 
            isUser={isUser}
            isStreaming={isStreaming}
          />
          {isStreaming && !isUser && (
            <span className="rr-copilot-streaming-cursor"></span>
          )}
        </div>

        {/* Copy Button - positioned at bottom right */}
        <div 
          className="rr-copilot-copy-button-container"
          style={{
            position: 'absolute',
            bottom: '3px',
            right: '0px',
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          <Icon
            icon={copiedMessageIndex === index ? "tick" : "duplicate"}
            onClick={() => onCopyMessage(message.content, index)}
            className="rr-copilot-copy-icon"
            style={{
              color: "#666",
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'opacity 0.2s ease',
              background: 'none',
              border: 'none',
              boxShadow: 'none',
              padding: '0',
              margin: '0'
            }}
            title="Copy message"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0.7';
            }}
          />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the message content, streaming status, or copy status actually changed
  return (
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.copiedMessageIndex === nextProps.copiedMessageIndex &&
    prevProps.message.id === nextProps.message.id
  );
});

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  onCopyMessage, 
  copiedMessageIndex,
  currentModel,
  currentProvider
}) => {
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false); // Based on scroll position
  const [showScrollButton, setShowScrollButton] = useState(false); // Final visibility including mouse state
  const [isMouseInside, setIsMouseInside] = useState(false);
  const hideButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Create dependencies for scroll tracking
  const scrollDependencies = [
    messages.length, // New messages
    isLoading, // Loading state changes  
    messages.filter(msg => msg.isStreaming).map(msg => msg.content.length).join(','), // Streaming content
    messages.map(msg => msg.content.length).join(','), // All content changes (for show more/less)
  ];
  
  // Use simplified scroll hook
  const [containerRefCallback, scrollActions] = useSimpleScroll(scrollDependencies, {
    threshold: 50, // Consider "at bottom" when within 50px
    respectUserIntent: true // Respect when user manually scrolls up
  });

  // Handle scroll to bottom button click
  const handleScrollToBottom = () => {
    scrollActions.scrollToBottom(true); // Force scroll
  };
  
  // Enhanced ref callback to monitor scroll position
  const enhancedRefCallback = useCallback((node: HTMLDivElement | null) => {
    containerRefCallback(node);
    
    if (node) {
      // Function to check scroll position and update button visibility
      const updateScrollButtonVisibility = () => {
        const { scrollTop, scrollHeight, clientHeight } = node;
        const isAtBottom = scrollHeight - scrollTop - clientHeight <= 50;
        const hasEnoughContent = scrollHeight > clientHeight + 100; // Has scrollable content
        
        setShouldShowScrollButton(!isAtBottom && hasEnoughContent && messages.length > 1);
      };
      
      // Initial check
      updateScrollButtonVisibility();
      
      // Add scroll listener
      const handleScroll = () => {
        updateScrollButtonVisibility();
      };
      
      node.addEventListener('scroll', handleScroll, { passive: true });
      
      // Cleanup function
      return () => {
        node.removeEventListener('scroll', handleScroll);
      };
    }
  }, [containerRefCallback, messages.length]);
  
  // Update scroll button visibility when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector('.rr-copilot-message-list') as HTMLDivElement;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop - clientHeight <= 50;
        const hasEnoughContent = scrollHeight > clientHeight + 100;
        
        setShouldShowScrollButton(!isAtBottom && hasEnoughContent && messages.length > 1);
      }
    }, 100); // Small delay to ensure DOM is updated
    
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  // Update final button visibility based on scroll position and mouse state
  useEffect(() => {
    if (shouldShowScrollButton) {
      setShowScrollButton(true);
      // Clear any existing timeout when button should be shown
      if (hideButtonTimeoutRef.current) {
        clearTimeout(hideButtonTimeoutRef.current);
        hideButtonTimeoutRef.current = null;
      }
    } else {
      setShowScrollButton(false);
    }
  }, [shouldShowScrollButton]);

  // Handle mouse events for auto-hiding scroll button
  useEffect(() => {
    const handleMouseEnter = () => {
      setIsMouseInside(true);
      // Clear any existing timeout when mouse enters
      if (hideButtonTimeoutRef.current) {
        clearTimeout(hideButtonTimeoutRef.current);
        hideButtonTimeoutRef.current = null;
      }
    };

    const handleMouseLeave = () => {
      setIsMouseInside(false);
      // Start timeout to hide button when mouse leaves (only if button should be shown)
      if (shouldShowScrollButton) {
        hideButtonTimeoutRef.current = setTimeout(() => {
          if (shouldShowScrollButton) { // Double check when timeout fires
            setShowScrollButton(false);
          }
        }, 2000); // Hide after 2 seconds
      }
    };

    const handleMouseMove = () => {
      if (isMouseInside && shouldShowScrollButton) {
        // Clear any existing timeout when mouse moves inside
        if (hideButtonTimeoutRef.current) {
          clearTimeout(hideButtonTimeoutRef.current);
          hideButtonTimeoutRef.current = null;
        }
        
        // Ensure button is visible
        setShowScrollButton(true);
        
        // Start new timeout to hide button after mouse stops moving
        hideButtonTimeoutRef.current = setTimeout(() => {
          if (shouldShowScrollButton) { // Double check when timeout fires
            setShowScrollButton(false);
          }
        }, 3000); // Hide after 3 seconds of no movement
      }
    };

    const container = document.querySelector('.rr-copilot-message-list-container') as HTMLDivElement;
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('mousemove', handleMouseMove);

      return () => {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('mousemove', handleMouseMove);
        
        // Cleanup timeout on unmount
        if (hideButtonTimeoutRef.current) {
          clearTimeout(hideButtonTimeoutRef.current);
        }
      };
    }
  }, [isMouseInside, shouldShowScrollButton]);

  // Clean up timeout when component unmounts
  useEffect(() => {
    return () => {
      if (hideButtonTimeoutRef.current) {
        clearTimeout(hideButtonTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="rr-copilot-message-list-container"
      style={{
        height: '100%',
        position: 'relative' // Container for absolute positioned button
      }}
    >
      <div 
        ref={enhancedRefCallback}
        className="rr-copilot-message-list" 
        style={{
          height: '100%',
          overflowY: 'auto',
          padding: '12px 14px',
          scrollBehavior: 'auto'
        }}
      >
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

        {/* Loading Indicator - only show if no streaming messages */}
        {isLoading && !messages.some(msg => msg.isStreaming) && (
          <LoadingIndicator currentModel={currentModel} currentProvider={currentProvider} />
        )}
      </div>
      
      {/* Scroll to bottom button - positioned outside scroll container */}
      <ScrollToBottomButton
        visible={showScrollButton}
        hasNewMessages={false}
        onClick={handleScrollToBottom}
      />
    </div>
  );
};