// src/components/ContextPreview.tsx
import React, { useMemo } from "react";
import { Icon, Tag, Card, Popover, Position } from "@blueprintjs/core";
import { PageContext } from "../types";

interface ContextPreviewProps {
  context: PageContext | null;
  onExcludeBlock?: (uid: string) => void;
  excludedUids?: Set<string>;
}

interface ContextSection {
  title: string;
  content: string;
  icon: string;
  color: string;
  count?: number;
}

export const ContextPreview: React.FC<ContextPreviewProps> = ({
  context,
  onExcludeBlock,
  excludedUids,
}) => {
  if (!context) return null;

  const formatBlocksPreview = (
    blocks: any[],
    maxLength: number = 140
  ): string => {
    if (!blocks || blocks.length === 0) return "";
    const content = blocks
      .map((block) => block.string || "")
      .filter((str) => str.trim())
      .join("\n")
      .trim();
    return content.length <= maxLength
      ? content
      : content.substring(0, maxLength) + "...";
  };

  const sections = useMemo<ContextSection[]>(() => {
    const s: ContextSection[] = [];
    if (context.currentPage) {
      s.push({
        title: context.currentPage.title,
        content: formatBlocksPreview(context.currentPage.blocks),
        icon: "document",
        color: "primary",
        count: context.currentPage.blocks?.length || 0,
      });
    }
    if (context.selectedText) {
      s.push({
        title: "选中文本",
        content:
          context.selectedText.length > 140
            ? context.selectedText.substring(0, 140) + "..."
            : context.selectedText,
        icon: "selection",
        color: "warning",
      });
    }
    if (context.visibleBlocks && context.visibleBlocks.length > 0) {
      s.push({
        title: "可见内容",
        content: formatBlocksPreview(context.visibleBlocks),
        icon: "eye-open",
        color: "success",
        count: context.visibleBlocks.length,
      });
    }
    if (
      context.dailyNote &&
      context.dailyNote.blocks &&
      context.dailyNote.blocks.length > 0
    ) {
      s.push({
        title: context.dailyNote.title,
        content: formatBlocksPreview(context.dailyNote.blocks),
        icon: "calendar",
        color: "primary",
        count: context.dailyNote.blocks.length,
      });
    }
    if (context.linkedReferences && context.linkedReferences.length > 0) {
      s.push({
        title: "反向链接",
        content: context.linkedReferences
          .slice(0, 3)
          .map((ref) => ref.string)
          .join("\n"),
        icon: "link",
        color: "none",
        count: context.linkedReferences.length,
      });
    }
    return s;
  }, [context]);

  // Collapsed, compact bar when no sections
  if (sections.length === 0) {
    return (
      <div className="rr-context-bar rr-context-bar--empty">
        <span className="rr-context-bar__label">无上下文</span>
      </div>
    );
  }

  // Build hover lists for current page and backlinks
  const currentPageBlocks = context.currentPage?.blocks || [];
  const backlinks = context.linkedReferences || [];

  const renderHoverList = (items: { uid: string; string: string }[]) => (
    <div className="rr-context-popover">
      <div className="rr-context-popover__body">
        {items.length === 0 && (
          <div className="rr-context-popover__empty">无条目</div>
        )}
        {items.slice(0, 30).map((b) => (
          <div key={b.uid} className="rr-context-hover-row">
            <div className="rr-context-hover-text" title={b.string}>
              {b.string || "(空)"}
            </div>
            {onExcludeBlock && (
              <button
                className="rr-context-hover-close"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onExcludeBlock(b.uid);
                }}
                aria-label="移除该条目"
              >
                <Icon icon="cross" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const pageCount = context.currentPage ? 1 : 0;
  const backlinkCount = backlinks.length;

  return (
    <div className="rr-context-bar-container">
      <div className="rr-context-bar" aria-label="页面上下文">
        {context.currentPage && (
          <Popover
            content={renderHoverList(currentPageBlocks)}
            position={Position.TOP}
            interactionKind="hover"
            minimal
            hoverOpenDelay={100}
          >
            <Tag
              minimal
              round
              className="rr-context-chip"
              title={context.currentPage.title}
            >
              <span className="rr-context-chip__text">
                {context.currentPage.title}
              </span>
              <span className="rr-context-chip__count">{pageCount}</span>
            </Tag>
          </Popover>
        )}
        {backlinkCount > 0 && (
          <Popover
            content={renderHoverList(backlinks)}
            position={Position.TOP}
            interactionKind="hover"
            minimal
            hoverOpenDelay={100}
          >
            <Tag
              minimal
              round
              className="rr-context-chip"
              title={`反向链接 ${backlinkCount}`}
            >
              <span className="rr-context-chip__text">反向链接</span>
              <span className="rr-context-chip__count">{backlinkCount}</span>
            </Tag>
          </Popover>
        )}
      </div>
    </div>
  );
};
