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
  autoIncludeMinimalBacklinkChildren: boolean; // Whether to automatically include children for backlinks that only contain page references
  expandBacklinkChildrenWhenFew?: boolean; // Expand children when backlink count is small
  fewBacklinksThreshold?: number; // Threshold to consider backlink count as "few"
  // Performance guards
  maxBacklinks?: number; // Cap backlinks processed per page (default derived from maxItems)
  maxBacklinksWithChildren?: number; // Cap backlinks for which children are expanded
  tokenBudgetForBacklinks?: number; // Estimated token budget reserved for backlinks selection/expansion
  yieldEveryNBacklinks?: number; // Yield to event loop every N backlinks to keep UI responsive
}

export class ContextManager {
  private visitedUids: Set<string> = new Set();
  private visitedPageTitles: Set<string> = new Set();
  private options: ContextBuilderOptions;
  private processStartTime: number = 0;
  private readonly MAX_PROCESSING_TIME = 30000; // 30 seconds max processing time

  /**
   * Create a lightweight context manager for performance-critical scenarios
   */
  static createLightweight(): ContextManager {
    return new ContextManager({
      maxDepth: 1, // Minimal recursion
      maxItems: 20, // Fewer items
      includeBacklinks: false, // Skip expensive operations
      includeBlockRefs: false,
      includeParentBlocks: false,
      includeSiblingBlocks: false,
      includeAncestorPath: false,
      includeBacklinkChildren: false,
      autoIncludeMinimalBacklinkChildren: false
    });
  }

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
      autoIncludeMinimalBacklinkChildren: true,
      expandBacklinkChildrenWhenFew: true,
      fewBacklinksThreshold: 8,
      maxBacklinks: undefined,
      maxBacklinksWithChildren: undefined,
      tokenBudgetForBacklinks: undefined,
      yieldEveryNBacklinks: 20,
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
    // Mark processing start for time-budget checks
    this.processStartTime = Date.now();
    // Only log context building if debug mode is enabled
    if (process.env.NODE_ENV === 'development') {
      console.log("🔍 Building context with:", {
        pages: userSpecifiedPages.length,
        blocks: userSpecifiedBlocks.length,
        maxDepth: this.options.maxDepth,
        maxItems: this.options.maxItems
      });
    }

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

    // Performance monitoring and warnings
    const processingTime = Date.now() - this.processStartTime;
    if (processingTime > 10000) { // 10 seconds
      console.warn(`⚠️ Context building took ${processingTime}ms - consider reducing maxDepth (${this.options.maxDepth}) or maxItems (${this.options.maxItems})`);
    }
    
    if (limitedItems.length >= this.options.maxItems * 0.9) {
      console.warn(`⚠️ Context approaching maximum items (${limitedItems.length}/${this.options.maxItems}) - some content may be missing`);
    }
    
