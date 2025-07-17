// src/utils/roam/remarkRoam.ts

/**
 * Consolidated Remark plugin for processing Roam Research syntax
 * Combines remarkRoamBlocks, remarkRoamPages, and remarkRoamLinks functionality
 */

import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Link } from 'mdast';
import { ValidationUtils } from '../shared/validation';

// Custom node types for Roam elements
export interface RoamBlockNode {
  type: 'roamBlock';
  uid: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, any>;
  };
}

export interface RoamPageNode {
  type: 'roamPage';
  pageName: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, any>;
  };
}

// Extend the MDAST node types
declare module 'mdast' {
  interface RootContentMap {
    roamBlock: RoamBlockNode;
    roamPage: RoamPageNode;
  }
}

// Plugin configuration options
export interface RemarkRoamOptions {
  processBlocks?: boolean;
  processPages?: boolean;
  processLinks?: boolean;
  validateReferences?: boolean;
  debugMode?: boolean;
}

const DEFAULT_OPTIONS: RemarkRoamOptions = {
  processBlocks: true,
  processPages: true,
  processLinks: true,
  validateReferences: true,
  debugMode: false,
};

/**
 * Extract UID from Roam URL for backward compatibility
 */
function extractUidFromUrl(url: string): string | null {
  // Match patterns like:
  // https://roamresearch.com/#/app/graph/page/uid
  // roam://#/app/graph/page/uid
  const roamUrlPattern = /(?:https?:\/\/roamresearch\.com\/#\/app\/[^\/]+\/page\/|roam:\/\/#\/app\/[^\/]+\/page\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(roamUrlPattern);
  return match ? match[1] : null;
}

/**
 * Check if a URL is a Roam link
 */
function isRoamUrl(url: string): boolean {
  return url.includes('roamresearch.com') || url.startsWith('roam://');
}

/**
 * Process block references ((uid)) in text nodes
 */
function processBlockReferences(
  node: Text,
  index: number | undefined,
  parent: any,
  options: RemarkRoamOptions
): void {
  if (!parent || index === undefined) return;

  const value = node.value;
  // Handle both normal ((uid)) and incorrectly formatted (((uid))) patterns
  const blockRefRegex = /\({2,3}([^)]+)\){2,3}/g;
  
  let match;
  const newNodes: any[] = [];
  let lastIndex = 0;

  while ((match = blockRefRegex.exec(value)) !== null) {
    const [fullMatch, uid] = match;
    const startIndex = match.index!;

    // Add text before the match
    if (startIndex > lastIndex) {
      newNodes.push({
        type: 'text',
        value: value.slice(lastIndex, startIndex)
      });
    }

    // Sanitize and validate the UID
    const sanitizedUid = ValidationUtils.sanitizeUID(uid);
    
    if (sanitizedUid && (!options.validateReferences || ValidationUtils.isValidUID(sanitizedUid))) {
      // Add the Roam block reference node
      newNodes.push({
        type: 'roamBlock',
        uid: sanitizedUid,
        data: {
          hName: 'span',
          hProperties: {
            className: ['roam-block-ref'],
            'data-uid': sanitizedUid
          }
        }
      } as RoamBlockNode);

      if (options.debugMode) {
        console.log('RemarkRoam: Processed block reference:', {
          original: fullMatch,
          sanitized: sanitizedUid
        });
      }
    } else {
      // Treat as regular text if validation fails
      newNodes.push({
        type: 'text',
        value: fullMatch
      });

      if (options.debugMode) {
        console.warn('RemarkRoam: Invalid block reference:', {
          original: fullMatch,
          sanitized: sanitizedUid
        });
      }
    }

    lastIndex = startIndex + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < value.length) {
    newNodes.push({
      type: 'text',
      value: value.slice(lastIndex)
    });
  }

  // Replace the text node with new nodes if we found matches
  if (newNodes.length > 0) {
    parent.children.splice(index, 1, ...newNodes);
  }
}

/**
 * Process page references [[Page Name]] in text nodes
 */
