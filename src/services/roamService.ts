// src/services/roamService.ts
import {
  RoamBlock,
  RoamPage,
  PageContext,
  UniversalSearchResult,
  UniversalSearchResponse,
} from "../types";
import { LLMUtil } from "../utils/llmUtil";

export class RoamService {
  // Cache for frequently accessed data
  private static graphNameCache: {
    value: string | null;
    timestamp: number;
  } | null = null;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Sidebar monitoring state
  private static sidebarCache: {
    notes: RoamPage[];
    timestamp: number;
    checksum: string;
  } | null = null;
  private static readonly SIDEBAR_CACHE_DURATION = 2000; // 2 seconds cache for sidebar
  private static sidebarObserver: MutationObserver | null = null;
  private static sidebarChangeCallbacks: Set<() => void> = new Set();

  /**
   * Get the current graph name
   */
  static getCurrentGraphName(): string | null {
    // Check cache first
    if (
      this.graphNameCache &&
      Date.now() - this.graphNameCache.timestamp < this.CACHE_DURATION
    ) {
      return this.graphNameCache.value;
    }

    try {
      // Getting graph name from URL (only log in development)
      if (process.env.NODE_ENV === "development") {
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
   * Get the current page information - now enhanced to detect visible content
   */
  static async getCurrentPageInfo(): Promise<RoamPage | null> {
    try {
      // If we're in aggregated daily notes view, there is no single current page
      // Avoid returning a stale page from previous navigation
      const isAggregatedDaily = this.isAggregatedDailyNotesView();
      if (isAggregatedDaily) {
        return null;
      }

      // Try multiple methods to get current page
      let currentPageUid = null;
      let title = "";

      // IMPROVED: Use more reliable methods first, then fallback to visible content detection
      
      // Method 1: Try to get from main window API (most reliable)
      const apiResult =
        window.roamAlphaAPI?.ui?.mainWindow?.getOpenPageOrBlockUid?.();
      if (apiResult && typeof apiResult === "object" && "then" in apiResult) {
        currentPageUid = await apiResult;
      } else {
        currentPageUid = apiResult || null;
      }

      // Method 2: Try to get from URL if API failed
      if (!currentPageUid) {
        const urlMatch = window.location.href.match(/\/page\/([^/?]+)/);
        if (urlMatch) {
          currentPageUid = decodeURIComponent(urlMatch[1]);
          console.log("🔍 Got page UID from URL:", currentPageUid);
        }
      }

      // Method 3: Look for main window title element (not affected by sidebar)
      if (!currentPageUid) {
        // Find the main content area first to avoid sidebar interference
        const mainContent = document.querySelector(".roam-main") || 
                           document.querySelector(".rm-main") ||
                           document.querySelector("[data-testid='main-content']") ||
                           document.querySelector(".roam-article") ||
                           document.body;
        
        if (mainContent) {
          const titleElement = mainContent.querySelector(".rm-title-display");
          if (titleElement) {
            const pageTitle = titleElement.textContent?.trim();
            if (pageTitle) {
              console.log("🔍 Found main window page title:", pageTitle);
              title = pageTitle;
              
              const titleQuery = `
                [:find ?uid
                 :where
                 [?e :node/title "${pageTitle}"]
                 [?e :block/uid ?uid]]
              `;
              const titleResult = window.roamAlphaAPI.q(titleQuery);
              if (titleResult && titleResult.length > 0) {
                currentPageUid = titleResult[0][0];
                console.log("✅ Using main window page as current:", pageTitle);
              }
            }
          }
        }
      }

      // Method 4: Enhanced visible content detection as final fallback
      if (!currentPageUid) {
        const visibleBlocks = this.getVisibleBlocks();
        if (visibleBlocks.length > 0) {
          console.log("🔍 Fallback: trying visible content detection");
          // This now works better due to the sidebar-aware visibility logic we fixed above
        }
      }

      // All main detection methods completed above

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
      const rightSidebar =
        document.querySelector("#roam-right-sidebar-content") ||
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
        const visibleTitles = Array.from(titleElements).filter((el) => {
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
              console.log(
                "✅ Successfully got fallback sidebar page from DOM:",
                pageTitle
              );
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

      // Try different query patterns for different types of pages (excluding backlinks query)
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
      // First, let's debug what elements actually exist in the DOM
      console.log("🔍 DEBUG: Analyzing DOM structure...");

      // Check for any elements with data-block-uid attribute
      const allBlockUidElements = document.querySelectorAll("[data-block-uid]");
      console.log(
        `🔍 Found ${allBlockUidElements.length} elements with data-block-uid`
      );

      // Check for common Roam class patterns
      const roamBlocks = document.querySelectorAll(".roam-block");
      const rmBlocks = document.querySelectorAll(".rm-block");
      const roamArticle = document.querySelectorAll(".roam-article");
      const rmMainElement = document.querySelectorAll(".rm-main");
      const roamLogPages = document.querySelectorAll(".roam-log-page");
      const rmBlockChildren = document.querySelectorAll(".rm-block-children");
      const rmTitleDisplay = document.querySelectorAll(".rm-title-display");

      console.log("🔍 DOM elements found:", {
        roamBlocks: roamBlocks.length,
        rmBlocks: rmBlocks.length,
        roamArticle: roamArticle.length,
        rmMainElement: rmMainElement.length,
        roamLogPages: roamLogPages.length,
        rmBlockChildren: rmBlockChildren.length,
        rmTitleDisplay: rmTitleDisplay.length,
        allWithBlockUid: allBlockUidElements.length,
      });

      // If we have elements with data-block-uid, let's see what classes they have
      if (allBlockUidElements.length > 0) {
        const sampleElement = allBlockUidElements[0];
        console.log("🔍 Sample element classes:", sampleElement.className);
        console.log("🔍 Sample element tagName:", sampleElement.tagName);
      } else if (roamBlocks.length > 0) {
        // Since we found .roam-block elements, let's analyze them
        const sampleRoamBlock = roamBlocks[0];
        console.log("🔍 Sample .roam-block element:");
        console.log("🔍 - classes:", sampleRoamBlock.className);
        console.log("🔍 - tagName:", sampleRoamBlock.tagName);
        console.log(
          "🔍 - attributes:",
          Array.from(sampleRoamBlock.attributes).map(
            (attr) => `${attr.name}="${attr.value}"`
          )
        );
        console.log(
          "🔍 - textContent preview:",
          sampleRoamBlock.textContent?.substring(0, 100)
        );
      }

      // Try multiple selectors to catch all possible block elements in Roam
      const blockSelectors = [
        ".rm-block", // Start with rm-block which seems more relevant
        ".roam-log-page .rm-block", // Blocks within log pages
        ".rm-block-children .rm-block", // Blocks within block children
        ".roam-block",
        ".roam-log-page", // Try the log pages themselves
        ".rm-block-children", // Try block children containers
        "[data-block-uid]",
        ".roam-block[data-block-uid]",
        ".rm-block[data-block-uid]",
        ".rm-block-main[data-block-uid]",
        ".rm-block-text[data-block-uid]",
        ".controls[data-block-uid]",
      ];

      let blockElements: NodeListOf<Element> | null = null;
      for (const selector of blockSelectors) {
        blockElements = document.querySelectorAll(selector);
        if (blockElements.length > 0) {
          console.log(
            `🔍 Found ${blockElements.length} blocks using selector: ${selector}`
          );
          break;
        }
      }

      // Early return if no blocks found
      if (!blockElements || blockElements.length === 0) {
        console.log("❌ No block elements found in DOM");
        return visibleBlocks;
      }

      // Use requestAnimationFrame for better performance
      const processBlocks = () => {
        for (const element of blockElements!) {
          // Try multiple ways to get the block UID
          let uid = element.getAttribute("data-block-uid");
          if (!uid) {
            uid = element.getAttribute("blockuid");
          }
          if (!uid) {
            uid = element.getAttribute("data-uid");
          }
          if (!uid) {
            // Try to find UID in child elements
            const uidElement = element.querySelector(
              "[data-block-uid], [blockuid], [data-uid]"
            );
            if (uidElement) {
              uid =
                uidElement.getAttribute("data-block-uid") ||
                uidElement.getAttribute("blockuid") ||
                uidElement.getAttribute("data-uid");
            }
          }
          if (!uid) {
            // Skip elements without real block UIDs - they're not actual Roam blocks
            console.log("🔍 No UID found, skipping non-block element:", element.className);
            continue;
          }

          // Try multiple ways to get the block text based on actual Roam structure
          let textElement = element.querySelector(".rm-block-text");
          if (!textElement) {
            textElement = element.querySelector(".roam-block-text");
          }
          if (!textElement) {
            textElement = element.querySelector(".rm-title-display"); // For title elements
          }
          if (!textElement) {
            textElement = element.querySelector("[contenteditable]");
          }
          if (!textElement) {
            textElement = element.querySelector(".rm-block-input");
          }
          if (!textElement) {
            textElement = element.querySelector("textarea");
          }
          if (!textElement) {
            textElement = element.querySelector("span");
          }
          if (!textElement) {
            textElement = element.querySelector("div");
          }
          if (!textElement) {
            // If no text element found, use the element itself if it has text
            if (element.textContent && element.textContent.trim()) {
              textElement = element;
            }
          }

          if (uid && textElement) {
            const string = textElement.textContent || "";

            // Only include blocks that are actually visible and have meaningful content
            const rect = element.getBoundingClientRect();

            // Check if sidebar is open to adjust visibility calculations
            const sidebarElement = document.querySelector("#roam-right-sidebar-content") || 
                                 document.querySelector(".roam-sidebar-container");
            const sidebarVisible = sidebarElement && (sidebarElement as HTMLElement).offsetWidth > 0;
            
            // Calculate effective main window width when sidebar is open
            const effectiveWidth = sidebarVisible ? 
              window.innerWidth * 0.6 :
              window.innerWidth;

            // Improved visibility: use visibility ratio instead of strict margins
            const viewportHeight = window.innerHeight;
            const viewportWidth = effectiveWidth;
            const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
            const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
            const area = Math.max(1, rect.width * rect.height);
            const visibleArea = Math.max(0, visibleHeight) * Math.max(0, visibleWidth);
            const visibilityRatio = visibleArea / area;

            const isVisible =
              visibilityRatio > 0.15 && // At least 15% of block visible
              rect.height > 8 &&
              rect.width > 8;

            // Debug visibility calculation for first few elements
            if (visibleBlocks.length < 3) {
              console.log(`🔍 Block visibility check:`, {
                uid: uid.substring(0, 20),
                hasText: string.trim().length > 0,
                textPreview: string.substring(0, 50),
                rect: {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height,
                },
                windowHeight: viewportHeight,
                windowWidth: window.innerWidth,
                effectiveWidth,
                sidebarVisible,
                visibilityRatio: Number(visibilityRatio.toFixed(2)),
                isVisible,
              });
            }

            if (isVisible && string.trim().length > 0) {
              visibleBlocks.push({
                uid,
                string,
                children: [],
              });
            }
          } else {
            // Debug why block was skipped
            if (visibleBlocks.length < 3) {
              console.log(`🔍 Block skipped:`, {
                hasUid: !!uid,
                hasTextElement: !!textElement,
                elementTagName: element.tagName,
                elementClasses: element.className,
              });
            }
          }
        }
      };

      processBlocks();

      console.log(
        `🔍 Processed ${blockElements.length} DOM elements, found ${visibleBlocks.length} visible blocks`
      );
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
      return selectedText.length > 5000
        ? selectedText.substring(0, 5000) + "..."
        : selectedText;
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
        today
          .toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })
          .replace(/\//g, "-"), // MM-dd-yyyy
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
   * Register a callback for sidebar changes
   */
  static onSidebarChange(callback: () => void): () => void {
    this.sidebarChangeCallbacks.add(callback);
    this.startSidebarMonitoring();

    // Return cleanup function
    return () => {
      this.sidebarChangeCallbacks.delete(callback);
      if (this.sidebarChangeCallbacks.size === 0) {
        this.stopSidebarMonitoring();
      }
    };
  }

  /**
   * Start monitoring the sidebar for changes
   */
  private static startSidebarMonitoring(): void {
    if (this.sidebarObserver) return; // Already monitoring

    try {
      // Create a mutation observer to watch for sidebar changes
      this.sidebarObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        for (const mutation of mutations) {
          // Check if the mutation affects the sidebar
          if (
            mutation.target &&
            this.isSidebarRelated(mutation.target as Element)
          ) {
            shouldUpdate = true;
            break;
          }

          // Check added/removed nodes
          if (
            mutation.addedNodes.length > 0 ||
            mutation.removedNodes.length > 0
          ) {
            for (const node of [
              ...Array.from(mutation.addedNodes),
              ...Array.from(mutation.removedNodes),
            ]) {
              if (
                node.nodeType === Node.ELEMENT_NODE &&
                this.isSidebarRelated(node as Element)
              ) {
                shouldUpdate = true;
                break;
              }
            }
          }

          if (shouldUpdate) break;
        }

        if (shouldUpdate) {
          // Debounce the updates
          this.debouncedSidebarUpdate();
        }
      });

      // Start observing the document body for sidebar changes
      this.sidebarObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "data-block-uid", "data-page-uid"],
      });

      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Started sidebar monitoring");
      }
    } catch (error) {
      console.warn("Failed to start sidebar monitoring:", error);
    }
  }

