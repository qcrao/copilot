// src/services/contextManager.ts
import { RoamService } from "./roamService";
import { RoamBlock, RoamPage } from "../types";

export interface ContextItem {
  type: 'page' | 'block' | 'reference';
  uid: string;
  title?: string;
  content: string;
  level: number; // Recursion level, 0 for user-specified content
  priority: number; // Priority, lower number = higher priority
  pageTitle?: string; // For block type, record the page it belongs to
  children?: ContextItem[];
  source: 'user_specified' | 'page_content' | 'backlink' | 'block_reference';
  createdDate?: string; // Creation date of the block/page (YYYY-MM-DD format)
  blockReference?: string; // Clickable block reference for direct navigation
}

export interface ContextBuilderOptions {
  maxDepth: number; // Maximum recursion depth
  maxItems: number; // Maximum number of items
  includeBacklinks: boolean; // Whether to include backlinks
  includeBlockRefs: boolean; // Whether to include block references
  includeParentBlocks: boolean; // Whether to include parent blocks
  includeSiblingBlocks: boolean; // Whether to include sibling blocks
  includeAncestorPath: boolean; // Whether to include ancestor path
  includeBacklinkChildren: boolean; // Whether to include children blocks in backlinks (can make content very long)
}

export class ContextManager {
  private visitedUids: Set<string> = new Set();
  private visitedPageTitles: Set<string> = new Set();
  private options: ContextBuilderOptions;

  constructor(options: Partial<ContextBuilderOptions> = {}) {
    this.options = {
      maxDepth: 3,
      maxItems: 50,
      includeBacklinks: true,
      includeBlockRefs: true,
      includeParentBlocks: true,
      includeSiblingBlocks: true,
      includeAncestorPath: true,
      includeBacklinkChildren: false,
      ...options
    };
  }

  /**
   * Build context starting from user-specified pages and blocks
   */
  async buildContext(
    userSpecifiedPages: string[] = [], 
    userSpecifiedBlocks: string[] = []
  ): Promise<ContextItem[]> {
    console.log("🔍 Building context with:", {
      pages: userSpecifiedPages,
      blocks: userSpecifiedBlocks,
      options: this.options
    });

    // Reset visited records
    this.visitedUids.clear();
    this.visitedPageTitles.clear();

    const contextItems: ContextItem[] = [];

    // Process user-specified pages
    for (const pageTitle of userSpecifiedPages) {
      const pageItems = await this.processPage(pageTitle, 0, 'user_specified');
      contextItems.push(...pageItems);
    }

    // Process user-specified blocks
    for (const blockUid of userSpecifiedBlocks) {
      const blockItems = await this.processBlock(blockUid, 0, 'user_specified');
      contextItems.push(...blockItems);
    }

    // Sort and limit quantity
    const sortedItems = this.sortByPriority(contextItems);
    const limitedItems = sortedItems.slice(0, this.options.maxItems);

    console.log("🔍 Context built:", {
      totalItems: limitedItems.length,
      levels: this.getLevelDistribution(limitedItems),
      sources: this.getSourceDistribution(limitedItems)
    });

    return limitedItems;
  }

  /**
   * Process page and recursively get related content
   */
  private async processPage(
    pageTitle: string, 
    currentLevel: number, 
    source: ContextItem['source']
  ): Promise<ContextItem[]> {
    if (currentLevel > this.options.maxDepth) {
      return [];
    }

    if (this.visitedPageTitles.has(pageTitle)) {
      console.log(`🔄 Skipping already visited page: ${pageTitle}`);
      return [];
    }

    this.visitedPageTitles.add(pageTitle);

    try {
      const page = await RoamService.getPageByTitle(pageTitle);
      if (!page) {
        console.log(`❌ Page not found: ${pageTitle}`);
        return [];
      }

      const contextItems: ContextItem[] = [];

      // Add page itself
      const pageContent = this.formatPageContent(page);
      const createdDate = await this.getPageCreationDate(page.uid);
      const pageItem: ContextItem = {
        type: 'page',
        uid: page.uid,
        title: page.title,
        content: pageContent,
        level: currentLevel,
        priority: this.calculatePriority(currentLevel, source),
        source,
        createdDate,
        blockReference: this.generateBlockReference(page.uid)
      };

      contextItems.push(pageItem);
      this.visitedUids.add(page.uid);

      // If not at max depth, get related content
      if (currentLevel < this.options.maxDepth) {
        // Get backlinks
        if (this.options.includeBacklinks) {
          const backlinks = await this.getBacklinks(pageTitle, currentLevel + 1);
          contextItems.push(...backlinks);
        }

        // Get block references in the page
        if (this.options.includeBlockRefs) {
          const blockRefs = await this.getBlockReferences(page, currentLevel + 1);
          contextItems.push(...blockRefs);
        }
      }

      return contextItems;
    } catch (error) {
      console.error(`❌ Error processing page ${pageTitle}:`, error);
      return [];
    }
  }

