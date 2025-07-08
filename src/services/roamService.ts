// src/services/roamService.ts
import { RoamBlock, RoamPage, PageContext } from "../types";

export class RoamService {
  /**
   * Get the current graph name
   */
  static getCurrentGraphName(): string | null {
    try {
      console.log("Getting graph name from URL:", window.location.href);
      console.log("Pathname:", window.location.pathname);
      console.log("Hash:", window.location.hash);

      // Try to get graph name from URL - check both href and hash
      const urlMatch = window.location.href.match(/\/app\/([^\/\?#]+)/);
      if (urlMatch) {
        console.log("Graph name from href:", urlMatch[1]);
        return decodeURIComponent(urlMatch[1]);
      }

      // Try to get from hash (Roam often uses hash routing)
      const hashMatch = window.location.hash.match(/\/app\/([^\/\?#]+)/);
      if (hashMatch) {
        console.log("Graph name from hash:", hashMatch[1]);
        return decodeURIComponent(hashMatch[1]);
      }

      // Fallback: try to get from roam API or other methods
      // Some roam installations might have different URL patterns
      const pathMatch = window.location.pathname.match(/\/app\/([^\/\?#]+)/);
      if (pathMatch) {
        console.log("Graph name from pathname:", pathMatch[1]);
        return decodeURIComponent(pathMatch[1]);
      }

      // Try alternative patterns - first check for roam:// protocol
      const roamProtocolMatch = window.location.href.match(
        /roam:\/\/#\/app\/([^\/\?#]+)/
      );
      if (roamProtocolMatch) {
        console.log("Graph name from roam protocol:", roamProtocolMatch[1]);
        return decodeURIComponent(roamProtocolMatch[1]);
      }

      // Try alternative patterns for web
      const altMatch = window.location.href.match(/#\/app\/([^\/\?#]+)/);
      if (altMatch) {
        console.log("Graph name from alt pattern:", altMatch[1]);
        return decodeURIComponent(altMatch[1]);
      }

      // Try to get from Roam API if available
      if (window.roamAlphaAPI && (window.roamAlphaAPI as any).graph) {
        try {
          const graphName = (window.roamAlphaAPI as any).graph.name;
          if (graphName) {
            console.log("Graph name from Roam API:", graphName);
            return graphName;
          }
        } catch (apiError) {
          console.log("Could not get graph name from API:", apiError);
        }
      }

      // Check if we're on roamresearch.com and try to extract from current page title
      if (window.location.hostname === "roamresearch.com") {
        // Try to get from the document title which often contains the graph name
        const titleMatch = document.title.match(/^(.+?)\s*-\s*Roam/);
        if (titleMatch && titleMatch[1] && titleMatch[1] !== "Roam") {
          console.log("Graph name from document title:", titleMatch[1]);
          return titleMatch[1].trim();
        }
      }

      // Try to get from the sidebar or other UI elements
      const sidebarElement = document.querySelector(
        ".roam-sidebar-container .bp3-heading"
      );
      if (sidebarElement && sidebarElement.textContent) {
        const sidebarText = sidebarElement.textContent.trim();
        if (sidebarText && sidebarText !== "Roam" && sidebarText.length < 50) {
          console.log("Graph name from sidebar:", sidebarText);
          return sidebarText;
        }
      }

      console.log(
        "Could not determine graph name from URL:",
        window.location.href
      );
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
      userName = userName.replace(/[_-]/g, " ");

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
        window.location.protocol === "roam:" ||
        window.location.href.startsWith("roam://") ||
        // Check for Electron environment
        (typeof window !== "undefined" &&
          (window as any).process &&
          (window as any).process.type === "renderer") ||
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
  static generateBlockUrl(
    blockUid: string,
    graphName?: string
  ): { webUrl: string; desktopUrl: string } | null {
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
  static generatePageUrl(
    pageUid: string,
    graphName?: string
  ): { webUrl: string; desktopUrl: string } | null {
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
      const apiResult =
        window.roamAlphaAPI?.ui?.mainWindow?.getOpenPageOrBlockUid?.();
      if (apiResult && typeof apiResult === "object" && "then" in apiResult) {
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

          // Only include blocks that are actually visible (more lenient)
          const rect = element.getBoundingClientRect();
          // Include blocks that are at least partially visible
          if (
            rect.bottom > 0 && // Bottom is below the top of viewport
            rect.top < window.innerHeight && // Top is above the bottom of viewport
            rect.right > 0 && // Right edge is to the right of left edge of viewport
            rect.left < window.innerWidth // Left edge is to the left of right edge of viewport
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
        // Add ordinal format like "June 25th, 2025"
        today
          .toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
          .replace(/(\d+),/, (match, day) => {
            const dayNum = parseInt(day);
            let suffix = "th";
            if (dayNum % 10 === 1 && dayNum !== 11) suffix = "st";
            else if (dayNum % 10 === 2 && dayNum !== 12) suffix = "nd";
            else if (dayNum % 10 === 3 && dayNum !== 13) suffix = "rd";
            return `${dayNum}${suffix},`;
          }), // Month ddth, yyyy
        today.toISOString().split("T")[0], // yyyy-mm-dd
        // Also try common alternative formats
        `${today.getDate()}${getOrdinalSuffix(
          today.getDate()
        )} ${today.toLocaleDateString("en-US", {
          month: "long",
        })}, ${today.getFullYear()}`, // ddth Month, yyyy
      ];

      // Helper function for ordinal suffix
      function getOrdinalSuffix(day: number): string {
        if (day % 10 === 1 && day !== 11) return "st";
        if (day % 10 === 2 && day !== 12) return "nd";
        if (day % 10 === 3 && day !== 13) return "rd";
        return "th";
      }

      for (const format of dateFormats) {
        console.log("Trying date format:", format);

        const query = `
          [:find ?uid
           :where
           [?e :node/title "${format}"]
           [?e :block/uid ?uid]]
        `;

        console.log("Executing query:", query);
        const result = window.roamAlphaAPI.q(query);
        console.log("Query result:", result);
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
      currentPageBlocks: currentPage?.blocks?.length || 0,
      visibleBlocks: visibleBlocks.length,
      selectedText: selectedText ? "Yes" : "No",
      dailyNote: dailyNote?.title || "None",
      dailyNoteBlocks: dailyNote?.blocks?.length || 0,
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
        "gpt-4o": 24000, // 128k context window
        "gpt-4o-mini": 24000, // 128k context window, very cost-effective
        "gpt-4-turbo": 24000, // 128k context window
        "gpt-4": 6000, // 8k context window, conservative
        "gpt-3.5-turbo": 2000, // 4k context window, keep conservative
      },
      anthropic: {
        "claude-3-5-sonnet-20241022": 180000, // Claude 3.5 Sonnet - 200k context
        "claude-3-5-haiku-20241022": 180000, // Claude 3.5 Haiku - 200k context
        "claude-3-opus-20240229": 180000, // Claude 3 Opus - 200k context
        "claude-3-sonnet-20240229": 180000, // Claude 3 Sonnet - 200k context
        "claude-3-haiku-20240307": 180000, // Claude 3 Haiku - 200k context
      },
      groq: {
        "llama-3.3-70b-versatile": 24000, // 128k context window, latest model
        "llama-3.1-70b-versatile": 24000, // 128k context window
        "llama-3.1-8b-instant": 24000, // 128k context window, ultra fast & cheap
        "llama3-groq-70b-8192-tool-use-preview": 6000, // 8k context window, tool preview
        "llama3-groq-8b-8192-tool-use-preview": 6000, // 8k context window, tool preview
      },
      xai: {
        "grok-beta": 24000, // 131k context window
        "grok-vision-beta": 24000, // 128k context window with vision
      },
    };

    const providerLimits = modelLimits[provider];
    if (!providerLimits) {
      // For Ollama, provide intelligent defaults based on model name patterns
      if (provider === "ollama") {
        return this.getOllamaTokenLimit(model);
      }
      console.warn(`Unknown provider: ${provider}, using default limit`);
      return 6000; // Default fallback
    }

    const limit = providerLimits[model];
    if (!limit) {
      console.warn(
        `Unknown model: ${model} for provider: ${provider}, using default limit`
      );
      return 6000; // Default fallback
    }

    return limit;
  }

  /**
   * Get token limit for Ollama models based on model name patterns
   */
  static getOllamaTokenLimit(model: string): number {
    const modelName = model.toLowerCase();

    // Large models (70B+)
    if (modelName.includes("70b") || modelName.includes("72b")) {
      return 24000; // 128k context
    }

    // Medium-large models (13B-34B)
    if (
      modelName.includes("13b") ||
      modelName.includes("14b") ||
      modelName.includes("34b")
    ) {
      return 16000; // 32k context
    }

    // Medium models (7B-9B)
    if (
      modelName.includes("7b") ||
      modelName.includes("8b") ||
      modelName.includes("9b")
    ) {
      return 12000; // 16k context, conservative
    }

    // Small models (3B-4B)
    if (modelName.includes("3b") || modelName.includes("4b")) {
      return 8000; // 8k context
    }

    // Very small models (1B-2B)
    if (modelName.includes("1b") || modelName.includes("2b")) {
      return 4000; // 4k context
    }

    // Special cases
    if (modelName.includes("code") || modelName.includes("deepseek")) {
      return 16000; // Code models usually have larger context
    }

    if (modelName.includes("qwen")) {
      return 16000; // Qwen models typically have 32k context
    }

    if (modelName.includes("mistral")) {
      return 8000; // Mistral models, conservative
    }

    if (modelName.includes("llama")) {
      return 12000; // Llama models, conservative default
    }

    // Default for unknown Ollama models
    return 8000;
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
  static truncateContext(
    formattedContext: string,
    maxTokens: number = 6000
  ): string {
    const currentTokens = this.estimateTokenCount(formattedContext);

    if (currentTokens <= maxTokens) {
      return formattedContext;
    }

    // Calculate how much we need to reduce
    const targetLength = Math.floor(
      formattedContext.length * (maxTokens / currentTokens)
    );

    // Split into sections
    const sections = formattedContext.split("\n\n");
    let result = "";
    let addedSections = 0;

    // Always include selected text and current page title if they exist
    const selectedTextSection = sections.find((s) =>
      s.startsWith("**Selected Text:**")
    );
    const currentPageSection = sections.find((s) =>
      s.startsWith("**Current Page:")
    );

    if (selectedTextSection) {
      result += selectedTextSection + "\n\n";
    }

    if (currentPageSection) {
      result += currentPageSection + "\n\n";
      addedSections = 1;
    }

    // Add other sections until we approach the limit
    for (const section of sections) {
      if (section === selectedTextSection || section === currentPageSection)
        continue;

      const testResult = result + section + "\n\n";
      if (this.estimateTokenCount(testResult) > targetLength) {
        // If this is page content, try to include partial content
        if (
          section.startsWith("**Page Content:**") ||
          section.startsWith("**Visible Content:**")
        ) {
          const lines = section.split("\n");
          const header = lines[0];
          let partialContent = header + "\n";

          for (let i = 1; i < lines.length; i++) {
            const testPartial =
              result +
              partialContent +
              lines[i] +
              "\n" +
              "... (content truncated)\n\n";
            if (this.estimateTokenCount(testPartial) > targetLength) break;
            partialContent += lines[i] + "\n";
          }

          if (partialContent !== header + "\n") {
            result += partialContent + "... (content truncated)\n\n";
          }
        }
        break;
      }

      result += section + "\n\n";
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
      const pageUrls = this.generatePageUrl(
        context.currentPage.uid,
        graphName || undefined
      );
      const urlLinks = pageUrls
        ? formatUrls(pageUrls.webUrl, pageUrls.desktopUrl)
        : `[[${context.currentPage.title}]]`;

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
      formattedContext += this.formatBlocksForAIWithClickableReferences(
        context.visibleBlocks,
        0,
        graphName,
        isDesktop
      );
      formattedContext += "\n";
    }

    // Add daily note content
    console.log("Daily note check:", {
      hasDailyNote: !!context.dailyNote,
      dailyNoteTitle: context.dailyNote?.title,
      dailyNoteBlocks: context.dailyNote?.blocks?.length || 0,
      dailyNoteBlocksContent:
        context.dailyNote?.blocks?.map((b) => ({
          uid: b.uid,
          string: b.string,
        })) || [],
    });

    if (context.dailyNote && context.dailyNote.blocks.length > 0) {
      const dailyUrls = this.generatePageUrl(
        context.dailyNote.uid,
        graphName || undefined
      );
      const dailyUrlLinks = dailyUrls
        ? formatUrls(dailyUrls.webUrl, dailyUrls.desktopUrl)
        : `[[${context.dailyNote.title}]]`;

      formattedContext += `**Today's Daily Note (${context.dailyNote.title}):** ${dailyUrlLinks}\n`;
      const dailyContent = this.formatBlocksForAIWithClickableReferences(
        context.dailyNote.blocks,
        0,
        graphName,
        isDesktop
      );
      console.log("Formatted daily note content:", dailyContent);
      formattedContext += dailyContent;
      formattedContext += "\n";
    } else if (context.dailyNote) {
      console.log("Daily note found but no blocks:", context.dailyNote);
    } else {
      console.log("No daily note found in context");
    }

    // Add linked references
    if (context.linkedReferences.length > 0) {
      formattedContext += `**Linked References (${context.linkedReferences.length} references):**\n`;
      for (const ref of context.linkedReferences.slice(0, 10)) {
        const blockUrls = this.generateBlockUrl(
          ref.uid,
          graphName || undefined
        );
        const blockUrlLinks = blockUrls
          ? formatUrls(blockUrls.webUrl, blockUrls.desktopUrl)
          : `((${ref.uid}))`;

        formattedContext += `- ${ref.string} ${blockUrlLinks}\n`;
      }
      if (context.linkedReferences.length > 10) {
        formattedContext += `... and ${
          context.linkedReferences.length - 10
        } more references\n`;
      }
      formattedContext += "\n";
    }

    // Add guidance for AI about page references
    formattedContext += `\n\n**IMPORTANT GUIDELINES:**\n`;
    formattedContext += `- Only use page references [[Page Name]] that appear in the context above\n`;
    formattedContext += `- Do NOT create new page references that are not already mentioned\n`;
    formattedContext += `- If you need to mention a concept that doesn't have a page reference in the context, use regular text instead of [[]]\n`;
    formattedContext += `- All [[]] references in your response should be clickable and valid\n`;

    const finalContext = formattedContext.trim();

    console.log("Final formatted context for AI:", finalContext);
    console.log("Context length:", finalContext.length, "characters");

    // Apply truncation if context is too long
    return this.truncateContext(finalContext, maxTokens);
  }

  /**
   * Format blocks recursively for AI with clickable source references
   */
  static formatBlocksForAIWithClickableReferences(
    blocks: RoamBlock[],
    level: number,
    graphName?: string | null,
    isDesktop?: boolean
  ): string {
    let formatted = "";
    const indent = "  ".repeat(level);

    for (const block of blocks) {
      if (block.string.trim()) {
        let blockReference = `((${block.uid}))`;
        let clickableLink = "";

        if (graphName) {
          const blockUrls = this.generateBlockUrl(block.uid, graphName);
          if (blockUrls) {
            if (isDesktop) {
              clickableLink = ` [🔗](${blockUrls.desktopUrl})`;
            } else {
              clickableLink = ` [🔗 Web](${blockUrls.webUrl}) | [🔗 App](${blockUrls.desktopUrl})`;
            }
          }
        }

        formatted += `${indent}- ${block.string} ${blockReference}${clickableLink}\n`;

        if (block.children && block.children.length > 0) {
          formatted += this.formatBlocksForAIWithClickableReferences(
            block.children,
            level + 1,
            graphName,
            isDesktop
          );
        }
      }
    }

    return formatted;
  }

  /**
   * Format blocks recursively for AI with source references (legacy method)
   */
  static formatBlocksForAIWithReferences(
    blocks: RoamBlock[],
    level: number,
    pageTitle?: string
  ): string {
    let formatted = "";
    const indent = "  ".repeat(level);

    for (const block of blocks) {
      if (block.string.trim()) {
        formatted += `${indent}- ${block.string} [Block Reference: ((${block.uid}))]\n`;

        if (block.children && block.children.length > 0) {
          formatted += this.formatBlocksForAIWithReferences(
            block.children,
            level + 1,
            pageTitle
          );
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
        inputDate
          .toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })
          .replace(/\//g, "-"),
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
        `${inputDate.getFullYear()}-${
          inputDate.getMonth() + 1
        }-${inputDate.getDate()}`,
        // With ordinal suffix
        inputDate
          .toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
          .replace(/(\d+)/, (match) => {
            const day = parseInt(match);
            const suffix =
              day % 10 === 1 && day !== 11
                ? "st"
                : day % 10 === 2 && day !== 12
                ? "nd"
                : day % 10 === 3 && day !== 13
                ? "rd"
                : "th";
            return day + suffix;
          }),
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
  static async getNotesFromDateRange(
    startDate: string,
    endDate: string
  ): Promise<RoamPage[]> {
    try {
      const notes: RoamPage[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateString = currentDate.toISOString().split("T")[0];
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

  /**
   * Get page by exact title match (new method for getRoamNotes tool)
   */
  static async getPageByTitle(title: string): Promise<RoamPage | null> {
    try {
      console.log("Getting page by title:", title);

      const query = `
        [:find ?uid
         :where
         [?e :node/title "${title}"]
         [?e :block/uid ?uid]]
      `;

      const result = window.roamAlphaAPI.q(query);
      console.log("Page query result:", result);

      if (result && result.length > 0) {
        const uid = result[0][0];
        const blocks = await this.getPageBlocks(uid);
        return { title, uid, blocks };
      }
      return null;
    } catch (error) {
      console.error("Error getting page by title:", error);
      return null;
    }
  }

  /**
   * Get block by UID (new method for getRoamNotes tool)
   */
  static async getBlockByUid(uid: string): Promise<RoamBlock | null> {
    try {
      console.log("Getting block by UID:", uid);

      const query = `
        [:find ?string
         :where
         [?e :block/uid "${uid}"]
         [?e :block/string ?string]]
      `;

      const result = window.roamAlphaAPI.q(query);
      console.log("Block query result:", result);

      if (result && result.length > 0) {
        const content = result[0][0];
        const children = await this.getBlockChildren(uid);

        return {
          uid,
          string: content,
          children,
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting block by UID:", error);
      return null;
    }
  }

  /**
   * Get blocks that reference a specific page (new method for getRoamNotes tool)
   */
  static async getBlocksReferencingPage(
    pageTitle: string
  ): Promise<RoamBlock[]> {
    try {
      console.log("Getting blocks referencing page:", pageTitle);

      // Multiple query strategies for better coverage
      const queries = [
        // Standard page reference [[PageTitle]]
        `[:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "[[${pageTitle}]]]")]`,

        // Tag reference #PageTitle
        `[:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "#${pageTitle}")]`,

        // Direct reference relationship
        `[:find ?uid ?string
         :where
         [?page :node/title "${pageTitle}"]
         [?block :block/refs ?page]
         [?block :block/uid ?uid]
         [?block :block/string ?string]]`,
      ];

      const allResults: RoamBlock[] = [];
      for (const query of queries) {
        try {
          console.log("Executing reference query:", query);
          const result = window.roamAlphaAPI.q(query);
          console.log("Reference query result:", result);

          if (result) {
            const blocks = result.map(([uid, string]: [string, string]) => ({
              uid,
              string: string || "",
              children: [],
            }));
            allResults.push(...blocks);
          }
        } catch (queryError) {
          console.warn(`Reference query failed:`, queryError);
        }
      }

      // Remove duplicates based on UID
      const uniqueBlocks = allResults.filter(
        (block, index, self) =>
          index === self.findIndex((b) => b.uid === block.uid)
      );

      console.log(
        `Found ${uniqueBlocks.length} unique blocks referencing "${pageTitle}"`
      );
      return uniqueBlocks;
    } catch (error) {
      console.error("Error getting blocks referencing page:", error);
      return [];
    }
  }

  /**
   * Full text search in all notes (new method for getRoamNotes tool)
   */
  static async searchNotesFullText(searchTerm: string): Promise<RoamBlock[]> {
    try {
      console.log("Performing full text search for:", searchTerm);

      const query = `
        [:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? (clojure.string/lower-case ?string) "${searchTerm.toLowerCase()}")]]
      `;

      console.log("Executing search query:", query);
      const result = window.roamAlphaAPI.q(query);
      console.log("Search query result:", result);

      if (!result) return [];

      const searchResults = result.map(([uid, string]: [string, string]) => ({
        uid,
        string: string || "",
        children: [],
      }));

      console.log(
        `Found ${searchResults.length} blocks containing "${searchTerm}"`
      );
      return searchResults;
    } catch (error) {
      console.error("Error in full text search:", error);
      return [];
    }
  }

  /**
   * Unified query method for getRoamNotes tool
   */
  static async queryNotes(params: any): Promise<any> {
    const startTime = performance.now();
    const warnings: string[] = [];
    let notes: any[] = [];
    let queryType = "unknown";

    try {
      console.log("🔍 Executing queryNotes with params:", params);

      // 1. Current page context query
      if (params.currentPageContext) {
        queryType = "current-page";
        const currentPage = await this.getCurrentPageInfo();
        if (currentPage) {
          notes = [currentPage];
        } else {
          warnings.push("无法获取当前页面信息");
        }
      }

      // 2. Specific block query
      else if (params.blockUid) {
        queryType = "block-uid";
        const block = await this.getBlockByUid(params.blockUid);
        if (block) {
          notes = [block];
        } else {
          warnings.push(`未找到 UID 为 ${params.blockUid} 的块`);
        }
      }

      // 3. Page title query
      else if (params.pageTitle) {
        queryType = "page-title";
        const page = await this.getPageByTitle(params.pageTitle);
        if (page) {
          notes = [page];
        } else {
          warnings.push(`未找到标题为 "${params.pageTitle}" 的页面`);
        }
      }

      // 4. Single date query
      else if (params.date) {
        queryType = "single-date";
        const dailyNote = await this.getNotesFromDate(params.date);
        if (dailyNote) {
          notes = [dailyNote];
        } else {
          warnings.push(`未找到 ${params.date} 的每日笔记`);
        }
      }

      // 5. Date range query
      else if (params.startDate && params.endDate) {
        queryType = "date-range";
        const rangeNotes = await this.getNotesFromDateRange(
          params.startDate,
          params.endDate
        );
        notes = rangeNotes;
        if (notes.length === 0) {
          warnings.push(
            `未找到 ${params.startDate} 到 ${params.endDate} 期间的笔记`
          );
        }
      }

      // 6. Referenced page query
      else if (params.referencedPage) {
        queryType = "referenced-page";
        const referencedBlocks = await this.getBlocksReferencingPage(
          params.referencedPage
        );
        notes = referencedBlocks;
        if (notes.length === 0) {
          warnings.push(`未找到引用 "${params.referencedPage}" 的块`);
        }
      }

      // 7. Full text search
      else if (params.searchTerm) {
        queryType = "full-text-search";
        const searchResults = await this.searchNotesFullText(params.searchTerm);
        notes = searchResults;
        if (notes.length === 0) {
          warnings.push(`未找到包含 "${params.searchTerm}" 的内容`);
        }
      }

      // 8. Apply limit
      if (params.limit && notes.length > params.limit) {
        warnings.push(
          `结果已限制为 ${params.limit} 个项目（共找到 ${notes.length} 个）`
        );
        notes = notes.slice(0, params.limit);
      }

      const executionTime = performance.now() - startTime;
      console.log(
        `🔍 queryNotes completed in ${executionTime.toFixed(2)}ms, found ${
          notes.length
        } results`
      );

      return {
        success: true,
        data: notes,
        totalFound: notes.length,
        executionTime,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          queryType,
          dateRange:
            params.startDate && params.endDate
              ? `${params.startDate} to ${params.endDate}`
              : undefined,
          sourcePage: params.pageTitle || params.referencedPage,
        },
      };
    } catch (error: any) {
      console.error("❌ Error in queryNotes:", error);
      return {
        success: false,
        data: [],
        totalFound: 0,
        executionTime: performance.now() - startTime,
        warnings: [`查询失败: ${error.message}`],
        metadata: { queryType },
      };
    }
  }
}
