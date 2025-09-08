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
  maxLength = 80
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Handle expand/collapse with proper scroll behavior
  const handleToggleExpanded = (expanded: boolean) => {
    setIsExpanded(expanded);
    
    if (!expanded) {
      // When collapsing (show less), scroll to the end of collapsed content
      // This is the industry standard behavior
      setTimeout(() => {
        requestAnimationFrame(() => {
          // After state update, the "show more" button should be visible
          const showMoreButton = document.querySelector('.rr-copilot-show-more-btn');
          if (showMoreButton) {
            showMoreButton.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        });
      }, 0);
    }
  };

  const { shouldCollapse, truncatedContent } = useMemo(() => {
    // Don't collapse if content is short, currently streaming, or if it's an AI message
    if (content.length <= maxLength || isStreaming || !isUser) {
      return { shouldCollapse: false, truncatedContent: content };
    }

    // Find a good break point near maxLength
    let breakPoint = maxLength;
    const searchRange = content.slice(0, maxLength + 200); // Expanded search range
    
    // Priority order for finding good break points
    const breakPatterns = [
      // End of complete numbered list item (e.g., "...insights\n2. ")
      /\n\d+\.\s/g,
      // End of complete bullet list item  
      /\n[-*]\s/g,
      // End of paragraph (double newline)
      /\n\n/g,
      // End of sentence
      /\.\s+/g,
      // End of line
      /\n/g
    ];

    for (const pattern of breakPatterns) {
      const matches = Array.from(searchRange.matchAll(pattern));
      if (matches.length > 0) {
        // Find the last good match that's not too close to maxLength
        const validMatches = matches.filter(match => 
          match.index! > maxLength - 100 && match.index! <= maxLength + 100
        );
        
        if (validMatches.length > 0) {
          const lastMatch = validMatches[validMatches.length - 1];
          // For list items, break before the number/bullet, not after
          if (pattern.source.includes('\\d+\\.\\s') || pattern.source.includes('[-*]\\s')) {
            breakPoint = lastMatch.index!;
          } else {
            breakPoint = lastMatch.index! + lastMatch[0].length;
          }
          break;
        }
      }
    }

    // Ensure we don't cut off in the middle of important formatting
    const truncated = content.slice(0, breakPoint).trim();
    
    return {
      shouldCollapse: true,
      truncatedContent: truncated
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
            className="rr-copilot-show-more-btn"
            onClick={() => handleToggleExpanded(true)}
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
            className="rr-copilot-show-less-btn"
            onClick={() => handleToggleExpanded(false)}
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
