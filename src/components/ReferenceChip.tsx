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
}

// React component for rendering the chip
const ReferenceChipComponent: React.FC<ReactNodeViewProps> = ({ node }) => {
  const { uid, preview } = node.attrs;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Navigate to the block in Roam
    if (uid && typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const roamAPI = (window as any).roamAlphaAPI;
        // Use Roam's API to navigate to the block
        roamAPI.ui.mainWindow.openBlock({ block: { uid } });
      } catch (error) {
        console.error("Failed to navigate to block:", error);
        // Fallback: try to open the block reference
        try {
          const roamAPI = (window as any).roamAlphaAPI;
          roamAPI.ui.rightSidebar.addWindow({
            window: { type: "block", "block-uid": uid },
          });
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
      title={`Block reference: ${uid}`}
      contentEditable={false}
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
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-uid]",
        getAttrs: (element) => {
          const uid = (element as HTMLElement).getAttribute("data-uid");
          const preview = (element as HTMLElement).getAttribute("data-preview");
          return uid ? { uid, preview: preview || "Reference" } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "reference-chip",
        "data-uid": HTMLAttributes.uid,
        "data-preview": HTMLAttributes.preview,
      }),
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
  preview: string
) => {
  return editor
    .chain()
    .focus()
    .insertReferenceChip({ uid, preview })
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
    return `((${node.attrs?.uid || ""}))`;
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
