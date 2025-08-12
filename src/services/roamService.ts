// src/services/roamService.ts
import { RoamBlock, RoamPage, PageContext, UniversalSearchResult, UniversalSearchResponse } from "../types";
import { LLMUtil } from "../utils/llmUtil";

export class RoamService {
  // Cache for frequently accessed data
  private static graphNameCache: { value: string | null; timestamp: number } | null = null;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get the current graph name
   */
  static getCurrentGraphName(): string | null {
    // Check cache first
    if (this.graphNameCache && 
        Date.now() - this.graphNameCache.timestamp < this.CACHE_DURATION) {
      return this.graphNameCache.value;
    }
    
    try {
      // Getting graph name from URL (only log in development)
      if (process.env.NODE_ENV === 'development') {
        console.log("Getting graph name from URL:", window.location.href);
      }

      // Try to get graph name from URL - check both href and hash
      const urlMatch = window.location.href.match(/\/app\/([^\/\?#]+)/);
      if (urlMatch) {
        const graphName = decodeURIComponent(urlMatch[1]);
        // Cache the result
        this.graphNameCache = { value: graphName, timestamp: Date.now() };
        return graphName;
      }

      // Try to get from hash (Roam often uses hash routing)
      const hashMatch = window.location.hash.match(/\/app\/([^\/\?#]+)/);
      if (hashMatch) {
        return decodeURIComponent(hashMatch[1]);
      }

      // Fallback: try to get from roam API or other methods
      // Some roam installations might have different URL patterns
      const pathMatch = window.location.pathname.match(/\/app\/([^\/\?#]+)/);
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
      }

      // Try alternative patterns - first check for roam:// protocol
      const roamProtocolMatch = window.location.href.match(
        /roam:\/\/#\/app\/([^\/\?#]+)/
      );
      if (roamProtocolMatch) {
        return decodeURIComponent(roamProtocolMatch[1]);
      }

      // Try alternative patterns for web
      const altMatch = window.location.href.match(/#\/app\/([^\/\?#]+)/);
      if (altMatch) {
        return decodeURIComponent(altMatch[1]);
      }

      // Try to get from Roam API if available
      if (window.roamAlphaAPI && (window.roamAlphaAPI as any).graph) {
        try {
          const graphName = (window.roamAlphaAPI as any).graph.name;
          if (graphName) {
            return graphName;
          }
        } catch (apiError) {
          // Could not get graph name from API - continue with other methods
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
      
      // Cache the null result to avoid repeated expensive operations
      this.graphNameCache = { value: null, timestamp: Date.now() };
      return null;
    } catch (error) {
      console.error("Error getting graph name:", error);
      this.graphNameCache = { value: null, timestamp: Date.now() };
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

      // First, check if we have sidebar notes (they take priority as context)
      // Instead of trying to pick one "active" page, we'll let all sidebar notes 
      // contribute to context via the getSidebarNotes() method in getPageContext()
      const sidebarNotes = await this.getSidebarNotes();
      if (sidebarNotes && sidebarNotes.length > 0) {
        // Found sidebar notes - using main window as current page
        // Continue to get main window page, sidebar notes will be included in context separately
      }

      // Try to get from main window API (might be async)
      const apiResult =
        window.roamAlphaAPI?.ui?.mainWindow?.getOpenPageOrBlockUid?.();
      if (apiResult && typeof apiResult === "object" && "then" in apiResult) {
        currentPageUid = await apiResult;
      } else {
        currentPageUid = apiResult || null;
      }

      // Got current page UID from main window API

      if (!currentPageUid) {
        // Fallback: try to get from URL
        const urlMatch = window.location.href.match(/\/page\/([^/?]+)/);
        if (urlMatch) {
          currentPageUid = decodeURIComponent(urlMatch[1]);
        }
      }

      if (!currentPageUid) {
        // Fallback: try to get from document title or other methods
        const titleElement = document.querySelector(".rm-title-display");
        if (titleElement) {
          title = titleElement.textContent || "";

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
            }
          }
        }
      }

      if (!currentPageUid) {
        // No current page UID found
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

      // Got final page info

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

  // The getActiveSidebarPageInfo and findMostActiveSidebarWindow methods have been removed
  // as we now include ALL sidebar notes in the context instead of trying to pick one "active" page

  /**
   * Fallback method to detect active sidebar page from DOM
   */
  static async getActiveSidebarPageFromDOM(): Promise<RoamPage | null> {
    try {
      console.log("🔍 Checking DOM for active sidebar page...");
      
      // Look for the right sidebar
      const rightSidebar = document.querySelector("#roam-right-sidebar-content") || 
                          document.querySelector(".roam-sidebar-container") ||
                          document.querySelector("[data-testid='right-sidebar']");
      
      if (!rightSidebar) {
        console.log("❌ No right sidebar found in DOM");
        return null;
      }
      
      // Look for all visible page titles in the sidebar
      const titleElements = rightSidebar.querySelectorAll(".rm-title-display");
      
      if (titleElements.length > 0) {
        // Get all visible titles
        const visibleTitles = Array.from(titleElements).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        
        if (visibleTitles.length > 0) {
          // Just return the first visible one for fallback, 
          // but the real value is in getSidebarNotes() which gets all of them
          const firstVisibleTitle = visibleTitles[0];
          const pageTitle = firstVisibleTitle.textContent?.trim();
          
          if (pageTitle) {
            console.log("🔍 Found fallback sidebar page title:", pageTitle);
            const page = await this.getPageByTitle(pageTitle);
            if (page) {
              console.log("✅ Successfully got fallback sidebar page from DOM:", pageTitle);
              return page;
            }
          }
        }
      }
      
      console.log("❌ No sidebar page titles found in DOM");
      return null;
    } catch (error) {
      console.error("❌ Error getting active sidebar page from DOM:", error);
      return null;
    }
  }

  /**
   * Get all blocks for a page
   */
  static async getPageBlocks(pageUid: string): Promise<RoamBlock[]> {
    try {
      // Getting blocks for page

      // Ensure pageUid is a string, not a Promise
      const resolvedPageUid = await Promise.resolve(pageUid);

      if (!resolvedPageUid) {
        // No valid page UID provided
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
        result = window.roamAlphaAPI.q(queries[i]);
        if (result && result.length > 0) {
          break;
        }
      }

      if (!result || result.length === 0) {
        // No blocks found with any query
        return [];
      }

      const blocks: RoamBlock[] = result.map((row: any[]) => ({
        uid: row[0],
        string: row[1] || "",
        order: row[2] || 0,
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
      // Get all visible block elements with performance optimization
      const blockElements = document.querySelectorAll(
        ".roam-block[data-block-uid]"
      );
      
      // Early return if no blocks found
      if (blockElements.length === 0) {
        return visibleBlocks;
      }

      // Use requestAnimationFrame for better performance
      const processBlocks = () => {
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
      };
      
      processBlocks();
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
      if (!selection || selection.rangeCount === 0) {
        return "";
      }
      
      const selectedText = selection.toString().trim();
      // Limit selection length to prevent memory issues
      return selectedText.length > 5000 ? selectedText.substring(0, 5000) + "..." : selectedText;
    } catch (error) {
      console.error("Error getting selected text:", error);
      return "";
    }
  }

  /**
   * Get current daily note (either today's or the currently opened daily note)
   */
  static async getCurrentDailyNote(): Promise<RoamPage | null> {
    try {
      // First, check if the current page is already a daily note
      const currentPage = await this.getCurrentPageInfo();
      if (currentPage && this.isDailyNotePage(currentPage.title)) {
        console.log("Current page is already a daily note:", currentPage.title);
        return currentPage; // Return the current daily note page
      }

      // If current page is not a daily note, get today's daily note as fallback
      const today = new Date();
      const todayISO = today.toISOString().split("T")[0];
      const roamDateFormat = LLMUtil.convertToRoamDateFormat(todayISO);
      
      console.log("Looking for today's daily note:", roamDateFormat);

      const dateFormats = [
        roamDateFormat, // Standard Roam format: "July 10th, 2025"
        todayISO, // yyyy-mm-dd
        today.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit", 
          year: "numeric",
        }).replace(/\//g, "-"), // MM-dd-yyyy
        today.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric", 
          year: "numeric",
        }), // Month dd, yyyy (without ordinal)
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
        if (result && result.length > 0) {
          const uid = result[0][0];
          const blocks = await this.getPageBlocks(uid);

          return {
            title: roamDateFormat, // Always return in standard Roam format
            uid,
            blocks,
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting current daily note:", error);
      return null;
    }
  }

  /**
   * Get sidebar notes (pages opened in right sidebar)
   */
  static async getSidebarNotes(): Promise<RoamPage[]> {
    try {
      console.log("🔍 Getting sidebar notes...");

      // Try to get sidebar windows from Roam API first (more reliable)
      if (!window.roamAlphaAPI?.ui?.rightSidebar?.getWindows) {
        console.log("❌ Sidebar getWindows API not available, trying DOM fallback");
        return this.getSidebarNotesFromDOM();
      }

      const sidebarWindows = window.roamAlphaAPI.ui.rightSidebar.getWindows();
      console.log("🔍 Sidebar windows from API:", sidebarWindows);
      console.log("🔍 Raw sidebar windows data:", JSON.stringify(sidebarWindows, null, 2));

      if (!sidebarWindows || sidebarWindows.length === 0) {
        console.log("❌ No sidebar windows found via API, trying DOM fallback");
        return this.getSidebarNotesFromDOM();
      }

      const sidebarNotes: RoamPage[] = [];
      const processedUids = new Set<string>();
      
      for (const sidebarWindow of sidebarWindows) {
        try {
          console.log("🔍 Processing sidebar window:", sidebarWindow);
          console.log("🔍 Window keys:", Object.keys(sidebarWindow));
          console.log("🔍 Window page-uid:", sidebarWindow["page-uid"]);
          console.log("🔍 Window block-uid:", sidebarWindow["block-uid"]);
          
          if (sidebarWindow["page-uid"]) {
            // This is a page window
            const pageUid = sidebarWindow["page-uid"];
            if (!processedUids.has(pageUid)) {
              processedUids.add(pageUid);
              console.log("🔍 Found page window with UID:", pageUid);
              
              // Add a small delay to ensure the page is fully loaded
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Get page by UID
              const blocks = await this.getPageBlocks(pageUid);
              
              // Try to get the page title
              const titleQuery = `
                [:find ?title
                 :where
                 [?e :block/uid "${pageUid}"]
                 [?e :node/title ?title]]
              `;
              
              const titleResult = window.roamAlphaAPI.q(titleQuery);
              let pageTitle = "";
              
              if (titleResult && titleResult.length > 0) {
                pageTitle = titleResult[0][0];
              } else {
                // Fallback: try to get title from blocks
                console.log("🔍 Trying to get title from daily note format");
                const dailyQuery = `
                  [:find ?title
                   :where
                   [?e :block/uid "${pageUid}"]
                   [?e :block/string ?title]]
                `;
                const dailyResult = window.roamAlphaAPI.q(dailyQuery);
                if (dailyResult && dailyResult.length > 0) {
                  pageTitle = dailyResult[0][0];
                }
              }
              
              if (pageTitle) {
                const page: RoamPage = {
                  title: pageTitle,
                  uid: pageUid,
                  blocks,
                };
                sidebarNotes.push(page);
                console.log("✅ Added page to sidebar notes:", pageTitle);
              }
            }
          } else if (sidebarWindow["block-uid"]) {
            // This is a block window, get the parent page
            const blockUid = sidebarWindow["block-uid"];
            console.log("🔍 Found block window with UID:", blockUid);
            
            const parentPageTitle = await this.getParentPageTitleForBlock(blockUid);
            if (parentPageTitle) {
              console.log("🔍 Block belongs to page:", parentPageTitle);
              const page = await this.getPageByTitle(parentPageTitle);
              if (page && !processedUids.has(page.uid)) {
                processedUids.add(page.uid);
                sidebarNotes.push(page);
                console.log("✅ Added block's page to sidebar notes:", parentPageTitle);
              }
            }
          }
        } catch (windowError) {
          console.warn("❌ Error processing sidebar window:", windowError);
        }
      }

      console.log(`✅ Found ${sidebarNotes.length} sidebar notes via API`);
      
      // If API didn't find any notes, try DOM fallback
      if (sidebarNotes.length === 0) {
        console.log("🔄 No sidebar notes from API, trying DOM fallback...");
        const domNotes = await this.getSidebarNotesFromDOM();
        console.log(`🔍 DOM fallback found ${domNotes.length} notes`);
        return domNotes;
      }
      
      return sidebarNotes;
    } catch (error) {
      console.error("❌ Error getting sidebar notes:", error);
      return this.getSidebarNotesFromDOM();
    }
  }

  /**
   * Fallback method to detect sidebar notes from DOM
   */
  static async getSidebarNotesFromDOM(): Promise<RoamPage[]> {
    try {
      console.log("🔍 Getting sidebar notes from DOM...");
      
      const sidebarNotes: RoamPage[] = [];
      
      // Look for the right sidebar - check common selectors
      const rightSidebar = document.querySelector("#roam-right-sidebar-content") || 
                          document.querySelector(".roam-sidebar-container") ||
                          document.querySelector("[data-testid='right-sidebar']");
      
      if (!rightSidebar) {
        console.log("❌ No right sidebar found in DOM");
        return [];
      }
      
      console.log("✅ Found right sidebar container");
      
      // Look for page title elements in the sidebar
      const pageTitleElements = rightSidebar.querySelectorAll(".rm-title-display");
      console.log(`🔍 Found ${pageTitleElements.length} page title elements in sidebar`);
      
      const processedTitles = new Set<string>();
      
      for (const titleElement of pageTitleElements) {
        try {
          const pageTitle = titleElement.textContent?.trim();
          
          if (pageTitle && pageTitle !== "" && !processedTitles.has(pageTitle)) {
            processedTitles.add(pageTitle);
            console.log("🔍 Found sidebar page title:", pageTitle);
            
            const page = await this.getPageByTitle(pageTitle);
            if (page) {
              sidebarNotes.push(page);
              console.log("✅ Added page to sidebar notes:", pageTitle);
            }
          }
        } catch (elementError) {
          console.warn("❌ Error processing title element:", elementError);
        }
      }

      console.log(`✅ Found ${sidebarNotes.length} sidebar notes via DOM`);
      return sidebarNotes;
    } catch (error) {
      console.error("❌ Error getting sidebar notes from DOM:", error);
      return [];
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
    // Getting comprehensive page context

    const [currentPage, visibleBlocks, selectedText, dailyNote, sidebarNotes] =
      await Promise.all([
        this.getCurrentPageInfo(),
        Promise.resolve(this.getVisibleBlocks()),
        Promise.resolve(this.getSelectedText()),
        this.getCurrentDailyNote(),
        this.getSidebarNotes(),
      ]);

    // Get linked references if we have a current page
    let linkedReferences: RoamBlock[] = [];
    if (currentPage) {
      linkedReferences = await this.getLinkedReferences(currentPage.title);
    }

    // Log page context summary only in development
    if (process.env.NODE_ENV === 'development') {
      console.log("Page context summary:", {
        currentPage: currentPage?.title || "None",
        visibleBlocks: visibleBlocks.length,
        sidebarNotes: sidebarNotes.length,
      });
    }
    
    // Debug sidebar notes only in development mode
    if (process.env.NODE_ENV === 'development' && sidebarNotes && sidebarNotes.length === 0) {
      console.log("❌ No sidebar notes in context");
    }

    const contextResult = {
      currentPage: currentPage || undefined,
      visibleBlocks,
      selectedText: selectedText || undefined,
      dailyNote: dailyNote || undefined,
      linkedReferences,
      sidebarNotes,
    };
    
    // Final context ready
    
    return contextResult;
  }

  /**
   * Get minimal page context for tool calls (to avoid interference)
   */
  static async getToolCallContext(): Promise<PageContext> {
    console.log("🎯 Getting minimal context for tool call...");

    // Only get selected text to avoid context contamination
    const selectedText = this.getSelectedText();
    
    // For debugging: get current page info but don't include it in context
    const currentPage = await this.getCurrentPageInfo();
    
    console.log("🎯 Tool call context summary:", {
      selectedText: selectedText ? `Yes (${selectedText.length} chars)` : "No",
      currentPage: currentPage?.title || "None",
      strategy: "minimal - selected text only"
    });

    // Return ultra-minimal context to avoid AI confusion
    return {
      currentPage: undefined, // Explicitly skip to avoid date confusion
      visibleBlocks: [], // Skip all visible content
      selectedText: selectedText || undefined, // Only include if actually selected
      dailyNote: undefined, // Skip daily note context
      linkedReferences: [], // Skip all references
      sidebarNotes: [], // Skip sidebar notes
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

    // Special cases - check model families first before parameter size
    if (modelName.includes("qwen")) {
      return 24000; // Qwen models typically have 32k context, using 24k for safety
    }

    if (modelName.includes("deepseek")) {
      return 48000; // DeepSeek models have 64k context, using 48k for safety
    }

    if (modelName.includes("code") || modelName.includes("coder")) {
      return 16000; // Code models usually have larger context
    }

    if (modelName.includes("mistral")) {
      return 16000; // Mistral models, updated to be more generous
    }

    if (modelName.includes("llama")) {
      return 16000; // Llama models, updated to be more generous
    }

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

    // For tool calls, use ultra-minimal context
    const isToolCallContext = !context.currentPage && !context.dailyNote && 
                             context.visibleBlocks.length === 0 && 
                             context.linkedReferences.length === 0 &&
                             (!context.sidebarNotes || context.sidebarNotes.length === 0);

    if (isToolCallContext) {
      console.log("🎯 Formatting minimal tool call context");
      
      if (context.selectedText) {
        formattedContext += `**Selected Text:**\n${context.selectedText}\n\n`;
      }
      
      // Add minimal guidance
      formattedContext += `**Context Note:** This is minimal context for tool execution to avoid interference.\n`;
      
      const finalContext = formattedContext.trim();
      console.log("🎯 Minimal context length:", finalContext.length, "characters");
      return finalContext;
    }

    // Standard context formatting for regular queries
    console.log("📋 Formatting full context for regular query");

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

    // Add sidebar notes
    if (context.sidebarNotes && context.sidebarNotes.length > 0) {
      formattedContext += `**Sidebar Notes (${context.sidebarNotes.length} open):**\n`;
      for (const sidebarNote of context.sidebarNotes.slice(0, 5)) { // Limit to first 5 to avoid context bloat
        const sidebarUrls = this.generatePageUrl(
          sidebarNote.uid,
          graphName || undefined
        );
        const sidebarUrlLinks = sidebarUrls
          ? formatUrls(sidebarUrls.webUrl, sidebarUrls.desktopUrl)
          : `[[${sidebarNote.title}]]`;

        formattedContext += `**Sidebar: "${sidebarNote.title}"** ${sidebarUrlLinks}\n`;
        
        if (sidebarNote.blocks.length > 0) {
          const sidebarContent = this.formatBlocksForAIWithClickableReferences(
            sidebarNote.blocks.slice(0, 10), // Limit to first 10 blocks per sidebar note
            0,
            graphName,
            isDesktop
          );
          formattedContext += sidebarContent;
        }
        formattedContext += "\n";
      }
      if (context.sidebarNotes.length > 5) {
        formattedContext += `... and ${context.sidebarNotes.length - 5} more sidebar notes\n`;
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

    console.log("📋 Final formatted context for AI:", finalContext);
    console.log("📋 Context length:", finalContext.length, "characters");

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
      console.log("🗓️ Getting notes from date:", dateString);

      // Validate input date
      const inputDate = new Date(dateString);
      if (isNaN(inputDate.getTime())) {
        console.error("❌ Invalid date string:", dateString);
        return null;
      }

      // Use the improved date format generation from LLMUtil
      const dateFormats = LLMUtil.generateRoamDateFormats(dateString);

      for (const format of dateFormats) {
        console.log("🔍 Trying date format:", format);

        const query = `
          [:find ?uid
           :where
           [?e :node/title "${format}"]
           [?e :block/uid ?uid]]
        `;

        const result = window.roamAlphaAPI.q(query);
        console.log("📊 Query result for", format, ":", result);

        if (result && result.length > 0) {
          const uid = result[0][0];
          const blocks = await this.getPageBlocks(uid);

          console.log("✅ Found daily note:", { format, uid, blockCount: blocks.length });
          return {
            title: format,
            uid,
            blocks,
          };
        }
      }

      console.log("❌ No daily note found for date:", dateString);
      return null;
    } catch (error) {
      console.error("❌ Error getting notes from date:", error);
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
         [(clojure.string/includes? ?string "[[${pageTitle}]]")]`,

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
          warnings.push("Unable to get current page information");
        }
      }

      // 2. Specific block query
      else if (params.blockUid) {
        queryType = "block-uid";
        const block = await this.getBlockByUid(params.blockUid);
        if (block) {
          notes = [block];
        } else {
          warnings.push(`Block with UID ${params.blockUid} not found`);
        }
      }

      // 3. Page title query
      else if (params.pageTitle) {
        queryType = "page-title";
        const page = await this.getPageByTitle(params.pageTitle);
        if (page) {
          notes = [page];
        } else {
          warnings.push(`Page with title "${params.pageTitle}" not found`);
        }
      }

      // 4. Single date query
      else if (params.date) {
        queryType = "single-date";
        const dailyNote = await this.getNotesFromDate(params.date);
        if (dailyNote) {
          notes = [dailyNote];
        } else {
          warnings.push(`Daily note for ${params.date} not found`);
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
            `No notes found between ${params.startDate} and ${params.endDate}`
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
          warnings.push(`No blocks found referencing "${params.referencedPage}"`);
        }
      }

      // 7. Full text search
      else if (params.searchTerm) {
        queryType = "full-text-search";
        const searchResults = await this.searchNotesFullText(params.searchTerm);
        notes = searchResults;
        if (notes.length === 0) {
          warnings.push(`No content found containing "${params.searchTerm}"`);
        }
      }

      // 8. Apply limit
      if (params.limit && notes.length > params.limit) {
        warnings.push(
          `Results limited to ${params.limit} items (found ${notes.length} total)`
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
        warnings: [`Query failed: ${error.message}`],
        metadata: { queryType },
      };
    }
  }

  /**
   * Search for pages by title (for bracket autocomplete)
   */
  static async searchPages(searchTerm: string, limit: number = 10): Promise<Array<{ title: string; uid: string }>> {
    try {
      if (!searchTerm.trim()) {
        // Return some recent pages when no search term
        return this.getAllPageTitles(limit);
      }

      const lowerSearchTerm = searchTerm.toLowerCase();
      console.log(`🔍 Searching pages for: "${searchTerm}"`);

      // First, get all pages and filter in JavaScript to avoid Datalog escaping issues
      const allPagesQuery = `
        [:find ?title ?uid
         :where
         [?e :node/title ?title]
         [?e :block/uid ?uid]]
      `;

      const result = window.roamAlphaAPI.q(allPagesQuery);
      if (!result || result.length === 0) {
        console.log("No pages found in database");
        return [];
      }

      // Filter and convert result to page objects
      const allPages = result.map(([title, uid]: [string, string]) => ({ title, uid }));
      
      // Debug: show a few page titles to understand the data
      console.log(`Sample page titles:`, allPages.slice(0, 10).map(p => p.title));
      
      // Debug: look for pages that might contain our search term
      const candidatePages = allPages.filter(page => 
        page.title.toLowerCase().includes('claude') || 
        page.title.toLowerCase().includes('code')
      );
      console.log(`Pages containing 'claude' or 'code':`, candidatePages.map(p => p.title));
      
      // More flexible search: split search term and match each part
      const searchWords = lowerSearchTerm.split(/[-\s]+/).filter(word => word.length > 0);
      console.log(`Search words:`, searchWords);
      
      const pages = allPages.filter(page => {
        const pageTitle = page.title.toLowerCase();
        // Match if all search words are found in the title
        const matches = searchWords.every(word => pageTitle.includes(word));
        
        // Debug specific pages for troubleshooting
        if (pageTitle.includes('claude')) {
          console.log(`Checking page "${page.title}": searchWords=[${searchWords.join(', ')}], matches=${matches}`);
        }
        
        return matches;
      });

      console.log(`Found ${pages.length} matching pages out of ${result.length} total pages`);

      if (pages.length === 0) {
        console.log(`No pages found for search term: "${searchTerm}"`);
        return [];
      }

      // Sort by relevance: exact match first, then starts with, then contains
      pages.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        
        // Exact match
        if (aTitle === lowerSearchTerm && bTitle !== lowerSearchTerm) return -1;
        if (bTitle === lowerSearchTerm && aTitle !== lowerSearchTerm) return 1;
        
        // Starts with
        if (aTitle.startsWith(lowerSearchTerm) && !bTitle.startsWith(lowerSearchTerm)) return -1;
        if (bTitle.startsWith(lowerSearchTerm) && !aTitle.startsWith(lowerSearchTerm)) return 1;
        
        // Alphabetical for similar relevance
        return aTitle.localeCompare(bTitle);
      });

      const limitedResults = pages.slice(0, limit);
      console.log(`Returning ${limitedResults.length} results:`, limitedResults.map(p => p.title));
      
      return limitedResults;
    } catch (error) {
      console.error("Error searching pages:", error);
      return [];
    }
  }

  /**
   * Get all page titles (for initial page list)
   */
  static async getAllPageTitles(limit: number = 50): Promise<Array<{ title: string; uid: string }>> {
    try {
      console.log("🔍 Getting all page titles");

      const query = `
        [:find ?title ?uid
         :where
         [?e :node/title ?title]
         [?e :block/uid ?uid]]
      `;

      const result = window.roamAlphaAPI.q(query);
      if (!result || result.length === 0) {
        console.log("No pages found");
        return [];
      }

      // Convert to page objects and sort alphabetically
      const pages = result.map(([title, uid]: [string, string]) => ({
        title,
        uid
      }));

      pages.sort((a, b) => a.title.localeCompare(b.title));

      const limitedResults = pages.slice(0, limit);
      console.log(`Found ${pages.length} pages, returning ${limitedResults.length}`);
      
      return limitedResults;
    } catch (error) {
      console.error("Error getting all page titles:", error);
      return [];
    }
  }

  /**
   * Universal search that combines page titles and block content search
   * Used for @ symbol triggered search feature
   */
  static async universalSearch(searchTerm: string, limit: number = 10): Promise<UniversalSearchResponse> {
    const startTime = Date.now();
    console.log(`🔍 UniversalSearch called with: "${searchTerm}", limit: ${limit}`);

    if (!searchTerm || searchTerm.trim().length === 0) {
      return {
        results: [],
        totalFound: 0,
        searchTerm: searchTerm,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Run page and block searches in parallel for better performance
      const [pageResults, blockResults] = await Promise.all([
        this.searchPagesForUniversal(searchTerm, Math.ceil(limit * 0.6)), // Prefer pages slightly
        this.searchBlocksForUniversal(searchTerm, Math.ceil(limit * 0.7)), // Allow some overlap
      ]);

      // Combine and sort results by relevance
      const allResults = [...pageResults, ...blockResults];
      const sortedResults = this.sortUniversalSearchResults(allResults, searchTerm);
      const limitedResults = sortedResults.slice(0, limit);

      const executionTime = Date.now() - startTime;
      console.log(`🔍 UniversalSearch completed: ${limitedResults.length} results in ${executionTime}ms`);

      return {
        results: limitedResults,
        totalFound: allResults.length,
        searchTerm: searchTerm,
        executionTime: executionTime,
      };
    } catch (error) {
      console.error("Error in universal search:", error);
      return {
        results: [],
        totalFound: 0,
        searchTerm: searchTerm,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Enhanced page search that matches Roam's native search behavior
   */
  private static async searchPagesForUniversal(searchTerm: string, limit: number): Promise<UniversalSearchResult[]> {
    try {
      if (!window.roamAlphaAPI?.q) {
        console.warn("Roam API not available for page search");
        return [];
      }

      const lowerSearchTerm = searchTerm.toLowerCase().trim();
      
      // Use the proven working method: get all pages first, then filter in JavaScript
      const allPagesQuery = `
        [:find ?title ?uid
         :where
         [?e :node/title ?title]
         [?e :block/uid ?uid]]
      `;

      const result = await window.roamAlphaAPI.q(allPagesQuery);
      
      if (!result || result.length === 0) {
        console.log("No pages found in database");
        return [];
      }

      // Convert to our format
      const allPages = result.map((row: any[]) => ({
        title: row[0] as string,
        uid: row[1] as string,
      }));

      console.log(`🔍 Found ${allPages.length} total pages`);

      // Filter pages that match the search term
      const matchingPages = allPages.filter(page => {
        const pageTitle = page.title.toLowerCase();
        return pageTitle.includes(lowerSearchTerm);
      });

      console.log(`🔍 Found ${matchingPages.length} matching pages for "${searchTerm}"`);

      // Apply Roam-like relevance sorting
      const sortedPages = this.sortPagesByRelevance(matchingPages, searchTerm);
      const limitedPages = sortedPages.slice(0, limit);

      return limitedPages.map(page => {
        const isDaily = this.isDailyNotePage(page.title);
        return {
          type: isDaily ? "daily-note" as const : "page" as const,
          uid: page.uid,
          title: page.title,
          preview: page.title,
          highlightedText: this.highlightSearchTerm(page.title, searchTerm),
        };
      });
    } catch (error) {
      console.error("Error searching pages for universal search:", error);
      return [];
    }
  }

  /**
   * Enhanced block search that matches Roam's native search behavior
   */
  private static async searchBlocksForUniversal(searchTerm: string, limit: number): Promise<UniversalSearchResult[]> {
    try {
      // Use the existing working searchNotesFullText method
      const blockResults = await this.searchNotesFullText(searchTerm);
      
      if (!blockResults || blockResults.length === 0) {
        console.log(`🔍 No blocks found for "${searchTerm}"`);
        return [];
      }

      console.log(`🔍 Found ${blockResults.length} matching blocks for "${searchTerm}"`);

      // Apply relevance sorting
      const sortedBlocks = this.sortBlocksByRelevance(blockResults, searchTerm);
      const limitedBlocks = sortedBlocks.slice(0, limit);
      
      // Get parent page titles for blocks in parallel
      const resultsWithPages = await Promise.all(
        limitedBlocks.map(async (block) => {
          const parentPageTitle = await this.getParentPageTitleForBlock(block.uid);
          const preview = this.formatBlockPreview(block.string, 80);
          
          return {
            type: "block" as const,
            uid: block.uid,
            content: block.string,
            preview: preview,
            pageTitle: parentPageTitle,
            highlightedText: this.highlightSearchTerm(preview, searchTerm),
          };
        })
      );

      return resultsWithPages;
    } catch (error) {
      console.error("Error searching blocks for universal search:", error);
      return [];
    }
  }

  /**
   * Get the parent page title for a block UID
   */
  static async getParentPageTitleForBlock(blockUid: string): Promise<string | undefined> {
    try {
      if (!window.roamAlphaAPI?.q) {
        console.warn("Roam API not available for getting parent page title");
        return undefined;
      }

      // Query to find the page that contains this block
      const pageQuery = `
        [:find ?title
         :where
         [?page :node/title ?title]
         [?page :block/children ?child]
         [?child :block/uid "${blockUid}"]]
      `;

      const result = await window.roamAlphaAPI.q(pageQuery);
      
      if (result && result.length > 0) {
        return result[0][0] as string;
      }

      // If direct child query fails, try to find through parent hierarchy
      const hierarchyQuery = `
        [:find ?title
         :where
         [?block :block/uid "${blockUid}"]
         [?parent :block/children ?block]
         [?page :block/children ?parent]
         [?page :node/title ?title]]
      `;

      const hierarchyResult = await window.roamAlphaAPI.q(hierarchyQuery);
      
      if (hierarchyResult && hierarchyResult.length > 0) {
        return hierarchyResult[0][0] as string;
      }

      return undefined;
    } catch (error) {
      console.error("Error getting parent page title for block:", blockUid, error);
      return undefined;
    }
  }

  /**
   * Check if a page title represents a daily note
   */
  private static isDailyNotePage(title: string): boolean {
    // Roam daily notes typically follow formats like:
    // "January 1st, 2024", "01-01-2024", "2024-01-01", etc.
    const dailyNotePatterns = [
      /^\w+ \d{1,2}(st|nd|rd|th), \d{4}$/, // "January 1st, 2024"
      /^\d{1,2}-\d{1,2}-\d{4}$/, // "01-01-2024"
      /^\d{4}-\d{1,2}-\d{1,2}$/, // "2024-01-01"
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // "01/01/2024"
    ];
    
    return dailyNotePatterns.some(pattern => pattern.test(title));
  }

  /**
   * Format block content for preview display
   */
  private static formatBlockPreview(content: string, maxLength: number = 60): string {
    if (!content) return "";
    
    // Remove Roam markup for cleaner preview
    let cleaned = content
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove page links
      .replace(/\(\(([^)]+)\)\)/g, '') // Remove block references
      .replace(/#\[\[([^\]]+)\]\]/g, '#$1') // Simplify hashtags
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
      .replace(/`([^`]+)`/g, '$1') // Remove code
      .trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength - 3) + "...";
  }

  /**
   * Highlight search term in text for display
   */
  private static highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Sort pages by relevance using Roam-like algorithm
   */
  private static sortPagesByRelevance(pages: Array<{title: string; uid: string}>, searchTerm: string): Array<{title: string; uid: string}> {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    return pages.sort((a, b) => {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();
      
      // Exact match has highest priority
      if (titleA === lowerSearchTerm && titleB !== lowerSearchTerm) return -1;
      if (titleB === lowerSearchTerm && titleA !== lowerSearchTerm) return 1;
      
      // Case-insensitive exact match
      if (titleA === lowerSearchTerm && titleB === lowerSearchTerm) {
        return a.title.localeCompare(b.title);
      }
      
      // Starts with search term
      const startsA = titleA.startsWith(lowerSearchTerm);
      const startsB = titleB.startsWith(lowerSearchTerm);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;
      
      if (startsA && startsB) {
        // Both start with search term, prefer shorter titles
        return titleA.length - titleB.length;
      }
      
      // Word boundary matching (search term at start of a word)
      const wordBoundaryA = new RegExp(`\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(titleA);
      const wordBoundaryB = new RegExp(`\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(titleB);
      if (wordBoundaryA && !wordBoundaryB) return -1;
      if (!wordBoundaryA && wordBoundaryB) return 1;
      
      // Position of match (earlier position = higher relevance)
      const posA = titleA.indexOf(lowerSearchTerm);
      const posB = titleB.indexOf(lowerSearchTerm);
      if (posA !== posB) return posA - posB;
      
      // Prefer shorter titles
      if (titleA.length !== titleB.length) {
        return titleA.length - titleB.length;
      }
      
      // Alphabetical as final tie-breaker
      return titleA.localeCompare(titleB);
    });
  }

  /**
   * Sort blocks by relevance using Roam-like algorithm
   */
  private static sortBlocksByRelevance(blocks: Array<{uid: string; string: string}>, searchTerm: string): Array<{uid: string; string: string}> {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    return blocks.sort((a, b) => {
      const contentA = a.string.toLowerCase();
      const contentB = b.string.toLowerCase();
      
      // Exact match has highest priority
      if (contentA === lowerSearchTerm && contentB !== lowerSearchTerm) return -1;
      if (contentB === lowerSearchTerm && contentA !== lowerSearchTerm) return 1;
      
      // Word boundary matching
      const wordBoundaryA = new RegExp(`\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(contentA);
      const wordBoundaryB = new RegExp(`\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(contentB);
      if (wordBoundaryA && !wordBoundaryB) return -1;
      if (!wordBoundaryA && wordBoundaryB) return 1;
      
      // Position of match (earlier position = higher relevance)
      const posA = contentA.indexOf(lowerSearchTerm);
      const posB = contentB.indexOf(lowerSearchTerm);
      if (posA !== posB) return posA - posB;
      
      // Prefer shorter content (more focused)
      if (contentA.length !== contentB.length) {
        return contentA.length - contentB.length;
      }
      
      // Alphabetical as final tie-breaker
      return contentA.localeCompare(contentB);
    });
  }

  /**
   * Sort universal search results by relevance
   */
  private static sortUniversalSearchResults(results: UniversalSearchResult[], searchTerm: string): UniversalSearchResult[] {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return results.sort((a, b) => {
      // Get text to compare for each result
      const textA = (a.title || a.preview || "").toLowerCase();
      const textB = (b.title || b.preview || "").toLowerCase();
      
      // Exact match first
      const exactA = textA === lowerSearchTerm;
      const exactB = textB === lowerSearchTerm;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;
      
      // Starts with search term
      const startsA = textA.startsWith(lowerSearchTerm);
      const startsB = textB.startsWith(lowerSearchTerm);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;
      
      // Type preference: pages > daily-notes > blocks
      const typeOrder = { "page": 0, "daily-note": 1, "block": 2 };
      const typeCompare = typeOrder[a.type] - typeOrder[b.type];
      if (typeCompare !== 0) return typeCompare;
      
      // Alphabetical as final tie-breaker
      return textA.localeCompare(textB);
    });
  }
}
