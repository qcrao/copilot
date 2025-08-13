// src/components/ContextPreview.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Icon, Tag, Card, Popover, Position } from "@blueprintjs/core";
import { PageContext } from "../types";
import { RoamService } from "../services/roamService";

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
  const [sidebarBacklinks, setSidebarBacklinks] = useState<{ [key: string]: number }>({});

  // Fetch backlinks count for sidebar notes
  useEffect(() => {
    if (!context?.sidebarNotes || context.sidebarNotes.length === 0) return;

    const fetchBacklinks = async () => {
      const backlinkCounts: { [key: string]: number } = {};
      
      for (const note of context.sidebarNotes || []) {
        try {
          const backlinks = await RoamService.getLinkedReferences(note.title);
          backlinkCounts[note.uid] = backlinks.length;
        } catch (error) {
          console.warn('Error fetching backlinks for', note.title, error);
          backlinkCounts[note.uid] = 0;
        }
      }
      
      setSidebarBacklinks(backlinkCounts);
    };

    fetchBacklinks();
  }, [context?.sidebarNotes]);

  if (!context) return null;

  // Helper function to count non-empty blocks
  const countNonEmptyBlocks = (blocks: { uid: string; string: string }[]) => {
    return blocks.filter(block => block.string && block.string.trim().length > 0).length;
  };

  const renderHoverList = (items: { uid: string; string: string }[]) => {
    // Filter out empty blocks completely
    const nonEmptyBlocks = items.filter(block => block.string && block.string.trim().length > 0);
    
    return (
      <div className="rr-context-popover">
        <div className="rr-context-popover__body">
          {nonEmptyBlocks.length === 0 && (
            <div className="rr-context-popover__empty">0 blocks</div>
          )}
          {nonEmptyBlocks.slice(0, 30).map((b) => (
            <div key={b.uid} className="rr-context-hover-row">
              <div className="rr-context-hover-text" title={b.string}>
                {b.string}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Separate page content and backlinks
  const currentPageBlocks = context.currentPage?.blocks || [];
  const visibleBlocks = context.visibleBlocks || [];
  const selectedText = context.selectedText;
  const dailyNoteBlocks = context.dailyNote?.blocks || [];
  const backlinks = context.linkedReferences || [];
  const sidebarNotes = context.sidebarNotes || [];
  
  
  // Helper function to check if a page title is a daily note
  const isDailyNote = (title: string): boolean => {
    if (!title) return false;
    const dailyNotePatterns = [
      /^\w+ \d{1,2}(st|nd|rd|th), \d{4}$/, // "January 1st, 2024"
      /^\d{1,2}-\d{1,2}-\d{4}$/, // "01-01-2024"
      /^\d{4}-\d{1,2}-\d{1,2}$/, // "2024-01-01"
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // "01/01/2024"
    ];
    return dailyNotePatterns.some(pattern => pattern.test(title));
  };

  // Check if current page is a daily note
  const isCurrentPageDaily = context.currentPage ? isDailyNote(context.currentPage.title) : false;
  
  // Check if daily note is the same as current page
  const isDailyNoteSameAsCurrentPage = context.currentPage && context.dailyNote && 
    context.currentPage.uid === context.dailyNote.uid;

  // Check if page has any content (only count non-empty blocks)
  const hasPageContent = countNonEmptyBlocks(currentPageBlocks) > 0 || 
                         countNonEmptyBlocks(visibleBlocks) > 0 || 
                         selectedText || 
                         countNonEmptyBlocks(dailyNoteBlocks) > 0;
  const hasBacklinks = backlinks.length > 0;
  const hasSidebarNotes = sidebarNotes.length > 0;

  if (!hasPageContent && !hasBacklinks && !hasSidebarNotes) return null;

  return (
    <div className="rr-context-preview">
      {/* Current Page Chip - show as daily note if it's a daily note, otherwise as regular page */}
      {context.currentPage && (
        <Popover
          content={renderHoverList(currentPageBlocks.length > 0 ? currentPageBlocks : visibleBlocks)}
          position={Position.TOP}
          interactionKind="hover"
          minimal
          hoverOpenDelay={100}
        >
          <Tag
            minimal
            round
            className={isCurrentPageDaily ? "rr-context-chip rr-context-chip--daily" : "rr-context-chip rr-context-chip--page"}
            title={context.currentPage.title}
          >
            <Icon icon={isCurrentPageDaily ? "calendar" : "document"} size={12} />
            <span className="rr-context-chip__text">
              {context.currentPage.title}
            </span>
            <span className="rr-context-chip__count">
              {currentPageBlocks.length > 0 
                ? countNonEmptyBlocks(currentPageBlocks) 
                : countNonEmptyBlocks(visibleBlocks)}
            </span>
          </Tag>
        </Popover>
      )}

      {/* Visible Blocks - only show if they are different from current page blocks */}
      {visibleBlocks.length > 0 && currentPageBlocks.length > 0 && (
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
            <span className="rr-context-chip__count">{countNonEmptyBlocks(visibleBlocks)}</span>
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

      {/* Daily Note - only show if it's different from current page */}
      {context.dailyNote && dailyNoteBlocks.length > 0 && !isDailyNoteSameAsCurrentPage && (
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
            <span className="rr-context-chip__count">{countNonEmptyBlocks(dailyNoteBlocks)}</span>
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
                {sidebarNotes.slice(0, 10).map((note) => {
                  const backlinkCount = sidebarBacklinks[note.uid] || 0;
                  return (
                    <div key={note.uid} className="rr-context-hover-row">
                      <div className="rr-context-hover-text" title={note.title}>
                        <strong>{note.title}</strong> ({note.blocks.length} blocks, {backlinkCount} backlinks)
                      </div>
                    </div>
                  );
                })}
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
