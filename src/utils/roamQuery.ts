// src/utils/roamQuery.ts
import { RoamBlock, RoamPage } from "../types";
import { BLOCK_PREVIEW_LENGTH } from "../constants";

export interface BlockWithReferences extends RoamBlock {
  references?: RoamPage[];
}

export class RoamQuery {
  /**
   * Get a block and its content recursively (2 levels deep)
   */
  static async getBlock(uid: string): Promise<BlockWithReferences | null> {
    try {
      console.log("ROAM_QUERY_DEBUG: Getting block:", uid);
      console.log("ROAM_QUERY_DEBUG: UID sanitized:", JSON.stringify(uid));

      // Query for the block itself
      const blockQuery = `
        [:find ?string
         :where
         [?block :block/uid "${uid}"]
         [?block :block/string ?string]]
      `;

      console.log("ROAM_QUERY_DEBUG: Executing query:", blockQuery);
      const blockResult = window.roamAlphaAPI.q(blockQuery);
      console.log("ROAM_QUERY_DEBUG: Query result:", blockResult);
      
      if (!blockResult || blockResult.length === 0) {
        console.log("ROAM_QUERY_DEBUG: Block not found:", uid);
        
        // Additional debugging: check if any partial matches exist (only in debug mode)
        if (uid.length >= 6) {
          try {
            const partialQuery = `
              [:find ?uid ?string
               :where
               [?block :block/uid ?uid]
               [?block :block/string ?string]
               [(clojure.string/starts-with? ?uid "${uid.substring(0, 6)}")]]
            `;
            
            const partialMatches = window.roamAlphaAPI.q(partialQuery);
            if (partialMatches && partialMatches.length > 0) {
              console.log("ROAM_QUERY_DEBUG: Found blocks with similar UID prefix:", 
                partialMatches.slice(0, 3).map(([blockUid, blockString]) => ({ 
                  uid: blockUid, 
                  preview: blockString.substring(0, 50) + '...' 
                }))
              );
            } else {
              console.log("ROAM_QUERY_DEBUG: No blocks found with similar UID prefix");
            }
          } catch (debugError) {
            console.log("ROAM_QUERY_DEBUG: Could not search for partial UID matches:", debugError);
          }
        }
        
        return null;
      }

      const blockString = blockResult[0][0];
      
      // Get children recursively (2 levels deep)
      const children = await this.getBlockChildren(uid, 2);
      
      // Parse page references from block string
      const references = await this.resolvePageReferences(blockString);

      console.log("Retrieved block:", {
        uid,
        string: blockString,
        children: children.length,
        references: references.length
      });

      return {
        uid,
        string: blockString,
        children,
        references
      };
    } catch (error) {
      console.error("Error getting block:", error);
      return null;
    }
  }

  /**
   * Get children blocks recursively with depth limit
   */
  static async getBlockChildren(blockUid: string, maxDepth: number): Promise<RoamBlock[]> {
    if (maxDepth <= 0) return [];

    try {
      const childrenQuery = `
        [:find ?uid ?string ?order
         :where
         [?parent :block/uid "${blockUid}"]
         [?parent :block/children ?child]
         [?child :block/uid ?uid]
         [?child :block/string ?string]
         [?child :block/order ?order]]
      `;

      const result = window.roamAlphaAPI.q(childrenQuery);
      if (!result) return [];

      const children: RoamBlock[] = result.map(
        ([uid, string, order]: [string, string, number]) => ({
          uid,
          string,
          order,
        })
      );

      children.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Recursively get children of children (reduce depth)
      for (const child of children) {
        child.children = await this.getBlockChildren(child.uid, maxDepth - 1);
      }

      return children;
    } catch (error) {
      console.error("Error getting block children:", error);
      return [];
    }
  }

