// src/components/CollapsibleMessage.tsx
import React, { useState, useMemo } from 'react';
import { EnhancedMessageRenderer } from './EnhancedMessageRenderer';

interface CollapsibleMessageProps {
  content: string;
  isUser?: boolean;
  isStreaming?: boolean;
  maxLength?: number; // Characters to show when collapsed
}

export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({
  content,
  isUser = false,
  isStreaming = false,
  maxLength = 300
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { shouldCollapse, truncatedContent } = useMemo(() => {
    // Don't collapse if content is short or currently streaming
    if (content.length <= maxLength || isStreaming) {
      return { shouldCollapse: false, truncatedContent: content };
    }

    // Find a good break point near maxLength (end of sentence or line)
    let breakPoint = maxLength;
    const nearBreakPoint = content.slice(0, maxLength + 100);
    
    // Look for sentence end
    const sentenceEnd = nearBreakPoint.lastIndexOf('.');
    const lineEnd = nearBreakPoint.lastIndexOf('\n');
    
    if (sentenceEnd > maxLength - 50) {
      breakPoint = sentenceEnd + 1;
    } else if (lineEnd > maxLength - 50) {
      breakPoint = lineEnd;
    }

    return {
      shouldCollapse: true,
      truncatedContent: content.slice(0, breakPoint).trim()
    };
  }, [content, maxLength, isStreaming]);

  // If content doesn't need collapsing, render normally
  if (!shouldCollapse) {
    return (
      <EnhancedMessageRenderer 
        content={content} 
        isUser={isUser}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <div>
      <EnhancedMessageRenderer 
        content={isExpanded ? content : truncatedContent} 
        isUser={isUser}
        isStreaming={false} // Don't show streaming cursor on truncated content
      />
      
      {!isExpanded && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setIsExpanded(true)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            Show more
          </button>
        </div>
      )}
      
      {isExpanded && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
};