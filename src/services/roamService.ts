// src/services/roamService.ts
import { RoamBlock, RoamPage, PageContext } from "../types";

export class RoamService {
  /**
   * Get the current page information
   */
  static async getCurrentPageInfo(): Promise<RoamPage | null> {
    try {
      const currentPageUid = window.roamAlphaAPI?.ui?.mainWindow?.getOpenPageOrBlockUid?.();
      if (!currentPageUid) {
        return null;
      }

      // Query page title
      const pageQuery = `
        [:find ?title
         :where
         [?e :block/uid "${currentPageUid}"]
         [?e :node/title ?title]]
      `;

      const result = window.roamAlphaAPI.q(pageQuery);
      if (!result || result.length === 0) {
        return null;
      }

      const title = result[0][0];
      
      // Get all blocks for this page
      const blocks = await this.getPageBlocks(currentPageUid);
      
      return {
        title,
        uid: currentPageUid,
        blocks
      };
    } catch (error) {
      console.error("Error getting current page info:", error);
      return null;
    }
  }

  /**
   * Get all blocks for a page
   */
  static async getPageBlocks(pageUid: string): Promise<RoamBlock[]> {
    try {
      const blocksQuery = `
        [:find ?uid ?string ?order
         :where
         [?page :block/uid "${pageUid}"]
         [?page :block/children ?block]
         [?block :block/uid ?uid]
         [?block :block/string ?string]
         [?block :block/order ?order]]
      `;

      const result = window.roamAlphaAPI.q(blocksQuery);
      if (!result) return [];
      
      const blocks: RoamBlock[] = result.map(([uid, string, order]: [string, string, number]) => ({
        uid,
        string,
        order
      }));

      // Sort by order and get children for each block
      blocks.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Get children for each block recursively
      for (const block of blocks) {
        block.children = await this.getBlockChildren(block.uid);
      }

      return blocks;
    } catch (error) {
      console.error("Error getting page blocks:", error);
      return [];
    }
  }

  /**
   * Get children blocks recursively
   */
  static async getBlockChildren(blockUid: string): Promise<RoamBlock[]> {
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
      
      const children: RoamBlock[] = result.map(([uid, string, order]: [string, string, number]) => ({
        uid,
        string,
        order
      }));

      children.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Recursively get children of children
      for (const child of children) {
        child.children = await this.getBlockChildren(child.uid);
      }

      return children;
    } catch (error) {
      console.error("Error getting block children:", error);
      return [];
    }
  }

  /**
   * Get all visible blocks in the current view
   */
  static getVisibleBlocks(): RoamBlock[] {
    const visibleBlocks: RoamBlock[] = [];
    
    try {
      // Get all visible block elements
      const blockElements = document.querySelectorAll('.roam-block[data-block-uid]');
      
      blockElements.forEach((element) => {
        const uid = element.getAttribute('data-block-uid');
        const textElement = element.querySelector('.rm-block-text');
        
        if (uid && textElement) {
          const string = textElement.textContent || '';
          
          // Only include blocks that are actually visible
          const rect = element.getBoundingClientRect();
          if (rect.top >= 0 && rect.left >= 0 && 
              rect.bottom <= window.innerHeight && 
              rect.right <= window.innerWidth) {
            visibleBlocks.push({
              uid,
              string,
              children: [] // We'll focus on the main visible content for now
            });
          }
        }
      });
    } catch (error) {
      console.error("Error getting visible blocks:", error);
    }

    return visibleBlocks;
  }

  /**
   * Get selected text if any
   */
  static getSelectedText(): string {
    try {
      const selection = window.getSelection();
      return selection ? selection.toString().trim() : '';
    } catch (error) {
      console.error("Error getting selected text:", error);
      return '';
    }
  }

  /**
   * Get comprehensive page context for AI
   */
  static async getPageContext(): Promise<PageContext> {
    const [currentPage, visibleBlocks, selectedText] = await Promise.all([
      this.getCurrentPageInfo(),
      Promise.resolve(this.getVisibleBlocks()),
      Promise.resolve(this.getSelectedText())
    ]);

    return {
      currentPage: currentPage || undefined,
      visibleBlocks,
      selectedText: selectedText || undefined
    };
  }

  /**
   * Format page context for AI prompt
   */
  static formatContextForAI(context: PageContext): string {
    let formattedContext = "";

    if (context.selectedText) {
      formattedContext += `**Selected Text:**\n${context.selectedText}\n\n`;
    }

    if (context.currentPage) {
      formattedContext += `**Current Page: "${context.currentPage.title}"**\n\n`;
      
      if (context.currentPage.blocks.length > 0) {
        formattedContext += "**Page Content:**\n";
        formattedContext += this.formatBlocksForAI(context.currentPage.blocks, 0);
      }
    } else if (context.visibleBlocks.length > 0) {
      formattedContext += "**Visible Content:**\n";
      formattedContext += this.formatBlocksForAI(context.visibleBlocks, 0);
    }

    return formattedContext;
  }

  /**
   * Format blocks recursively for AI
   */
  static formatBlocksForAI(blocks: RoamBlock[], level: number): string {
    let formatted = "";
    const indent = "  ".repeat(level);

    for (const block of blocks) {
      if (block.string.trim()) {
        formatted += `${indent}- ${block.string}\n`;
        
        if (block.children && block.children.length > 0) {
          formatted += this.formatBlocksForAI(block.children, level + 1);
        }
      }
    }

    return formatted;
  }
}