  /**
   * Process block and recursively get related content with enhanced context
   */
  private async processBlock(
    blockUid: string, 
    currentLevel: number, 
    source: ContextItem['source']
  ): Promise<ContextItem[]> {
    if (currentLevel > this.options.maxDepth) {
      return [];
    }

    if (this.visitedUids.has(blockUid)) {
      console.log(`🔄 Skipping already visited block: ${blockUid}`);
      return [];
    }

    this.visitedUids.add(blockUid);

    try {
      const block = await RoamService.getBlockByUid(blockUid);
      if (!block) {
        console.log(`❌ Block not found: ${blockUid}`);
        return [];
      }

      const contextItems: ContextItem[] = [];

      // Get page title of the block
      const pageTitle = await this.getBlockPageTitle(blockUid);
      const createdDate = await this.getBlockCreationDate(blockUid);

      // Add block itself
      const blockItem: ContextItem = {
        type: 'block',
        uid: block.uid,
        content: block.string,
        level: currentLevel,
        priority: this.calculatePriority(currentLevel, source),
        pageTitle,
        source,
        createdDate,
        blockReference: this.generateBlockReference(block.uid)
      };

      contextItems.push(blockItem);

      // If not at max depth, get related content
      if (currentLevel < this.options.maxDepth) {
        // Get enhanced block context (parent, sibling, ancestor)
        const enhancedContextItems = await this.getEnhancedBlockContext(blockUid, currentLevel);
        contextItems.push(...enhancedContextItems);

        // Get page references mentioned in the block
        const pageRefs = this.extractPageReferences(block.string);
        for (const refPageTitle of pageRefs) {
          if (!this.visitedPageTitles.has(refPageTitle)) {
            const refItems = await this.processPage(refPageTitle, currentLevel + 1, 'block_reference');
            contextItems.push(...refItems);
          }
        }

        // Get child blocks
        if (block.children && block.children.length > 0) {
          for (const child of block.children) {
            const childItems = await this.processBlock(child.uid, currentLevel + 1, 'block_reference');
            contextItems.push(...childItems);
          }
        }
      }

      return contextItems;
    } catch (error) {
      console.error(`❌ Error processing block ${blockUid}:`, error);
      return [];
    }
  }

  /**
   * Get enhanced block context (parent, sibling, ancestor)
   */
  private async getEnhancedBlockContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // Get parent blocks
      if (this.options.includeParentBlocks) {
        const parentItems = await this.getParentBlockContext(blockUid, currentLevel + 1);
        contextItems.push(...parentItems);
      }

      // Get sibling blocks
      if (this.options.includeSiblingBlocks) {
        const siblingItems = await this.getSiblingBlockContext(blockUid, currentLevel + 1);
        contextItems.push(...siblingItems);
      }

      // Get ancestor path
      if (this.options.includeAncestorPath) {
        const ancestorItems = await this.getAncestorPathContext(blockUid, currentLevel + 1);
        contextItems.push(...ancestorItems);
      }

