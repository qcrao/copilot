// src/components/EnhancedMessageRenderer.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import remarkRoamBlocks from '../utils/remarkRoamBlocks';
import remarkRoamLinks from '../utils/remarkRoamLinks';
import { RoamQuery } from '../utils/roamQuery';
import { BLOCK_PREVIEW_LENGTH } from '../constants';

// Global cache for block content to prevent re-loading during streaming
const blockContentCache = new Map<string, { content: string; timestamp: number }>();
const pageExistenceCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Import Highlight.js CSS for code highlighting
import 'highlight.js/styles/github.css';

interface EnhancedMessageRendererProps {
  content: string;
  isUser?: boolean;
  isStreaming?: boolean;
}

// Component for rendering roam block references with content
const BlockReference: React.FC<{
  uid: string;
  isUser: boolean;
}> = ({ uid, isUser }) => {
  // Check cache immediately for initial state
  const getCachedContent = (uid: string): { content: string; isLoading: boolean } => {
    const now = Date.now();
    const cached = blockContentCache.get(uid);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return { content: cached.content, isLoading: false };
    }
    return { content: '', isLoading: true };
  };

  const initialState = getCachedContent(uid);
  const [blockContent, setBlockContent] = useState<string>(initialState.content);
  const [isLoading, setIsLoading] = useState(initialState.isLoading);

  useEffect(() => {
    const loadBlockContent = async () => {
      try {
        
        // Validate UID
        if (!uid || typeof uid !== 'string') {
          setBlockContent(`Invalid block reference`);
          setIsLoading(false);
          return;
        }

        // Roam UIDs are typically 9 characters but can vary from 6-20 characters
        if (uid.length < 6 || uid.length > 20) {
          setBlockContent(`[Invalid UID length]`);
          setIsLoading(false);
          return;
        }

        // Check for common invalid UID patterns  
        if (uid.includes(' ') || uid.includes('\n') || uid.includes('\t')) {
          setBlockContent(`[Invalid UID format]`);
          setIsLoading(false);
          return;
        }

        // Check for valid UID characters (alphanumeric, hyphens, underscores)
        if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
          setBlockContent(`[Invalid UID characters]`);
          setIsLoading(false);
          return;
        }

        // Check cache first
        const now = Date.now();
        const cached = blockContentCache.get(uid);
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          setBlockContent(cached.content);
          setIsLoading(false);
          return;
        }

        const blockData = await RoamQuery.getBlock(uid);
        
        if (blockData) {
          const preview = RoamQuery.formatBlockPreview(blockData.string, BLOCK_PREVIEW_LENGTH);
          setBlockContent(preview);
          // Cache the result
          blockContentCache.set(uid, { content: preview, timestamp: now });
        } else {
          const errorMsg = `[Block ${uid} not found]`;
          setBlockContent(errorMsg);
          // Cache error result for shorter duration
          blockContentCache.set(uid, { content: errorMsg, timestamp: now - CACHE_DURATION + 30000 }); // 30 second cache for errors
          
          // Optional: Log for debugging purposes
          console.log(`📋 Block not found: ${uid}. This could mean:
            1. The block was deleted
            2. There's a sync issue 
            3. The UID format is incorrect
            4. Access permissions changed`);
        }
      } catch (error) {
        console.error('Error loading block content for UID:', uid, error);
        const errorMsg = `[Error loading block]`;
        setBlockContent(errorMsg);
        // Cache error result for shorter duration
        const now = Date.now();
        blockContentCache.set(uid, { content: errorMsg, timestamp: now - CACHE_DURATION + 30000 });
      } finally {
        setIsLoading(false);
      }
    };

    loadBlockContent();
  }, [uid]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Navigate to the block in Roam
    if (uid && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        roamAPI.ui.mainWindow.openBlock({ block: { uid: uid } });
      } catch (error) {
        try {
          // Try opening in right sidebar
          const roamAPI = (window as any).roamAlphaAPI;
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: "block", "block-uid": uid }
          });
        } catch (sidebarError) {
          try {
            // Try direct URL navigation to the block
            const currentUrl = window.location.href;
            const roamDbMatch = currentUrl.match(/\/app\/([^\/]+)/);
            if (roamDbMatch) {
              const dbName = roamDbMatch[1];
              const blockUrl = `${window.location.origin}/app/${dbName}/page/${uid}`;
              window.location.href = blockUrl;
            }
          } catch (urlError) {
            // Final fallback - try to focus on the block if it's visible
            try {
              const blockElement = document.querySelector(`[data-uid="${uid}"]`);
              if (blockElement) {
                blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (blockElement as HTMLElement).focus();
              }
            } catch (focusError) {
              console.error('Navigation failed:', focusError);
            }
          }
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
      {isLoading ? `[Loading...]` : blockContent}
    </span>
  );
};

