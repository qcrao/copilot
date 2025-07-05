// src/components/EnhancedMessageRenderer.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import remarkRoamBlocks from '../utils/remarkRoamBlocks';
import remarkRoamPages from '../utils/remarkRoamPages';
import { RoamQuery } from '../utils/roamQuery';
import { BLOCK_PREVIEW_LENGTH } from '../constants';

// Import Highlight.js CSS for code highlighting
import 'highlight.js/styles/github.css';

interface EnhancedMessageRendererProps {
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

// Component for rendering Roam page references
const PageReference: React.FC<{
  pageName: string;
  isUser: boolean;
}> = ({ pageName, isUser }) => {
  return (
    <span
      style={{
        backgroundColor: isUser ? 'rgba(57, 58, 61, 0.1)' : 'rgba(57, 58, 61, 0.1)',
        color: isUser ? '#393A3D' : '#393A3D',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: '500',
        border: `1px solid ${isUser ? 'rgba(57, 58, 61, 0.3)' : 'rgba(57, 58, 61, 0.3)'}`,
        cursor: 'default',
        margin: '1px 0',
        display: 'inline-block',
        lineHeight: '1.2'
      }}
      title={`Roam page: ${pageName}`}
    >
      {pageName}
    </span>
  );
};

export const EnhancedMessageRenderer: React.FC<EnhancedMessageRendererProps> = ({ 
  content, 
  isUser = false, 
  model 
}) => {
  // Pre-process content to remove thinking blocks and clean up formatting
  const preprocessContent = (text: string): string => {
    return text
      .replace(/<think>([\s\S]*?)<\/think>/gi, '') // Remove think blocks entirely
      .replace(/^([^：:\n]+?)：\s*$/gm, '$1') // Remove trailing colons from lines that look like titles
      .replace(/^([^：:\n]+?):\s*$/gm, '$1') // Handle both Chinese and English colons
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with just 2
      .replace(/^\s*\n/gm, '\n') // Remove lines that only contain whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse multiple empty lines to single empty line
      .replace(/\s+$/, '') // Remove all trailing whitespace
      .trim(); // Remove leading/trailing whitespace
  };

  const processedContent = preprocessContent(content);

  return (
    <div 
      className="rr-copilot-enhanced-renderer"
      style={{ 
        whiteSpace: 'normal', // Change from 'pre-wrap' to 'normal' to handle whitespace better
        wordBreak: 'break-word',
        lineHeight: '1.6'
      }}
    >
      <ReactMarkdown
        skipHtml={false}
        unwrapDisallowed={true}
        remarkPlugins={[
          remarkGfm,
          remarkRoamBlocks,
          remarkRoamPages
        ]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, subset: false }]
        ]}
        components={{
          // Custom component for code blocks with syntax highlighting
          code({ className, children, ...rest }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code
                  style={{
                    backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontFamily: 'monospace',
                    fontSize: '0.9em'
                  }}
                  {...rest}
                >
                  {children}
                </code>
              );
            }

            return (
              <pre
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
                <code className={className}>
                  {String(children).replace(/\n$/, '')}
                </code>
              </pre>
            );
          },

          // Custom component for Roam block references
          span({ className, children, ...rest }) {
            const props = rest as any;
            
            // Handle Roam block references
            if (className?.includes('roam-block-ref') && props['data-uid']) {
              return <BlockReference uid={props['data-uid']} isUser={isUser} />;
            }
            
            // Handle Roam page references
            if (className?.includes('roam-page-ref') && props['data-page-name']) {
              return <PageReference pageName={props['data-page-name']} isUser={isUser} />;
            }

            // Default span rendering
            return <span className={Array.isArray(className) ? className.join(' ') : className} {...rest}>{children}</span>;
          },

          // Style links appropriately
          a({ href, children, ...rest }) {
            const handleLinkClick = (e: React.MouseEvent) => {
              e.preventDefault();
              try {
                if (href?.startsWith('roam://')) {
                  window.location.href = href;
                } else if (href?.startsWith('http://') || href?.startsWith('https://')) {
                  window.open(href, '_blank', 'noopener,noreferrer');
                } else if (href) {
                  window.location.href = href;
                }
              } catch (error) {
                console.error('Failed to open link:', error);
              }
            };

            return (
              <a
                href={href}
                onClick={handleLinkClick}
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
                {...rest}
              >
                {children}
              </a>
            );
          },

          // Style images appropriately
          img({ src, alt, ...rest }) {
            return (
              <img
                src={src}
                alt={alt || 'Image'}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '6px',
                  border: `1px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  margin: '8px 0'
                }}
                onError={(e) => {
                  // Replace with placeholder on error
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const placeholder = document.createElement('div');
                  placeholder.style.cssText = `
                    background-color: ${isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'};
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'};
                    text-align: center;
                    color: ${isUser ? 'rgba(255,255,255,0.7)' : 'rgba(57,58,61,0.7)'};
                    font-size: 12px;
                    margin: 8px 0;
                  `;
                  placeholder.textContent = `🖼️ Image: ${alt || src}`;
                  target.parentNode?.insertBefore(placeholder, target);
                }}
                {...rest}
              />
            );
          },

          // Style headings appropriately
          h1: ({ children, ...rest }) => (
            <h1 style={{ 
              fontSize: '1.8em', 
              fontWeight: 'bold', 
              color: isUser ? '#ffffff' : '#393A3D',
              margin: '16px 0 8px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h1>
          ),
          h2: ({ children, ...rest }) => (
            <h2 style={{ 
              fontSize: '1.5em', 
              fontWeight: 'bold', 
              color: isUser ? '#ffffff' : '#393A3D',
              margin: '16px 0 8px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h2>
          ),
          h3: ({ children, ...rest }) => (
            <h3 style={{ 
              fontSize: '1.3em', 
              fontWeight: 'bold', 
              color: isUser ? '#ffffff' : '#393A3D',
              margin: '16px 0 8px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h3>
          ),
          h4: ({ children, ...rest }) => (
            <h4 style={{ 
              fontSize: '1.1em', 
              fontWeight: 'bold', 
              color: isUser ? '#ffffff' : '#393A3D',
              margin: '16px 0 8px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h4>
          ),
          h5: ({ children, ...rest }) => (
            <h5 style={{ 
              fontSize: '1em', 
              fontWeight: 'bold', 
              color: isUser ? '#ffffff' : '#393A3D',
              margin: '16px 0 8px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h5>
          ),
          h6: ({ children, ...rest }) => (
            <h6 style={{ 
              fontSize: '0.9em', 
              fontWeight: 'bold', 
              color: isUser ? '#ffffff' : '#393A3D',
              margin: '16px 0 8px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h6>
          ),

          // Style lists appropriately
          ul: ({ children, ...rest }) => (
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }} {...rest}>
              {children}
            </ul>
          ),
          ol: ({ children, ...rest }) => (
            <ol style={{ paddingLeft: '20px', margin: '8px 0' }} {...rest}>
              {children}
            </ol>
          ),
          li: ({ children, ...rest }) => (
            <li style={{ margin: '2px 0', lineHeight: '1.6' }} {...rest}>
              {children}
            </li>
          ),

          // Style horizontal rules
          hr: ({ ...rest }) => (
            <hr
              style={{
                border: 'none',
                borderTop: `2px solid ${isUser ? 'rgba(255,255,255,0.3)' : 'rgba(57,58,61,0.3)'}`,
                margin: '16px 0',
                width: '100%'
              }}
              {...rest}
            />
          ),

          // Style paragraphs with tighter spacing
          p: ({ children, ...rest }) => {
            // Check if paragraph is empty or only contains whitespace
            const isEmpty = !children || (Array.isArray(children) && children.every(child => 
              typeof child === 'string' && child.trim() === ''
            ));
            
            // Don't render empty paragraphs
            if (isEmpty) {
              return null;
            }
            
            return (
              <p style={{ margin: '0 0 4px 0', lineHeight: '1.6' }} {...rest}>
                {children}
              </p>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};