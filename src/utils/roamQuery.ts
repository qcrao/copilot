// src/utils/roamQuery.ts
import { RoamBlock, RoamPage } from "../types";
import { CONTENT_LIMITS } from "./shared/constants";
import { roamLogger } from "./shared/debug";

export interface BlockWithReferences extends RoamBlock {
  references?: RoamPage[];
  parent?: RoamBlock;
  siblings?: RoamBlock[];
  ancestorPath?: RoamBlock[];
}

type BlockPullEntity = {
  [":block/uid"]?: string;
  [":block/string"]?: string;
  [":block/order"]?: number;
  [":block/children"]?: BlockPullEntity[];
  [":block/parents"]?: BlockPullEntity[];
};

export class RoamQuery {
  private static readonly DEFAULT_CHILD_DEPTH = 2;

  private static buildBlockPullSpec(
    childrenDepth: number,
    includeParents: boolean = false
  ): any[] {
    const spec: any[] = [":block/uid", ":block/string", ":block/order"];

    if (childrenDepth > 0) {
      spec.push({
        ":block/children": RoamQuery.buildBlockPullSpec(childrenDepth - 1),
      });
    }

    if (includeParents) {
      spec.push({ ":block/parents": RoamQuery.buildParentSpec() });
    }

    return spec;
  }

  private static buildParentSpec(): any[] {
    return [
      ":block/uid",
      ":block/string",
      ":block/order",
      { ":block/children": RoamQuery.buildBlockPullSpec(1) },
    ];
  }

