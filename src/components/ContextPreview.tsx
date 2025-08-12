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

  const renderHoverList = (items: { uid: string; string: string }[]) => (
    <div className="rr-context-popover">
      <div className="rr-context-popover__body">
        {items.length === 0 && (
          <div className="rr-context-popover__empty">No items</div>
        )}
        {items.slice(0, 30).map((b) => (
          <div key={b.uid} className="rr-context-hover-row">
            <div className="rr-context-hover-text" title={b.string}>
              {b.string || "(empty)"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Separate page content and backlinks
  const currentPageBlocks = context.currentPage?.blocks || [];
  const visibleBlocks = context.visibleBlocks || [];
  const selectedText = context.selectedText;
  const dailyNoteBlocks = context.dailyNote?.blocks || [];
  const backlinks = context.linkedReferences || [];
  const sidebarNotes = context.sidebarNotes || [];

  // Check if page has any content
  const hasPageContent = currentPageBlocks.length > 0 || visibleBlocks.length > 0 || selectedText || dailyNoteBlocks.length > 0;
  const hasBacklinks = backlinks.length > 0;
  const hasSidebarNotes = sidebarNotes.length > 0;

  if (!hasPageContent && !hasBacklinks && !hasSidebarNotes) return null;

  return (
    <div className="rr-context-preview">
      {/* Current Page Chip - always show the page name, count shows content blocks */}
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
            className="rr-context-chip rr-context-chip--page"
            title={context.currentPage.title}
          >
            <Icon icon="document" size={12} />
            <span className="rr-context-chip__text">
              {context.currentPage.title}
            </span>
            <span className="rr-context-chip__count">{currentPageBlocks.length}</span>
          </Tag>
        </Popover>
      )}

      {/* Visible Blocks */}
      {visibleBlocks.length > 0 && (
        <Popover
          content={renderHoverList(visibleBlocks)}
          position={Position.TOP}
          interactionKind="hover"
          minimal
          hoverOpenDelay={100}
        >
          <Tag
            minimal
            round
            className="rr-context-chip rr-context-chip--visible"
            title={`Visible blocks: ${visibleBlocks.length}`}
          >
            <Icon icon="eye-open" size={12} />
            <span className="rr-context-chip__text">Visible</span>
            <span className="rr-context-chip__count">{visibleBlocks.length}</span>
          </Tag>
        </Popover>
      )}

      {/* Selected Text */}
      {selectedText && (
        <Tag
          minimal
          round
          className="rr-context-chip rr-context-chip--selected"
          title={selectedText.length > 100 ? selectedText.substring(0, 100) + "..." : selectedText}
        >
          <Icon icon="selection" size={12} />
          <span className="rr-context-chip__text">Selected</span>
        </Tag>
      )}

      {/* Daily Note */}
      {context.dailyNote && dailyNoteBlocks.length > 0 && (
        <Popover
          content={renderHoverList(dailyNoteBlocks)}
          position={Position.TOP}
          interactionKind="hover"
          minimal
          hoverOpenDelay={100}
        >
          <Tag
            minimal
            round
            className="rr-context-chip rr-context-chip--daily"
            title={context.dailyNote.title}
          >
            <Icon icon="calendar" size={12} />
            <span className="rr-context-chip__text">
              {context.dailyNote.title}
            </span>
            <span className="rr-context-chip__count">{dailyNoteBlocks.length}</span>
          </Tag>
        </Popover>
      )}

      {/* Sidebar Notes */}
      {hasSidebarNotes && (
        <Popover
          content={
            <div className="rr-context-popover">
              <div className="rr-context-popover__body">
                {sidebarNotes.length === 0 && (
                  <div className="rr-context-popover__empty">No sidebar notes</div>
                )}
                {sidebarNotes.slice(0, 10).map((note) => (
                  <div key={note.uid} className="rr-context-hover-row">
                    <div className="rr-context-hover-text" title={note.title}>
                      <strong>{note.title}</strong> ({note.blocks.length} blocks)
                    </div>
                  </div>
                ))}
                {sidebarNotes.length > 10 && (
                  <div className="rr-context-hover-row">
                    <div className="rr-context-hover-text">
                      ... and {sidebarNotes.length - 10} more sidebar notes
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
          position={Position.TOP}
          interactionKind="hover"
          minimal
          hoverOpenDelay={100}
        >
          <Tag
            minimal
            round
            className="rr-context-chip rr-context-chip--sidebar"
            title={`Sidebar notes: ${sidebarNotes.length}`}
          >
            <Icon icon="panel-stats" size={12} />
            <span className="rr-context-chip__text">Sidebar</span>
            <span className="rr-context-chip__count">{sidebarNotes.length}</span>
          </Tag>
        </Popover>
      )}

      {/* Backlinks */}
      {hasBacklinks && (
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
            className="rr-context-chip rr-context-chip--backlinks"
            title={`Backlinks: ${backlinks.length}`}
          >
            <Icon icon="link" size={12} />
            <span className="rr-context-chip__text">Backlinks</span>
            <span className="rr-context-chip__count">{backlinks.length}</span>
          </Tag>
        </Popover>
      )}
    </div>
  );
};
