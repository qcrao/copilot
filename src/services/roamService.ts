// src/services/roamService.ts
import { RoamBlock, RoamPage, PageContext } from "../types";

export class RoamService {
  /**
   * Get the current graph name
   */
  static getCurrentGraphName(): string | null {
    try {
      // Try to get graph name from URL
      const urlMatch = window.location.href.match(/\/app\/([^\/]+)/);
      if (urlMatch) {
        return urlMatch[1];
      }

      // Fallback: try to get from roam API or other methods
      // Some roam installations might have different URL patterns
      const pathMatch = window.location.pathname.match(/\/app\/([^\/]+)/);
      if (pathMatch) {
        return pathMatch[1];
      }

      console.log("Could not determine graph name from URL:", window.location.href);
      return null;
    } catch (error) {
      console.error("Error getting graph name:", error);
      return null;
    }
  }

  /**
   * Get user name (using graph name as identifier)
   */
  static getUserName(): string | null {
    try {
      const graphName = this.getCurrentGraphName();
      if (!graphName) {
        return null;
      }
      
      // Clean up the graph name for display
      // Remove any URL encoding but keep original casing
      let userName = decodeURIComponent(graphName);
      
      // Only replace underscores and hyphens with spaces, but preserve original casing
      userName = userName.replace(/[_-]/g, ' ');
      
      return userName;
    } catch (error) {
      console.error("Error getting user name:", error);
      return null;
    }
  }

  /**
   * Detect if running in web or desktop environment
   */
  static isDesktopApp(): boolean {
    try {
      // Check for desktop app indicators
      return (
        window.location.protocol === 'roam:' ||
        window.location.href.startsWith('roam://') ||
        // Check for Electron environment
        (typeof window !== 'undefined' && 
         (window as any).process && 
         (window as any).process.type === 'renderer') ||
        // Check user agent for desktop indicators
        /Electron|roam/i.test(navigator.userAgent)
      );
    } catch (error) {
      console.error("Error detecting desktop app:", error);
      return false;
    }
  }

  /**
   * Generate clickable URL for a block
   */
  static generateBlockUrl(blockUid: string, graphName?: string): { webUrl: string; desktopUrl: string } | null {
    const graph = graphName || this.getCurrentGraphName();
    if (!graph) {
      console.log("Cannot generate URLs without graph name");
      return null;
    }

    const webUrl = `https://roamresearch.com/#/app/${graph}/page/${blockUid}`;
    const desktopUrl = `roam://#/app/${graph}/page/${blockUid}`;

    return { webUrl, desktopUrl };
  }

  /**
   * Generate clickable URL for a page
   */
  static generatePageUrl(pageUid: string, graphName?: string): { webUrl: string; desktopUrl: string } | null {
    const graph = graphName || this.getCurrentGraphName();
    if (!graph) {
      console.log("Cannot generate URLs without graph name");
      return null;
    }

    const webUrl = `https://roamresearch.com/#/app/${graph}/page/${pageUid}`;
    const desktopUrl = `roam://#/app/${graph}/page/${pageUid}`;

    return { webUrl, desktopUrl };
  }

