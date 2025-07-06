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
        // Enhanced UID validation with detailed logging
        console.log('BLOCK_REF_DEBUG: Starting block reference load for UID:', uid);
        console.log('BLOCK_REF_DEBUG: UID type:', typeof uid, 'length:', uid?.length);
        
        if (!uid || typeof uid !== 'string') {
          console.warn('BLOCK_REF_DEBUG: UID is null, undefined, or not a string:', uid);
          setBlockContent(`Invalid block reference`);
          setIsLoading(false);
          return;
        }

        // Roam UIDs are typically 9 characters but can vary
        if (uid.length < 8 || uid.length > 15) {
          console.warn('BLOCK_REF_DEBUG: UID length outside expected range:', uid, 'length:', uid.length);
          setBlockContent(`Invalid block reference (${uid.substring(0, 8)}...)`);
          setIsLoading(false);
          return;
        }

        // Check for common invalid UID patterns
        if (uid.includes(' ') || uid.includes('\n') || uid.includes('\t')) {
          console.warn('BLOCK_REF_DEBUG: UID contains whitespace:', JSON.stringify(uid));
          setBlockContent(`Invalid block reference (${uid.substring(0, 8)}...)`);
          setIsLoading(false);
          return;
        }

        console.log('BLOCK_REF_DEBUG: UID validation passed, querying database for:', uid);
        const blockData = await RoamQuery.getBlock(uid);
        
        if (blockData) {
          const preview = RoamQuery.formatBlockPreview(blockData.string, BLOCK_PREVIEW_LENGTH);
          setBlockContent(preview);
          console.log('BLOCK_REF_DEBUG: Block content loaded successfully:', {
            uid: uid,
            contentLength: blockData.string?.length || 0,
            previewLength: preview.length,
            preview: preview.substring(0, 50) + '...'
          });
        } else {
          console.warn('BLOCK_REF_DEBUG: Block not found in database:', uid);
          console.warn('BLOCK_REF_DEBUG: This could indicate:');
          console.warn('  1. The UID does not exist in the database');
          console.warn('  2. The block was deleted');
          console.warn('  3. The UID was generated incorrectly by the AI');
          setBlockContent(`Block not found (${uid.substring(0, 8)}...)`);
        }
      } catch (error) {
        console.error('BLOCK_REF_DEBUG: Error loading block content for UID:', uid, error);
        console.error('BLOCK_REF_DEBUG: Error details:', {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack
        });
        setBlockContent(`Error loading block (${uid.substring(0, 8)}...)`);
      } finally {
        setIsLoading(false);
      }
    };

    loadBlockContent();
  }, [uid]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('BLOCK_REF_DEBUG: Block reference clicked for UID:', uid);
    
    // Navigate to the block in Roam
    if (uid && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        console.log('BLOCK_REF_DEBUG: Attempting to navigate to block with Roam API');
        
        // Method 1: Use Roam's official navigation API
        roamAPI.ui.mainWindow.openBlock({ block: { uid: uid } });
        console.log('BLOCK_REF_DEBUG: Successfully called roamAPI.ui.mainWindow.openBlock');
        
      } catch (error) {
        console.error("BLOCK_REF_DEBUG: roamAPI.ui.mainWindow.openBlock failed:", error);
        try {
          // Method 2: Try opening in right sidebar
          const roamAPI = (window as any).roamAlphaAPI;
          console.log('BLOCK_REF_DEBUG: Trying right sidebar approach');
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: "block", "block-uid": uid }
          });
          console.log('BLOCK_REF_DEBUG: Successfully called roamAPI.ui.rightSidebar.addWindow');
          
        } catch (sidebarError) {
          console.error("BLOCK_REF_DEBUG: Sidebar method also failed:", sidebarError);
          try {
            // Method 3: Try direct URL navigation to the block
            const currentUrl = window.location.href;
            const roamDbMatch = currentUrl.match(/\/app\/([^\/]+)/);
            if (roamDbMatch) {
              const dbName = roamDbMatch[1];
              const blockUrl = `${window.location.origin}/app/${dbName}/page/${uid}`;
              console.log('BLOCK_REF_DEBUG: Trying direct URL navigation to:', blockUrl);
              window.location.href = blockUrl;
            } else {
              console.error('BLOCK_REF_DEBUG: Could not extract database name from URL:', currentUrl);
            }
          } catch (urlError) {
            console.error("BLOCK_REF_DEBUG: All navigation methods failed:", urlError);
            
            // Method 4: Final fallback - try to focus on the block if it's visible
            try {
              const blockElement = document.querySelector(`[data-uid="${uid}"]`);
              if (blockElement) {
                console.log('BLOCK_REF_DEBUG: Found block element in DOM, scrolling to it');
                blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (blockElement as HTMLElement).focus();
              } else {
                console.log('BLOCK_REF_DEBUG: Block element not found in DOM');
              }
            } catch (focusError) {
              console.error('BLOCK_REF_DEBUG: Focus method also failed:', focusError);
            }
          }
        }
      }
    } else {
      console.error('BLOCK_REF_DEBUG: Roam API not available or UID invalid:', { 
        uid, 
        hasRoamAPI: !!(window as any).roamAlphaAPI,
        roamAPIAvailable: typeof (window as any).roamAlphaAPI
      });
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
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('PAGE_REF_DEBUG: Page reference clicked for page:', pageName);
    
    // Navigate to the page in Roam
    if (pageName && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        console.log('PAGE_REF_DEBUG: Attempting to navigate to page with Roam API');
        
        // Method 1: Try to navigate to the page directly
        roamAPI.ui.mainWindow.openPage({ page: { title: pageName } });
        console.log('PAGE_REF_DEBUG: Successfully called roamAPI.ui.mainWindow.openPage');
        
      } catch (error) {
        console.error("PAGE_REF_DEBUG: roamAPI.ui.mainWindow.openPage failed:", error);
        try {
          // Method 2: Try opening in right sidebar
          const roamAPI = (window as any).roamAlphaAPI;
          console.log('PAGE_REF_DEBUG: Trying right sidebar approach');
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: "page", "page-title": pageName }
          });
          console.log('PAGE_REF_DEBUG: Successfully called roamAPI.ui.rightSidebar.addWindow');
          
        } catch (sidebarError) {
          console.error("PAGE_REF_DEBUG: Sidebar method also failed:", sidebarError);
          try {
            // Method 3: Try direct URL navigation to the page
            const currentUrl = window.location.href;
            const roamDbMatch = currentUrl.match(/\/app\/([^\/]+)/);
            if (roamDbMatch) {
              const dbName = roamDbMatch[1];
              const pageUrl = `${window.location.origin}/app/${dbName}/page/${encodeURIComponent(pageName)}`;
              console.log('PAGE_REF_DEBUG: Trying direct URL navigation to:', pageUrl);
              window.location.href = pageUrl;
            } else {
              console.error('PAGE_REF_DEBUG: Could not extract database name from URL:', currentUrl);
            }
          } catch (urlError) {
            console.error("PAGE_REF_DEBUG: All navigation methods failed:", urlError);
          }
        }
      }
    } else {
      console.error('PAGE_REF_DEBUG: Roam API not available or page name invalid:', { 
        pageName, 
        hasRoamAPI: !!(window as any).roamAlphaAPI,
        roamAPIAvailable: typeof (window as any).roamAlphaAPI
      });
    }
  };

  return (
    <span
      style={{
        color: '#106ba3',
        cursor: 'pointer',
        textDecoration: 'none',
        fontWeight: 'normal',
        margin: '0 1px',
        display: 'inline',
        lineHeight: 'inherit',
        verticalAlign: 'baseline',
        transition: 'color 0.2s ease'
      }}
      title={`Navigate to page: ${pageName}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#0c5689';
        e.currentTarget.style.textDecoration = 'underline';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#106ba3';
        e.currentTarget.style.textDecoration = 'none';
      }}
      onClick={handleClick}
    >
      [[{pageName}]]
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
              console.log('RENDERER_DEBUG: Rendering block reference component:', {
                uid: props['data-uid'],
                className: className,
                isUser: isUser
              });
              return <BlockReference uid={props['data-uid']} isUser={isUser} />;
            }
            
            // Handle Roam page references
            if (className?.includes('roam-page-ref') && props['data-page-name']) {
              console.log('RENDERER_DEBUG: Rendering page reference component:', {
                pageName: props['data-page-name'],
                className: className,
                isUser: isUser
              });
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