    // Only log detailed context stats in development
    if (process.env.NODE_ENV === 'development') {
      console.log("🔍 Context built:", {
        totalItems: limitedItems.length,
        levels: this.getLevelDistribution(limitedItems),
        processingTime: `${processingTime}ms`
      });
    }

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
      // Skip already visited page silently
      return [];
    }

    this.visitedPageTitles.add(pageTitle);

    try {
      const page = await RoamService.getPageByTitle(pageTitle);
      if (!page) {
        // Page not found - continue silently
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
      // Skip already visited block silently
      return [];
    }

    try {
      const contextItems: ContextItem[] = [];

      if (source === 'user_specified') {
        // For user-specified blocks, use the enhanced recursive resolver
        // Using enhanced recursive resolver for user-specified block
        
        const resolved = await this.resolveContentRecursively(blockUid, 'block', currentLevel);
        if (resolved) {
          this.visitedUids.add(resolved.metadata.uid);
          
          const blockItem: ContextItem = {
            type: 'block',
            uid: resolved.metadata.uid,
            content: resolved.content,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, source),
            pageTitle: resolved.metadata.pageTitle,
            source,
            createdDate: resolved.metadata.createdDate,
            blockReference: resolved.metadata.blockReference
          };

          contextItems.push(blockItem);
          
          // Block resolved successfully
        }
      } else {
        // For non-user-specified blocks, use the simpler approach
        const block = await RoamService.getBlockByUid(blockUid);
        if (!block) {
          // Block not found - continue silently
          return [];
        }

        this.visitedUids.add(blockUid);

        const pageTitle = await this.getBlockPageTitle(blockUid);
        const createdDate = await this.getBlockCreationDate(blockUid);

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

          // Process children if they exist
          if (block.children && block.children.length > 0) {
            for (const child of block.children) {
              const childItems = await this.processBlock(child.uid, currentLevel + 1, 'block_reference');
              contextItems.push(...childItems);
            }
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
        
        for (const [siblingUid, siblingString] of limitedResult) {
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
    
    if (maxDepth <= 0 || maxDepth > 10) return ancestors; // Hard limit to prevent deep recursion
    
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

      // Determine caps
      const maxBacklinks =
        typeof this.options.maxBacklinks === 'number'
          ? this.options.maxBacklinks
          : Math.min(100, Math.max(20, this.options.maxItems * 2));
      const maxWithChildren =
        typeof this.options.maxBacklinksWithChildren === 'number'
          ? this.options.maxBacklinksWithChildren
          : 15;

      // Cheap pre-scoring: prefer backlinks with substantive non-reference text
      const scored = backlinks.map((b) => {
        const withoutRefs = b.string.replace(/\[\[[^\]]+\]\]/g, '').trim();
        return { block: b, score: withoutRefs.length, withoutRefs };
      });

      const strong = scored
        .filter((s) => s.score >= 10)
        .sort((a, b) => b.score - a.score);
      const weak = scored.filter((s) => s.score < 10);

      const selected: typeof scored = [];
      for (const s of strong) {
        if (selected.length >= maxBacklinks) break;
        selected.push(s);
      }
      for (const s of weak) {
        if (selected.length >= maxBacklinks) break;
        selected.push(s);
      }

      // If backlinks are few, we can be more generous about expanding children
      const allowExpansionDueToFew =
        (this.options.expandBacklinkChildrenWhenFew ?? true) &&
        selected.length <= (this.options.fewBacklinksThreshold ?? 8);

      let expandedChildrenCount = 0;
      const yieldEvery = this.options.yieldEveryNBacklinks ?? 20;
      let processed = 0;

      // Token-driven budget for backlinks as a whole
      // Default to ~25% of a 6k window ~= 1500 tokens when not provided
      const maxBacklinkTokens = this.options.tokenBudgetForBacklinks ?? 1500;
      let usedBacklinkTokens = 0;

      for (const { block, score, withoutRefs } of selected) {
        // Time-budget guard
        if (Date.now() - this.processStartTime > this.MAX_PROCESSING_TIME) {
          break;
        }

        if (this.visitedUids.has(block.uid)) continue;

        // Quick circular/self-reference filter for very short mentions
        const selfRefPattern = new RegExp(`\\\\[\\\\[${pageTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\\]\\\\]`, 'i');
        const hasSelfRef = selfRefPattern.test(block.string);
        if (hasSelfRef && score < 10 && !this.options.includeBacklinkChildren) {
          // Skip trivial mention-only backlinks unless we plan to expand children
          continue;
        }

        let content = block.string;
        const baseTokens = RoamService.estimateTokenCount(content);

        // Decide if we should expand children for this backlink
        const budgetHeadroomFactor = allowExpansionDueToFew ? 0.9 : 0.7;
        const shouldExpandChildren =
          (
            this.options.includeBacklinkChildren ||
            (this.options.autoIncludeMinimalBacklinkChildren && withoutRefs.length < 10) ||
            allowExpansionDueToFew
          ) &&
          expandedChildrenCount < maxWithChildren &&
          // Only consider expansion when we still have comfortable token headroom
          usedBacklinkTokens + baseTokens < Math.floor(maxBacklinkTokens * budgetHeadroomFactor);

        if (shouldExpandChildren) {
          const complete = await this.getBlockWithCompleteHierarchy(block.uid);
          if (complete) {
            // Re-check circular with complete data, skip if still trivial
            if (await this.containsCircularReference(complete, pageTitle)) {
              continue;
            }
            content = complete.string;
            if (complete.children && complete.children.length > 0) {
              content += '\n' + RoamService.formatBlocksForAI(complete.children, 1);
            }
            // Only count as expanded if we will include it after budget check below
            const expandedTokens = RoamService.estimateTokenCount(content);
            if (usedBacklinkTokens + expandedTokens <= maxBacklinkTokens) {
              expandedChildrenCount++;
            } else {
              // Expansion too big for remaining budget; revert to base content
              content = block.string;
            }
          }
        }

        const backlinkPageTitle = await this.getBlockPageTitle(block.uid);
        const createdDate = await this.getBlockCreationDate(block.uid);

        // Budget check and potential fallback/truncation
        let plannedTokens = RoamService.estimateTokenCount(content);
        if (usedBacklinkTokens + plannedTokens > maxBacklinkTokens) {
          // Try fallback to base if we ended up with expanded content
          if (content !== block.string) {
            const baseOnlyTokens = baseTokens;
            if (usedBacklinkTokens + baseOnlyTokens <= maxBacklinkTokens) {
              content = block.string;
              plannedTokens = baseOnlyTokens;
            }
          }

          // If still over budget, consider truncating base content when nothing has been added yet
          if (usedBacklinkTokens + plannedTokens > maxBacklinkTokens) {
            const remaining = maxBacklinkTokens - usedBacklinkTokens;
            if (remaining > 8) { // require minimum space to be meaningful
              const maxChars = remaining * 4; // inverse of estimateTokenCount heuristic
              const truncated = (content.length > maxChars)
                ? content.slice(0, maxChars) + '…'
                : content;
              content = truncated;
              plannedTokens = RoamService.estimateTokenCount(truncated);
              if (usedBacklinkTokens + plannedTokens > maxBacklinkTokens) {
                // Still doesn't fit; skip this backlink
                processed++;
                if (processed % yieldEvery === 0) {
                  await new Promise((r) => setTimeout(r, 0));
                }
                continue;
              }
            } else {
              // Too little budget left; stop processing more backlinks
              break;
            }
          }
        }

        const item: ContextItem = {
          type: 'reference',
          uid: block.uid,
          content: content,
          level: currentLevel,
          priority: this.calculatePriority(currentLevel, 'backlink'),
          pageTitle: backlinkPageTitle,
          source: 'backlink',
          createdDate,
          blockReference: this.generateBlockReference(block.uid)
        };

        contextItems.push(item);
        this.visitedUids.add(block.uid);
        usedBacklinkTokens += plannedTokens;

        // Cooperative yield to keep UI responsive
        processed++;
        if (processed % yieldEvery === 0) {
          await new Promise((r) => setTimeout(r, 0));
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
   * Improved: consider child blocks - if a block has meaningful children, it's not circular even if main content is just page reference
   */
  private async containsCircularReference(backlink: RoamBlock, pageTitle: string): Promise<boolean> {
    // Check if content contains reference to same page
    const pageRefPattern = new RegExp(`\\[\\[${pageTitle}\\]\\]`, 'gi');
    const hasPageRef = pageRefPattern.test(backlink.string);
    
    if (!hasPageRef) {
      return false;
    }
    
    // Calculate content length after removing references
    const contentWithoutRefs = backlink.string.replace(/\[\[[^\]]+\]\]/g, '').trim();
    
    // If content is very short after removing references (less than 10 characters)
    const isMainContentShort = contentWithoutRefs.length < 10;
    
    if (!isMainContentShort) {
      // Main content has substance, not circular
      return false;
    }
    
    // Main content is short, but check if there are meaningful child blocks
    if (backlink.children && backlink.children.length > 0) {
      // Check if children have meaningful content
      const childContent = backlink.children
        .map(child => child.string)
        .join(' ')
        .trim();
      
      if (childContent.length > 20) { // If children have substantial content
        return false;
      }
    }
    
    // Both main content and children are minimal - this is likely circular
    return true;
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
  // Removed unused getSourceDistribution

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
    
    // Only log detailed context stats in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log("📋 Context formatting stats:", {
        totalItems: items.length,
        totalSections: sections.length,
        formattedContextLength: formattedContext.length
      });
    }

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

  /**
   * Enhanced content resolver that recursively expands blocks and page references
   * This is the core method for getting complete, interconnected content
   */
  private async resolveContentRecursively(
    contentId: string,
    contentType: 'page' | 'block',
    currentDepth: number = 0,
    visitedInThisPath: Set<string> = new Set()
  ): Promise<{
    content: string;
    metadata: {
      uid: string;
      type: 'page' | 'block';
      title?: string;
      pageTitle?: string;
      createdDate?: string;
      blockReference?: string;
      expandedReferences: string[];
    };
  } | null> {
    
    // Prevent infinite recursion with multiple safety checks
    if (currentDepth > this.options.maxDepth || 
        visitedInThisPath.has(contentId) ||
        visitedInThisPath.size > 20 || // Limit path size to prevent circular chains
        Date.now() - this.processStartTime > this.MAX_PROCESSING_TIME) {
      return null;
    }

    // Mark as visited in this resolution path
    const pathVisited = new Set(visitedInThisPath);
    pathVisited.add(contentId);

    try {
      if (contentType === 'page') {
        return await this.resolvePageContent(contentId, currentDepth, pathVisited);
      } else {
        return await this.resolveBlockContent(contentId, currentDepth, pathVisited);
      }
    } catch (error) {
      console.error(`❌ Error resolving ${contentType} content for ${contentId}:`, error);
      return null;
    }
  }

  /**
   * Resolve page content with all its blocks and their references
   */
  private async resolvePageContent(
    pageTitle: string,
    currentDepth: number,
    pathVisited: Set<string>
  ): Promise<{
    content: string;
    metadata: {
      uid: string;
      type: 'page';
      title: string;
      createdDate?: string;
      blockReference?: string;
      expandedReferences: string[];
    };
  } | null> {

    const page = await RoamService.getPageByTitle(pageTitle);
    if (!page) return null;

    const expandedReferences: string[] = [];
    let expandedContent = this.formatPageContent(page);

    // Recursively resolve references in page blocks
    if (page.blocks && page.blocks.length > 0) {
      const resolvedBlocks = await this.resolveBlocksRecursively(
        page.blocks, 
        currentDepth + 1, 
        pathVisited,
        expandedReferences
      );
      
      if (resolvedBlocks.length > 0) {
        expandedContent = `${page.title}\n${resolvedBlocks.join('\n')}`;
      }
    }

    const createdDate = await this.getPageCreationDate(page.uid);

    return {
      content: expandedContent,
      metadata: {
        uid: page.uid,
        type: 'page',
        title: page.title,
        createdDate,
        blockReference: this.generateBlockReference(page.uid),
        expandedReferences
      }
    };
  }

  /**
   * Resolve block content with its complete hierarchy and references
   */
  private async resolveBlockContent(
    blockUid: string,
    currentDepth: number,
    pathVisited: Set<string>
  ): Promise<{
    content: string;
    metadata: {
      uid: string;
      type: 'block';
      pageTitle?: string;
      createdDate?: string;
      blockReference?: string;
      expandedReferences: string[];
    };
  } | null> {

    // First, find the top-level parent if this is a user-specified block
    const topLevelUid = await this.findTopLevelParent(blockUid);
    const actualBlockUid = topLevelUid || blockUid;

    // Get the complete block with all children
    const completeBlock = await this.getBlockWithCompleteHierarchy(actualBlockUid);
    if (!completeBlock) return null;

    const expandedReferences: string[] = [];
    
    // Start with the main block content
    let expandedContent = completeBlock.string;

    // Recursively resolve child blocks
    if (completeBlock.children && completeBlock.children.length > 0) {
      const resolvedChildren = await this.resolveBlocksRecursively(
        completeBlock.children,
        currentDepth + 1,
        pathVisited,
        expandedReferences
      );
      
      if (resolvedChildren.length > 0) {
        expandedContent += '\n' + resolvedChildren.map(child => `  ${child}`).join('\n');
      }
    }

    // Find and resolve page references in the content
    const pageRefs = this.extractPageReferences(expandedContent);
    for (const pageRef of pageRefs) {
      if (!pathVisited.has(pageRef) && currentDepth < this.options.maxDepth) {
        const resolvedPage = await this.resolveContentRecursively(
          pageRef,
          'page',
          currentDepth + 1,
          pathVisited
        );
        
        if (resolvedPage) {
          expandedReferences.push(pageRef);
          expandedContent += `\n\n**Referenced Page: ${pageRef}**\n${resolvedPage.content}`;
        }
      }
    }

    const pageTitle = await this.getBlockPageTitle(actualBlockUid);
    const createdDate = await this.getBlockCreationDate(actualBlockUid);

    return {
      content: expandedContent,
      metadata: {
        uid: actualBlockUid,
        type: 'block',
        pageTitle,
        createdDate,
        blockReference: this.generateBlockReference(actualBlockUid),
        expandedReferences
      }
    };
  }

  /**
   * Recursively resolve a list of blocks with their references
   */
  private async resolveBlocksRecursively(
    blocks: RoamBlock[],
    currentDepth: number,
    pathVisited: Set<string>,
    expandedReferences: string[]
  ): Promise<string[]> {
    const resolvedBlocks: string[] = [];

    for (const block of blocks) {
      if (pathVisited.has(block.uid)) continue;

      let blockContent = block.string;

      // Resolve child blocks recursively
      if (block.children && block.children.length > 0) {
        const resolvedChildren = await this.resolveBlocksRecursively(
          block.children,
          currentDepth + 1,
          pathVisited,
          expandedReferences
        );
        
        if (resolvedChildren.length > 0) {
          blockContent += '\n' + resolvedChildren.map(child => `  ${child}`).join('\n');
        }
      }

      // Find and resolve page references
      const pageRefs = this.extractPageReferences(blockContent);
      for (const pageRef of pageRefs) {
        if (!pathVisited.has(pageRef) && !expandedReferences.includes(pageRef) && currentDepth < this.options.maxDepth) {
          const resolvedPage = await this.resolveContentRecursively(
            pageRef,
            'page',
            currentDepth + 1,
            pathVisited
          );
          
          if (resolvedPage) {
            expandedReferences.push(pageRef);
            blockContent += `\n**→ ${pageRef}:** ${resolvedPage.content}`;
          }
        }
      }

      resolvedBlocks.push(blockContent);
    }

    return resolvedBlocks;
  }

  /**
   * Find the top-level parent of a block (simplified and more robust)
   */
  private async findTopLevelParent(blockUid: string): Promise<string | null> {
    let currentUid = blockUid;
    let maxLevels = 10; // Prevent infinite loops
    
    while (maxLevels-- > 0) {
      const parentQuery = `
        [:find ?parentUid
         :where
         [?block :block/uid "${currentUid}"]
         [?parent :block/children ?block]
         [?parent :block/uid ?parentUid]]
      `;

      const result = window.roamAlphaAPI.q(parentQuery);
      if (!result || result.length === 0) {
        // No parent found, current is top level
        return currentUid === blockUid ? null : currentUid;
      }

      currentUid = result[0][0];
    }

    // Max parent traversal reached - return current UID to prevent infinite recursion
    return currentUid;
  }

  /**
   * Get block with complete hierarchy (optimized and cleaner)
   */
  private async getBlockWithCompleteHierarchy(blockUid: string): Promise<RoamBlock | null> {
    try {
      const baseBlock = await RoamService.getBlockByUid(blockUid);
      if (!baseBlock) return null;

      return await this.enrichWithAllChildren(baseBlock);
    } catch (error) {
      console.error(`❌ Error getting complete hierarchy for ${blockUid}:`, error);
      return null;
    }
  }

  /**
   * Efficiently enrich block with all children using a single query
   */
  private async enrichWithAllChildren(block: RoamBlock): Promise<RoamBlock> {
    try {
      // Get all descendants in one query for efficiency
      const descendantsQuery = `
        [:find ?uid ?string ?parentUid ?order
         :where
         [?ancestor :block/uid "${block.uid}"]
         [?ancestor :block/children+ ?descendant]
         [?descendant :block/uid ?uid]
         [?descendant :block/string ?string]
         [?parent :block/children ?descendant]
         [?parent :block/uid ?parentUid]
         [?descendant :block/order ?order]]
      `;

      const result = window.roamAlphaAPI.q(descendantsQuery);
      
      if (!result || result.length === 0) {
        return block;
      }

      // Build hierarchy map
      const blockMap = new Map<string, RoamBlock>();
      blockMap.set(block.uid, { ...block, children: [] });

      // Add all descendants to map
      for (const [uid, string] of result) {
        if (!blockMap.has(uid)) {
          blockMap.set(uid, {
            uid,
            string,
            children: []
          });
        }
      }

      // Build parent-child relationships
      for (const [uid, , parentUid] of result) {
        const parent = blockMap.get(parentUid);
        const child = blockMap.get(uid);
        
        if (parent && child) {
          if (!parent.children) parent.children = [];
          parent.children.push(child);
        }
      }

      // Sort children by order
      const sortChildren = (block: RoamBlock) => {
        if (block.children) {
          block.children.sort((a, b) => {
            const aOrder = result.find(r => r[0] === a.uid)?.[3] || 0;
            const bOrder = result.find(r => r[0] === b.uid)?.[3] || 0;
            return aOrder - bOrder;
          });
          
          block.children.forEach(sortChildren);
        }
      };

      const enrichedBlock = blockMap.get(block.uid)!;
      sortChildren(enrichedBlock);
      
      return enrichedBlock;
    } catch (error) {
      console.error(`❌ Error enriching block ${block.uid}:`, error);
      return block;
    }
  }
}
