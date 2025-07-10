// src/components/ReferenceChip.tsx
import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  ReactNodeViewProps,
} from "@tiptap/react";

// Interface for reference chip attributes
export interface ReferenceChipAttributes {
  uid: string;
  preview: string;
  type?: "block" | "page";
}

// React component for rendering the chip
const ReferenceChipComponent: React.FC<ReactNodeViewProps> = ({ node }) => {
  const { uid, preview, type = "block" } = node.attrs;
  console.log('🎨 ReferenceChipComponent rendered with:', { uid, preview, type });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Navigate to the page or block in Roam
    if (uid && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        
        if (type === "page") {
          // Navigate to page using the preview as the page title
          roamAPI.ui.mainWindow.openPage({ page: { title: preview } });
        } else {
          // Navigate to block using the uid
          roamAPI.ui.mainWindow.openBlock({ block: { uid } });
        }
      } catch (error) {
        console.error(`Failed to navigate to ${type}:`, error);
        // Fallback: try to open in right sidebar
        try {
          const roamAPI = (window as any).roamAlphaAPI;
          if (type === "page") {
            roamAPI.ui.rightSidebar.addWindow({
              window: { type: "page", "page-title": preview },
            });
          } else {
            roamAPI.ui.rightSidebar.addWindow({
              window: { type: "block", "block-uid": uid },
            });
          }
        } catch (fallbackError) {
          console.error("Fallback navigation also failed:", fallbackError);
        }
      }
    }
  };

  return (
    <NodeViewWrapper
      as="span"
      className="reference-chip"
      onClick={handleClick}
      title={`${type === "page" ? "Page" : "Block"} reference: ${type === "page" ? preview : uid}`}
      contentEditable={false}
      data-type={type}
      style={{
        outline: "none",
        border: "none",
        boxShadow: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
    >
      {preview}
    </NodeViewWrapper>
  );
};

// TipTap node extension
export const ReferenceChip = Node.create({
  name: "referenceChip",

  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      uid: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-uid"),
        renderHTML: (attributes) => {
          if (!attributes.uid) {
            return {};
          }
          return {
            "data-uid": attributes.uid,
          };
        },
      },
      preview: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-preview"),
        renderHTML: (attributes) => {
          if (!attributes.preview) {
            return {};
          }
          return {
            "data-preview": attributes.preview,
          };
        },
      },
      type: {
        default: "block",
        parseHTML: (element) => element.getAttribute("data-type"),
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {};
          }
          return {
            "data-type": attributes.type,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-uid]",
        getAttrs: (element) => {
          const uid = (element as HTMLElement).getAttribute("data-uid");
          const preview = (element as HTMLElement).getAttribute("data-preview");
          const type = (element as HTMLElement).getAttribute("data-type") || "block";
          return uid ? { uid, preview: preview || "Reference", type } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    console.log('🎨 ReferenceChip renderHTML called with:', HTMLAttributes);
    const attributes = {
      class: "reference-chip",
      "data-uid": HTMLAttributes.uid,
      "data-preview": HTMLAttributes.preview,
      "data-type": HTMLAttributes.type || "block",
    };
    console.log('🎨 Final attributes:', attributes);
    return [
      "span",
      mergeAttributes(HTMLAttributes, attributes),
      HTMLAttributes.preview || "Reference",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReferenceChipComponent);
  },

  addCommands() {
    return {
      insertReferenceChip:
        (attributes: ReferenceChipAttributes) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    } as any;
  },

  // Enable keyboard navigation
  addKeyboardShortcuts() {
    return {
      // Delete chip with backspace/delete
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;

        // Check if we're after a reference chip
        const before = $from.nodeBefore;
        if (before && before.type === this.type) {
          return editor.commands.deleteNode(this.name);
        }

        return false;
      },
      Delete: ({ editor }) => {
        const { selection } = editor.state;
        const { $to } = selection;

        // Check if we're before a reference chip
        const after = $to.nodeAfter;
        if (after && after.type === this.type) {
          return editor.commands.deleteNode(this.name);
        }

        return false;
      },
    };
  },
});

// Utility function to insert a reference chip
export const insertReferenceChip = (
  editor: any,
  uid: string,
  preview: string,
  type: "block" | "page" = "block"
) => {
  console.log('🎨 insertReferenceChip called with:', { uid, preview, type });
  return editor
    .chain()
    .focus()
    .insertReferenceChip({ uid, preview, type })
    .insertContent(" ") // Add a space after the chip
    .run();
};

// Utility function to parse ((UID)) text and convert to chips
export const parseReferencesFromText = (
  text: string
): Array<{ uid: string; text: string }> => {
  const references: Array<{ uid: string; text: string }> = [];
  const regex = /\(\(([a-zA-Z0-9_-]+)\)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    references.push({
      uid: match[1],
      text: match[0], // The full ((UID)) text
    });
  }

  return references;
};

// Utility function to serialize editor content to plain text with ((UID)) format
export const serializeWithReferences = (editor: any): string => {
  const doc = editor.getJSON();
  return serializeNodeToText(doc);
};

function serializeNodeToText(node: any): string {
  if (node.type === "text") {
    return node.text || "";
  }

  if (node.type === "referenceChip") {
    const type = node.attrs?.type || 'block';
    const uid = node.attrs?.uid || '';
    const preview = node.attrs?.preview || '';
    
    // For page references, use [[PageName]] format
    if (type === 'page') {
      return `[[${preview}]]`;
    }
    // For block references, use ((uid)) format
    return `((${uid}))`;
  }

  if (node.type === "paragraph") {
    const content =
      node.content?.map((child: any) => serializeNodeToText(child)).join("") ||
      "";
    return content + "\n";
  }

  if (node.type === "doc") {
    return (
      node.content?.map((child: any) => serializeNodeToText(child)).join("") ||
      ""
    );
  }

  // Handle other node types
  if (node.content) {
    return node.content
      .map((child: any) => serializeNodeToText(child))
      .join("");
  }

  return "";
}