function processPageReferences(
  node: Text,
  index: number | undefined,
  parent: any,
  options: RemarkRoamOptions
): void {
  if (!parent || index === undefined) return;

  const value = node.value;
  const pageRefRegex = /\[\[([^\]]+)\]\]/g;
  
  let match;
  const newNodes: any[] = [];
  let lastIndex = 0;

  while ((match = pageRefRegex.exec(value)) !== null) {
    const [fullMatch, pageName] = match;
    const startIndex = match.index!;
    const trimmedPageName = pageName.trim();

    // Add text before the match
    if (startIndex > lastIndex) {
      newNodes.push({
        type: 'text',
        value: value.slice(lastIndex, startIndex)
      });
    }

    // Validate if this is a legitimate page reference
    if (!options.validateReferences || ValidationUtils.isValidPageName(trimmedPageName)) {
      // Add the Roam page reference node
      newNodes.push({
        type: 'roamPage',
        pageName: trimmedPageName,
        data: {
          hName: 'span',
          hProperties: {
            className: ['roam-page-ref'],
            'data-page-name': trimmedPageName,
            'data-needs-validation': options.validateReferences ? 'true' : 'false'
          }
        }
      } as RoamPageNode);

      if (options.debugMode) {
        console.log('RemarkRoam: Processed page reference:', trimmedPageName);
      }
    } else {
      // Treat as regular text, not a page reference
      newNodes.push({
        type: 'text',
        value: fullMatch
      });

      if (options.debugMode) {
        console.warn('RemarkRoam: Invalid page reference:', trimmedPageName);
      }
    }

    lastIndex = startIndex + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < value.length) {
    newNodes.push({
      type: 'text',
      value: value.slice(lastIndex)
    });
  }

  // Replace the text node with new nodes if we found matches
  if (newNodes.length > 0) {
    parent.children.splice(index, 1, ...newNodes);
  }
}

/**
 * Process Roam links for backward compatibility
 */
function processRoamLinks(
  node: Link,
  index: number | undefined,
  parent: any,
  options: RemarkRoamOptions
): void {
  if (!parent || index === undefined || !node.url) return;

  // Only process Roam URLs
  if (!isRoamUrl(node.url)) return;

  const uid = extractUidFromUrl(node.url);
  if (!uid) return;

  // Validate the extracted UID
  const sanitizedUid = ValidationUtils.sanitizeUID(uid);
  if (!sanitizedUid || (options.validateReferences && !ValidationUtils.isValidUID(sanitizedUid))) {
    if (options.debugMode) {
      console.warn('RemarkRoam: Invalid UID from Roam link:', {
        url: node.url,
        extracted: uid,
        sanitized: sanitizedUid
      });
    }
    return; // Leave as regular link
  }

  if (options.debugMode) {
    console.log('RemarkRoam: Converting Roam link to block reference:', {
      originalUrl: node.url,
      extractedUid: sanitizedUid,
      linkText: node.children?.[0]?.type === 'text' ? node.children[0].value : 'unknown'
    });
  }

  // Replace the link node with a roamBlock node
  const roamBlockNode: RoamBlockNode = {
    type: 'roamBlock',
    uid: sanitizedUid,
    data: {
      hName: 'span',
      hProperties: {
        className: ['roam-block-ref'],
        'data-uid': sanitizedUid
      }
    }
  };

  // Replace the link with the block reference
  parent.children[index] = roamBlockNode as any;
}

/**
 * Main Remark plugin for processing all Roam syntax
 */
const remarkRoam: Plugin<[RemarkRoamOptions?], Root> = (options = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (tree) => {
    // Process text nodes for block and page references
    if (config.processBlocks || config.processPages) {
      visit(tree, 'text', (node: Text, index, parent) => {
        // Process block references first, then page references
        // This ensures proper precedence if there are conflicts
        if (config.processBlocks) {
          processBlockReferences(node, index, parent, config);
        }
        
        // Note: After processing block references, the node structure may have changed
        // We need to visit the modified tree again for page references
      });

      // Second pass for page references after block references are processed
      if (config.processPages) {
        visit(tree, 'text', (node: Text, index, parent) => {
          processPageReferences(node, index, parent, config);
        });
      }
    }

    // Process Roam links for backward compatibility
    if (config.processLinks) {
      visit(tree, 'link', (node: Link, index, parent) => {
        processRoamLinks(node, index, parent, config);
      });
    }
  };
};

export default remarkRoam;