  /**
   * Get the current page information
   */
  static async getCurrentPageInfo(): Promise<RoamPage | null> {
    try {
      // Try multiple methods to get current page
      let currentPageUid = null;
      let title = "";

      // Try to get from API (might be async)
      const apiResult = window.roamAlphaAPI?.ui?.mainWindow?.getOpenPageOrBlockUid?.();
      if (apiResult && typeof apiResult === 'object' && 'then' in apiResult) {
        currentPageUid = await apiResult;
      } else {
        currentPageUid = apiResult || null;
      }

      console.log("Current page UID from API:", currentPageUid);

      if (!currentPageUid) {
        // Fallback: try to get from URL
        const urlMatch = window.location.href.match(/\/page\/([^/?]+)/);
        if (urlMatch) {
          currentPageUid = decodeURIComponent(urlMatch[1]);
          console.log("Current page UID from URL:", currentPageUid);
        }
      }

      if (!currentPageUid) {
        // Fallback: try to get from document title or other methods
        const titleElement = document.querySelector(".rm-title-display");
        if (titleElement) {
          title = titleElement.textContent || "";
          console.log("Page title from DOM:", title);

          // Try to find page by title
          if (title) {
            const titleQuery = `
              [:find ?uid
               :where
               [?e :node/title "${title}"]
               [?e :block/uid ?uid]]
            `;
            const titleResult = window.roamAlphaAPI.q(titleQuery);
            if (titleResult && titleResult.length > 0) {
              currentPageUid = titleResult[0][0];
              console.log("Found UID by title:", currentPageUid);
            }
          }
        }
      }

      if (!currentPageUid) {
        console.log("No current page UID found");
        return null;
      }

      // If we don't have title yet, query it
      if (!title) {
        const pageQuery = `
          [:find ?title
           :where
           [?e :block/uid "${currentPageUid}"]
           [?e :node/title ?title]]
        `;

        const result = window.roamAlphaAPI.q(pageQuery);
        if (result && result.length > 0) {
          title = result[0][0];
        } else {
          // Try alternative query for daily notes
          const dailyQuery = `
            [:find ?title
             :where
             [?e :block/uid "${currentPageUid}"]
             [?e :block/string ?title]]
          `;
          const dailyResult = window.roamAlphaAPI.q(dailyQuery);
          if (dailyResult && dailyResult.length > 0) {
            title = dailyResult[0][0];
          }
        }
      }

      console.log("Final page info:", { title, uid: currentPageUid });

      // Get all blocks for this page
      const blocks = await this.getPageBlocks(currentPageUid);

      return {
        title: title || "Untitled",
        uid: currentPageUid,
        blocks,
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
      console.log("Getting blocks for page:", pageUid);

      // Ensure pageUid is a string, not a Promise
      const resolvedPageUid = await Promise.resolve(pageUid);
      console.log("Resolved page UID:", resolvedPageUid);

      if (!resolvedPageUid) {
        console.log("No valid page UID provided");
        return [];
      }

      // Try different query patterns for different types of pages
      const queries = [
        // Standard page children query
        `[:find ?uid ?string ?order
         :where
         [?page :block/uid "${resolvedPageUid}"]
         [?page :block/children ?block]
         [?block :block/uid ?uid]
         [?block :block/string ?string]
         [?block :block/order ?order]]`,

        // Alternative query using parents relationship
        `[:find ?uid ?string ?order
         :where
         [?page :block/uid "${resolvedPageUid}"]
         [?block :block/parents ?page]
         [?block :block/uid ?uid]
         [?block :block/string ?string]
         [?block :block/order ?order]]`,

        // Try without order constraint
        `[:find ?uid ?string
         :where
         [?page :block/uid "${resolvedPageUid}"]
         [?page :block/children ?block]
         [?block :block/uid ?uid]
         [?block :block/string ?string]]`,

        // Try finding all blocks that reference this page
        `[:find ?uid ?string
         :where
         [?block :block/uid ?uid]
         [?block :block/string ?string]
         [?block :block/refs ?page]
         [?page :block/uid "${resolvedPageUid}"]]`,
      ];

      let result = null;
      for (let i = 0; i < queries.length; i++) {
        console.log(`Trying query ${i + 1}:`, queries[i]);
        result = window.roamAlphaAPI.q(queries[i]);
        console.log(`Query ${i + 1} result:`, result);

        if (result && result.length > 0) {
          break;
        }
      }

      if (!result || result.length === 0) {
        console.log("No blocks found with any query");
        return [];
      }

      const blocks: RoamBlock[] = result.map((row: any[]) => ({
        uid: row[0],
        string: row[1] || "",
        order: row[2] || 0,
      }));

      // Sort by order and get children for each block
      blocks.sort((a, b) => (a.order || 0) - (b.order || 0));

      console.log("Found blocks:", blocks.length);

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

      const children: RoamBlock[] = result.map(
        ([uid, string, order]: [string, string, number]) => ({
          uid,
          string,
          order,
        })
      );

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
      const blockElements = document.querySelectorAll(
        ".roam-block[data-block-uid]"
      );

      blockElements.forEach((element) => {
        const uid = element.getAttribute("data-block-uid");
        const textElement = element.querySelector(".rm-block-text");

        if (uid && textElement) {
          const string = textElement.textContent || "";

          // Only include blocks that are actually visible
          const rect = element.getBoundingClientRect();
          if (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
          ) {
            visibleBlocks.push({
              uid,
              string,
              children: [], // We'll focus on the main visible content for now
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
      return selection ? selection.toString().trim() : "";
    } catch (error) {
      console.error("Error getting selected text:", error);
      return "";
    }
  }

  /**
   * Get today's daily note
   */
  static async getTodaysDailyNote(): Promise<RoamPage | null> {
    try {
      const today = new Date();
      const dateString = today
        .toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
        .replace(/\//g, "-");

      console.log("Looking for daily note:", dateString);

      // Try different date formats that Roam might use
      const dateFormats = [
        dateString, // MM-dd-yyyy
        today.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }), // Month dd, yyyy
        today.toISOString().split("T")[0], // yyyy-mm-dd
      ];

      for (const format of dateFormats) {
        const query = `
          [:find ?uid
           :where
           [?e :node/title "${format}"]
           [?e :block/uid ?uid]]
        `;

        const result = window.roamAlphaAPI.q(query);
        if (result && result.length > 0) {
          const uid = result[0][0];
          const blocks = await this.getPageBlocks(uid);

          return {
            title: format,
            uid,
            blocks,
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting today's daily note:", error);
      return null;
    }
  }

  /**
   * Get linked references for a page
   */
  static async getLinkedReferences(pageTitle: string): Promise<RoamBlock[]> {
    try {
      console.log("Getting linked references for:", pageTitle);

      const query = `
        [:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "[[${pageTitle}]]")]]
      `;

      const result = window.roamAlphaAPI.q(query);
      console.log("Linked references result:", result);

      if (!result) return [];

      return result.map(([uid, string]: [string, string]) => ({
        uid,
        string: string || "",
        children: [],
      }));
    } catch (error) {
      console.error("Error getting linked references:", error);
      return [];
    }
  }

  /**
   * Get comprehensive page context for AI
   */
  static async getPageContext(): Promise<PageContext> {
    console.log("Getting comprehensive page context...");

    const [currentPage, visibleBlocks, selectedText, dailyNote] =
      await Promise.all([
        this.getCurrentPageInfo(),
        Promise.resolve(this.getVisibleBlocks()),
        Promise.resolve(this.getSelectedText()),
        this.getTodaysDailyNote(),
      ]);

    // Get linked references if we have a current page
    let linkedReferences: RoamBlock[] = [];
    if (currentPage) {
      linkedReferences = await this.getLinkedReferences(currentPage.title);
    }

    console.log("Page context summary:", {
      currentPage: currentPage?.title || "None",
      visibleBlocks: visibleBlocks.length,
      selectedText: selectedText ? "Yes" : "No",
      dailyNote: dailyNote?.title || "None",
      linkedReferences: linkedReferences.length,
    });

    return {
      currentPage: currentPage || undefined,
      visibleBlocks,
      selectedText: selectedText || undefined,
      dailyNote: dailyNote || undefined,
      linkedReferences,
    };
  }

  /**
   * Get model-specific maximum context tokens
   */
  static getModelTokenLimit(provider: string, model: string): number {
    const modelLimits: { [key: string]: { [key: string]: number } } = {
      openai: {
        'gpt-4o-mini': 24000,  // 128k context window, very cost-effective
        'gpt-3.5-turbo': 2000, // 4k context window, keep conservative
      },
      anthropic: {
        'claude-3-haiku-20240307': 180000,     // Claude 3 Haiku - 200k context
        'claude-3-5-haiku-20241022': 180000,   // Claude 3.5 Haiku - 200k context  
      },
      groq: {
        'llama-3.1-8b-instant': 24000,    // 128k context window, ultra fast & cheap
        'gemma2-9b-it': 6000,             // 8k context window, very fast
      },
      xai: {
        'grok-beta': 24000,        // 131k context window
        'grok-3-mini': 24000,      // 128k context window, most cost-effective
      }
    };

    const providerLimits = modelLimits[provider];
    if (!providerLimits) {
      console.warn(`Unknown provider: ${provider}, using default limit`);
      return 6000; // Default fallback
    }

    const limit = providerLimits[model];
    if (!limit) {
      console.warn(`Unknown model: ${model} for provider: ${provider}, using default limit`);
      return 6000; // Default fallback
    }

    return limit;
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate context to fit within token limit
   */
  static truncateContext(formattedContext: string, maxTokens: number = 6000): string {
    const currentTokens = this.estimateTokenCount(formattedContext);
    
    if (currentTokens <= maxTokens) {
      return formattedContext;
    }

    // Calculate how much we need to reduce
    const targetLength = Math.floor(formattedContext.length * (maxTokens / currentTokens));
    
    // Split into sections
    const sections = formattedContext.split('\n\n');
    let result = '';
    let addedSections = 0;
    
    // Always include selected text and current page title if they exist
    const selectedTextSection = sections.find(s => s.startsWith('**Selected Text:**'));
    const currentPageSection = sections.find(s => s.startsWith('**Current Page:'));
    
    if (selectedTextSection) {
      result += selectedTextSection + '\n\n';
    }
    
    if (currentPageSection) {
      result += currentPageSection + '\n\n';
      addedSections = 1;
    }

    // Add other sections until we approach the limit
    for (const section of sections) {
      if (section === selectedTextSection || section === currentPageSection) continue;
      
      const testResult = result + section + '\n\n';
      if (this.estimateTokenCount(testResult) > targetLength) {
        // If this is page content, try to include partial content
        if (section.startsWith('**Page Content:**') || section.startsWith('**Visible Content:**')) {
          const lines = section.split('\n');
          const header = lines[0];
          let partialContent = header + '\n';
          
          for (let i = 1; i < lines.length; i++) {
            const testPartial = result + partialContent + lines[i] + '\n' + '... (content truncated)\n\n';
            if (this.estimateTokenCount(testPartial) > targetLength) break;
            partialContent += lines[i] + '\n';
          }
          
          if (partialContent !== header + '\n') {
            result += partialContent + '... (content truncated)\n\n';
          }
        }
        break;
      }
      
      result += section + '\n\n';
      addedSections++;
      
      // Limit number of sections to prevent too much context
      if (addedSections >= 3) break;
    }

    return result.trim();
  }

  /**
   * Format page context for AI prompt with clickable source references
   */
  static formatContextForAI(context: PageContext, maxTokens?: number): string {
    let formattedContext = "";
    const graphName = this.getCurrentGraphName();
    const isDesktop = this.isDesktopApp();

    if (context.selectedText) {
      formattedContext += `**Selected Text:**\n${context.selectedText}\n\n`;
    }

    // Helper function to format URL links
    const formatUrls = (webUrl: string, desktopUrl: string) => {
      if (isDesktop) {
        return `[🔗 Open in Roam](${desktopUrl})`;
      } else {
        return `[🔗 Web](${webUrl}) | [🔗 Desktop](${desktopUrl})`;
      }
    };

    if (context.currentPage) {
      const pageUrls = this.generatePageUrl(context.currentPage.uid, graphName || undefined);
      const urlLinks = pageUrls ? formatUrls(pageUrls.webUrl, pageUrls.desktopUrl) : `[[${context.currentPage.title}]]`;
      
      formattedContext += `**Current Page: "${context.currentPage.title}"** ${urlLinks}\n\n`;

      if (context.currentPage.blocks.length > 0) {
        formattedContext += "**Page Content:**\n";
        formattedContext += this.formatBlocksForAIWithClickableReferences(
          context.currentPage.blocks,
          0,
          graphName,
          isDesktop
        );
        formattedContext += "\n";
      }
    } else if (context.visibleBlocks.length > 0) {
      formattedContext += "**Visible Content:**\n";
      formattedContext += this.formatBlocksForAIWithClickableReferences(context.visibleBlocks, 0, graphName, isDesktop);
      formattedContext += "\n";
    }

    // Add daily note content
    if (context.dailyNote && context.dailyNote.blocks.length > 0) {
      const dailyUrls = this.generatePageUrl(context.dailyNote.uid, graphName || undefined);
      const dailyUrlLinks = dailyUrls ? formatUrls(dailyUrls.webUrl, dailyUrls.desktopUrl) : `[[${context.dailyNote.title}]]`;
      
      formattedContext += `**Today's Daily Note (${context.dailyNote.title}):** ${dailyUrlLinks}\n`;
      formattedContext += this.formatBlocksForAIWithClickableReferences(
        context.dailyNote.blocks, 
        0,
        graphName,
        isDesktop
      );
      formattedContext += "\n";
    }

    // Add linked references
    if (context.linkedReferences.length > 0) {
      formattedContext += `**Linked References (${context.linkedReferences.length} references):**\n`;
      for (const ref of context.linkedReferences.slice(0, 10)) {
        const blockUrls = this.generateBlockUrl(ref.uid, graphName || undefined);
        const blockUrlLinks = blockUrls ? formatUrls(blockUrls.webUrl, blockUrls.desktopUrl) : `((${ref.uid}))`;
        
        formattedContext += `- ${ref.string} ${blockUrlLinks}\n`;
      }
      if (context.linkedReferences.length > 10) {
        formattedContext += `... and ${
          context.linkedReferences.length - 10
        } more references\n`;
      }
      formattedContext += "\n";
    }

    const finalContext = formattedContext.trim();
    
    // Apply truncation if context is too long
    return this.truncateContext(finalContext, maxTokens);
  }

  /**
   * Format blocks recursively for AI with clickable source references
   */
  static formatBlocksForAIWithClickableReferences(blocks: RoamBlock[], level: number, graphName?: string | null, isDesktop?: boolean): string {
    let formatted = "";
    const indent = "  ".repeat(level);

    for (const block of blocks) {
      if (block.string.trim()) {
        let blockReference = `((${block.uid}))`;
        
        if (graphName) {
          const blockUrls = this.generateBlockUrl(block.uid, graphName);
          if (blockUrls) {
            if (isDesktop) {
              blockReference = `[🔗](${blockUrls.desktopUrl})`;
            } else {
              blockReference = `[🔗 Web](${blockUrls.webUrl}) | [🔗 App](${blockUrls.desktopUrl})`;
            }
          }
        }
        
        formatted += `${indent}- ${block.string} ${blockReference}\n`;

        if (block.children && block.children.length > 0) {
          formatted += this.formatBlocksForAIWithClickableReferences(block.children, level + 1, graphName, isDesktop);
        }
      }
    }

    return formatted;
  }

  /**
   * Format blocks recursively for AI with source references (legacy method)
   */
  static formatBlocksForAIWithReferences(blocks: RoamBlock[], level: number, pageTitle?: string): string {
    let formatted = "";
    const indent = "  ".repeat(level);

    for (const block of blocks) {
      if (block.string.trim()) {
        formatted += `${indent}- ${block.string} [Block Reference: ((${block.uid}))]\n`;

        if (block.children && block.children.length > 0) {
          formatted += this.formatBlocksForAIWithReferences(block.children, level + 1, pageTitle);
        }
      }
    }

    return formatted;
  }

  /**
   * Format blocks recursively for AI (legacy method for compatibility)
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

  // /**
  //  * Detect the primary language of text content
  //  * NOTE: This function is deprecated in favor of manual language settings
  //  */
  // static detectLanguage(content: string): string {
  //   const cleanContent = content.replace(/\s/g, '');
  //   const totalChars = cleanContent.length;
    
  //   if (totalChars === 0) return 'English';

  //   // Chinese characters (including traditional and simplified)
  //   const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  //   const chineseRatio = chineseChars / totalChars;
    
  //   // Japanese characters (Hiragana, Katakana, Kanji)
  //   const japaneseChars = (content.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length;
  //   const japaneseRatio = japaneseChars / totalChars;
    
  //   // Korean characters (Hangul)
  //   const koreanChars = (content.match(/[\uac00-\ud7af]/g) || []).length;
  //   const koreanRatio = koreanChars / totalChars;
    
  //   // French characters (accented characters)
  //   const frenchChars = (content.match(/[àâäéèêëïîôöùûüÿçÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ]/g) || []).length;
  //   const frenchRatio = frenchChars / totalChars;
    
  //   // Spanish characters (accented characters)
  //   const spanishChars = (content.match(/[áéíóúüñÁÉÍÓÚÜÑ¿¡]/g) || []).length;
  //   const spanishRatio = spanishChars / totalChars;
    
  //   // German characters (umlaut and ß)
  //   const germanChars = (content.match(/[äöüßÄÖÜ]/g) || []).length;
  //   const germanRatio = germanChars / totalChars;

  //   // Determine language based on ratios
  //   if (chineseRatio > 0.2) return 'Chinese';
  //   if (japaneseRatio > 0.2) return 'Japanese';
  //   if (koreanRatio > 0.2) return 'Korean';
  //   if (frenchRatio > 0.05) return 'French';
  //   if (spanishRatio > 0.05) return 'Spanish';
  //   if (germanRatio > 0.05) return 'German';
    
  //   return 'English';
  // }

  // /**
  //  * Add language instruction to prompt based on detected language
  //  * NOTE: This function is deprecated in favor of manual language settings
  //  */
  // static addLanguageInstruction(prompt: string, detectedLanguage: string): string {
  //   return prompt + `\n\nIMPORTANT: Please respond in ${detectedLanguage}, as this appears to be the primary language used in the user's notes.`;
  // }

  /**
   * Get notes from a specific date
   */
  static async getNotesFromDate(dateString: string): Promise<RoamPage | null> {
    try {
      console.log("Getting notes from date:", dateString);
      
      // Convert date string to various formats that Roam might use
      const inputDate = new Date(dateString);
      if (isNaN(inputDate.getTime())) {
        console.error("Invalid date string:", dateString);
        return null;
      }

      const dateFormats = [
        // MM-dd-yyyy
        inputDate.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit", 
          year: "numeric",
        }).replace(/\//g, "-"),
        // Month dd, yyyy
        inputDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        // yyyy-mm-dd
        inputDate.toISOString().split("T")[0],
        // dd-MM-yyyy
        inputDate.toLocaleDateString("en-GB").replace(/\//g, "-"),
        // Just the year-month-day without leading zeros
        `${inputDate.getFullYear()}-${inputDate.getMonth() + 1}-${inputDate.getDate()}`,
        // With ordinal suffix
        inputDate.toLocaleDateString("en-US", {
          month: "long", 
          day: "numeric",
          year: "numeric"
        }).replace(/(\d+)/, (match) => {
          const day = parseInt(match);
          const suffix = day % 10 === 1 && day !== 11 ? 'st' :
                        day % 10 === 2 && day !== 12 ? 'nd' :
                        day % 10 === 3 && day !== 13 ? 'rd' : 'th';
          return day + suffix;
        })
      ];

      for (const format of dateFormats) {
        console.log("Trying date format:", format);
        
        const query = `
          [:find ?uid
           :where
           [?e :node/title "${format}"]
           [?e :block/uid ?uid]]
        `;

        const result = window.roamAlphaAPI.q(query);
        console.log("Query result for", format, ":", result);
        
        if (result && result.length > 0) {
          const uid = result[0][0];
          const blocks = await this.getPageBlocks(uid);

          return {
            title: format,
            uid,
            blocks,
          };
        }
      }

      console.log("No daily note found for date:", dateString);
      return null;
    } catch (error) {
      console.error("Error getting notes from date:", error);
      return null;
    }
  }

  /**
   * Get notes from a date range
   */
  static async getNotesFromDateRange(startDate: string, endDate: string): Promise<RoamPage[]> {
    try {
      const notes: RoamPage[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateString = currentDate.toISOString().split('T')[0];
        const note = await this.getNotesFromDate(dateString);
        if (note) {
          notes.push(note);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return notes;
    } catch (error) {
      console.error("Error getting notes from date range:", error);
      return [];
    }
  }
}
