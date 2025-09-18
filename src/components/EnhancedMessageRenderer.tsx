// src/components/EnhancedMessageRenderer.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Popover, Position } from '@blueprintjs/core';

import remarkRoam from '../utils/roam/remarkRoam';
// remarkRoamLinks functionality is now included in remarkRoam
import { RoamQuery } from '../utils/roamQuery';
import { CONTENT_LIMITS } from '../utils/shared/constants';
import { RoamService } from '../services/roamService';
import { ValidationUtils } from '../utils/shared/validation';

// Global cache for block content to prevent re-loading during streaming
const blockContentCache = new Map<string, { content: string; timestamp: number; isFallback?: boolean }>();
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
  index?: number; // numeric citation index (1-based)
}> = ({ uid, isUser, index }) => {
  // Check cache immediately for initial state
  const getCachedContent = (uid: string): { content: string; isLoading: boolean } => {
    const now = Date.now();
    const cached = blockContentCache.get(uid);
    if (cached && !cached.isFallback && (now - cached.timestamp) < CACHE_DURATION) {
      return { content: cached.content, isLoading: false };
    }
    return { content: '', isLoading: true };
  };

  const initialState = getCachedContent(uid);
  const defaultValidity = ValidationUtils.isValidUID(uid);
  const [blockContent, setBlockContent] = useState<string>(initialState.content);
  const [isLoading, setIsLoading] = useState(initialState.isLoading);
  const [isValidBlock, setIsValidBlock] = useState<boolean>(
    initialState.isLoading ? defaultValidity : initialState.content !== ''
  );

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: number | null = null;

    const FALLBACK_TEXT = (targetUid: string) => `Block ((${targetUid}))`;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 600;

    const scheduleRetry = (attempt: number, loader: (nextAttempt: number) => void) => {
      if (attempt >= MAX_RETRIES - 1) {
        return;
      }
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      retryTimeout = window.setTimeout(() => {
        if (!isMounted) return;
        loader(attempt + 1);
      }, RETRY_DELAY_MS);
    };

    const loadBlockContent = async (attempt: number) => {
      try {
        if (attempt > 0 && isMounted) {
          setIsLoading(true);
        }

        // Validate UID
        if (!uid || typeof uid !== 'string') {
          if (!isMounted) return;
          setBlockContent(`Invalid block reference`);
          setIsValidBlock(false);
          return;
        }

        // Validate UID structure once up front
        if (!defaultValidity) {
          if (!isMounted) return;
          setBlockContent(`[Invalid UID format]`);
          setIsValidBlock(false);
          return;
        }

        const now = Date.now();
        const cached = blockContentCache.get(uid);
        if (cached && !cached.isFallback && (now - cached.timestamp) < CACHE_DURATION) {
          if (!isMounted) return;
          setBlockContent(cached.content);
          setIsValidBlock(true);
          return;
        }

        const roamAPI = typeof window !== 'undefined' ? (window as any).roamAlphaAPI : null;
        const canQueryRoam = !!(roamAPI && typeof roamAPI.pull === 'function');

        if (!canQueryRoam) {
          const fallback = FALLBACK_TEXT(uid);
          if (isMounted) {
            setBlockContent(fallback);
            setIsValidBlock(true);
          }
          blockContentCache.set(uid, { content: fallback, timestamp: now, isFallback: true });
          scheduleRetry(attempt, loadBlockContent);
          return;
        }

        // Try multiple methods to get block content
        let blockContent = null;
        let blockFound = false;

        // Method 1: Try direct query first (more reliable)
        try {
          const queryResult = roamAPI.q(`[:find ?s :in $ ?u :where [?b :block/uid ?u] [?b :block/string ?s]]`, uid);
          if (queryResult && queryResult.length > 0 && queryResult[0].length > 0) {
            blockContent = queryResult[0][0];
            blockFound = true;
            if (process.env.NODE_ENV === 'development') {
              console.log(`📋 Block ${uid} found via query:`, blockContent.substring(0, 150));
            }
          }
        } catch (queryError) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`📋 Query method failed for ${uid}:`, queryError);
          }
        }

        // Method 2: Fallback to pull API if query failed
        if (!blockFound) {
          try {
            const blockData = await RoamQuery.getBlock(uid);
            if (blockData && blockData.string) {
              blockContent = blockData.string;
              blockFound = true;
              if (process.env.NODE_ENV === 'development') {
                console.log(`📋 Block ${uid} found via pull API:`, blockContent.substring(0, 150));
              }
            }
          } catch (pullError) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`📋 Pull API method failed for ${uid}:`, pullError);
            }
          }
        }

        // Method 3: Try to find the block in the DOM as last resort
        if (!blockFound) {
          try {
            const blockElement = document.querySelector(`[data-uid="${uid}"]`);
            if (blockElement) {
              // Try to get text content from the block element
              const textElement = blockElement.querySelector('.roam-block') ||
                                blockElement.querySelector('.rm-block-text') ||
                                blockElement;
              if (textElement && textElement.textContent) {
                blockContent = textElement.textContent.trim();
                blockFound = true;
                if (process.env.NODE_ENV === 'development') {
                  console.log(`📋 Block ${uid} found via DOM:`, blockContent.substring(0, 150));
                }
              }
            }
          } catch (domError) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`📋 DOM method failed for ${uid}:`, domError);
            }
          }
        }

        if (!isMounted) return;

        if (blockFound && blockContent) {
          setBlockContent(blockContent);
          setIsValidBlock(true);
          blockContentCache.set(uid, { content: blockContent, timestamp: Date.now() });
        } else {
          const fallback = FALLBACK_TEXT(uid);
          if (process.env.NODE_ENV === 'development') {
            console.log(`📋 Block ${uid} not found with any method, using fallback:`, fallback);
          }
          setBlockContent(fallback);
          setIsValidBlock(true);
          blockContentCache.set(uid, { content: fallback, timestamp: Date.now(), isFallback: true });
          console.warn(`📋 Block content could not be retrieved for ${uid}; using fallback preview.`);
          scheduleRetry(attempt, loadBlockContent);
        }
      } catch (error) {
        console.error('Error loading block content for UID:', uid, error);
        const fallback = FALLBACK_TEXT(uid);
        if (isMounted) {
          setBlockContent(fallback);
          setIsValidBlock(defaultValidity);
        }
        blockContentCache.set(uid, { content: fallback, timestamp: Date.now(), isFallback: true });
        scheduleRetry(attempt, loadBlockContent);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadBlockContent(0);

    return () => {
      isMounted = false;
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };
  }, [uid, defaultValidity]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isValidBlock || isLoading) return;

    const roamAPI = typeof window !== 'undefined' ? (window as any).roamAlphaAPI : null;

    const tryUrlNavigation = (): boolean => {
      try {
        const urls = RoamService.generateBlockUrl(uid);
        if (!urls) return false;
        const isDesktop = RoamService.isDesktopApp();
        const target = isDesktop ? urls.desktopUrl : urls.webUrl;
        window.location.href = target;
        return true;
      } catch (urlError) {
        console.error('Navigation via URL failed:', urlError);
        return false;
      }
    };

    const tryDomFocus = () => {
      try {
        const blockElement = document.querySelector(`[data-uid="${uid}"]`);
        if (blockElement) {
          blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (blockElement as HTMLElement).focus();
        }
      } catch (focusError) {
        console.error('Navigation failed:', focusError);
      }
    };

    if (roamAPI) {
      try {
        roamAPI.ui.mainWindow.openBlock({ block: { uid } });
        return;
      } catch (mainWindowError) {
        console.warn('Main window navigation failed, attempting fallbacks:', mainWindowError);
        try {
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: 'block', 'block-uid': uid }
          });
          return;
        } catch (sidebarError) {
          console.warn('Sidebar navigation failed, attempting URL fallback:', sidebarError);
        }
      }
    }

    if (tryUrlNavigation()) {
      return;
    }

    tryDomFocus();
  };

  const renderPreviewPopover = () => {
    // Debug logging (can be removed later)
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Preview Debug:', { uid, isLoading, isValidBlock, blockContent: blockContent?.substring(0, 100) });
    }

    if (isLoading) {
      return (
        <div style={{
          padding: '8px 12px',
          fontSize: '12px',
          color: '#6b7280',
          fontStyle: 'italic',
          backgroundColor: 'white',
          border: '1px solid #d1d9e0',
          borderRadius: '6px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          Loading block content...
        </div>
      );
    }

    if (!isValidBlock) {
      return (
        <div style={{
          padding: '8px 12px',
          fontSize: '12px',
          color: '#6b7280',
          backgroundColor: 'white',
          border: '1px solid #d1d9e0',
          borderRadius: '6px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          Block reference invalid: (({uid}))
        </div>
      );
    }

    if (!blockContent || blockContent.trim() === '') {
      return (
        <div style={{
          padding: '8px 12px',
          fontSize: '12px',
          color: '#6b7280',
          backgroundColor: 'white',
          border: '1px solid #d1d9e0',
          borderRadius: '6px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginBottom: '4px',
            fontFamily: 'monospace'
          }}>
            (({uid}))
          </div>
          Block content not available
        </div>
      );
    }

    return (
      <div style={{
        padding: '8px 12px',
        maxWidth: '300px',
        fontSize: '13px',
        lineHeight: '1.4',
        color: '#24292f',
        backgroundColor: 'white',
        border: '1px solid #d1d9e0',
        borderRadius: '6px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: '4px',
          fontFamily: 'monospace'
        }}>
          (({uid}))
        </div>
        <div style={{
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap'
        }}>
          {blockContent.length > 200 ? blockContent.substring(0, 200) + '...' : blockContent}
        </div>
      </div>
    );
  };

  return (
    <Popover
      content={renderPreviewPopover()}
      position={Position.TOP}
      interactionKind="hover"
      minimal
      hoverOpenDelay={300}
      hoverCloseDelay={100}
    >
      <span
        style={{
          color: isValidBlock ? '#215db0' : '#6b7280',
          cursor: isValidBlock ? 'pointer' : 'default',
          display: 'inline',
          lineHeight: 'inherit',
          verticalAlign: 'baseline',
          transition: 'color 0.15s ease'
        }}
        aria-disabled={!isValidBlock}
        onMouseEnter={(e) => {
          if (!isValidBlock) return;
          e.currentTarget.style.color = '#1a4d96';
          (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = isValidBlock ? '#215db0' : '#6b7280';
          (e.currentTarget as HTMLElement).style.textDecoration = 'none';
        }}
        onClick={handleClick}
      >
        <sup style={{ fontSize: '0.75em', fontWeight: 600 }}>{index ?? '•'}</sup>
      </span>
    </Popover>
  );
};

// Component for rendering Roam page references with existence validation
const PageReference: React.FC<{
  pageName: string;
  needsValidation?: boolean;
}> = ({ pageName, needsValidation = true }) => {
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

  // Always validate by default to avoid broken navigation
  const initialState = getCachedPageExists(pageName);
  const [pageExists, setPageExists] = useState<boolean | null>(initialState.exists);
  const [isChecking, setIsChecking] = useState(initialState.isChecking);
  const [pageUid, setPageUid] = useState<string | null>(null);

  useEffect(() => {
    if (isChecking) {
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

          // Use q with input binding to avoid quote-escaping issues
          const pageQuery = `[:find ?u :in $ ?t :where [?p :node/title ?t] [?p :block/uid ?u]]`;

          const result = (window as any).roamAlphaAPI.q(pageQuery, pageName);
          const exists = Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) && result[0].length > 0;
          setPageExists(exists);
          setIsChecking(false);
          // Cache the result
          pageExistenceCache.set(pageName, { exists, timestamp: now });
          // Store UID for reliable navigation fallback
          setPageUid(exists ? result[0][0] : null);
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
  }, [pageName, isChecking]);

  // If page doesn't exist, render as plain text
  if (!isChecking && pageExists === false) {
    return (
      <span style={{ color: '#393A3D' }} title={`Page not found: ${pageName}`}>
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
            // Fallback: only navigate by UID. Never use title in /page path to avoid 404.
            if (pageUid) {
              const urls = RoamService.generatePageUrl(pageUid);
              if (urls) {
                const isDesktop = RoamService.isDesktopApp();
                window.location.href = isDesktop ? urls.desktopUrl : urls.webUrl;
              }
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
  // Build deterministic UID -> index map based on first appearance in content
  const buildCitationMap = (text: string): { order: string[]; map: Record<string, number> } => {
    const order: string[] = [];
    const seen = new Set<string>();

    const uidRe = /\(\(([a-zA-Z0-9_-]{6,})\)\)/g;
    let m: RegExpExecArray | null;
    while ((m = uidRe.exec(text)) !== null) {
      const uid = m[1];
      if (!seen.has(uid)) {
        seen.add(uid);
        order.push(uid);
      }
    }

    // Also support Roam deep links that include UIDs
    const roamUrlRe = /(?:https?:\/\/roamresearch\.com\/#\/app\/[^/]+\/page\/|roam:\/\/#\/app\/[^/]+\/page\/)([a-zA-Z0-9_-]+)/g;
    while ((m = roamUrlRe.exec(text)) !== null) {
      const uid = m[1];
      if (!seen.has(uid)) {
        seen.add(uid);
        order.push(uid);
      }
    }

    const map: Record<string, number> = {};
    order.forEach((u, i) => (map[u] = i + 1));
    return { order, map };
  };

  // We compute based on the processed content (after cleanup of incomplete refs)
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

  const citation = useMemo(() => buildCitationMap(processedContent), [processedContent]);
  const dynamicMapRef = useRef<{ map: Record<string, number>; next: number }>({ map: citation.map, next: citation.order.length + 1 });
  // Reset dynamic map when content changes
  useEffect(() => {
    dynamicMapRef.current = { map: citation.map, next: citation.order.length + 1 };
  }, [citation.map, citation.order.length]);

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
          // Process Roam syntax BEFORE GFM to avoid accidental [text](url) parsing
          [remarkRoam, { 
            processBlocks: true,
            processPages: true,
            processLinks: true,
            validateReferences: true,
            debugMode: false,
            isStreaming
          }],
          remarkGfm
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
              const uid = props['data-uid'];
              let index = dynamicMapRef.current.map[uid];
              if (!index) {
                index = dynamicMapRef.current.next++;
                dynamicMapRef.current.map[uid] = index;
              }
              return <BlockReference uid={uid} isUser={isUser} index={index} />;
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
                if (!href) return;

                // Intercept accidental Markdown link like [[Page]]((uid)) => href becomes "(uid)"
                const accidentalUidMatch = href.match(/^\(([a-zA-Z0-9_-]{6,20})\)$/);
                if (accidentalUidMatch && accidentalUidMatch[1]) {
                  const uid = accidentalUidMatch[1];
                  if (typeof window !== 'undefined' && (window as any).roamAlphaAPI) {
                    try {
                      (window as any).roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid } });
                      return;
                    } catch (err) {
                      // Fallback to URL navigation by UID
                      const urls = RoamService.generateBlockUrl(uid);
                      if (urls) {
                        const isDesktop = RoamService.isDesktopApp();
                        window.location.href = isDesktop ? urls.desktopUrl : urls.webUrl;
                        return;
                      }
                    }
                  }
                }

                if (href.startsWith('roam://')) {
                  window.location.href = href;
                } else if (href.startsWith('http://') || href.startsWith('https://')) {
                  window.open(href, '_blank', 'noopener,noreferrer');
                } else {
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

          // Style strong/bold text appropriately
          strong: ({ children, ...rest }) => (
            <strong style={{ 
              fontWeight: 'bold', 
              color: 'inherit' 
            }} {...rest}>
              {children}
            </strong>
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
