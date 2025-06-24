// src/components/MessageRenderer.tsx
import React from 'react';

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content, isUser = false }) => {
  const parseContent = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    
    // Define all patterns we want to match
    const patterns = [
      // Markdown links: [text](url)
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/g,
        type: 'markdown-link'
      },
      // Bold text: **text** or __text__
      {
        regex: /(\*\*|__)([^\*_]+)\1/g,
        type: 'bold'
      },
      // Italic text: *text* or _text_ (simple version to avoid lookbehind issues)
      {
        regex: /\*([^\*]+)\*|_([^_]+)_/g,
        type: 'italic'
      },
      // Inline code: `code`
      {
        regex: /`([^`]+)`/g,
        type: 'code'
      },
      // Roam page links: [[Page Name]]
      {
        regex: /\[\[([^\]]+)\]\]/g,
        type: 'roam-page'
      },
      // URLs: http:// or https://
      {
        regex: /(https?:\/\/[^\s\)\.,;!?\u4e00-\u9fff]+)/g,
        type: 'url'
      }
    ];

    // Find all matches from all patterns
    const allMatches: Array<{
      start: number;
      end: number;
      type: string;
      text: string;
      url?: string;
      originalMatch: string;
    }> = [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        if (pattern.type === 'markdown-link') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Link text
            url: match[2], // URL
            originalMatch: match[0]
          });
        } else if (pattern.type === 'bold') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[2], // Bold text content
            originalMatch: match[0]
          });
        } else if (pattern.type === 'italic') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1] || match[2], // Italic text content
            originalMatch: match[0]
          });
        } else if (pattern.type === 'code') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Code content
            originalMatch: match[0]
          });
        } else if (pattern.type === 'roam-page') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Page name
            originalMatch: match[0]
          });
        } else if (pattern.type === 'url') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // URL
            url: match[1], // Same as text for URLs
            originalMatch: match[0]
          });
        }
      }
    });

    // Sort by position and remove overlaps
    allMatches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches (prefer earlier ones)
    const filteredMatches = [];
    let lastEnd = 0;
    for (const match of allMatches) {
      if (match.start >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.end;
      }
    }

    // Build the elements
    let currentIndex = 0;
    filteredMatches.forEach((match, index) => {
      // Add text before this match
      if (match.start > currentIndex) {
        const textBefore = text.slice(currentIndex, match.start);
        elements.push(textBefore);
      }

      // Add the matched element
      elements.push(renderMatchedElement(match, index));
      currentIndex = match.end;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      elements.push(text.slice(currentIndex));
    }

    return elements;
  };

  const renderMatchedElement = (match: any, index: number): React.ReactNode => {
    switch (match.type) {
      case 'markdown-link':
        return (
          <a
            key={index}
            href={match.url}
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick(match.url);
            }}
            style={{
              color: isUser ? '#ffffff' : '#393A3D',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {match.text}
          </a>
        );

      case 'bold':
        return (
          <strong key={index}>{match.text}</strong>
        );

      case 'italic':
        return (
          <em key={index}>{match.text}</em>
        );

      case 'code':
        return (
          <code
            key={index}
            style={{
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              padding: '2px 4px',
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: '0.9em'
            }}
          >
            {match.text}
          </code>
        );

      case 'roam-page':
        return (
          <span
            key={index}
            style={{
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(57,58,61,0.1)',
              color: isUser ? '#ffffff' : '#393A3D',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '500',
              border: `1px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(57,58,61,0.3)'}`,
              cursor: 'default',
              margin: '1px 0',
              display: 'inline-block',
              lineHeight: '1.2'
            }}
            title={`Roam page: ${match.text}`}
          >
            {match.text}
          </span>
        );

      case 'url':
        return (
          <a
            key={index}
            href={match.url}
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick(match.url);
            }}
            style={{
              color: isUser ? '#ffffff' : '#393A3D',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {match.text}
          </a>
        );

      default:
        return match.text;
    }
  };

  const handleLinkClick = (url: string) => {
    try {
      if (url.startsWith('roam://')) {
        // Handle Roam desktop protocol
        window.location.href = url;
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // Handle web URLs
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback for other protocols
        window.location.href = url;
      }
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  };

  const renderContent = () => {
    const elements = parseContent(content);
    return elements.map((element, index) => {
      if (typeof element === 'string') {
        // Handle line breaks and list items in text
        return element.split('\n').map((line, lineIndex, arr) => {
          // Only convert to bullet point if it's clearly a list item:
          // - Must start with optional whitespace, then "-", then space, then content
          // - Content should be substantial (more than just a single dash)
          const listMatch = line.match(/^(\s*)-\s+(.{2,})$/);
          if (listMatch && listMatch[2].trim().length > 1) {
            const indentLevel = listMatch[1].length / 2; // Assuming 2 spaces per indent
            return (
              <React.Fragment key={`${index}-${lineIndex}`}>
                <div style={{ 
                  marginLeft: `${indentLevel * 16}px`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  margin: '2px 0'
                }}>
                  <span style={{ 
                    color: isUser ? '#ffffff' : '#393A3D',
                    fontWeight: 'bold',
                    lineHeight: '1.6'
                  }}>•</span>
                  <span>{listMatch[2]}</span>
                </div>
                {lineIndex < arr.length - 1 && lineIndex < arr.length - 1 && arr[lineIndex + 1].trim() !== '' && <br />}
              </React.Fragment>
            );
          }
          
          return (
            <React.Fragment key={`${index}-${lineIndex}`}>
              {line}
              {lineIndex < arr.length - 1 && <br />}
            </React.Fragment>
          );
        });
      }
      return element;
    });
  };

  return (
    <div style={{ 
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: '1.6'
    }}>
      {renderContent()}
    </div>
  );
};