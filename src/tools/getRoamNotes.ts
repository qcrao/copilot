// src/tools/getRoamNotes.ts
import { z } from "zod";
import { RoamService } from "../services/roamService";
import { RoamNoteContent, RoamQueryResult } from "../types";

// Input parameter schema for getRoamNotes tool
export const RoamQuerySchema = z.object({
  // Core query parameters
  pageTitle: z.string().optional().describe("精确匹配 Roam Research 中的页面标题。例如：'项目A会议纪要'"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("指定一个日期来获取该日期的所有每日笔记，格式为 YYYY-MM-DD。例如：'2023-10-27'"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("指定一个开始日期来获取该日期及之后的每日笔记，格式为 YYYY-MM-DD。通常与 endDate 结合使用。例如：'2023-10-01'"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("指定一个结束日期来获取该日期及之前的每日笔记，格式为 YYYY-MM-DD。通常与 startDate 结合使用。例如：'2023-10-07'"),
  blockUid: z.string().optional().describe("指定 Roam Research 中某个块的唯一标识符（UID）来获取该块的内容。例如：'abcdefg'"),
  referencedPage: z.string().optional().describe("查找并返回所有引用了指定页面标题的块。例如：'产品迭代计划'"),
  currentPageContext: z.boolean().optional().describe("如果为 true，表示需要获取用户当前正在查看的页面或块的内容。此参数无需外部提供具体值，工具会从运行时上下文获取。"),
  
  // Control parameters
  limit: z.number().int().min(1).max(100).default(20).describe("限制返回的笔记或块的数量，常用于获取最新的笔记。例如：5"),
  includeChildren: z.boolean().default(true).describe("是否包含子块内容"),
  includeReferences: z.boolean().default(false).describe("是否包含引用信息"),
  
  // Advanced query parameters
  searchTerm: z.string().optional().describe("在笔记内容中搜索特定词汇或短语"),
  tags: z.array(z.string()).optional().describe("筛选包含特定标签的笔记"),
  excludePages: z.array(z.string()).optional().describe("排除特定页面的结果")
});

export type RoamQueryInput = z.infer<typeof RoamQuerySchema>;

/**
 * getRoamNotes tool implementation
 * This is the core tool that allows AI to intelligently retrieve Roam Research notes
 */
export class GetRoamNotesTool {
  
  /**
   * Get tool description for LLM
   */
  static getDescription(): string {
    return `检索 Roam Research 中的笔记内容。这是一个强大的工具，可以根据多种条件获取用户的笔记数据。

使用指南：
- **获取特定日期笔记**：使用 date 参数 (YYYY-MM-DD)
- **获取日期范围笔记**：使用 startDate 和 endDate 参数
- **获取特定页面**：使用 pageTitle 参数
- **获取当前查看内容**：使用 currentPageContext: true
- **查找引用内容**：使用 referencedPage 参数
- **获取特定块**：使用 blockUid 参数
- **搜索内容**：使用 searchTerm 参数

最佳实践：
- 当用户提到时间（"昨天"、"本周"、"上个月"）时，自动转换为对应的日期参数
- 当用户说"当前笔记"、"这个页面"时，使用 currentPageContext
- 当用户询问某个概念或项目时，使用 referencedPage 查找相关内容
- 总是使用 limit 参数来控制返回数量，避免数据过载`;
  }

  /**
   * Execute the tool with given parameters
   */
  static async execute(params: RoamQueryInput): Promise<string> {
    try {
      console.log("🔧 执行 getRoamNotes 工具，参数：", params);
      const startTime = performance.now();
      
      // Validate parameters
      const validatedParams = RoamQuerySchema.parse(params);
      
      // Execute the query
      const result = await this.executeQuery(validatedParams);
      
      const executionTime = performance.now() - startTime;
      console.log(`🔧 getRoamNotes 执行完成，耗时 ${executionTime.toFixed(2)}ms，找到 ${result.data.length} 个结果`);
      
      // Format result for AI consumption
      const formattedResult = {
        success: result.success,
        summary: `找到 ${result.totalFound} 个结果 (${result.metadata.queryType} 查询)`,
        queryInfo: result.metadata,
        notes: result.data.map(note => ({
          type: note.type,
          title: note.title,
          content: note.content.length > 500 
            ? note.content.slice(0, 500) + "..." 
            : note.content,
          uid: note.uid,
          path: note.path,
          wordCount: note.wordCount,
          hasMore: note.content.length > 500,
          hasChildren: note.hasChildren,
          referenceCount: note.referenceCount
        })),
        warnings: result.warnings,
        executionTime: `${executionTime.toFixed(2)}ms`
      };

      return JSON.stringify(formattedResult, null, 2);
    } catch (error: any) {
      console.error("❌ getRoamNotes 工具执行错误：", error);
      const errorResult = {
        success: false,
        error: error.message,
        summary: "工具执行失败",
        notes: [],
        executionTime: "0ms"
      };
      return JSON.stringify(errorResult, null, 2);
    }
  }

  /**
   * Execute query based on parameters
   */
  private static async executeQuery(params: RoamQueryInput): Promise<RoamQueryResult> {
    const startTime = performance.now();
    const warnings: string[] = [];
    let notes: RoamNoteContent[] = [];
    let queryType = "unknown";

    try {
      // 1. Current page context query
      if (params.currentPageContext) {
        queryType = "current-page";
        const currentPage = await RoamService.getCurrentPageInfo();
        if (currentPage) {
          notes = [await this.convertPageToNoteContent(currentPage)];
        } else {
          warnings.push("无法获取当前页面信息");
        }
      }
      
      // 2. Specific block query
      else if (params.blockUid) {
        queryType = "block-uid";
        const block = await this.getBlockByUid(params.blockUid, params.includeChildren);
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
          notes = [await this.convertPageToNoteContent(page)];
        } else {
          warnings.push(`未找到标题为 "${params.pageTitle}" 的页面`);
        }
      }
      
      // 4. Single date query
      else if (params.date) {
        queryType = "single-date";
        const dailyNote = await RoamService.getNotesFromDate(params.date);
        if (dailyNote) {
          notes = [await this.convertPageToNoteContent(dailyNote)];
        } else {
          warnings.push(`未找到 ${params.date} 的每日笔记`);
        }
      }
      
      // 5. Date range query
      else if (params.startDate && params.endDate) {
        queryType = "date-range";
        const rangeNotes = await RoamService.getNotesFromDateRange(params.startDate, params.endDate);
        notes = await Promise.all(rangeNotes.map(page => this.convertPageToNoteContent(page)));
        if (notes.length === 0) {
          warnings.push(`未找到 ${params.startDate} 到 ${params.endDate} 期间的笔记`);
        }
      }
      
      // 6. Referenced page query
      else if (params.referencedPage) {
        queryType = "referenced-page";
        const referencedBlocks = await this.getBlocksReferencingPage(params.referencedPage);
        notes = referencedBlocks.map(block => this.convertBlockToNoteContent(block));
        if (notes.length === 0) {
          warnings.push(`未找到引用 "${params.referencedPage}" 的块`);
        }
      }
      
      // 7. Full text search
      else if (params.searchTerm) {
        queryType = "full-text-search";
        notes = await this.searchNotesFullText(params.searchTerm);
        if (notes.length === 0) {
          warnings.push(`未找到包含 "${params.searchTerm}" 的内容`);
        }
      }

      // 8. Post-process results: sort, limit, filter
      notes = this.postProcessResults(notes, params, warnings);

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        data: notes,
        totalFound: notes.length,
        executionTime,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          queryType,
          dateRange: params.startDate && params.endDate 
            ? `${params.startDate} to ${params.endDate}` 
            : undefined,
          sourcePage: params.pageTitle || params.referencedPage
        }
      };

    } catch (error: any) {
      console.error("Error in executeQuery:", error);
      return {
        success: false,
        data: [],
        totalFound: 0,
        executionTime: performance.now() - startTime,
        warnings: [`查询失败: ${error.message}`],
        metadata: { queryType }
      };
    }
  }

  /**
   * Get page by exact title match
   */
  private static async getPageByTitle(title: string): Promise<any | null> {
    try {
      const query = `
        [:find ?uid
         :where
         [?e :node/title "${title}"]
         [?e :block/uid ?uid]]
      `;
      
      const result = window.roamAlphaAPI.q(query);
      if (result && result.length > 0) {
        const uid = result[0][0];
        const blocks = await RoamService.getPageBlocks(uid);
        return { title, uid, blocks };
      }
      return null;
    } catch (error) {
      console.error("Error getting page by title:", error);
      return null;
    }
  }

  /**
   * Get block by UID
   */
  private static async getBlockByUid(uid: string, includeChildren: boolean = true): Promise<RoamNoteContent | null> {
    try {
      const query = `
        [:find ?string
         :where
         [?e :block/uid "${uid}"]
         [?e :block/string ?string]]
      `;
      
      const result = window.roamAlphaAPI.q(query);
      if (result && result.length > 0) {
        const content = result[0][0];
        const noteContent: RoamNoteContent = {
          type: "block",
          uid,
          content,
          wordCount: content.split(/\s+/).length,
          hasChildren: false
        };

        if (includeChildren) {
          const children = await RoamService.getBlockChildren(uid);
          noteContent.children = children.map(child => this.convertBlockToNoteContent(child));
          noteContent.hasChildren = children.length > 0;
        }

        return noteContent;
      }
      return null;
    } catch (error) {
      console.error("Error getting block by UID:", error);
      return null;
    }
  }

  /**
   * Get blocks that reference a specific page
   */
  private static async getBlocksReferencingPage(pageTitle: string): Promise<any[]> {
    try {
      const queries = [
        // Standard page reference [[PageTitle]]
        `[:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "[[${pageTitle}]]")]]`,
        
        // Tag reference #PageTitle
        `[:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? ?string "#${pageTitle}")]]`,
         
        // Direct reference relationship
        `[:find ?uid ?string
         :where
         [?page :node/title "${pageTitle}"]
         [?block :block/refs ?page]
         [?block :block/uid ?uid]
         [?block :block/string ?string]]`
      ];

      const allResults: any[] = [];
      for (const query of queries) {
        try {
          const result = window.roamAlphaAPI.q(query);
          if (result) {
            const blocks = result.map(([uid, string]: [string, string]) => ({
              uid,
              string: string || "",
              children: []
            }));
            allResults.push(...blocks);
          }
        } catch (queryError) {
          console.warn(`Query failed: ${queryError}`);
        }
      }

      // Remove duplicates
      const uniqueBlocks = allResults.filter((block, index, self) => 
        index === self.findIndex(b => b.uid === block.uid)
      );

      return uniqueBlocks;
    } catch (error) {
      console.error("Error getting blocks referencing page:", error);
      return [];
    }
  }

  /**
   * Full text search in notes
   */
  private static async searchNotesFullText(searchTerm: string): Promise<RoamNoteContent[]> {
    try {
      const query = `
        [:find ?uid ?string
         :where
         [?block :block/string ?string]
         [?block :block/uid ?uid]
         [(clojure.string/includes? (clojure.string/lower-case ?string) "${searchTerm.toLowerCase()}")]]
      `;

      const result = window.roamAlphaAPI.q(query);
      if (!result) return [];

      return result.map(([uid, string]: [string, string]) => ({
        type: "search-result" as const,
        uid,
        content: string || "",
        wordCount: (string || "").split(/\s+/).length
      }));
    } catch (error) {
      console.error("Error in full text search:", error);
      return [];
    }
  }

  /**
   * Convert page to note content
   */
  private static async convertPageToNoteContent(page: any): Promise<RoamNoteContent> {
    const content = RoamService.formatBlocksForAI(page.blocks, 0);
    
    return {
      type: page.title.match(/^\d{2}-\d{2}-\d{4}$/) ? "daily-note" : "page",
      title: page.title,
      uid: page.uid,
      content,
      hasChildren: page.blocks.length > 0,
      children: page.blocks.map((block: any) => this.convertBlockToNoteContent(block)),
      wordCount: content.split(/\s+/).length,
      referenceCount: 0 // Could be calculated if needed
    };
  }

  /**
   * Convert block to note content
   */
  private static convertBlockToNoteContent(block: any): RoamNoteContent {
    return {
      type: "block",
      uid: block.uid,
      content: block.string,
      hasChildren: (block.children?.length || 0) > 0,
      children: block.children?.map((child: any) => this.convertBlockToNoteContent(child)),
      wordCount: block.string.split(/\s+/).length
    };
  }

  /**
   * Post-process results: sort, limit, filter
   */
  private static postProcessResults(
    notes: RoamNoteContent[], 
    params: RoamQueryInput, 
    warnings: string[]
  ): RoamNoteContent[] {
    let processed = [...notes];

    // 1. Exclude specified pages
    if (params.excludePages?.length) {
      processed = processed.filter(note => 
        !params.excludePages!.includes(note.title || "")
      );
    }

    // 2. Tag filtering
    if (params.tags?.length) {
      processed = processed.filter(note =>
        params.tags!.some(tag => 
          note.content.includes(`#${tag}`) || note.content.includes(`[[${tag}]]`)
        )
      );
    }

    // 3. Sort by relevance
    processed.sort((a, b) => {
      // Priority: current page > recent modification > content length
      if (a.type === "page" && b.type !== "page") return -1;
      if (b.type === "page" && a.type !== "page") return 1;
      return (b.wordCount || 0) - (a.wordCount || 0);
    });

    // 4. Apply limit
    if (params.limit && processed.length > params.limit) {
      warnings.push(`结果已限制为 ${params.limit} 个项目（共找到 ${processed.length} 个）`);
      processed = processed.slice(0, params.limit);
    }

    return processed;
  }
}