// src/components/ContextPreview.tsx
import React from "react";
import { Icon, Tag, Card } from "@blueprintjs/core";
import { PageContext } from "../types";

interface ContextPreviewProps {
  context: PageContext | null;
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
}) => {
  if (!context) {
    return null;
  }

  const formatBlocksPreview = (blocks: any[], maxLength: number = 100): string => {
    if (!blocks || blocks.length === 0) return "";
    
    const content = blocks
      .map(block => block.string || "")
      .filter(str => str.trim())
      .join("\n")
      .trim();
    
    if (content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength) + "...";
  };

  const getContextSections = (): ContextSection[] => {
    const sections: ContextSection[] = [];

    // Current Page
    if (context.currentPage) {
      sections.push({
        title: context.currentPage.title,
        content: formatBlocksPreview(context.currentPage.blocks),
        icon: "document",
        color: "blue",
        count: context.currentPage.blocks?.length || 0,
      });
    }

    // Selected Text
    if (context.selectedText) {
      sections.push({
        title: "选中文本",
        content: context.selectedText.length > 100 
          ? context.selectedText.substring(0, 100) + "..." 
          : context.selectedText,
        icon: "selection",
        color: "orange",
      });
    }

    // Visible Blocks
    if (context.visibleBlocks && context.visibleBlocks.length > 0) {
      sections.push({
        title: "可见内容",
        content: formatBlocksPreview(context.visibleBlocks),
        icon: "eye-open",
        color: "green",
        count: context.visibleBlocks.length,
      });
    }

    // Daily Note
    if (context.dailyNote && context.dailyNote.blocks && context.dailyNote.blocks.length > 0) {
      sections.push({
        title: context.dailyNote.title,
        content: formatBlocksPreview(context.dailyNote.blocks),
        icon: "calendar",
        color: "purple",
        count: context.dailyNote.blocks.length,
      });
    }

    // Linked References
    if (context.linkedReferences && context.linkedReferences.length > 0) {
      sections.push({
        title: "反向链接",
        content: context.linkedReferences
          .slice(0, 2)
          .map(ref => ref.string)
          .join("\n"),
        icon: "link",
        color: "gray",
        count: context.linkedReferences.length,
      });
    }

    return sections;
  };

  const sections = getContextSections();

  if (sections.length === 0) {
    return (
      <Card className="mb-3 border-l-4 border-l-gray-300 p-3">
        <div className="flex items-center gap-2">
          <Icon icon="info-sign" size={14} />
          <span className="text-xs text-gray-600">暂无上下文信息</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-3 border-l-4 border-l-blue-500 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Icon icon="layers" size={14} />
        <span className="font-medium text-sm">上下文</span>
        <Tag minimal round intent="primary" className="text-xs">
          {sections.length}
        </Tag>
      </div>

      <div className="space-y-2">
        {sections.map((section, index) => (
          <div key={index} className="border rounded p-2 bg-gray-50">
            <div className="flex items-center gap-2 mb-1">
              <Icon 
                icon={section.icon as any} 
                size={12} 
                style={{ color: `var(--bp5-intent-${section.color}-color)` }}
              />
              <span className="text-xs font-medium">{section.title}</span>
              {section.count !== undefined && (
                <Tag minimal round intent={section.color as any} className="text-xs">
                  {section.count}
                </Tag>
              )}
            </div>
            
            {section.content && (
              <div className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white p-2 rounded border max-h-20 overflow-y-auto">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};