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

        // Add text before the match
        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastIndex, startIndex)
          });
        }

        // Add the Roam page reference node
        newNodes.push({
          type: 'roamPage',
          pageName: pageName.trim(),
          data: {
            hName: 'span',
            hProperties: {
              className: ['roam-page-ref'],
              'data-page-name': pageName.trim()
            }
          }
        } as RoamPageNode);

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