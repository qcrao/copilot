// src/services/contextComposer.ts
import { PageContext, RoamBlock } from "../types";
import { ContextItem } from "./contextManager";
import { RoamService } from "./roamService";

export interface UnifiedContextOptions {
  provider?: string;
  model?: string;
  maxTokens?: number; // hard cap for context tokens (optional)
  contextTokenShare?: number; // fraction of model window used for context, default 0.7
  curatedShare?: number; // fraction of context budget reserved for curated levels, default 0.85
  includeGuidelines?: boolean; // append reference guidelines, default true
  includeDailyNotes?: boolean; // include visible daily notes if available, default true
  includeSidebarNotes?: boolean; // include sidebar notes if available, default true
  levelWeights?: Record<number, number>; // optional override per-level weight
}

type Section = {
  key: string;
  title: string;
  content: string;
  priority: number; // lower = more important
  allocatedTokens: number; // initial allocation, will be rebalanced
  actualTokensNeeded?: number; // computed later
};

/**
 * Compose a unified, dynamically-sized context string by combining curated ContextItems
 * (grouped by semantic level) with optional extras from PageContext (sidebar/daily notes),
 * using token-budget allocation instead of fixed item counts.
 */
export function composeUnifiedContext(
  items: ContextItem[],
  pageContext?: PageContext,
  options: UnifiedContextOptions = {}
): string {
  const {
    provider,
    model,
    includeGuidelines = true,
    includeDailyNotes = true,
    includeSidebarNotes = true,
    contextTokenShare = 0.7,
    curatedShare = 0.85,
    maxTokens,
    levelWeights,
  } = options;

  // 1) Determine available token budget
  const modelLimit = provider && model
    ? RoamService.getModelTokenLimit(provider, model)
    : 6000; // sensible default

  // Model-side budget reserved for context (e.g., 70% of window)
  const modelBudget = Math.floor(modelLimit * contextTokenShare);
  // User provided cap (from settings) may be undefined; clamp to modelBudget
  const requestedBudget = typeof maxTokens === 'number' ? maxTokens : modelBudget;
  // Enforce a practical minimum of 1000 to keep context meaningful (as agreed)
  const maxContextTokens = Math.max(1000, Math.min(requestedBudget, modelBudget));

  // 2) Build curated sections by level (0,1,2,3+)
  const itemsByLevel: Record<number, ContextItem[]> = {};
  for (const it of items) {
    const lvl = it.level ?? 0;
    if (!itemsByLevel[lvl]) itemsByLevel[lvl] = [];
    itemsByLevel[lvl].push(it);
  }

  const presentLevels = Object.keys(itemsByLevel)
    .map((s) => Number(s))
    .sort((a, b) => a - b);

  // Default decreasing weights by level
  const defaultWeights: Record<number, number> = {
    0: 0.5,
    1: 0.3,
    2: 0.15,
    3: 0.05,
  };

  // Normalize weights only across the levels that are present
  const levelWeightFor = (lvl: number): number => {
    const base = levelWeights?.[lvl] ?? defaultWeights[lvl] ?? 0.05;
    return base;
  };

  const weightSum = presentLevels.reduce((sum, lvl) => sum + levelWeightFor(lvl), 0) || 1;

  const curatedTokenBudget = Math.floor(maxContextTokens * curatedShare);
  const extrasTokenBudget = maxContextTokens - curatedTokenBudget;

  const curatedSections: Section[] = [];
  for (const lvl of presentLevels) {
    const sectionTitle = getLevelTitle(lvl);
    const sectionContent = formatItemsForLevel(itemsByLevel[lvl]);

    const normalizedWeight = levelWeightFor(lvl) / weightSum;
    const allocated = Math.max(0, Math.floor(curatedTokenBudget * normalizedWeight));

    curatedSections.push({
      key: `curated-level-${lvl}`,
      title: `=== ${sectionTitle} ===`,
      content: sectionContent,
      priority: 1 + lvl, // level 0 highest priority
      allocatedTokens: allocated,
    });
  }

  // 3) Build optional extras from PageContext (no fixed counts)
  const extraSections: Section[] = [];
  const graphName = RoamService.getCurrentGraphName?.();
  const isDesktop = RoamService.isDesktopApp?.();

  // Use curated items' UIDs to avoid simple duplicates in extras
  const curatedBlockUids = new Set<string>(
    items
      .filter((i) => i.type === "block" || i.type === "reference")
      .map((i) => i.uid)
  );

  if (pageContext) {
    if (includeSidebarNotes && pageContext.sidebarNotes && pageContext.sidebarNotes.length > 0) {
      const parts: string[] = [];
      parts.push(`**Sidebar Notes (${pageContext.sidebarNotes.length} open):**`);

      for (const note of pageContext.sidebarNotes) {
        const urlLinks = (() => {
          if (!graphName) return `[[${note.title}]]`;
          const urls = RoamService.generatePageUrl(note.uid, graphName);
          if (!urls) return `[[${note.title}]]`;
          return isDesktop
            ? `[🔗 Open in Roam](${urls.desktopUrl})`
            : `[🔗 Web](${urls.webUrl}) | [🔗 Desktop](${urls.desktopUrl})`;
        })();

        parts.push(`**Sidebar: "${note.title}"** ${urlLinks}`);

        const filteredBlocks = (note.blocks || []).filter((b) => !curatedBlockUids.has(b.uid));
        if (filteredBlocks.length > 0) {
          const formatted = RoamService.formatBlocksForAIWithClickableReferences(
            filteredBlocks,
            0,
            graphName,
            isDesktop
          );
          if (formatted.trim()) parts.push(formatted.trim());
        }
      }

      extraSections.push({
        key: "extras-sidebar",
        title: "",
        content: parts.join("\n"),
        priority: 10,
        allocatedTokens: 0, // assigned later
      });
    }

    if (includeDailyNotes && pageContext.visibleDailyNotes && pageContext.visibleDailyNotes.length > 0) {
      const parts: string[] = [];
      parts.push(`**Visible Daily Notes (${pageContext.visibleDailyNotes.length} dates):**`);

      for (const daily of pageContext.visibleDailyNotes) {
        const urlLinks = (() => {
          if (!graphName) return `[[${daily.title}]]`;
          const urls = RoamService.generatePageUrl(daily.uid, graphName);
          if (!urls) return `[[${daily.title}]]`;
          return isDesktop
            ? `[🔗 Open in Roam](${urls.desktopUrl})`
            : `[🔗 Web](${urls.webUrl}) | [🔗 Desktop](${urls.desktopUrl})`;
        })();

        parts.push(`**${daily.title}** ${urlLinks}`);

        const filteredBlocks = (daily.blocks || []).filter((b) => !curatedBlockUids.has(b.uid));
        if (filteredBlocks.length > 0) {
          const formatted = RoamService.formatBlocksForAIWithClickableReferences(
            filteredBlocks,
            0,
            graphName,
            isDesktop
          );
          if (formatted.trim()) parts.push(formatted.trim());
        }
      }

      extraSections.push({
        key: "extras-dailies",
        title: "",
        content: parts.join("\n"),
        priority: 11,
        allocatedTokens: 0, // assigned later
      });
    }
  }

  // Distribute extras budget equally among present extras
  if (extraSections.length > 0 && extrasTokenBudget > 0) {
    const per = Math.floor(extrasTokenBudget / extraSections.length);
    for (const s of extraSections) s.allocatedTokens = per;
  }

  // 4) Merge and compute needs, then dynamically rebalance unused tokens
  const sections: Section[] = [...curatedSections, ...extraSections];

  // If nothing to include, align with minimal-tool-call semantics when pageContext present
  if (sections.length === 0) {
    if (pageContext) {
      return "**Context Note:** This is minimal context for tool execution to avoid interference.";
    }
    return "No relevant context content found.";
  }

  for (const s of sections) {
    const header = s.title ? s.title + "\n" : "";
    const headerTokens = RoamService.estimateTokenCount(header);
    const contentTokens = RoamService.estimateTokenCount(s.content);
    s.actualTokensNeeded = headerTokens + contentTokens;
  }

  // First pass: accumulate surplus
  let unused = 0;
  for (const s of sections) {
    const need = s.actualTokensNeeded || 0;
    if (need < s.allocatedTokens) {
      unused += s.allocatedTokens - need;
      s.allocatedTokens = need;
    }
  }

  // Second pass: give unused tokens to higher priority sections that need more
  if (unused > 0) {
    const needy = sections
      .filter((s) => (s.actualTokensNeeded || 0) > s.allocatedTokens)
      .sort((a, b) => a.priority - b.priority);

    for (const s of needy) {
      if (unused <= 0) break;
      const need = (s.actualTokensNeeded || 0) - s.allocatedTokens;
      const give = Math.min(need, unused);
      s.allocatedTokens += give;
      unused -= give;
    }
  }

  // 5) Build final context honoring the per-section allocations
  let usedTokens = 0;
  const out: string[] = [];
  // Sort sections by priority
  sections.sort((a, b) => a.priority - b.priority);

  // Prepend a concise source summary when the user explicitly selected pages
  try {
    const selectedPages = items
      .filter((i) => i.type === "page" && i.level === 0)
      .map((i) => {
        const title = i.title || "Untitled";
        const date = i.createdDate ? ` (${i.createdDate})` : "";
        return `[[${title}]]${date}`;
      });
    if (selectedPages.length > 0) {
      out.push(`**Context Sources:** ${selectedPages.join(", ")}`);
    }
  } catch (e) {
    // Non-fatal; keep context generation robust
  }

  // Dynamic small-section threshold (avoid dropping all content on small budgets)
  const minSectionThreshold = Math.max(20, Math.floor(maxContextTokens * 0.03));

  for (const s of sections) {
    const header = s.title ? s.title + "\n" : "";
    const headerTokens = RoamService.estimateTokenCount(header);
    if (usedTokens + headerTokens >= maxContextTokens) break;

    const contentTokens = RoamService.estimateTokenCount(s.content);
    const fullTokens = headerTokens + contentTokens;

    if (usedTokens + fullTokens <= maxContextTokens && fullTokens <= s.allocatedTokens) {
      out.push(header + s.content);
      usedTokens += fullTokens;
      continue;
    }

    // Truncate content to fit within remaining allocation and global budget
    const available = Math.max(
      0,
      Math.min(s.allocatedTokens - headerTokens, maxContextTokens - usedTokens - headerTokens)
    );

    if (available > minSectionThreshold) { // ensure meaningful space
      const truncated = truncatePreservingStructureLocal(s.content, available);
      if (truncated.trim().length > 0) {
        out.push(header + truncated);
        usedTokens += headerTokens + RoamService.estimateTokenCount(truncated);
      }
    }
  }

  // Include guidelines only if budget allows
  if (includeGuidelines) {
    const guidelines =
      "\n\n**IMPORTANT GUIDELINES:**\n" +
      "- Only use page references [[Page Name]] that appear in the context above\n" +
      "- Do NOT create new page references that are not already mentioned\n" +
      "- If you need to mention a concept that doesn't have a page reference in the context, use regular text instead of [[]]\n" +
      "- All [[]] references in your response should be clickable and valid\n";

    const gTokens = RoamService.estimateTokenCount(guidelines);
    if (usedTokens + gTokens <= maxContextTokens) {
      out.push(guidelines);
      usedTokens += gTokens;
    } else {
      // Skip guidelines when budget is very tight
    }
  }

  return out.join("\n\n").trim();
}