  /**
   * Resolve page references from block text
   * Extracts [[Page Name]] references and gets their content
   */
  static async resolvePageReferences(text: string): Promise<RoamPage[]> {
    try {
      const pageReferences: RoamPage[] = [];
      
      // Match [[Page Name]] patterns
      const pageMatches = text.match(/\[\[([^\]]+)\]\]/g);
      if (!pageMatches) return [];

      // Extract unique page names
      const uniquePages = [...new Set(
        pageMatches.map(match => match.slice(2, -2))
      )];

      console.log("Found page references:", uniquePages);

      // Get content for each referenced page
      for (const pageName of uniquePages) {
        const pageContent = await this.getPageByTitle(pageName);
        if (pageContent) {
          pageReferences.push(pageContent);
        }
      }

      return pageReferences;
    } catch (error) {
      console.error("Error resolving page references:", error);
      return [];
    }
  }

  /**
   * Get page content by title (first level blocks only)
   */
  static async getPageByTitle(title: string): Promise<RoamPage | null> {
    try {
      console.log("Getting page by title:", title);

      // Query for page by title
      const pageQuery = `
        [:find ?uid
         :where
         [?page :node/title "${title}"]
         [?page :block/uid ?uid]]
      `;

      const pageResult = window.roamAlphaAPI.q(pageQuery);
      if (!pageResult || pageResult.length === 0) {
        console.log("Page not found:", title);
        return null;
      }

      const pageUid = pageResult[0][0];
      
      // Get first level blocks only (avoid infinite recursion)
      const blocks = await this.getPageFirstLevelBlocks(pageUid);

      return {
        title,
        uid: pageUid,
        blocks
      };
    } catch (error) {
      console.error("Error getting page by title:", error);
      return null;
    }
  }

  /**
   * Get only first level blocks of a page (no children)
   */
  static async getPageFirstLevelBlocks(pageUid: string): Promise<RoamBlock[]> {
    try {
      const query = `
        [:find ?uid ?string ?order
         :where
         [?page :block/uid "${pageUid}"]
         [?page :block/children ?block]
         [?block :block/uid ?uid]
         [?block :block/string ?string]
         [?block :block/order ?order]]
      `;

      const result = window.roamAlphaAPI.q(query);
      if (!result) return [];

      const blocks: RoamBlock[] = result.map(
        ([uid, string, order]: [string, string, number]) => ({
          uid,
          string,
          order,
          children: [] // No children to keep it lightweight
        })
      );

      blocks.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Limit to first 5 blocks to prevent overwhelming context
      return blocks.slice(0, 5);
    } catch (error) {
      console.error("Error getting page first level blocks:", error);
      return [];
    }
  }

  /**
   * Extract UID from Roam drag data
   */
  static extractUidFromDragData(dataTransfer: DataTransfer): string | null {
    try {
      const uidList = dataTransfer.getData("roam/block-uid-list");
      console.log("Drag data received:", uidList);
      
      if (!uidList) return null;
      
      // Parse the UID list (could be JSON array, comma-separated, or newline-separated)
      let uids: string[] = [];
      
      try {
        // Try parsing as JSON first
        uids = JSON.parse(uidList);
      } catch {
        // Check if it's newline-separated (most common from Roam drag)
        if (uidList.includes('\n') || uidList.includes('\r')) {
          uids = uidList.split(/[\r\n]+/).map(uid => uid.trim()).filter(uid => uid.length > 0);
        } else {
          // Fallback to comma-separated
          uids = uidList.split(',').map(uid => uid.trim()).filter(uid => uid.length > 0);
        }
      }
      
      console.log("Parsed UIDs from drag data:", uids);
      
      // Return first valid UID
      for (const uid of uids) {
        if (uid && uid.length >= 6 && uid.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(uid)) {
          return uid;
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting UID from drag data:", error);
      return null;
    }
  }

  /**
   * Format block content for display (preview)
   */
  static formatBlockPreview(blockString: string, maxLength: number = BLOCK_PREVIEW_LENGTH): string {
    if (!blockString) return "Empty block";
    
    const cleanText = blockString
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove [[ ]] from page references
      .replace(/\(\(([^)]+)\)\)/g, '') // Remove (( )) from block references
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
      .replace(/__([^_]+)__/g, '$1') // Remove underline markdown
      .trim();

    if (cleanText.length <= maxLength) {
      return cleanText;
    }

    return cleanText.substring(0, maxLength - 3) + "...";
  }
}