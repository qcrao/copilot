// src/utils/remarkRoamPages.ts
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text } from 'mdast';

// Custom node type for Roam page links
interface RoamPageNode {
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
    roamPage: RoamPageNode;
  }
}

/**
 * Validates if a page name is a legitimate Roam page reference
 * Filters out common false positives like URLs, emojis, etc.
 */
function isValidPageReference(pageName: string): boolean {
  // Empty or whitespace-only strings are invalid
  if (!pageName || !pageName.trim()) {
    return false;
  }

  // URLs (http/https) should not be treated as page references
  if (pageName.match(/^https?:\/\//)) {
    return false;
  }

  // Email addresses should not be treated as page references
  if (pageName.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return false;
  }

  // Common invalid patterns that AIs might generate
  const invalidPatterns = [
    /^🔗\s*(Web|App|Link)$/i,  // "🔗 Web", "🔗 App" etc.
    /^(Web|App)\s*🔗$/i,       // "Web 🔗", "App 🔗" etc.
    /^(https?|ftp|file):\/\//i, // URLs
    /^www\./i,                  // www domains
    /^\d{4}-\d{2}-\d{2}$/,     // Pure dates (might be valid but often false positives)
    /^[\d\s\-:,\.]+$/,         // Only numbers, spaces, and punctuation
    /^[^\w\s\u4e00-\u9fff]+$/, // Only special characters (not Chinese, English, or numbers)
  ];

  // Check against invalid patterns
  for (const pattern of invalidPatterns) {
    if (pattern.test(pageName)) {
      return false;
    }
  }

  // Very short page names (1-2 characters) are often false positives unless they're Chinese/Japanese
  if (pageName.length <= 2 && !/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(pageName)) {
    return false;
  }

  // Strings that are too long (over 100 characters) are likely not page names
  if (pageName.length > 100) {
    return false;
  }

  // If it passes all checks, it's likely a valid page reference
  return true;
}

/**
 * Remark plugin to parse Roam page links [[Page Name]]
 * Transforms [[Page Name]] syntax into custom AST nodes
 */
const remarkRoamPages: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
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
        if (isValidPageReference(trimmedPageName)) {
          console.log('REMARK_PAGES_DEBUG: Valid page reference found:', trimmedPageName);
          // Add the Roam page reference node
          newNodes.push({
            type: 'roamPage',
            pageName: trimmedPageName,
            data: {
              hName: 'span',
              hProperties: {
                className: ['roam-page-ref'],
                'data-page-name': trimmedPageName
              }
            }
          } as RoamPageNode);
        } else {
          console.log('REMARK_PAGES_DEBUG: Invalid page reference, treating as plain text:', trimmedPageName);
          // Treat as regular text, not a page reference
          newNodes.push({
            type: 'text',
            value: fullMatch
          });
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
    });
  };
};

export default remarkRoamPages;
export type { RoamPageNode };