      return contextItems;
    } catch (error) {
      console.error(`❌ Error getting enhanced block context for ${blockUid}:`, error);
      return [];
    }
  }

  /**
   * Get parent block context
   */
  private async getParentBlockContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // Use RoamQuery to get parent block
      const parentQuery = `
        [:find ?parentUid ?parentString
         :where
         [?block :block/uid "${blockUid}"]
         [?parent :block/children ?block]
         [?parent :block/uid ?parentUid]
         [?parent :block/string ?parentString]]
      `;

      const result = window.roamAlphaAPI.q(parentQuery);
      if (result && result.length > 0) {
        const [parentUid, parentString] = result[0];
        
        if (!this.visitedUids.has(parentUid)) {
          const pageTitle = await this.getBlockPageTitle(parentUid);
          const createdDate = await this.getBlockCreationDate(parentUid);
          
          const parentItem: ContextItem = {
            type: 'block',
            uid: parentUid,
            content: parentString,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, 'block_reference'),
            pageTitle,
            source: 'block_reference',
            createdDate,
            blockReference: this.generateBlockReference(parentUid)
          };

          contextItems.push(parentItem);
          this.visitedUids.add(parentUid);
        }
      }
    } catch (error) {
      console.error(`❌ Error getting parent block context for ${blockUid}:`, error);
    }

    return contextItems;
  }

  /**
   * Get sibling block context
   */
  private async getSiblingBlockContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // Use RoamQuery to get sibling blocks
      const siblingsQuery = `
        [:find ?siblingUid ?siblingString ?siblingOrder
         :where
         [?block :block/uid "${blockUid}"]
         [?parent :block/children ?block]
         [?parent :block/children ?sibling]
         [?sibling :block/uid ?siblingUid]
         [?sibling :block/string ?siblingString]
         [?sibling :block/order ?siblingOrder]
         [(not= ?siblingUid "${blockUid}")]]
      `;

      const result = window.roamAlphaAPI.q(siblingsQuery);
      if (result && result.length > 0) {
        // Only take first 3 sibling blocks to avoid too much content
        const limitedResult = result.slice(0, 3);
        
        for (const [siblingUid, siblingString, siblingOrder] of limitedResult) {
          if (!this.visitedUids.has(siblingUid)) {
            const pageTitle = await this.getBlockPageTitle(siblingUid);
            const createdDate = await this.getBlockCreationDate(siblingUid);
            
            const siblingItem: ContextItem = {
              type: 'block',
              uid: siblingUid,
              content: siblingString,
              level: currentLevel,
              priority: this.calculatePriority(currentLevel, 'block_reference'),
              pageTitle,
              source: 'block_reference',
              createdDate,
              blockReference: this.generateBlockReference(siblingUid)
            };

            contextItems.push(siblingItem);
            this.visitedUids.add(siblingUid);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error getting sibling block context for ${blockUid}:`, error);
    }

    return contextItems;
  }

  /**
   * Get ancestor path context
   */
  private async getAncestorPathContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // Recursively get ancestor path, but limit depth to avoid too much content
      const ancestors = await this.getAncestorPath(blockUid, 3); // Max 3 levels of ancestors
      
      for (const ancestor of ancestors) {
        if (!this.visitedUids.has(ancestor.uid)) {
          const pageTitle = await this.getBlockPageTitle(ancestor.uid);
          const createdDate = await this.getBlockCreationDate(ancestor.uid);
          
          const ancestorItem: ContextItem = {
            type: 'block',
            uid: ancestor.uid,
            content: ancestor.string,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, 'block_reference'),
            pageTitle,
            source: 'block_reference',
            createdDate,
            blockReference: this.generateBlockReference(ancestor.uid)
          };

          contextItems.push(ancestorItem);
          this.visitedUids.add(ancestor.uid);
        }
      }
    } catch (error) {
      console.error(`❌ Error getting ancestor path context for ${blockUid}:`, error);
    }

    return contextItems;
  }

  /**
   * Recursively get ancestor path
   */
  private async getAncestorPath(blockUid: string, maxDepth: number): Promise<RoamBlock[]> {
    const ancestors: RoamBlock[] = [];
    
    if (maxDepth <= 0) return ancestors;
    
    try {
      const parentQuery = `
        [:find ?parentUid ?parentString
         :where
         [?block :block/uid "${blockUid}"]
         [?parent :block/children ?block]
         [?parent :block/uid ?parentUid]
         [?parent :block/string ?parentString]]
      `;

      const result = window.roamAlphaAPI.q(parentQuery);
      if (result && result.length > 0) {
        const [parentUid, parentString] = result[0];
        
        const parent: RoamBlock = {
          uid: parentUid,
          string: parentString
        };
        
        ancestors.push(parent);
        
        // Recursively get higher level ancestors
        const higherAncestors = await this.getAncestorPath(parentUid, maxDepth - 1);
        ancestors.push(...higherAncestors);
      }
    } catch (error) {
      console.error(`❌ Error getting ancestor path for ${blockUid}:`, error);
    }

    return ancestors;
  }

  /**
   * Get backlinks for a page
   */
  private async getBacklinks(pageTitle: string, currentLevel: number): Promise<ContextItem[]> {
    try {
      const backlinks = await RoamService.getBlocksReferencingPage(pageTitle);
      const contextItems: ContextItem[] = [];

      for (const backlink of backlinks) {
        // Check for circular references
        if (this.containsCircularReference(backlink.string, pageTitle)) {
          console.log(`🔄 Skipping circular reference in backlink: ${backlink.string}`);
          continue;
        }

        if (!this.visitedUids.has(backlink.uid)) {
          const backlinkPageTitle = await this.getBlockPageTitle(backlink.uid);
          const createdDate = await this.getBlockCreationDate(backlink.uid);
          
          // Format backlink content - include children if option is enabled
          let backlinkContent = backlink.string;
          if (this.options.includeBacklinkChildren && backlink.children && backlink.children.length > 0) {
            backlinkContent += '\n' + RoamService.formatBlocksForAI(backlink.children, 1);
          }
          
          const backlinkItem: ContextItem = {
            type: 'reference',
            uid: backlink.uid,
            content: backlinkContent,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, 'backlink'),
            pageTitle: backlinkPageTitle,
            source: 'backlink',
            createdDate,
            blockReference: this.generateBlockReference(backlink.uid)
          };

          contextItems.push(backlinkItem);
          this.visitedUids.add(backlink.uid);
        }
      }

      return contextItems;
    } catch (error) {
      console.error(`❌ Error getting backlinks for ${pageTitle}:`, error);
      return [];
    }
  }

  /**
   * Get block references in a page
   */
  private async getBlockReferences(page: RoamPage, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    // Traverse all blocks in the page, looking for block references
    const allBlocks = this.getAllBlocksFromPage(page);
    
    for (const block of allBlocks) {
      const blockRefs = this.extractBlockReferences(block.string);
      
      for (const refBlockUid of blockRefs) {
        if (!this.visitedUids.has(refBlockUid)) {
          const refItems = await this.processBlock(refBlockUid, currentLevel, 'block_reference');
          contextItems.push(...refItems);
        }
      }
    }

    return contextItems;
  }

  /**
   * Check for circular references
   * Improved: only consider it circular if content only contains references to target page
   */
  private containsCircularReference(content: string, pageTitle: string): boolean {
    // Check if content contains reference to same page
    const pageRefPattern = new RegExp(`\\[\\[${pageTitle}\\]\\]`, 'gi');
    const hasPageRef = pageRefPattern.test(content);
    
    if (!hasPageRef) {
      return false;
    }
    
    // Calculate content length after removing references
    const contentWithoutRefs = content.replace(/\[\[[^\]]+\]\]/g, '').trim();
    
    // If content is very short after removing references (less than 10 characters), consider it circular
    const isCircular = contentWithoutRefs.length < 10;
    
    if (isCircular) {
      console.log(`🔄 Detected circular reference: content mostly contains [[${pageTitle}]]: "${content}"`);
    } else {
      console.log(`✅ Valid backlink with meaningful content: "${content}"`);
    }
    
    return isCircular;
  }

  /**
   * Extract page references from text
   */
  private extractPageReferences(text: string): string[] {
    const pageRefPattern = /\[\[([^\]]+)\]\]/g;
    const matches = [];
    let match;
    
    while ((match = pageRefPattern.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Extract block references from text
   */
  private extractBlockReferences(text: string): string[] {
    const blockRefPattern = /\(\(([^)]+)\)\)/g;
    const matches = [];
    let match;
    
    while ((match = blockRefPattern.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Get all blocks from a page recursively
   */
  private getAllBlocksFromPage(page: RoamPage): RoamBlock[] {
    const allBlocks: RoamBlock[] = [];
    
    const addBlocksRecursively = (blocks: RoamBlock[]) => {
      for (const block of blocks) {
        allBlocks.push(block);
        if (block.children && block.children.length > 0) {
          addBlocksRecursively(block.children);
        }
      }
    };
    
    addBlocksRecursively(page.blocks);
    return allBlocks;
  }

  /**
   * Get page title for a block
   */
  private async getBlockPageTitle(blockUid: string): Promise<string | undefined> {
    try {
      // Query for the page containing the block
      const pageQuery = `
        [:find ?title
         :where
         [?page :node/title ?title]
         [?page :block/children ?child]
         [?child :block/uid "${blockUid}"]]
      `;

      const result = window.roamAlphaAPI.q(pageQuery);
      
      if (result && result.length > 0) {
        return result[0][0] as string;
      }

      // If direct query fails, try through parent hierarchy
      const hierarchyQuery = `
        [:find ?title
         :where
         [?block :block/uid "${blockUid}"]
         [?parent :block/children ?block]
         [?page :block/children ?parent]
         [?page :node/title ?title]]
      `;

      const hierarchyResult = window.roamAlphaAPI.q(hierarchyQuery);
      
      if (hierarchyResult && hierarchyResult.length > 0) {
        return hierarchyResult[0][0] as string;
      }

      return undefined;
    } catch (error) {
      console.error(`❌ Error getting page title for block ${blockUid}:`, error);
      return undefined;
    }
  }

  /**
   * Format page content
   */
  private formatPageContent(page: RoamPage): string {
    if (!page.blocks || page.blocks.length === 0) {
      return `Page "${page.title}" has no content`;
    }

    return RoamService.formatBlocksForAI(page.blocks, 0);
  }

  /**
   * Calculate priority
   */
  private calculatePriority(level: number, source: ContextItem['source']): number {
    const baseScore = {
      'user_specified': 0,
      'page_content': 10,
      'backlink': 20,
      'block_reference': 30
    };

    return baseScore[source] + (level * 10);
  }

  /**
   * Sort by priority
   */
  private sortByPriority(items: ContextItem[]): ContextItem[] {
    return items.sort((a, b) => {
      // Lower priority number = higher priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Same priority, sort by level
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      
      // Same level, sort by content length (longer content first)
      return (b.content?.length || 0) - (a.content?.length || 0);
    });
  }

  /**
   * Get level distribution statistics
   */
  private getLevelDistribution(items: ContextItem[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    
    for (const item of items) {
      distribution[item.level] = (distribution[item.level] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Get source distribution statistics
   */
  private getSourceDistribution(items: ContextItem[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const item of items) {
      distribution[item.source] = (distribution[item.source] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Format context for AI readable string
   */
  formatContextForAI(items: ContextItem[]): string {
    if (items.length === 0) {
      return "No relevant context content found.";
    }

    const sections: string[] = [];
    const itemsByLevel = this.groupByLevel(items);

    // Organize content by level
    for (const level of Object.keys(itemsByLevel).sort((a, b) => Number(a) - Number(b))) {
      const levelItems = itemsByLevel[Number(level)];
      const levelTitle = this.getLevelTitle(Number(level));
      
      sections.push(`\n=== ${levelTitle} ===`);
      
      for (const item of levelItems) {
        let itemContent = '';
        const dateInfo = item.createdDate ? ` [Created: ${item.createdDate}]` : '';
        const blockRef = item.blockReference || '';
        
        switch (item.type) {
          case 'page':
            itemContent = `**Page: ${item.title}**${dateInfo} ${blockRef}\n${item.content}`;
            break;
          case 'block':
            const pageInfo = item.pageTitle ? ` (from page: ${item.pageTitle})` : '';
            itemContent = `**Block Reference**${pageInfo}${dateInfo} ${blockRef}\n${item.content}`;
            break;
          case 'reference':
            const refPageInfo = item.pageTitle ? ` (from page: ${item.pageTitle})` : '';
            itemContent = `**Backlink**${refPageInfo}${dateInfo} ${blockRef}\n${item.content}`;
            break;
        }
        
        sections.push(itemContent);
      }
    }

    const formattedContext = sections.join('\n\n');
    
    // Add detailed debugging logs
    console.log("📋 Context formatting detailed breakdown:", {
      totalItems: items.length,
      itemsByType: {
        page: items.filter(i => i.type === 'page').length,
        block: items.filter(i => i.type === 'block').length,
        reference: items.filter(i => i.type === 'reference').length
      },
      itemsBySource: {
        user_specified: items.filter(i => i.source === 'user_specified').length,
        page_content: items.filter(i => i.source === 'page_content').length,
        backlink: items.filter(i => i.source === 'backlink').length,
        block_reference: items.filter(i => i.source === 'block_reference').length
      },
      totalSections: sections.length,
      formattedContextLength: formattedContext.length,
      averageContentLength: Math.round(items.reduce((sum, item) => sum + (item.content?.length || 0), 0) / items.length),
      contextPreview: formattedContext.substring(0, 500) + "..."
    });

    return formattedContext;
  }

  /**
   * Group by level
   */
  private groupByLevel(items: ContextItem[]): Record<number, ContextItem[]> {
    const grouped: Record<number, ContextItem[]> = {};
    
    for (const item of items) {
      if (!grouped[item.level]) {
        grouped[item.level] = [];
      }
      grouped[item.level].push(item);
    }
    
    return grouped;
  }

  /**
   * Get level title
   */
  private getLevelTitle(level: number): string {
    switch (level) {
      case 0:
        return "Page Content";
      case 1:
        return "Directly Related Content";
      case 2:
        return "Extended Related Content";
      case 3:
        return "Background Information";
      default:
        return `Level ${level} Related Content`;
    }
  }

  /**
   * Get block creation date
   */
  private async getBlockCreationDate(blockUid: string): Promise<string | undefined> {
    try {
      const query = `
        [:find ?time
         :where
         [?b :block/uid "${blockUid}"]
         [?b :create/time ?time]]
      `;

      const result = window.roamAlphaAPI.q(query);
      if (result && result.length > 0) {
        const timestamp = result[0][0];
        // Convert Roam timestamp to date string (YYYY-MM-DD)
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
      }
      return undefined;
    } catch (error) {
      console.error(`❌ Error getting creation date for block ${blockUid}:`, error);
      return undefined;
    }
  }

  /**
   * Get page creation date
   */
  private async getPageCreationDate(pageUid: string): Promise<string | undefined> {
    try {
      const query = `
        [:find ?time
         :where
         [?p :block/uid "${pageUid}"]
         [?p :create/time ?time]]
      `;

      const result = window.roamAlphaAPI.q(query);
      if (result && result.length > 0) {
        const timestamp = result[0][0];
        // Convert Roam timestamp to date string (YYYY-MM-DD)
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
      }
      return undefined;
    } catch (error) {
      console.error(`❌ Error getting creation date for page ${pageUid}:`, error);
      return undefined;
    }
  }

  /**
   * Generate clickable block reference
   */
  private generateBlockReference(blockUid: string): string {
    const graphName = RoamService.getCurrentGraphName();
    const isDesktop = RoamService.isDesktopApp();
    
    if (graphName) {
      const blockUrls = RoamService.generateBlockUrl(blockUid, graphName);
      if (blockUrls) {
        if (isDesktop) {
          return `[((${blockUid}))](${blockUrls.desktopUrl})`;
        } else {
          return `[((${blockUid}))](${blockUrls.webUrl})`;
        }
      }
    }
    
    // Fallback to simple block reference
    return `((${blockUid}))`;
  }
}