// Helper: format a list of ContextItems (single level) similar to ContextManager.formatContextForAI
function formatItemsForLevel(items: ContextItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    const dateInfo = item.createdDate ? ` [Created: ${item.createdDate}]` : "";
    const blockRef = item.blockReference || "";

    if (item.type === "page") {
      const title = item.title || "Untitled";
      parts.push(`**Page: ${title}**${dateInfo} ${blockRef}\n${item.content}`);
      continue;
    }

    if (item.type === "block") {
      const pageInfo = item.pageTitle ? ` (from page: ${item.pageTitle})` : "";
      parts.push(`**Block Reference**${pageInfo}${dateInfo} ${blockRef}\n${item.content}`);
      continue;
    }

    if (item.type === "reference") {
      const refPageInfo = item.pageTitle ? ` (from page: ${item.pageTitle})` : "";
      parts.push(`**Backlink**${refPageInfo}${dateInfo} ${blockRef}\n${item.content}`);
      continue;
    }
  }
  return parts.join("\n\n");
}

// Helper: map level -> human-readable title
function getLevelTitle(level: number): string {
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

// Local truncation: preserve paragraph structure (roughly aligns with RoamService behavior)
function truncatePreservingStructureLocal(content: string, maxTokens: number): string {
  const paragraphs = content.split("\n\n");
  const acc: string[] = [];
  let tokens = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const t = RoamService.estimateTokenCount(p);
    if (tokens + t <= Math.floor(maxTokens * 0.9)) { // leave room for notice
      acc.push(p);
      tokens += t;
    } else {
      const remaining = paragraphs.length - i;
      if (remaining > 0) {
        acc.push(`... (${remaining} more sections truncated for brevity)`);
      }
      break;
    }
  }

  return acc.join("\n\n");
}
