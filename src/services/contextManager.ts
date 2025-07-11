// src/services/contextManager.ts
import { RoamService } from "./roamService";
import { RoamBlock, RoamPage } from "../types";

export interface ContextItem {
  type: 'page' | 'block' | 'reference';
  uid: string;
  title?: string;
  content: string;
  level: number; // 递归层级，0为用户直接指定的内容
  priority: number; // 优先级，数字越小优先级越高
  pageTitle?: string; // 对于block类型，记录所属页面
  children?: ContextItem[];
  source: 'user_specified' | 'page_content' | 'backlink' | 'block_reference';
}

export interface ContextBuilderOptions {
  maxDepth: number; // 最大递归深度
  maxItems: number; // 最大条目数
  includeBacklinks: boolean; // 是否包含反向链接
  includeBlockRefs: boolean; // 是否包含块引用
  includeParentBlocks: boolean; // 是否包含父级块
  includeSiblingBlocks: boolean; // 是否包含兄弟块
  includeAncestorPath: boolean; // 是否包含祖先路径
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
      ...options
    };
  }

  /**
   * 构建上下文，从用户指定的页面和块开始
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

    // 重置访问记录
    this.visitedUids.clear();
    this.visitedPageTitles.clear();

    const contextItems: ContextItem[] = [];

    // 处理用户指定的页面
    for (const pageTitle of userSpecifiedPages) {
      const pageItems = await this.processPage(pageTitle, 0, 'user_specified');
      contextItems.push(...pageItems);
    }

    // 处理用户指定的块
    for (const blockUid of userSpecifiedBlocks) {
      const blockItems = await this.processBlock(blockUid, 0, 'user_specified');
      contextItems.push(...blockItems);
    }

    // 排序并限制数量
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
   * 处理页面，递归获取相关内容
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

      // 添加页面本身
      const pageContent = this.formatPageContent(page);
      const pageItem: ContextItem = {
        type: 'page',
        uid: page.uid,
        title: page.title,
        content: pageContent,
        level: currentLevel,
        priority: this.calculatePriority(currentLevel, source),
        source
      };

      contextItems.push(pageItem);
      this.visitedUids.add(page.uid);

      // 如果还没到最大深度，获取相关内容
      if (currentLevel < this.options.maxDepth) {
        // 获取反向链接
        if (this.options.includeBacklinks) {
          const backlinks = await this.getBacklinks(pageTitle, currentLevel + 1);
          contextItems.push(...backlinks);
        }

        // 获取页面中的块引用
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
   * 处理块，递归获取相关内容，包含增强的上下文
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

      // 获取块所属的页面标题
      const pageTitle = await this.getBlockPageTitle(blockUid);

      // 添加块本身
      const blockItem: ContextItem = {
        type: 'block',
        uid: block.uid,
        content: block.string,
        level: currentLevel,
        priority: this.calculatePriority(currentLevel, source),
        pageTitle,
        source
      };

      contextItems.push(blockItem);

      // 如果还没到最大深度，获取相关内容
      if (currentLevel < this.options.maxDepth) {
        // 获取增强的上下文（父块、兄弟块、祖先路径）
        const enhancedContextItems = await this.getEnhancedBlockContext(blockUid, currentLevel);
        contextItems.push(...enhancedContextItems);

        // 获取块中提到的页面引用
        const pageRefs = this.extractPageReferences(block.string);
        for (const refPageTitle of pageRefs) {
          if (!this.visitedPageTitles.has(refPageTitle)) {
            const refItems = await this.processPage(refPageTitle, currentLevel + 1, 'block_reference');
            contextItems.push(...refItems);
          }
        }

        // 获取块的子块
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
   * 获取增强的块上下文（父块、兄弟块、祖先路径）
   */
  private async getEnhancedBlockContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // 获取父块
      if (this.options.includeParentBlocks) {
        const parentItems = await this.getParentBlockContext(blockUid, currentLevel + 1);
        contextItems.push(...parentItems);
      }

      // 获取兄弟块
      if (this.options.includeSiblingBlocks) {
        const siblingItems = await this.getSiblingBlockContext(blockUid, currentLevel + 1);
        contextItems.push(...siblingItems);
      }

      // 获取祖先路径
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
   * 获取父块上下文
   */
  private async getParentBlockContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // 使用 RoamQuery 获取父块
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
          
          const parentItem: ContextItem = {
            type: 'block',
            uid: parentUid,
            content: parentString,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, 'block_reference'),
            pageTitle,
            source: 'block_reference'
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
   * 获取兄弟块上下文
   */
  private async getSiblingBlockContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // 使用 RoamQuery 获取兄弟块
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
        // 只取前3个兄弟块以避免过多内容
        const limitedResult = result.slice(0, 3);
        
        for (const [siblingUid, siblingString, siblingOrder] of limitedResult) {
          if (!this.visitedUids.has(siblingUid)) {
            const pageTitle = await this.getBlockPageTitle(siblingUid);
            
            const siblingItem: ContextItem = {
              type: 'block',
              uid: siblingUid,
              content: siblingString,
              level: currentLevel,
              priority: this.calculatePriority(currentLevel, 'block_reference'),
              pageTitle,
              source: 'block_reference'
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
   * 获取祖先路径上下文
   */
  private async getAncestorPathContext(blockUid: string, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    try {
      // 递归获取祖先路径，但限制深度以避免过多内容
      const ancestors = await this.getAncestorPath(blockUid, 3); // 最多3层祖先
      
      for (const ancestor of ancestors) {
        if (!this.visitedUids.has(ancestor.uid)) {
          const pageTitle = await this.getBlockPageTitle(ancestor.uid);
          
          const ancestorItem: ContextItem = {
            type: 'block',
            uid: ancestor.uid,
            content: ancestor.string,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, 'block_reference'),
            pageTitle,
            source: 'block_reference'
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
   * 递归获取祖先路径
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
        
        // 递归获取更高层的祖先
        const higherAncestors = await this.getAncestorPath(parentUid, maxDepth - 1);
        ancestors.push(...higherAncestors);
      }
    } catch (error) {
      console.error(`❌ Error getting ancestor path for ${blockUid}:`, error);
    }

    return ancestors;
  }

  /**
   * 获取页面的反向链接
   */
  private async getBacklinks(pageTitle: string, currentLevel: number): Promise<ContextItem[]> {
    try {
      const backlinks = await RoamService.getBlocksReferencingPage(pageTitle);
      const contextItems: ContextItem[] = [];

      for (const backlink of backlinks) {
        // 检查是否包含循环引用
        if (this.containsCircularReference(backlink.string, pageTitle)) {
          console.log(`🔄 Skipping circular reference in backlink: ${backlink.string}`);
          continue;
        }

        if (!this.visitedUids.has(backlink.uid)) {
          const backlinkPageTitle = await this.getBlockPageTitle(backlink.uid);
          
          const backlinkItem: ContextItem = {
            type: 'reference',
            uid: backlink.uid,
            content: backlink.string,
            level: currentLevel,
            priority: this.calculatePriority(currentLevel, 'backlink'),
            pageTitle: backlinkPageTitle,
            source: 'backlink'
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
   * 获取页面中的块引用
   */
  private async getBlockReferences(page: RoamPage, currentLevel: number): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    // 遍历页面中的所有块，寻找块引用
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
   * 检查是否包含循环引用
   * 改进：只有当内容只包含对目标页面的引用时才认为是循环引用
   */
  private containsCircularReference(content: string, pageTitle: string): boolean {
    // 检查内容中是否包含指向同一页面的引用
    const pageRefPattern = new RegExp(`\\[\\[${pageTitle}\\]\\]`, 'gi');
    const hasPageRef = pageRefPattern.test(content);
    
    if (!hasPageRef) {
      return false;
    }
    
    // 计算引用的内容长度
    const contentWithoutRefs = content.replace(/\[\[[^\]]+\]\]/g, '').trim();
    
    // 如果去掉引用后内容很少（少于10个字符），则认为是循环引用
    const isCircular = contentWithoutRefs.length < 10;
    
    if (isCircular) {
      console.log(`🔄 Detected circular reference: content mostly contains [[${pageTitle}]]: "${content}"`);
    } else {
      console.log(`✅ Valid backlink with meaningful content: "${content}"`);
    }
    
    return isCircular;
  }

  /**
   * 从文本中提取页面引用
   */
  private extractPageReferences(text: string): string[] {
    const pageRefPattern = /\[\[([^\]]+)\]\]/g;
    const matches = [];
    let match;
    
    while ((match = pageRefPattern.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    return [...new Set(matches)]; // 去重
  }

  /**
   * 从文本中提取块引用
   */
  private extractBlockReferences(text: string): string[] {
    const blockRefPattern = /\(\(([^)]+)\)\)/g;
    const matches = [];
    let match;
    
    while ((match = blockRefPattern.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    return [...new Set(matches)]; // 去重
  }

  /**
   * 获取页面中的所有块（递归）
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
   * 获取块所属的页面标题
   */
  private async getBlockPageTitle(blockUid: string): Promise<string | undefined> {
    try {
      // 查询块所属的页面
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

      // 如果直接查询失败，尝试通过父级关系查找
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
   * 格式化页面内容
   */
  private formatPageContent(page: RoamPage): string {
    if (!page.blocks || page.blocks.length === 0) {
      return `页面 "${page.title}" 暂无内容`;
    }

    return RoamService.formatBlocksForAI(page.blocks, 0);
  }

  /**
   * 计算优先级
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
   * 按优先级排序
   */
  private sortByPriority(items: ContextItem[]): ContextItem[] {
    return items.sort((a, b) => {
      // 优先级数字越小越优先
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // 优先级相同时，按层级排序
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      
      // 层级相同时，按内容长度排序（更长的内容优先）
      return (b.content?.length || 0) - (a.content?.length || 0);
    });
  }

  /**
   * 获取层级分布统计
   */
  private getLevelDistribution(items: ContextItem[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    
    for (const item of items) {
      distribution[item.level] = (distribution[item.level] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * 获取来源分布统计
   */
  private getSourceDistribution(items: ContextItem[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const item of items) {
      distribution[item.source] = (distribution[item.source] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * 格式化上下文为 AI 可读的字符串
   */
  formatContextForAI(items: ContextItem[]): string {
    if (items.length === 0) {
      return "未找到相关上下文内容。";
    }

    const sections: string[] = [];
    const itemsByLevel = this.groupByLevel(items);

    // 按级别组织内容
    for (const level of Object.keys(itemsByLevel).sort((a, b) => Number(a) - Number(b))) {
      const levelItems = itemsByLevel[Number(level)];
      const levelTitle = this.getLevelTitle(Number(level));
      
      sections.push(`\n=== ${levelTitle} ===`);
      
      for (const item of levelItems) {
        let itemContent = '';
        
        switch (item.type) {
          case 'page':
            itemContent = `**页面: ${item.title}**\n${item.content}`;
            break;
          case 'block':
            const pageInfo = item.pageTitle ? ` (来自页面: ${item.pageTitle})` : '';
            itemContent = `**块引用**${pageInfo}\n${item.content}`;
            break;
          case 'reference':
            const refPageInfo = item.pageTitle ? ` (来自页面: ${item.pageTitle})` : '';
            itemContent = `**反向链接**${refPageInfo}\n${item.content}`;
            break;
        }
        
        sections.push(itemContent);
      }
    }

    return sections.join('\n\n');
  }

  /**
   * 按级别分组
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
   * 获取级别标题
   */
  private getLevelTitle(level: number): string {
    switch (level) {
      case 0:
        return "用户指定内容";
      case 1:
        return "直接相关内容";
      case 2:
        return "扩展相关内容";
      case 3:
        return "背景信息";
      default:
        return `第 ${level} 层相关内容`;
    }
  }
}