  private static transformBlockEntity(
    entity: BlockPullEntity,
    childrenDepth: number
  ): RoamBlock {
    const uid = entity?.[":block/uid"] || "";
    const blockString = entity?.[":block/string"] || "";
    const order = entity?.[":block/order"] ?? 0;

    let children: RoamBlock[] = [];
    if (childrenDepth > 0 && Array.isArray(entity?.[":block/children"])) {
      const nestedDepth = Math.max(0, childrenDepth - 1);
      children = (entity[":block/children"] as BlockPullEntity[])
        .map((child) =>
          RoamQuery.transformBlockEntity(child, nestedDepth)
        )
        .filter((child) => !!child.uid)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return {
      uid,
      string: blockString,
      order,
      children,
    };
  }

  private static extractImmediateParent(
    entity?: BlockPullEntity | null
  ): BlockPullEntity | null {
    if (!entity) return null;
    const parents = entity[":block/parents"];
    if (!Array.isArray(parents) || parents.length === 0) {
      return null;
    }
    return parents[parents.length - 1] || null;
  }

  private static mapAncestors(entity?: BlockPullEntity | null): RoamBlock[] {
    if (!entity) return [];
    const parents = entity[":block/parents"];
    if (!Array.isArray(parents) || parents.length === 0) {
      return [];
    }

    return parents
      .map((ancestor) => RoamQuery.transformBlockEntity(ancestor, 0))
      .filter((ancestor) => !!ancestor.uid);
  }
  
  /**
   * Get a block and its content recursively (2 levels deep)
   * Enhanced with parent, siblings, and ancestor path
   */
  static async getBlock(uid: string): Promise<BlockWithReferences | null> {
    try {
      if (roamLogger.isEnabled()) {
        roamLogger.log("Getting block via pull:", uid);
      }

      const pull = window.roamAlphaAPI?.pull;
      if (typeof pull !== "function") {
        roamLogger.error("Roam pull API unavailable");
        return null;
      }

      const rawBlock = pull(
        RoamQuery.buildBlockPullSpec(
          RoamQuery.DEFAULT_CHILD_DEPTH,
          true
        ),
        [":block/uid", uid]
      ) as BlockPullEntity | null;

      if (!rawBlock) {
        if (roamLogger.isEnabled()) {
          roamLogger.log("Block not found via pull:", uid);
        }
        return null;
      }

      const block = RoamQuery.transformBlockEntity(
        rawBlock,
        RoamQuery.DEFAULT_CHILD_DEPTH
      );
      const parentEntity = RoamQuery.extractImmediateParent(rawBlock);
      const parent = parentEntity
        ? RoamQuery.transformBlockEntity(parentEntity, 1)
        : null;

      const siblings = parent?.children
        ? parent.children.filter((sibling) => sibling.uid !== uid)
        : [];

      const ancestorPath = RoamQuery.mapAncestors(rawBlock);
      const references = await this.resolvePageReferences(block.string);

      const enhanced: BlockWithReferences = {
        ...block,
        parent: parent || undefined,
        siblings,
        ancestorPath,
        references,
      };

      if (roamLogger.isEnabled()) {
        roamLogger.log("Retrieved block via pull:", {
          uid: enhanced.uid,
          children: enhanced.children?.length || 0,
          parent: enhanced.parent?.uid,
          siblings: enhanced.siblings?.length || 0,
          ancestors: enhanced.ancestorPath?.length || 0,
        });
      }

      return enhanced;
    } catch (error) {
      roamLogger.error("Error getting block via pull:", error);
      return null;
    }
  }

  /**
   * Get children blocks recursively with depth limit
   */
  static async getBlockChildren(blockUid: string, maxDepth: number): Promise<RoamBlock[]> {
    if (maxDepth <= 0) return [];

    try {
      const pull = window.roamAlphaAPI?.pull;
      if (typeof pull !== "function") {
        roamLogger.error("Roam pull API unavailable");
        return [];
      }

      const rawBlock = pull(
        RoamQuery.buildBlockPullSpec(maxDepth, false),
        [":block/uid", blockUid]
      ) as BlockPullEntity | null;

      if (!rawBlock) {
        return [];
      }

      const block = RoamQuery.transformBlockEntity(rawBlock, maxDepth);
      return block.children || [];
    } catch (error) {
      roamLogger.error("Error getting block children:", error);
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

      roamLogger.log("Found page references:", uniquePages);

      // Get content for each referenced page
      for (const pageName of uniquePages) {
        const pageContent = await this.getPageByTitle(pageName);
        if (pageContent) {
          pageReferences.push(pageContent);
        }
      }

      return pageReferences;
    } catch (error) {
      roamLogger.error("Error resolving page references:", error);
      return [];
    }
  }

  /**
   * Get page content by title (first level blocks only)
   */
  static async getPageByTitle(title: string): Promise<RoamPage | null> {
    try {
      roamLogger.log("Getting page by title:", title);

      // Query for page by title
      const pageQuery = `
        [:find ?uid
         :where
         [?page :node/title "${title}"]
         [?page :block/uid ?uid]]
      `;

      const pageResult = window.roamAlphaAPI.q(pageQuery);
      if (!pageResult || pageResult.length === 0) {
        roamLogger.log("Page not found:", title);
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
      roamLogger.error("Error getting page by title:", error);
      return null;
    }
  }

  /**
   * Get only first level blocks of a page (no children)
   */
  static async getPageFirstLevelBlocks(pageUid: string): Promise<RoamBlock[]> {
    try {
      const pull = window.roamAlphaAPI?.pull;
      if (typeof pull !== "function") {
        roamLogger.error("Roam pull API unavailable");
        return [];
      }

      const rawPage = pull(
        [
          ":block/uid",
          { ":block/children": RoamQuery.buildBlockPullSpec(0) },
        ],
        [":block/uid", pageUid]
      ) as BlockPullEntity | null;

      const children = rawPage?.[":block/children"];
      if (!Array.isArray(children) || children.length === 0) {
        return [];
      }

      const blocks = children
        .map((child) => RoamQuery.transformBlockEntity(child, 0))
        .filter((block) => !!block.uid);

      blocks.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Limit to first 5 blocks to prevent overwhelming context
      return blocks.slice(0, 5);
    } catch (error) {
      roamLogger.error("Error getting page first level blocks:", error);
      return [];
    }
  }

  /**
   * Extract UID from Roam drag data
   */
  static extractUidFromDragData(dataTransfer: DataTransfer): string | null {
    try {
      const uidList = dataTransfer.getData("roam/block-uid-list");
      roamLogger.log("Drag data received:", uidList);
      
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
      
      roamLogger.log("Parsed UIDs from drag data:", uids);
      
      // Return first valid UID
      for (const uid of uids) {
        if (uid && uid.length >= 6 && uid.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(uid)) {
          return uid;
        }
      }
      
      return null;
    } catch (error) {
      roamLogger.error("Error extracting UID from drag data:", error);
      return null;
    }
  }

  /**
   * Get parent block of a block
   */
  static async getBlockParent(blockUid: string): Promise<RoamBlock | null> {
    try {
      const pull = window.roamAlphaAPI?.pull;
      if (typeof pull !== "function") {
        roamLogger.error("Roam pull API unavailable");
        return null;
      }

      const rawBlock = pull(
        RoamQuery.buildBlockPullSpec(0, true),
        [":block/uid", blockUid]
      ) as BlockPullEntity | null;

      const parentEntity = RoamQuery.extractImmediateParent(rawBlock);
      if (!parentEntity) {
        return null;
      }

      return RoamQuery.transformBlockEntity(parentEntity, 1);
    } catch (error) {
      roamLogger.error("Error getting block parent:", error);
      return null;
    }
  }

  /**
   * Get sibling blocks of a block (same parent)
   */
  static async getBlockSiblings(blockUid: string): Promise<RoamBlock[]> {
    try {
      const pull = window.roamAlphaAPI?.pull;
      if (typeof pull !== "function") {
        roamLogger.error("Roam pull API unavailable");
        return [];
      }

      const rawBlock = pull(
        RoamQuery.buildBlockPullSpec(0, true),
        [":block/uid", blockUid]
      ) as BlockPullEntity | null;

      const parentEntity = RoamQuery.extractImmediateParent(rawBlock);
      if (!parentEntity) {
        return [];
      }

      const parent = RoamQuery.transformBlockEntity(parentEntity, 1);
      return parent.children?.filter((child) => child.uid !== blockUid) || [];
    } catch (error) {
      roamLogger.error("Error getting block siblings:", error);
      return [];
    }
  }

  /**
   * Get ancestor path of a block (from root to current block)
   */
  static async getBlockAncestorPath(blockUid: string): Promise<RoamBlock[]> {
    try {
      const pull = window.roamAlphaAPI?.pull;
      if (typeof pull !== "function") {
        roamLogger.error("Roam pull API unavailable");
        return [];
      }

      const rawBlock = pull(
        RoamQuery.buildBlockPullSpec(0, true),
        [":block/uid", blockUid]
      ) as BlockPullEntity | null;

      return RoamQuery.mapAncestors(rawBlock);
    } catch (error) {
      roamLogger.error("Error getting block ancestor path:", error);
      return [];
    }
  }

  /**
   * Get enhanced block context including parent, siblings, and related blocks
   */
  static async getBlockWithEnhancedContext(blockUid: string): Promise<BlockWithReferences | null> {
    try {
      const block = await this.getBlock(blockUid);
      if (!block) return null;

      // Get additional context for parent and siblings
      if (block.parent) {
        block.parent.children = await this.getBlockChildren(block.parent.uid, 1);
      }

      // Get children of siblings for better context
      for (const sibling of block.siblings || []) {
        sibling.children = await this.getBlockChildren(sibling.uid, 1);
      }

      return block;
    } catch (error) {
      roamLogger.error("Error getting block with enhanced context:", error);
      return null;
    }
  }

  /**
   * Format block content for display (preview)
   */
  static formatBlockPreview(blockString: string, maxLength: number = CONTENT_LIMITS.BLOCK_PREVIEW): string {
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
