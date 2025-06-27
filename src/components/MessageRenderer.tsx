// src/components/MessageRenderer.tsx
import React, { useState, useEffect } from 'react';
import { RoamQuery } from '../utils/roamQuery';
import { BLOCK_PREVIEW_LENGTH } from '../constants';

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
  model?: string;
}

// Component for rendering roam block references with content
const BlockReference: React.FC<{
  uid: string;
  isUser: boolean;
}> = ({ uid, isUser }) => {
  const [blockContent, setBlockContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBlockContent = async () => {
      try {
        const blockData = await RoamQuery.getBlock(uid);
        if (blockData) {
          const preview = RoamQuery.formatBlockPreview(blockData.string, BLOCK_PREVIEW_LENGTH);
          setBlockContent(preview);
        } else {
          setBlockContent(`Block ${uid.substring(0, 8)}...`);
        }
      } catch (error) {
        console.error('Error loading block content:', error);
        setBlockContent(`Block ${uid.substring(0, 8)}...`);
      } finally {
        setIsLoading(false);
      }
    };

    loadBlockContent();
  }, [uid]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Navigate to the block in Roam
    if (uid && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        roamAPI.ui.mainWindow.openBlock({ block: { uid } });
      } catch (error) {
        console.error("Failed to navigate to block:", error);
        try {
          const roamAPI = (window as any).roamAlphaAPI;
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: "block", "block-uid": uid },
          });
        } catch (fallbackError) {
          console.error("Fallback navigation also failed:", fallbackError);
        }
      }
    }
  };

  return (
    <span
      style={{
        backgroundColor: isUser ? 'rgba(33, 93, 176, 0.08)' : 'rgba(33, 93, 176, 0.08)',
        color: isUser ? '#215db0' : '#215db0',
        padding: '2px 4px',
        borderRadius: '4px',
        fontSize: '15px',
        fontWeight: 'normal',
        textDecoration: 'underline',
        textDecorationColor: isUser ? '#215db0' : '#215db0',
        textUnderlineOffset: '2px',
        cursor: 'pointer',
        margin: '0 1px',
        display: 'inline',
        lineHeight: 'inherit',
        verticalAlign: 'baseline',
        textShadow: isUser ? 'none' : '0 1px 2px rgba(33, 93, 176, 0.1)',
        transition: 'all 0.2s ease',
        border: 'none'
      }}
      title={`Block reference: ${uid}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(33, 93, 176, 0.12)';
        e.currentTarget.style.color = '#1a4d96';
        e.currentTarget.style.textDecorationColor = '#1a4d96';
        e.currentTarget.style.textShadow = '0 1px 3px rgba(33, 93, 176, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(33, 93, 176, 0.08)';
        e.currentTarget.style.color = '#215db0';
        e.currentTarget.style.textDecorationColor = '#215db0';
        e.currentTarget.style.textShadow = '0 1px 2px rgba(33, 93, 176, 0.1)';
      }}
      onClick={handleClick}
    >
      {isLoading ? `Block ${uid.substring(0, 8)}...` : blockContent}
    </span>
  );
};

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content, isUser = false, model }) => {
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

  // Pre-process content to remove colons from title-like lines, handle think tags, and trailing whitespace
  const preprocessContent = (text: string): string => {
    // Only process thinking tags for models that support it
    const processedText = supportsThinking(model) 
      ? text.replace(/<think>([\s\S]*?)<\/think>/gi, (match, content) => {
                 // Convert think blocks to collapsed expandable sections with modern styling
                 return `<details style="margin: 12px 0; padding: 0; background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f5 100%); border-radius: 12px; border: 1px solid #e8eaed; box-shadow: 0 2px 8px rgba(60, 64, 67, 0.08); overflow: hidden; transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);">
                   <summary style="cursor: pointer; padding: 12px 16px; font-weight: 500; color: #5f6368; font-size: 13px; display: flex; align-items: center; gap: 8px; background: transparent; border: none; outline: none; transition: all 0.2s ease; user-select: none;">
                     <span style="font-size: 16px;">🧠</span>
                     <span>Thinking process (click to expand)</span>
                     <span style="margin-left: auto; font-size: 12px; color: #9aa0a6; transition: transform 0.2s ease;">▼</span>
                   </summary>
                   <div style="padding: 16px; background: #ffffff; border-top: 1px solid #f1f3f5; font-size: 13px; line-height: 1.5; color: #5f6368; font-style: normal; white-space: pre-wrap;">${content.trim()}</div>
                 </details>`;
               })
      : text;
    
    return processedText
               .replace(/^([^：:\n]+?)：\s*$/gm, '$1') // Remove trailing colons from lines that look like titles
               .replace(/^([^：:\n]+?):\s*$/gm, '$1') // Handle both Chinese and English colons
               .replace(/\s+$/, ''); // Remove all trailing whitespace and empty lines
  };

  const parseContent = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    
    // Define all patterns we want to match (order matters for priority)
    const patterns = [
      // HTML details/summary blocks: <details>...</details>
      {
        regex: /<details[^>]*>([\s\S]*?)<\/details>/gi,
        type: 'html-details'
      },
      // Images: ![alt](url) - should be processed before other patterns
      {
        regex: /!\[([^\]]*)\]\(([^)]+)\)/g,
        type: 'image'
      },
      // List items: - item (must be at start of line, includes nested lists)
      {
        regex: /^(\s*)-\s+(.+)$/gm,
        type: 'list-item'
      },
      // Horizontal rule: --- or *** (must be at start of line, 3 or more)
      {
        regex: /^(-{3,}|\*{3,}|_{3,})\s*$/gm,
        type: 'horizontal-rule'
      },
      // Headings: ### Header (must be at start of line)
      {
        regex: /^(#{1,6})\s+(.+)$/gm,
        type: 'heading'
      },
      // Code blocks: ```code``` (multiline)
      {
        regex: /```([\s\S]*?)```/g,
        type: 'code-block'
      },
      // Markdown links: [text](url)
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/g,
        type: 'markdown-link'
      },
      // Bold text: **text** or __text__
      {
        regex: /(\*\*|__)([^\*_]+?)\1/g,
        type: 'bold'
      },
      // Italic text: *text* or _text_ (simple approach to avoid conflicts)
      {
        regex: /\b_([^_\n]+?)_\b|\*([^\*\n]+?)\*/g,
        type: 'italic'
      },
      // Strikethrough: ~~text~~
      {
        regex: /~~([^~]+?)~~/g,
        type: 'strikethrough'
      },
      // Inline code: `code`
      {
        regex: /`([^`\n]+?)`/g,
        type: 'code'
      },
      // Roam page links: [[Page Name]]
      {
        regex: /\[\[([^\]]+)\]\]/g,
        type: 'roam-page'
      },
      // Roam block references: ((block-uid))
      {
        regex: /\(\(([^)]+)\)\)/g,
        type: 'roam-block'
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
        if (pattern.type === 'html-details') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Inner HTML content
            originalMatch: match[0]
          });
        } else if (pattern.type === 'image') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Alt text
            url: match[2], // Image URL
            originalMatch: match[0]
          });
        } else if (pattern.type === 'list-item') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[2], // List item content
            url: match[1], // Indentation level
            originalMatch: match[0]
          });
        } else if (pattern.type === 'horizontal-rule') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: '', // No text content for HR
            originalMatch: match[0]
          });
        } else if (pattern.type === 'heading') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[2], // Header text
            url: match[1], // Header level (# ## ###)
            originalMatch: match[0]
          });
        } else if (pattern.type === 'code-block') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Code content
            originalMatch: match[0]
          });
        } else if (pattern.type === 'markdown-link') {
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
        } else if (pattern.type === 'strikethrough') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Strikethrough text content
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
        } else if (pattern.type === 'roam-block') {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: pattern.type,
            text: match[1], // Block UID
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
      case 'html-details':
        return (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: match.originalMatch }}
            style={{
              margin: '8px 0'
            }}
          />
        );

      case 'list-item':
        const indentLevel = (match.url?.length || 0) / 2; // Calculate indent from spaces
        return (
          <div
            key={index}
            style={{ 
              marginLeft: `${indentLevel * 16}px`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              margin: '2px 0',
              lineHeight: '1.6'
            }}
          >
            <span style={{ 
              color: isUser ? '#ffffff' : '#393A3D',
              fontWeight: 'bold',
              lineHeight: '1.6',
              marginTop: '1px'
            }}>•</span>
            <span style={{ flex: 1 }}>
              {parseContent(match.text).map((subElement, subIndex) => 
                React.isValidElement(subElement) 
                  ? React.cloneElement(subElement as React.ReactElement, { key: `list-${index}-${subIndex}` })
                  : subElement
              )}
            </span>
          </div>
        );

      case 'horizontal-rule':
        return (
          <hr
            key={index}
            style={{
              border: 'none',
              borderTop: `2px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(57,58,61,0.3)'}`,
              margin: '16px 0',
              width: '100%'
            }}
          />
        );

      case 'heading':
        const level = match.url.length; // Number of # characters
        const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        const fontSizeMap: { [key: number]: string } = {
          1: '1.8em',
          2: '1.5em', 
          3: '1.3em',
          4: '1.1em',
          5: '1em',
          6: '0.9em'
        };
        const fontSize = fontSizeMap[level] || '1em';
        
        // Remove trailing colon from heading text
        const headingText = match.text.replace(/:\s*$/, '');
        
        return React.createElement(HeadingTag, {
          key: index,
          style: {
            fontSize,
            fontWeight: 'bold',
            color: isUser ? '#ffffff' : '#393A3D',
            margin: '16px 0 8px 0',
            lineHeight: '1.3'
          }
        }, headingText);

      case 'code-block':
        return (
          <pre
            key={index}
            style={{
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              padding: '12px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.9em',
              overflow: 'auto',
              margin: '8px 0',
              whiteSpace: 'pre-wrap',
              border: `1px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`
            }}
          >
            <code>{match.text}</code>
          </pre>
        );

      case 'image':
        return (
          <div key={index} style={{ margin: '8px 0' }}>
            <img
              src={match.url}
              alt={match.text || 'Image'}
              style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '6px',
                border: `1px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onError={(e) => {
                // Replace with placeholder on error
                e.currentTarget.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.style.cssText = `
                  background-color: ${isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'};
                  padding: 12px;
                  border-radius: 6px;
                  border: 1px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'};
                  text-align: center;
                  color: ${isUser ? 'rgba(255,255,255,0.7)' : 'rgba(57,58,61,0.7)'};
                  font-size: 12px;
                `;
                placeholder.textContent = `🖼️ Image: ${match.text || match.url}`;
                e.currentTarget.parentNode?.insertBefore(placeholder, e.currentTarget);
              }}
            />
          </div>
        );

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

      case 'strikethrough':
        return (
          <span
            key={index}
            style={{
              textDecoration: 'line-through',
              color: isUser ? 'rgba(255,255,255,0.7)' : 'rgba(57,58,61,0.7)'
            }}
          >
            {match.text}
          </span>
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

      case 'roam-block':
        return (
          <BlockReference 
            key={index}
            uid={match.text}
            isUser={isUser}
          />
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
    const processedContent = preprocessContent(content);
    const elements = parseContent(processedContent);
    return elements.map((element, index) => {
      if (typeof element === 'string') {
        // Handle line breaks in remaining text - normalize multiple consecutive newlines
        const normalizedText = element.replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with double newline
        return normalizedText.split('\n').map((line, lineIndex, arr) => (
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
      lineHeight: '1.6'
    }}>
      {renderContent()}
    </div>
  );
};