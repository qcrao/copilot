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
      const blockRefRegex = /\(\(([^)]+)\)\)/g;
      
      let match;
      const newNodes: any[] = [];
      let lastIndex = 0;

      while ((match = blockRefRegex.exec(value)) !== null) {
        const [fullMatch, uid] = match;
        const startIndex = match.index!;
        const trimmedUid = uid.trim();

        console.log('REMARK_BLOCKS_DEBUG: Found block reference:', {
          fullMatch: fullMatch,
          rawUid: uid,
          trimmedUid: trimmedUid,
          uidLength: trimmedUid.length,
          startIndex: startIndex,
          contextBefore: value.slice(Math.max(0, startIndex - 10), startIndex),
          contextAfter: value.slice(startIndex + fullMatch.length, Math.min(value.length, startIndex + fullMatch.length + 10))
        });

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
          uid: trimmedUid,
          data: {
            hName: 'span',
            hProperties: {
              className: ['roam-block-ref'],
              'data-uid': trimmedUid
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