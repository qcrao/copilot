// src/components/MessageRenderer.tsx
import React from 'react';

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content, isUser = false }) => {
  const parseContent = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        elements.push(textBefore);
      }

      // Add the link
      const linkText = match[1];
      const linkUrl = match[2];
      
      elements.push(
        <a
          key={match.index}
          href={linkUrl}
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick(linkUrl);
          }}
          style={{
            color: isUser ? '#ffffff' : '#106ba3',
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
          {linkText}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements;
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
        // Handle line breaks in text
        return element.split('\n').map((line, lineIndex, arr) => (
          <React.Fragment key={`${index}-${lineIndex}`}>
            {line}
            {lineIndex < arr.length - 1 && <br />}
          </React.Fragment>
        ));
      }
      return element;
    });
  };

  return (
    <div style={{ 
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: '1.4'
    }}>
      {renderContent()}
    </div>
  );
};