  /**
   * Stop monitoring the sidebar
   */
  private static stopSidebarMonitoring(): void {
    if (this.sidebarObserver) {
      this.sidebarObserver.disconnect();
      this.sidebarObserver = null;
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Stopped sidebar monitoring");
      }
    }
  }

  /**
   * Check if an element is related to the sidebar
   */
  private static isSidebarRelated(element: Element): boolean {
    if (!element || !element.closest) return false;

    // Check for various sidebar-related selectors
    const sidebarSelectors = [
      "#roam-right-sidebar-content",
      ".roam-sidebar-container",
      '[data-testid="right-sidebar"]',
      ".rm-sidebar-window",
      ".sidebar-content",
    ];

    return sidebarSelectors.some((selector) => element.closest(selector));
  }

  private static sidebarUpdateTimeout: number | null = null;

  /**
   * Debounced sidebar update function
   */
  private static debouncedSidebarUpdate(): void {
    if (this.sidebarUpdateTimeout) {
      clearTimeout(this.sidebarUpdateTimeout);
    }

    this.sidebarUpdateTimeout = window.setTimeout(async () => {
      await this.checkSidebarChanges();
    }, 300); // 300ms debounce
  }

  /**
   * Check if sidebar has actually changed and notify callbacks
   */
  private static async checkSidebarChanges(): Promise<void> {
    try {
      const currentNotes = await this.getSidebarNotesInternal();
      const currentChecksum = this.generateSidebarChecksum(currentNotes);

      // Compare with cached version
      if (
        !this.sidebarCache ||
        this.sidebarCache.checksum !== currentChecksum
      ) {
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 Sidebar changed - notifying callbacks");
        }
        this.sidebarCache = {
          notes: currentNotes,
          timestamp: Date.now(),
          checksum: currentChecksum,
        };

        // Notify all registered callbacks
        this.sidebarChangeCallbacks.forEach((callback) => {
          try {
            callback();
          } catch (error) {
            console.warn("Error in sidebar change callback:", error);
          }
        });
      }
    } catch (error) {
      console.warn("Error checking sidebar changes:", error);
    }
  }

  /**
   * Generate a checksum for sidebar notes to detect changes
   */
  private static generateSidebarChecksum(notes: RoamPage[]): string {
    const simplified = notes.map((note) => ({
      uid: note.uid,
      title: note.title,
      blockCount: note.blocks.length,
    }));
    return JSON.stringify(simplified);
  }

  /**
   * Get sidebar notes (pages opened in right sidebar) with caching
   */
  static async getSidebarNotes(): Promise<RoamPage[]> {
    // Check cache first (short-lived cache for performance)
    if (
      this.sidebarCache &&
      Date.now() - this.sidebarCache.timestamp < this.SIDEBAR_CACHE_DURATION
    ) {
      return this.sidebarCache.notes;
    }

    const notes = await this.getSidebarNotesInternal();

    // Update cache
    this.sidebarCache = {
      notes,
      timestamp: Date.now(),
      checksum: this.generateSidebarChecksum(notes),
    };

    return notes;
  }

  /**
   * Internal method to get sidebar notes without caching
   */
  private static async getSidebarNotesInternal(): Promise<RoamPage[]> {
    try {
      // Getting sidebar notes from API

      // Try to get sidebar windows from Roam API first (more reliable)
      if (!window.roamAlphaAPI?.ui?.rightSidebar?.getWindows) {
        // Sidebar getWindows API not available, trying DOM fallback
        return this.getSidebarNotesFromDOM();
      }

      const sidebarWindows = window.roamAlphaAPI.ui.rightSidebar.getWindows();
      // Got sidebar windows from API

      if (!sidebarWindows || sidebarWindows.length === 0) {
        // No sidebar windows found via API, trying DOM fallback
        return this.getSidebarNotesFromDOM();
      }

      const sidebarNotes: RoamPage[] = [];
      const processedUids = new Set<string>();

      for (const sidebarWindow of sidebarWindows) {
        try {
          // Processing sidebar window

          if (sidebarWindow["page-uid"]) {
            // This is a page window
            const pageUid = sidebarWindow["page-uid"];
            if (!processedUids.has(pageUid)) {
              processedUids.add(pageUid);
              // Found page window

              // Add a small delay to ensure the page is fully loaded
              await new Promise((resolve) => setTimeout(resolve, 100));

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
                // Trying to get title from daily note format
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
                // Added page to sidebar notes
              }
            }
          } else if (sidebarWindow["block-uid"]) {
            // This is a block window, create a block-specific entry
            const blockUid = sidebarWindow["block-uid"];
            // Found block window

            if (!processedUids.has(blockUid)) {
              processedUids.add(blockUid);

              // Get the specific block content
              const blockQuery = `
                [:find ?string ?pageTitle
                 :where
                 [?block :block/uid "${blockUid}"]
                 [?block :block/string ?string]
                 [?block :block/page ?page]
                 [?page :node/title ?pageTitle]]
              `;

              const blockResult = window.roamAlphaAPI.q(blockQuery);
              if (blockResult && blockResult.length > 0) {
                const [blockString, pageTitle] = blockResult[0];

                // Create a block-specific entry
                const blockEntry: RoamPage = {
                  title:
                    blockString && blockString.trim()
                      ? blockString.substring(0, 100) +
                        (blockString.length > 100 ? "..." : "")
                      : `Block from ${pageTitle}`,
                  uid: blockUid,
                  blocks: [
                    {
                      uid: blockUid,
                      string: blockString || "",
                      children: [],
                    },
                  ],
                };

                sidebarNotes.push(blockEntry);
                // Added specific block to sidebar notes
              }
            }
          }
        } catch (windowError) {
          console.warn("❌ Error processing sidebar window:", windowError);
        }
      }

      // If API didn't find any notes, try DOM fallback
      if (sidebarNotes.length === 0) {
        const domNotes = await this.getSidebarNotesFromDOM();
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
      const sidebarNotes: RoamPage[] = [];

      // Look for the right sidebar - check common selectors
      const rightSidebar =
        document.querySelector("#roam-right-sidebar-content") ||
        document.querySelector(".roam-sidebar-container") ||
        document.querySelector("[data-testid='right-sidebar']");

      if (!rightSidebar) {
        return [];
      }

      // Look for page title elements in the sidebar
      const pageTitleElements =
        rightSidebar.querySelectorAll(".rm-title-display");

      const processedTitles = new Set<string>();

      for (const titleElement of pageTitleElements) {
        try {
          const pageTitle = titleElement.textContent?.trim();

          if (
            pageTitle &&
            pageTitle !== "" &&
            !processedTitles.has(pageTitle)
          ) {
            processedTitles.add(pageTitle);

            const page = await this.getPageByTitle(pageTitle);
            if (page) {
              sidebarNotes.push(page);
            }
          }
        } catch (elementError) {
          console.warn("❌ Error processing title element:", elementError);
        }
      }

      // Found sidebar notes via DOM
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
    console.log(
      "🚀 DEBUG: getPageContext called - optimized visible detection"
    );
    // Getting comprehensive page context

    let [currentPage, sidebarNotes] = await Promise.all([
      this.getCurrentPageInfo(),
      this.getSidebarNotes(),
    ]);

    // Smart visible blocks detection
    let visibleBlocks: RoamBlock[] = [];
    let visibleDailyNotes: RoamPage[] = [];

    const isDailyNotesView = this.isDailyNotesView();
    if (isDailyNotesView) {
      console.log("📅 Detected daily notes view - scanning for visible daily notes");
      visibleDailyNotes = await this.getVisibleDailyNotes();
      console.log(`📅 Found ${visibleDailyNotes.length} visible daily notes`);
      // In daily notes view, avoid keeping a stale page in context
      if (visibleDailyNotes.length > 0) {
        currentPage = null;
      }
    } else {
      console.log("📄 Regular page view - getting visible blocks");
      visibleBlocks = this.getVisibleBlocks();
      console.log(`📄 Found ${visibleBlocks.length} visible blocks`);
      
      // SAFETY: If we have a current page but no visible blocks detected,
      // use the current page blocks as fallback (handles sidebar interference)
      if (visibleBlocks.length === 0 && currentPage && currentPage.blocks.length > 0) {
        console.log("🔧 No visible blocks detected but current page has content - using page blocks as fallback");
        visibleBlocks = currentPage.blocks;
      }
    }

    // Get linked references if we have a current page (using comprehensive method)
    let linkedReferences: RoamBlock[] = [];
    if (currentPage) {
      linkedReferences = await this.getBlocksReferencingPage(currentPage.title);
    }

    // Log page context summary
    console.log("📋 Page context summary:", {
      currentPage: currentPage?.title || "None",
      currentPageBlocks: currentPage?.blocks.length || 0,
      visibleBlocks: visibleBlocks.length,
      visibleBlocksPreview: visibleBlocks
        .slice(0, 3)
        .map((b) => b.string.substring(0, 50) + "..."),
      sidebarNotes: sidebarNotes.length,
    });

    // Debug sidebar notes only in development mode
    if (
      process.env.NODE_ENV === "development" &&
      sidebarNotes &&
      sidebarNotes.length === 0
    ) {
      console.log("❌ No sidebar notes in context");
    }

    const contextResult = {
      currentPage: currentPage || undefined,
      visibleBlocks,
      selectedText: undefined, // Removed selectedText feature
      dailyNote: undefined,
      linkedReferences,
      sidebarNotes,
      visibleDailyNotes, // New: visible daily notes for daily notes view
    };

    // Debug: Log the final context result
    console.log('🔍 GETPAGECONTEXT RESULT:', {
      hasCurrentPage: !!contextResult.currentPage,
      currentPageTitle: contextResult.currentPage?.title,
      visibleBlocksCount: contextResult.visibleBlocks.length,
      hasVisibleDailyNotes: !!contextResult.visibleDailyNotes,
      visibleDailyNotesCount: contextResult.visibleDailyNotes?.length || 0,
      visibleDailyNotesTitles: contextResult.visibleDailyNotes?.map(dn => dn.title) || [],
      sidebarNotesCount: contextResult.sidebarNotes?.length || 0
    });

    return contextResult;
  }

  /**
   * Get minimal page context for tool calls (to avoid interference)
   */
  static async getToolCallContext(): Promise<PageContext> {
    console.log("🎯 Getting minimal context for tool call...");

    // Removed selected text feature to avoid context contamination

    // For debugging: get current page info but don't include it in context
    const currentPage = await this.getCurrentPageInfo();

    console.log("🎯 Tool call context summary:", {
      selectedText: "Removed (feature disabled)",
      currentPage: currentPage?.title || "None",
      strategy: "minimal - no context to avoid confusion",
    });

    // Return ultra-minimal context to avoid AI confusion
    return {
      currentPage: undefined, // Explicitly skip to avoid date confusion
      visibleBlocks: [], // Skip all visible content
      selectedText: undefined, // Feature removed
      dailyNote: undefined, // Skip daily note context
      linkedReferences: [], // Skip all references
      sidebarNotes: [], // Skip sidebar notes
    };
  }

  /**
   * Get model-specific maximum context tokens (increased limits for better context usage)
   */
  static getModelTokenLimit(provider: string, model: string): number {
    const modelLimits: { [key: string]: { [key: string]: number } } = {
      openai: {
        "gpt-4o": 60000, // 128k context window - increased from 24k
        "gpt-4o-mini": 60000, // 128k context window - increased from 24k
        "gpt-4-turbo": 60000, // 128k context window - increased from 24k
        "gpt-4": 15000, // 8k context window - increased from 6k
        "gpt-3.5-turbo": 8000, // 4k context window - increased from 2k
      },
      anthropic: {
        "claude-3-5-sonnet-20241022": 300000, // Claude 3.5 Sonnet - 200k context, increased usage
        "claude-3-5-haiku-20241022": 300000, // Claude 3.5 Haiku - 200k context, increased usage
        "claude-3-opus-20240229": 300000, // Claude 3 Opus - 200k context, increased usage
        "claude-3-sonnet-20240229": 300000, // Claude 3 Sonnet - 200k context, increased usage
        "claude-3-haiku-20240307": 300000, // Claude 3 Haiku - 200k context, increased usage
      },
      groq: {
        "llama-3.3-70b-versatile": 60000, // 128k context window - increased from 24k
        "llama-3.1-70b-versatile": 60000, // 128k context window - increased from 24k
        "llama-3.1-8b-instant": 60000, // 128k context window - increased from 24k
        "llama3-groq-70b-8192-tool-use-preview": 15000, // 8k context window - increased from 6k
        "llama3-groq-8b-8192-tool-use-preview": 15000, // 8k context window - increased from 6k
      },
      xai: {
        "grok-beta": 60000, // 131k context window - increased from 24k
        "grok-vision-beta": 60000, // 128k context window with vision - increased from 24k
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
   * Intelligently manage context to fit within token limit with priority-based allocation
   */
  static smartContextManagement(
    context: PageContext,
    maxTokens: number,
    provider: string,
    model: string
  ): string {
    // Get actual model token limit and use 70% for context (reserve 30% for response)
    const modelLimit = this.getModelTokenLimit(provider, model);
    const actualMaxTokens = maxTokens || Math.floor(modelLimit * 0.7);

    // Define content priority levels with token allocations (removed selectedText)
    const priorityAllocations = {
      currentPage: 0.35, // 35% - page content (increased from 25%)
      sidebarNotes: 0.25, // 25% - sidebar context (increased from 20%)
      visibleBlocks: 0.25, // 25% - visible content (increased from 15%)
      linkedReferences: 0.15, // 15% - backlinks (increased from 10%)
    };

    const sections: Array<{
      priority: number;
      title: string;
      content: string;
      maxTokens: number;
      type: keyof typeof priorityAllocations;
    }> = [];

    // 1. Current Page Content (Highest Priority)
    if (context.currentPage && context.currentPage.blocks.length > 0) {
      const pageContent = this.formatBlocksForAI(context.currentPage.blocks, 0);
      sections.push({
        priority: 1,
        title: `**Current Page: "${context.currentPage.title}"**`,
        content: pageContent,
        maxTokens: Math.floor(
          actualMaxTokens * priorityAllocations.currentPage
        ),
        type: "currentPage",
      });
    }

    // 2. Sidebar Notes (Important context)
    if (context.sidebarNotes && context.sidebarNotes.length > 0) {
      const sidebarContent = context.sidebarNotes
        .slice(0, 3) // Limit to 3 most relevant
        .map((note) => {
          const noteContent = this.formatBlocksForAI(
            note.blocks.slice(0, 5),
            0
          ); // First 5 blocks per note
          return `**Sidebar: "${note.title}"**\n${noteContent}`;
        })
        .join("\n\n");

      sections.push({
        priority: 2,
        title: `**Sidebar Notes (${Math.min(
          context.sidebarNotes.length,
          3
        )} open):**`,
        content: sidebarContent,
        maxTokens: Math.floor(
          actualMaxTokens * priorityAllocations.sidebarNotes
        ),
        type: "sidebarNotes",
      });
    }

    // 3. Visible Blocks (always include if they exist and show different content)
    if (context.visibleBlocks.length > 0) {
      // Check if visible blocks are different from current page blocks
      const currentPageUids = new Set(
        context.currentPage?.blocks.map((block) => block.uid) || []
      );
      const visibleBlocksFromDifferentPages = context.visibleBlocks.filter(
        (block) => !currentPageUids.has(block.uid)
      );

      // Include visible blocks if they're from different pages or if there's no current page
      if (!context.currentPage || visibleBlocksFromDifferentPages.length > 0) {
        const visibleContent = this.formatBlocksForAI(context.visibleBlocks, 0);
        sections.push({
          priority: 3,
          title: "**Visible Content:**",
          content: visibleContent,
          maxTokens: Math.floor(
            actualMaxTokens * priorityAllocations.visibleBlocks
          ),
          type: "visibleBlocks",
        });
      }
    }

    // 4. Linked References (Lower priority)
    if (context.linkedReferences && context.linkedReferences.length > 0) {
      const referencesContent = context.linkedReferences
        .slice(0, 5) // Limit to 5 most relevant
        .map((ref) => `- ${ref.string}`)
        .join("\n");

      sections.push({
        priority: 4,
        title: `**Linked References (${Math.min(
          context.linkedReferences.length,
          5
        )} references):**`,
        content: referencesContent,
        maxTokens: Math.floor(
          actualMaxTokens * priorityAllocations.linkedReferences
        ),
        type: "linkedReferences",
      });
    }

    // Build final context with dynamic token allocation
    let finalContext = "";
    let usedTokens = 0;
    let remainingTokens = actualMaxTokens;

    // Sort by priority and process
    sections.sort((a, b) => a.priority - b.priority);

    // First pass: calculate how much each section actually needs
    const sectionNeeds: Array<{
      section: (typeof sections)[0];
      actualTokensNeeded: number;
      allocatedTokens: number;
    }> = [];

    for (const section of sections) {
      const sectionHeader = section.title + "\n";
      const headerTokens = this.estimateTokenCount(sectionHeader);
      const contentTokens = this.estimateTokenCount(section.content);
      const totalNeeded = headerTokens + contentTokens;

      sectionNeeds.push({
        section,
        actualTokensNeeded: totalNeeded,
        allocatedTokens: section.maxTokens,
      });
    }

    // Second pass: redistribute unused tokens
    let unusedTokens = 0;
    for (let i = 0; i < sectionNeeds.length; i++) {
      const need = sectionNeeds[i];

      if (need.actualTokensNeeded < need.allocatedTokens) {
        // This section doesn't need all its allocated tokens
        const surplus = need.allocatedTokens - need.actualTokensNeeded;
        unusedTokens += surplus;
        need.allocatedTokens = need.actualTokensNeeded;
      }
    }

    // Distribute unused tokens to sections that can use them, prioritizing higher priority sections
    if (unusedTokens > 0) {
      for (let i = 0; i < sectionNeeds.length && unusedTokens > 0; i++) {
        const need = sectionNeeds[i];

        if (need.actualTokensNeeded > need.allocatedTokens) {
          // This section needs more tokens
          const needed = need.actualTokensNeeded - need.allocatedTokens;
          const canAllocate = Math.min(needed, unusedTokens);

          need.allocatedTokens += canAllocate;
          unusedTokens -= canAllocate;
        }
      }
    }

    // Third pass: build the final context with updated allocations
    for (const { section, allocatedTokens } of sectionNeeds) {
      const sectionHeader = section.title + "\n";
      const headerTokens = this.estimateTokenCount(sectionHeader);

      if (usedTokens + headerTokens >= actualMaxTokens) break;

      // Check if we can fit the full content with dynamic allocation
      const fullSectionTokens =
        headerTokens + this.estimateTokenCount(section.content);

      if (
        usedTokens + fullSectionTokens <= actualMaxTokens &&
        fullSectionTokens <= allocatedTokens
      ) {
        // Full content fits within dynamic allocation
        finalContext += sectionHeader + section.content + "\n\n";
        usedTokens += fullSectionTokens;
      } else {
        // Need to truncate this section, but use dynamic allocation
        const availableTokens = Math.min(
          allocatedTokens,
          actualMaxTokens - usedTokens - headerTokens
        );

        if (availableTokens > 100) {
          // Only include if we have meaningful space
          const truncatedContent = this.intelligentTruncate(
            section.content,
            availableTokens,
            section.type
          );

          if (truncatedContent.length > 50) {
            // Only add if meaningful content remains
            finalContext += sectionHeader + truncatedContent + "\n\n";
            usedTokens +=
              headerTokens + this.estimateTokenCount(truncatedContent);
          }
        }
      }
    }

    // Add context statistics for debugging
    if (process.env.NODE_ENV === "development") {
      const allocationDetails = sectionNeeds.map((need) => ({
        type: need.section.type,
        allocated: need.allocatedTokens,
        needed: need.actualTokensNeeded,
        saved: Math.max(0, need.allocatedTokens - need.actualTokensNeeded),
      }));

      console.log(`🧠 Dynamic Token Allocation:`, {
        totalSections: sections.length,
        maxTokens: actualMaxTokens,
        usedTokens,
        efficiency: `${Math.round((usedTokens / actualMaxTokens) * 100)}%`,
        redistributedTokens: allocationDetails.reduce(
          (sum, d) => sum + d.saved,
          0
        ),
        model: `${provider}/${model}`,
        sectionDetails: allocationDetails,
      });
    }

    return finalContext.trim();
  }

  /**
   * Intelligently truncate content based on its type
   */
  private static intelligentTruncate(
    content: string,
    maxTokens: number,
    contentType: string
  ): string {
    if (this.estimateTokenCount(content) <= maxTokens) {
      return content;
    }

    // Different strategies for different content types
    switch (contentType) {
      case "currentPage":
        // For page content, keep the first few blocks intact
        return this.truncatePreservingStructure(
          content,
          maxTokens,
          "page content"
        );

      case "sidebarNotes":
        // For sidebar notes, summarize each note
        return this.truncatePreservingStructure(
          content,
          maxTokens,
          "sidebar notes"
        );

      case "visibleBlocks":
        // For visible blocks, keep first and last few blocks
        return this.truncatePreservingStructure(
          content,
          maxTokens,
          "visible content"
        );

      case "linkedReferences":
        // For references, keep the most relevant ones
        const lines = content.split("\n").filter((line) => line.trim());
        const maxLines = Math.floor(maxTokens / 15); // Assume ~15 tokens per reference line
        if (lines.length <= maxLines) return content;

        return (
          lines.slice(0, maxLines).join("\n") +
          `\n... and ${lines.length - maxLines} more references`
        );

      default:
        return this.truncatePreservingStructure(content, maxTokens, "content");
    }
  }

  /**
   * Truncate content while preserving structure and meaning
   */
  private static truncatePreservingStructure(
    content: string,
    maxTokens: number,
    contentLabel: string
  ): string {
    const paragraphs = content.split("\n\n");
    let result = "";
    let tokens = 0;

    // Add paragraphs until we approach the limit
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraphTokens = this.estimateTokenCount(paragraphs[i]);

      if (tokens + paragraphTokens <= maxTokens * 0.9) {
        // Use 90% to leave room for truncation notice
        result += paragraphs[i] + "\n\n";
        tokens += paragraphTokens;
      } else {
        // Add truncation notice
        const remaining = paragraphs.length - i;
        if (remaining > 0) {
          result += `... (${remaining} more sections of ${contentLabel} truncated for brevity)`;
        }
        break;
      }
    }

    return result.trim();
  }

  /**
   * Legacy truncate method - kept for backward compatibility
   */
  static truncateContext(
    formattedContext: string,
    maxTokens: number = 15000 // Increased default from 6000
  ): string {
    const currentTokens = this.estimateTokenCount(formattedContext);

    if (currentTokens <= maxTokens) {
      return formattedContext;
    }

    // Use the new smart truncation for legacy calls
    console.log(
      "📝 Using legacy truncateContext - consider upgrading to smartContextManagement"
    );
    return this.truncatePreservingStructure(
      formattedContext,
      maxTokens,
      "context"
    );
  }

  /**
   * Format page context for AI prompt with clickable source references (enhanced version)
   */
  static formatContextForAI(
    context: PageContext,
    maxTokens?: number,
    provider?: string,
    model?: string
  ): string {
    // Use smart context management if provider/model info is available
    if (provider && model) {
      return this.smartContextManagement(
        context,
        maxTokens || 0,
        provider,
        model
      );
    }

    // Fallback to legacy formatting
    return this.formatContextForAI_Legacy(context, maxTokens);
  }

  /**
   * Legacy format method - kept for backward compatibility
   */
  static formatContextForAI_Legacy(
    context: PageContext,
    maxTokens?: number
  ): string {
    let formattedContext = "";
    const graphName = this.getCurrentGraphName();
    const isDesktop = this.isDesktopApp();

    // For tool calls, use ultra-minimal context
    const isToolCallContext =
      !context.currentPage &&
      !context.dailyNote &&
      context.visibleBlocks.length === 0 &&
      context.linkedReferences.length === 0 &&
      (!context.sidebarNotes || context.sidebarNotes.length === 0);

    if (isToolCallContext) {
      console.log("🎯 Formatting minimal tool call context");

      // No selected text feature anymore - just add minimal guidance
      formattedContext += `**Context Note:** This is minimal context for tool execution to avoid interference.\n`;

      const finalContext = formattedContext.trim();
      console.log(
        "🎯 Minimal context length:",
        finalContext.length,
        "characters"
      );
      return finalContext;
    }

    // Standard context formatting for regular queries
    console.log("📋 Formatting full context for regular query");

    // Removed selectedText feature for better user experience

    // Helper function to format URL links
    const formatUrls = (webUrl: string, desktopUrl: string) => {
      if (isDesktop) {
        return `[🔗 Open in Roam](${desktopUrl})`;
      } else {
        return `[🔗 Web](${webUrl}) | [🔗 Desktop](${desktopUrl})`;
      }
    };

    // Add current page information if available
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
    }

    // Add visible daily notes if they exist (only for daily notes view)
    if (context.visibleDailyNotes && context.visibleDailyNotes.length > 0) {
      formattedContext += `**Visible Daily Notes (${context.visibleDailyNotes.length} dates):**\n`;

      for (const dailyNote of context.visibleDailyNotes.slice(0, 5)) {
        // Limit to 5 for performance
        const dailyUrls = this.generatePageUrl(
          dailyNote.uid,
          graphName || undefined
        );
        const dailyUrlLinks = dailyUrls
          ? formatUrls(dailyUrls.webUrl, dailyUrls.desktopUrl)
          : `[[${dailyNote.title}]]`;

        formattedContext += `**${dailyNote.title}** ${dailyUrlLinks}\n`;

        if (dailyNote.blocks.length > 0) {
          const dailyContent = this.formatBlocksForAIWithClickableReferences(
            dailyNote.blocks.slice(0, 8), // First 8 blocks per daily note
            0,
            graphName,
            isDesktop
          );
          formattedContext += dailyContent;
        }
        formattedContext += "\n";
      }

      if (context.visibleDailyNotes.length > 5) {
        formattedContext += `... and ${
          context.visibleDailyNotes.length - 5
        } more daily notes\n`;
      }
      formattedContext += "\n";
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
      for (const sidebarNote of context.sidebarNotes.slice(0, 5)) {
        // Limit to first 5 to avoid context bloat
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
        formattedContext += `... and ${
          context.sidebarNotes.length - 5
        } more sidebar notes\n`;
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

    console.log(
      "📋 Final formatted context for AI (Legacy):",
      finalContext.length,
      "characters"
    );

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

          console.log("✅ Found daily note:", {
            format,
            uid,
            blockCount: blocks.length,
          });
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
      // Escape page title for safe use in Datalog queries
      const escapedPageTitle = pageTitle.replace(/"/g, '\\"');
      
      const queries = [
        // Standard page reference [[PageTitle]]
        `[:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "[[${escapedPageTitle}]]")]]`,

        // Tag reference #PageTitle (only if page title has no spaces)
        ...(pageTitle.includes(' ') ? [] : [`[:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "#${escapedPageTitle}")]`]),

        // Direct reference relationship (most reliable)
        `[:find ?uid ?string
         :where
         [?page :node/title "${escapedPageTitle}"]
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
          warnings.push(
            `No blocks found referencing "${params.referencedPage}"`
          );
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
  static async searchPages(
    searchTerm: string,
    limit: number = 10
  ): Promise<Array<{ title: string; uid: string }>> {
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
      const allPages = result.map(([title, uid]: [string, string]) => ({
        title,
        uid,
      }));

      // Debug: show a few page titles to understand the data
      console.log(
        `Sample page titles:`,
        allPages.slice(0, 10).map((p) => p.title)
      );

      // Debug: look for pages that might contain our search term
      const candidatePages = allPages.filter(
        (page) =>
          page.title.toLowerCase().includes("claude") ||
          page.title.toLowerCase().includes("code")
      );
      console.log(
        `Pages containing 'claude' or 'code':`,
        candidatePages.map((p) => p.title)
      );

      // More flexible search: split search term and match each part
      const searchWords = lowerSearchTerm
        .split(/[-\s]+/)
        .filter((word) => word.length > 0);
      console.log(`Search words:`, searchWords);

      const pages = allPages.filter((page) => {
        const pageTitle = page.title.toLowerCase();
        // Match if all search words are found in the title
        const matches = searchWords.every((word) => pageTitle.includes(word));

        // Debug specific pages for troubleshooting
        if (pageTitle.includes("claude")) {
          console.log(
            `Checking page "${page.title}": searchWords=[${searchWords.join(
              ", "
            )}], matches=${matches}`
          );
        }

        return matches;
      });

      console.log(
        `Found ${pages.length} matching pages out of ${result.length} total pages`
      );

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
        if (
          aTitle.startsWith(lowerSearchTerm) &&
          !bTitle.startsWith(lowerSearchTerm)
        )
          return -1;
        if (
          bTitle.startsWith(lowerSearchTerm) &&
          !aTitle.startsWith(lowerSearchTerm)
        )
          return 1;

        // Alphabetical for similar relevance
        return aTitle.localeCompare(bTitle);
      });

      const limitedResults = pages.slice(0, limit);
      console.log(
        `Returning ${limitedResults.length} results:`,
        limitedResults.map((p) => p.title)
      );

      return limitedResults;
    } catch (error) {
      console.error("Error searching pages:", error);
      return [];
    }
  }

  /**
   * Get all page titles (for initial page list)
   */
  static async getAllPageTitles(
    limit: number = 50
  ): Promise<Array<{ title: string; uid: string }>> {
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
        uid,
      }));

      pages.sort((a, b) => a.title.localeCompare(b.title));

      const limitedResults = pages.slice(0, limit);
      console.log(
        `Found ${pages.length} pages, returning ${limitedResults.length}`
      );

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
  static async universalSearch(
    searchTerm: string,
    limit: number = 10
  ): Promise<UniversalSearchResponse> {
    const startTime = Date.now();
    console.log(
      `🔍 UniversalSearch called with: "${searchTerm}", limit: ${limit}`
    );

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
      const sortedResults = this.sortUniversalSearchResults(
        allResults,
        searchTerm
      );
      const limitedResults = sortedResults.slice(0, limit);

      const executionTime = Date.now() - startTime;
      console.log(
        `🔍 UniversalSearch completed: ${limitedResults.length} results in ${executionTime}ms`
      );

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
  private static async searchPagesForUniversal(
    searchTerm: string,
    limit: number
  ): Promise<UniversalSearchResult[]> {
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
      const matchingPages = allPages.filter((page) => {
        const pageTitle = page.title.toLowerCase();
        return pageTitle.includes(lowerSearchTerm);
      });

      console.log(
        `🔍 Found ${matchingPages.length} matching pages for "${searchTerm}"`
      );

      // Apply Roam-like relevance sorting
      const sortedPages = this.sortPagesByRelevance(matchingPages, searchTerm);
      const limitedPages = sortedPages.slice(0, limit);

      return limitedPages.map((page) => {
        const isDaily = this.isDailyNotePage(page.title);
        return {
          type: isDaily ? ("daily-note" as const) : ("page" as const),
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
  private static async searchBlocksForUniversal(
    searchTerm: string,
    limit: number
  ): Promise<UniversalSearchResult[]> {
    try {
      // Use the existing working searchNotesFullText method
      const blockResults = await this.searchNotesFullText(searchTerm);

      if (!blockResults || blockResults.length === 0) {
        console.log(`🔍 No blocks found for "${searchTerm}"`);
        return [];
      }

      console.log(
        `🔍 Found ${blockResults.length} matching blocks for "${searchTerm}"`
      );

      // Apply relevance sorting
      const sortedBlocks = this.sortBlocksByRelevance(blockResults, searchTerm);
      const limitedBlocks = sortedBlocks.slice(0, limit);

      // Get parent page titles for blocks in parallel
      const resultsWithPages = await Promise.all(
        limitedBlocks.map(async (block) => {
          const parentPageTitle = await this.getParentPageTitleForBlock(
            block.uid
          );
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
  static async getParentPageTitleForBlock(
    blockUid: string
  ): Promise<string | undefined> {
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
      console.error(
        "Error getting parent page title for block:",
        blockUid,
        error
      );
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

    return dailyNotePatterns.some((pattern) => pattern.test(title));
  }

  /**
   * Format block content for preview display
   */
  private static formatBlockPreview(
    content: string,
    maxLength: number = 60
  ): string {
    if (!content) return "";

    // Remove Roam markup for cleaner preview
    let cleaned = content
      .replace(/\[\[([^\]]+)\]\]/g, "$1") // Remove page links
      .replace(/\(\(([^)]+)\)\)/g, "") // Remove block references
      .replace(/#\[\[([^\]]+)\]\]/g, "#$1") // Simplify hashtags
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
      .replace(/\*([^*]+)\*/g, "$1") // Remove italic
      .replace(/~~([^~]+)~~/g, "$1") // Remove strikethrough
      .replace(/`([^`]+)`/g, "$1") // Remove code
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

    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, "<mark>$1</mark>");
  }

  /**
   * Sort pages by relevance using Roam-like algorithm
   */
  private static sortPagesByRelevance(
    pages: Array<{ title: string; uid: string }>,
    searchTerm: string
  ): Array<{ title: string; uid: string }> {
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
      const wordBoundaryA = new RegExp(
        `\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(titleA);
      const wordBoundaryB = new RegExp(
        `\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(titleB);
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
  private static sortBlocksByRelevance(
    blocks: Array<{ uid: string; string: string }>,
    searchTerm: string
  ): Array<{ uid: string; string: string }> {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    return blocks.sort((a, b) => {
      const contentA = a.string.toLowerCase();
      const contentB = b.string.toLowerCase();

      // Exact match has highest priority
      if (contentA === lowerSearchTerm && contentB !== lowerSearchTerm)
        return -1;
      if (contentB === lowerSearchTerm && contentA !== lowerSearchTerm)
        return 1;

      // Word boundary matching
      const wordBoundaryA = new RegExp(
        `\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(contentA);
      const wordBoundaryB = new RegExp(
        `\\b${lowerSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(contentB);
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
  private static sortUniversalSearchResults(
    results: UniversalSearchResult[],
    searchTerm: string
  ): UniversalSearchResult[] {
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
      const typeOrder = { page: 0, "daily-note": 1, block: 2 };
      const typeCompare = typeOrder[a.type] - typeOrder[b.type];
      if (typeCompare !== 0) return typeCompare;

      // Alphabetical as final tie-breaker
      return textA.localeCompare(textB);
    });
  }

  /**
   * Check if the current view is a daily notes view (showing daily notes)
   */
  static isDailyNotesView(): boolean {
    try {
      // Check for any daily note titles visible (including single daily note pages)
      const titleElements = document.querySelectorAll(".rm-title-display");
      let dailyNoteCount = 0;

      for (const titleElement of titleElements) {
        const title = titleElement.textContent?.trim();
        if (title && this.isDailyNotePage(title)) {
          const rect = titleElement.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < window.innerHeight) {
            dailyNoteCount++;
          }
        }
      }

      return dailyNoteCount >= 1; // Single or multiple daily notes visible
    } catch (error) {
      console.error("Error checking daily notes view:", error);
      return false;
    }
  }

  /**
   * Detect aggregated daily notes view (multiple daily notes visible)
   */
  static isAggregatedDailyNotesView(): boolean {
    try {
      const titleElements = document.querySelectorAll(".rm-title-display");
      let dailyNoteCount = 0;

      for (const titleElement of titleElements) {
        const title = titleElement.textContent?.trim();
        if (title && this.isDailyNotePage(title)) {
          const rect = titleElement.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < window.innerHeight) {
            dailyNoteCount++;
          }
        }
      }

      return dailyNoteCount > 1;
    } catch (error) {
      console.error("Error checking aggregated daily notes view:", error);
      return false;
    }
  }

  /**
   * Get all visible daily notes in the current view
   */
  static async getVisibleDailyNotes(): Promise<RoamPage[]> {
    try {
      const visibleDailyNotes: RoamPage[] = [];
      const titleElements = document.querySelectorAll(".rm-title-display");
      const processedTitles = new Set<string>();

      for (const titleElement of titleElements) {
        const title = titleElement.textContent?.trim();
        if (
          title &&
          this.isDailyNotePage(title) &&
          !processedTitles.has(title)
        ) {
          const rect = titleElement.getBoundingClientRect();
          // Permissive visibility check - any visible part counts as visible
          const viewportHeight = window.innerHeight;
          
          const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
          const totalHeight = rect.height;
          const visibilityRatio = totalHeight > 0 ? visibleHeight / totalHeight : 0;
          
          const isVisible = rect.top < viewportHeight && 
                           rect.bottom > 0 && 
                           rect.width > 0 && 
                           rect.height > 10 && 
                           visibilityRatio > 0.1; // Any part visible (more than 10%)
          
          if (isVisible) {
            processedTitles.add(title);
            console.log("📅 Found visible daily note:", title, `(${(visibilityRatio * 100).toFixed(1)}% visible, rect: top=${rect.top}, bottom=${rect.bottom}, viewport=${viewportHeight})`);

            const page = await this.getPageByTitle(title);
            if (page) {
              visibleDailyNotes.push(page);
            }
          } else {
            console.log("📅 Daily note not sufficiently visible:", title, `(${(visibilityRatio * 100).toFixed(1)}% visible, rect: top=${rect.top}, bottom=${rect.bottom}, viewport=${viewportHeight})`);
          }
        }
      }

      // Sort by date (newest first)
      visibleDailyNotes.sort((a, b) => {
        const dateA = this.parseDateFromTitle(a.title);
        const dateB = this.parseDateFromTitle(b.title);
        return dateB.getTime() - dateA.getTime();
      });

      return visibleDailyNotes;
    } catch (error) {
      console.error("Error getting visible daily notes:", error);
      return [];
    }
  }

  /**
   * Parse date from daily note title
   */
  static parseDateFromTitle(title: string): Date {
    try {
      // Handle Roam's date format: "August 13th, 2025"
      const match = title.match(/(\w+)\s+(\d{1,2})\w*,\s+(\d{4})/);
      if (match) {
        const [, month, day, year] = match;
        return new Date(`${month} ${day}, ${year}`);
      }

      // Fallback to other formats
      return new Date(title);
    } catch (error) {
      return new Date();
    }
  }
}
