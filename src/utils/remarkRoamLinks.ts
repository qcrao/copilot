import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Link } from 'mdast';

// Custom node type for converted Roam links
interface RoamLinkNode {
  type: 'roamBlock' | 'roamPage';
  uid?: string;
  pageName?: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, any>;
  };
}

/**
 * Extract UID from Roam URL
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
 * Remark plugin to convert Roam markdown links back to block references
 * This provides backward compatibility for existing conversations
 */
const remarkRoamLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'link', (node: Link, index, parent) => {
      if (!parent || index === undefined || !node.url) return;

      // Only process Roam URLs
      if (!isRoamUrl(node.url)) return;

      const uid = extractUidFromUrl(node.url);
      if (!uid) return;

      console.log('REMARK_LINKS_DEBUG: Converting Roam link to block reference:', {
        originalUrl: node.url,
        extractedUid: uid,
        linkText: node.children?.[0]?.type === 'text' ? node.children[0].value : 'unknown'
      });

      // Validate the extracted UID
      if (uid.length < 6 || uid.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(uid)) {
        console.warn('REMARK_LINKS_DEBUG: Extracted UID failed validation:', uid);
        return; // Leave as regular link
      }

      // Replace the link node with a roamBlock node
      const roamBlockNode: RoamLinkNode = {
        type: 'roamBlock',
        uid: uid,
        data: {
          hName: 'span',
          hProperties: {
            className: ['roam-block-ref'],
            'data-uid': uid
          }
        }
      };

      // Replace the link with the block reference
      parent.children[index] = roamBlockNode as any;
    });
  };
};

export default remarkRoamLinks;
export type { RoamLinkNode };