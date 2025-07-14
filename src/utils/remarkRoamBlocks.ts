// src/utils/remarkRoamBlocks.ts
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text } from 'mdast';

// Custom node type for Roam block references
interface RoamBlockNode {
  type: 'roamBlock';
  uid: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, any>;
  };
}

// Extend the MDAST node types
declare module 'mdast' {
  interface RootContentMap {
    roamBlock: RoamBlockNode;
  }
}

/**
 * Remark plugin to parse Roam block references ((uid))
 * Transforms ((block-uid)) syntax into custom AST nodes
 */
const remarkRoamBlocks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
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
        const trimmedUid = uid.trim();


        // Clean up UID - remove ellipsis if present and validate
        let cleanUid = trimmedUid.replace(/\.{3,}$/, ''); // Remove trailing ellipsis
        
        // Validate the cleaned UID
        if (cleanUid.length < 6 || cleanUid.length > 20) {
          // Treat as regular text
          if (startIndex > lastIndex) {
            newNodes.push({
              type: 'text',
              value: value.slice(lastIndex, startIndex + fullMatch.length)
            });
          }
          lastIndex = startIndex + fullMatch.length;
          continue;
        }

        // Check for valid UID characters (after cleaning)
        if (!/^[a-zA-Z0-9_-]+$/.test(cleanUid)) {
          // Treat as regular text
          if (startIndex > lastIndex) {
            newNodes.push({
              type: 'text',
              value: value.slice(lastIndex, startIndex + fullMatch.length)
            });
          }
          lastIndex = startIndex + fullMatch.length;
          continue;
        }

        // Use the cleaned UID for the node
        const finalUid = cleanUid;

        // Add text before the match
        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastIndex, startIndex)
          });
        }

        // Add the Roam block reference node
        newNodes.push({
          type: 'roamBlock',
          uid: finalUid,
          data: {
            hName: 'span',
            hProperties: {
              className: ['roam-block-ref'],
              'data-uid': finalUid
            }
          }
        } as RoamBlockNode);

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

export default remarkRoamBlocks;
export type { RoamBlockNode };