// Component for rendering Roam page references with existence validation
const PageReference: React.FC<{
  pageName: string;
  needsValidation?: boolean;
}> = ({ pageName, needsValidation = false }) => {
  // Check cache immediately for initial state
  const getCachedPageExists = (pageName: string): { exists: boolean | null; isChecking: boolean } => {
    if (!needsValidation) return { exists: true, isChecking: false };
    
    const now = Date.now();
    const cached = pageExistenceCache.get(pageName);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return { exists: cached.exists, isChecking: false };
    }
    return { exists: null, isChecking: true };
  };

  const initialState = getCachedPageExists(pageName);
  const [pageExists, setPageExists] = useState<boolean | null>(initialState.exists);
  const [isChecking, setIsChecking] = useState(initialState.isChecking);

  useEffect(() => {
    if (needsValidation && isChecking) {
      const checkPageExists = async () => {
        try {
          // Check cache first
          const now = Date.now();
          const cached = pageExistenceCache.get(pageName);
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            setPageExists(cached.exists);
            setIsChecking(false);
            return;
          }

          if (typeof window === 'undefined' || !(window as any).roamAlphaAPI) {
            setPageExists(false);
            setIsChecking(false);
            pageExistenceCache.set(pageName, { exists: false, timestamp: now });
            return;
          }

          const pageQuery = `
            [:find ?uid
             :where
             [?page :node/title "${pageName}"]
             [?page :block/uid ?uid]]
          `;

          const result = (window as any).roamAlphaAPI.q(pageQuery);
          const exists = result && result.length > 0;
          setPageExists(exists);
          setIsChecking(false);
          // Cache the result
          pageExistenceCache.set(pageName, { exists, timestamp: now });
        } catch (error) {
          console.error('Error checking page existence:', error);
          setPageExists(false);
          setIsChecking(false);
          // Cache error result for shorter duration
          const now = Date.now();
          pageExistenceCache.set(pageName, { exists: false, timestamp: now - CACHE_DURATION + 30000 });
        }
      };

      checkPageExists();
    }
  }, [pageName, needsValidation, isChecking]);

  // If page doesn't exist, render as plain text
  if (needsValidation && !isChecking && pageExists === false) {
    return (
      <span style={{ color: '#393A3D' }}>
        {pageName}
      </span>
    );
  }

  // If still checking, show loading state
  if (isChecking) {
    return (
      <span style={{ color: '#393A3D', fontStyle: 'italic' }}>
        {pageName}
      </span>
    );
  }
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Navigate to the page in Roam
    if (pageName && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        roamAPI.ui.mainWindow.openPage({ page: { title: pageName } });
      } catch (error) {
        try {
          // Try opening in right sidebar
          const roamAPI = (window as any).roamAlphaAPI;
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: "page", "page-title": pageName }
          });
        } catch (sidebarError) {
          try {
            // Try direct URL navigation to the page
            const currentUrl = window.location.href;
            const roamDbMatch = currentUrl.match(/\/app\/([^\/]+)/);
            if (roamDbMatch) {
              const dbName = roamDbMatch[1];
              const pageUrl = `${window.location.origin}/app/${dbName}/page/${encodeURIComponent(pageName)}`;
              window.location.href = pageUrl;
            }
          } catch (urlError) {
            console.error('Navigation failed:', urlError);
          }
        }
      }
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
  isStreaming = false
}) => {
  // Pre-process content to remove thinking blocks and clean up formatting
  const preprocessContent = (text: string): string => {
    let processedText = text
      .replace(/<think>([\s\S]*?)<\/think>/gi, '') // Remove think blocks entirely
      .replace(/^([^：:\n]+?)：\s*$/gm, '$1') // Remove trailing colons from lines that look like titles
      .replace(/^([^：:\n]+?):\s*$/gm, '$1') // Handle both Chinese and English colons
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with just 2
      .replace(/^\s*\n/gm, '\n') // Remove lines that only contain whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse multiple empty lines to single empty line
      .replace(/\s+$/, '') // Remove all trailing whitespace
      // Convert plain image URLs to markdown image syntax
      .replace(/(?<!\!\[.*?\]\()(?<!\]\()(?<!\()(?<!\[)(https?:\/\/[^\s<>\[\]]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:\?[^\s<>\[\]]*)?(?:#[^\s<>\[\]]*)?)/gi, '![Image]($1)')
      // Handle images that are on their own line
      .replace(/^\s*(https?:\/\/[^\s<>\[\]]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:\?[^\s<>\[\]]*)?(?:#[^\s<>\[\]]*)?)\s*$/gim, '![Image]($1)');
    
    
    // Smart handling for streaming: only hide truly incomplete references
    if (isStreaming) {
      // Only remove incomplete references at the very end of content or spanning newlines
      // This allows complete references like ((uid)) and [[page]] to be processed normally
      processedText = processedText
        // Remove incomplete block references only at end of text or before newlines
        .replace(/\(\([^)]*$/, '') // Incomplete ((... at end of text
        .replace(/\(\([^)]*(?=\n)/g, '') // Incomplete ((... before newline
        // Remove incomplete page references only at end of text or before newlines  
        .replace(/\[\[[^\]]*$/, '') // Incomplete [[... at end of text
        .replace(/\[\[[^\]]*(?=\n)/g, ''); // Incomplete [[... before newline
      
      // Keep complete references intact - they should be processed normally
      // Complete patterns like ((uid)) and [[page]] will be handled by remarkRoam
    }
    
    return processedText.trim(); // Remove leading/trailing whitespace
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
          remarkRoamLinks, // Process markdown links first
          [remarkRoamBlocks, { 
            processBlocks: true,
            processPages: true,
            processLinks: true,
            validateReferences: true,
            debugMode: false,
            isStreaming
          }]
        ]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, subset: false }]
        ]}
        components={{
          // Custom component for code blocks with cleaner styling
          code({ className, children, ...rest }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            // Helper function to safely extract text content
            const getTextContent = (children: any): string => {
              if (typeof children === 'string') {
                return children;
              }
              if (Array.isArray(children)) {
                return children.map(child => getTextContent(child)).join('');
              }
              if (children && typeof children === 'object' && children.props) {
                return getTextContent(children.props.children);
              }
              if (children && children.toString && typeof children.toString === 'function') {
                const str = children.toString();
                return str === '[object Object]' ? '' : str;
              }
              return '';
            };
            
            const textContent = getTextContent(children);
            
            if (isInline) {
              return (
                <code
                  style={{
                    backgroundColor: '#f6f8fa',
                    color: '#24292f',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontFamily: 'SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", Consolas, "Droid Sans Mono", monospace',
                    fontSize: '0.85em',
                    border: '1px solid #d1d9e0'
                  }}
                  {...rest}
                >
                  {textContent}
                </code>
              );
            }

            return (
              <pre
                style={{
                  backgroundColor: '#f6f8fa',
                  color: '#24292f',
                  padding: '16px',
                  borderRadius: '8px',
                  fontFamily: 'SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", Consolas, "Droid Sans Mono", monospace',
                  fontSize: '0.85em',
                  overflow: 'auto',
                  margin: '12px 0',
                  whiteSpace: 'pre',
                  border: '1px solid #d1d9e0',
                  lineHeight: '1.45'
                }}
              >
                <code className={className}>
                  {textContent.replace(/\n$/, '')}
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
              const needsValidation = props['data-needs-validation'] === 'true';
              return (
                <PageReference 
                  pageName={props['data-page-name']} 
                  needsValidation={needsValidation}
                />
              );
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
                  color: '#106ba3',
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
              fontSize: '1.4em', 
              fontWeight: 'bold', 
              color: '#393A3D',
              margin: '12px 0 6px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h1>
          ),
          h2: ({ children, ...rest }) => (
            <h2 style={{ 
              fontSize: '1.2em', 
              fontWeight: 'bold', 
              color: '#393A3D',
              margin: '12px 0 6px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h2>
          ),
          h3: ({ children, ...rest }) => (
            <h3 style={{ 
              fontSize: '1.1em', 
              fontWeight: 'bold', 
              color: '#393A3D',
              margin: '12px 0 6px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h3>
          ),
          h4: ({ children, ...rest }) => (
            <h4 style={{ 
              fontSize: '1.05em', 
              fontWeight: 'bold', 
              color: '#393A3D',
              margin: '10px 0 5px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h4>
          ),
          h5: ({ children, ...rest }) => (
            <h5 style={{ 
              fontSize: '1em', 
              fontWeight: 'bold', 
              color: '#393A3D',
              margin: '10px 0 5px 0',
              lineHeight: '1.3'
            }} {...rest}>{children}</h5>
          ),
          h6: ({ children, ...rest }) => (
            <h6 style={{ 
              fontSize: '0.9em', 
              fontWeight: 'bold', 
              color: '#393A3D',
              margin: '10px 0 5px 0',
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

          // Style paragraphs with tighter spacing and handle structured content
          p: ({ children, ...rest }) => {
            // Check if paragraph is empty or only contains whitespace
            const isEmpty = !children || (Array.isArray(children) && children.every(child => 
              typeof child === 'string' && child.trim() === ''
            ));
            
            // Don't render empty paragraphs
            if (isEmpty) {
              return null;
            }
            
            // Check if this paragraph contains structured content (like section headers)
            const childrenStr = React.Children.toArray(children).join('');
            const isStructuredContent = /^\*\*[A-Z\s]+\*\*:?$|^\d+\.\s+\*\*[^\*]+\*\*:/.test(childrenStr);
            
            return (
              <p style={{ 
                margin: isStructuredContent ? '8px 0 6px 0' : '0 0 4px 0', 
                lineHeight: '1.6' 
              }} {...rest}>
                {children}
              </p>
            );
          },

          // Style tables properly
          table: ({ children, ...rest }) => (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              margin: '12px 0',
              fontSize: '0.9em',
              lineHeight: '1.4',
              border: '1px solid #e1e5e9',
              borderRadius: '6px',
              overflow: 'hidden'
            }} {...rest}>
              {children}
            </table>
          ),

          thead: ({ children, ...rest }) => (
            <thead style={{ backgroundColor: '#f6f8fa' }} {...rest}>
              {children}
            </thead>
          ),

          th: ({ children, ...rest }) => (
            <th style={{
              padding: '8px 12px',
              textAlign: 'left',
              fontWeight: '600',
              color: '#24292f',
              borderBottom: '2px solid #e1e5e9',
              borderRight: '1px solid #e1e5e9'
            }} {...rest}>
              {children}
            </th>
          ),

          td: ({ children, ...rest }) => (
            <td style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e1e5e9',
              borderRight: '1px solid #e1e5e9',
              verticalAlign: 'top'
            }} {...rest}>
              {children}
            </td>
          ),

          tbody: ({ children, ...rest }) => (
            <tbody {...rest}>
              {children}
            </tbody>
          ),

          tr: ({ children, ...rest }) => (
            <tr {...rest}>
              {children}
            </tr>
          ),

          // Style blockquotes properly
          blockquote: ({ children, ...rest }) => (
            <blockquote style={{
              margin: '8px 0',
              padding: '8px 12px',
              borderLeft: '3px solid #d1d5db',
              backgroundColor: '#f9fafb',
              fontSize: '0.9em',
              lineHeight: '1.5',
              color: '#6b7280',
              fontStyle: 'italic',
              borderRadius: '0 4px 4px 0'
            }} {...rest}>
              {children}
            </blockquote>
          )
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};