// src/components/ChatInput.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  ReferenceChip,
  insertReferenceChip,
  parseReferencesFromText,
  serializeWithReferences,
} from "./ReferenceChip";
import { RoamQuery } from "../utils/roamQuery";
import { PromptMenu } from "./PromptMenu";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { PromptTemplate } from "../types";
import {
  aiSettings,
  multiProviderSettings,
  getAvailableModels,
} from "../settings";

interface ChatInputProps {
  placeholder?: string;
  onSend: (message: string) => void;
  disabled?: boolean;
  onModelChange?: (model: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  onDateSelect?: (date: string, notes: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  placeholder = "Ask me anything about your notes...",
  onSend,
  disabled = false,
  onModelChange,
  value: controlledValue,
  onChange,
  onDateSelect,
}) => {
  const [availableModels, setAvailableModels] = useState<
    Array<{ model: string; provider: string; providerName: string }>
  >([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Prompt menu states
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [promptFilter, setPromptFilter] = useState("");
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [filteredPrompts, setFilteredPrompts] = useState<PromptTemplate[]>([]);
  const [promptMenuPosition, setPromptMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default drop cursor since we're using Dropcursor extension
        dropcursor: false,
      }),
      Dropcursor.configure({
        color: "#4285f4",
        width: 2,
      }),
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-empty",
      }),
      ReferenceChip,
    ],
    content: controlledValue || "",
    editorProps: {
      attributes: {
        class: "rr-copilot-editor",
        style:
          "outline: none; min-height: 24px; max-height: 120px; overflow-y: auto; line-height: 1.5;",
        "data-placeholder": placeholder,
        tabindex: "0",
      },
      handleDrop: (view, event, slice, moved) => {
        // Handle Roam block drops
        if (event.dataTransfer) {
          const uid = RoamQuery.extractUidFromDragData(event.dataTransfer);
          if (uid) {
            event.preventDefault();
            handleBlockDrop(uid, event);
            return true;
          }
        }
        return false;
      },
      handleClick: (view, pos, event) => {
        // Don't interfere with default click handling
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      handleContentChange(text);
    },
    onCreate: ({ editor }) => {
      // Initialize with controlled value if provided
      if (controlledValue) {
        initializeWithReferences(controlledValue);
        setLastInitializedValue(controlledValue);
      }
    },
  });

  // Handle controlled value changes (e.g., when widget reopens)
  const [lastInitializedValue, setLastInitializedValue] = useState<string>("");

  useEffect(() => {
    if (editor && controlledValue && controlledValue !== lastInitializedValue) {
      // Only reinitialize if the controlled value is different from what we last initialized
      const currentSerializedContent = serializeWithReferences(editor);
      if (currentSerializedContent !== controlledValue) {
        initializeWithReferences(controlledValue);
        setLastInitializedValue(controlledValue);
      }
    }
  }, [editor, controlledValue, lastInitializedValue]);

  // Get all available models from providers with API keys
  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error("Failed to load available models:", error);
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
    const interval = setInterval(loadModels, 30000);
    return () => clearInterval(interval);
  }, [multiProviderSettings.ollamaBaseUrl]);

  // Ensure selectedModel is valid
  const getValidModel = () => {
    if (
      availableModels.some(
        (m) => m.model === multiProviderSettings.currentModel
      )
    ) {
      return multiProviderSettings.currentModel;
    }
    return availableModels.length > 0 ? availableModels[0].model : "";
  };

  const [selectedModel, setSelectedModel] = useState(getValidModel());

  // Update selectedModel when available models change
  useEffect(() => {
    if (!isLoadingModels && availableModels.length > 0) {
      const validModel = getValidModel();
      if (validModel !== selectedModel) {
        setSelectedModel(validModel);
        if (validModel) {
          multiProviderSettings.currentModel = validModel;
          // Save to extension settings
          if (typeof window !== "undefined" && (window as any).roamAlphaAPI) {
            try {
              const extensionAPI = (window as any).roamAlphaAPI.ui
                .commandPalette;
              if (extensionAPI && extensionAPI.settings) {
                extensionAPI.settings.set("copilot-current-model", validModel);
              }
            } catch (error) {
              console.log("Could not save model setting:", error);
            }
          }
        }
      }
    }
  }, [availableModels, isLoadingModels, selectedModel]);

  // Handle block drop
  const handleBlockDrop = async (uid: string, event: DragEvent) => {
    try {
      console.log("Handling block drop:", uid);

      // Get block content
      const blockData = await RoamQuery.getBlock(uid);
      if (!blockData) {
        console.error("Could not fetch block data for:", uid);
        return;
      }

      // Create preview text
      const preview = RoamQuery.formatBlockPreview(blockData.string, 10);

      // Insert the reference chip at drop position
      if (editor) {
        // Get the drop position
        const coords = { left: event.clientX, top: event.clientY };
        const pos = editor.view.posAtCoords(coords);

        if (pos) {
          editor.commands.setTextSelection(pos.pos);
        }

        // Insert the reference chip (which already includes focus and space)
        insertReferenceChip(editor, uid, preview);

        // Ensure the editor remains focused and cursor is visible
        setTimeout(() => {
          if (editor && editor.view && editor.view.dom) {
            editor.commands.focus();
            // Trigger a content change to ensure the editor is properly updated
            const serializedContent = serializeWithReferences(editor);
            if (onChange) {
              onChange(serializedContent);
            }
          }
        }, 50);
      }
    } catch (error) {
      console.error("Error handling block drop:", error);
    }
  };

  // Initialize editor with references from text
  const initializeWithReferences = async (text: string) => {
    if (!editor) return;

    setIsInitializing(true);

    try {
      const references = parseReferencesFromText(text);

      if (references.length === 0) {
        editor.commands.setContent(text);
        return;
      }

      // Build the content with reference chips
      let currentText = text;
      const sortedReferences = references.sort(
        (a, b) => currentText.indexOf(a.text) - currentText.indexOf(b.text)
      );

      // Clear the editor first
      editor.commands.clearContent();

      // Process text parts and references in order
      let lastIndex = 0;

      for (const ref of sortedReferences) {
        const refIndex = currentText.indexOf(ref.text, lastIndex);

        // Add text before the reference
        if (refIndex > lastIndex) {
          const textBefore = currentText.slice(lastIndex, refIndex);
          if (textBefore) {
            editor.commands.insertContent(textBefore);
          }
        }

        // Add the reference chip
        try {
          const blockData = await RoamQuery.getBlock(ref.uid);
          const preview = blockData
            ? RoamQuery.formatBlockPreview(blockData.string, 10)
            : `Block ${ref.uid}`;

          insertReferenceChip(editor, ref.uid, preview);
        } catch (error) {
          console.error("Error loading reference:", ref.uid, error);
          // Fallback to text
          editor.commands.insertContent(`[Block ${ref.uid}]`);
        }

        lastIndex = refIndex + ref.text.length;
      }

      // Add any remaining text after the last reference
      if (lastIndex < currentText.length) {
        const textAfter = currentText.slice(lastIndex);
        if (textAfter) {
          editor.commands.insertContent(textAfter);
        }
      }
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle content changes
  const handleContentChange = (text: string) => {
    if (onChange && !isComposing && !isInitializing) {
      // Serialize the editor content to include reference chips as ((UID)) format
      const serializedContent = editor ? serializeWithReferences(editor) : text;
      onChange(serializedContent);
    }

    // Check for prompt command
    const commandInfo = parsePromptCommand(text);

    if (commandInfo.isCommand) {
      const newFilter = commandInfo.filter || "";
      const filtered = filterPrompts(newFilter);

      setPromptFilter(newFilter);
      setFilteredPrompts(filtered);
      setSelectedPromptIndex(0);

      if (!showPromptMenu) {
        setShowPromptMenu(true);
        setPromptMenuPosition(calculateMenuPosition());
      }
    } else {
      if (showPromptMenu) {
        closePromptMenu();
      }
    }

    // Handle date patterns
    if (!isComposing) {
      handleDateChange(text);
    }
  };

  // Prompt menu utility functions
  const parsePromptCommand = (inputValue: string) => {
    const match = inputValue.match(/\/([^\/\s]*)$/);
    if (match) {
      return {
        isCommand: true,
        filter: match[1] || "",
        startIndex: match.index,
      };
    }
    return { isCommand: false };
  };

  const filterPrompts = (filter: string) => {
    if (!filter) return PROMPT_TEMPLATES;

    return PROMPT_TEMPLATES.filter(
      (template) =>
        template.title.toLowerCase().includes(filter.toLowerCase()) ||
        template.description.toLowerCase().includes(filter.toLowerCase()) ||
        template.category.toLowerCase().includes(filter.toLowerCase())
    );
  };

  const calculateMenuPosition = () => {
    if (!editor?.view?.dom) {
      return { top: 0, left: 0 };
    }

    const editorRect = (editor.view.dom as HTMLElement).getBoundingClientRect();

    return {
      top: editorRect.top - 320,
      left: editorRect.left,
    };
  };

  const closePromptMenu = () => {
    setShowPromptMenu(false);
    setPromptFilter("");
    setSelectedPromptIndex(0);
    setFilteredPrompts([]);
  };

  const handlePromptSelect = (template: PromptTemplate) => {
    if (!editor) return;

    const text = editor.getText();
    const commandMatch = text.match(/\/[^\/\s]*$/);

    if (commandMatch) {
      const beforeCommand = text.slice(0, commandMatch.index);
      let processedPrompt = template.prompt;

      // Replace date placeholders
      const today = new Date().toISOString().split("T")[0];
      processedPrompt = processedPrompt.replace(/\[DATE\]/g, today);

      const newContent = beforeCommand + processedPrompt;
      editor.commands.setContent(newContent);
      editor.commands.focus("end");
    }

    closePromptMenu();
  };

  // Handle date changes
  const handleDateChange = async (text: string) => {
    if (isComposing || !onDateSelect) return;

    const datePattern = /\[(\d{4}-\d{2}-\d{2})\]/;
    const match = text.match(datePattern);

    if (match) {
      const dateString = match[1];
      try {
        const { RoamService } = await import("../services/roamService");
        const dateNotes = await RoamService.getNotesFromDate(dateString);
        let notesContent = "";

        if (dateNotes && dateNotes.blocks.length > 0) {
          notesContent = RoamService.formatBlocksForAI(dateNotes.blocks, 0);
        }

        onDateSelect(dateString, notesContent);
      } catch (error) {
        console.error("Error fetching date notes:", error);
        onDateSelect(dateString, "");
      }
    }
  };

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!editor) return;

      // Handle prompt menu navigation
      if (showPromptMenu) {
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setSelectedPromptIndex((prev) =>
              prev < filteredPrompts.length - 1 ? prev + 1 : 0
            );
            return;
          case "ArrowUp":
            event.preventDefault();
            setSelectedPromptIndex((prev) =>
              prev > 0 ? prev - 1 : filteredPrompts.length - 1
            );
            return;
          case "Enter":
            event.preventDefault();
            if (filteredPrompts[selectedPromptIndex]) {
              handlePromptSelect(filteredPrompts[selectedPromptIndex]);
            }
            return;
          case "Escape":
            event.preventDefault();
            closePromptMenu();
            return;
        }
      }

      // Handle send message
      if (event.key === "Enter" && !event.shiftKey && !isComposing) {
        event.preventDefault();
        handleSend();
      }
    },
    [editor, showPromptMenu, filteredPrompts, selectedPromptIndex, isComposing]
  );

  // Add keyboard event listener and focus management
  useEffect(() => {
    if (editor?.view?.dom) {
      const dom = editor.view.dom as HTMLElement;
      dom.addEventListener("keydown", handleKeyDown);

      // Add focus and blur event listeners to manage caret visibility
      const handleFocus = () => {
        // Ensure caret is visible
        dom.style.caretColor = "#393a3d";
      };

      const handleBlur = () => {
        // Keep caret color but allow natural blur behavior
      };

      dom.addEventListener("focus", handleFocus);
      dom.addEventListener("blur", handleBlur);

      return () => {
        dom.removeEventListener("keydown", handleKeyDown);
        dom.removeEventListener("focus", handleFocus);
        dom.removeEventListener("blur", handleBlur);
      };
    }
  }, [editor, handleKeyDown]);

  // Handle send
  const handleSend = () => {
    if (!editor) return;

    const text = editor.getText().trim();
    if (text && !disabled) {
      // Send the editor JSON for processing references
      const editorJSON = editor.getJSON();
      onSend(editorJSON as any);
      editor.commands.clearContent();
      if (onChange) {
        onChange("");
      }
    }
  };

  // Handle model change
  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    multiProviderSettings.currentModel = newModel;

    if (typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const extensionAPI = (window as any).roamAlphaAPI.ui.commandPalette;
        if (extensionAPI && extensionAPI.settings) {
          extensionAPI.settings.set("copilot-current-model", newModel);
        }
      } catch (error) {
        console.log("Could not save model setting:", error);
      }
    }

    if (onModelChange) {
      onModelChange(newModel);
    }
  };

  const canSend = (editor?.getText()?.trim().length || 0) > 0 && !disabled;

  // Handle composition events
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
    if (editor && onChange) {
      const serializedContent = serializeWithReferences(editor);
      onChange(serializedContent);
    }
  };

  // Handle editor container click to ensure cursor activation
  const handleEditorContainerClick = (event: React.MouseEvent) => {
    if (editor && editor.view) {
      // Check if we clicked in an empty area or need to focus
      const target = event.target as HTMLElement;
      const editorDom = editor.view.dom as HTMLElement;

      // If we clicked on the container but not on the editor content, focus the editor
      if (
        target.classList.contains("rr-copilot-editor-container") ||
        (target.closest(".rr-copilot-editor-container") &&
          !target.closest(".ProseMirror"))
      ) {
        event.preventDefault();
        editor.commands.focus();
      }
    }
  };

  // Calculate selector width based on longest model name
  const calculateSelectorWidth = () => {
    if (isLoadingModels || availableModels.length === 0) {
      return "100px";
    }

    // Find the longest model name
    const longestModel = availableModels.reduce((longest, current) => {
      const currentName =
        current.provider === "ollama" ? `🏠 ${current.model}` : current.model;
      const longestName =
        longest.provider === "ollama" ? `🏠 ${longest.model}` : longest.model;
      return currentName.length > longestName.length ? current : longest;
    });

    const longestName =
      longestModel.provider === "ollama"
        ? `🏠 ${longestModel.model}`
        : longestModel.model;

    // More accurate width calculation: roughly 6px per character + padding
    const estimatedWidth = Math.max(80, longestName.length * 6 + 40);
    return `${Math.min(estimatedWidth, 160)}px`;
  };

  return (
    <div
      className="rr-copilot-input-container"
      style={{ position: "relative" }}
    >
      <div className="rr-copilot-input-box">
        <div
          className="rr-copilot-editor-container"
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onClick={handleEditorContainerClick}
        >
          <EditorContent editor={editor} />
        </div>

        <div className="rr-copilot-input-toolbar">
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="rr-copilot-model-selector"
            disabled={disabled || isLoadingModels}
            style={{
              width: calculateSelectorWidth(),
            }}
          >
            {isLoadingModels ? (
              <option value="">Loading models...</option>
            ) : availableModels.length === 0 ? (
              <option value="">No keys</option>
            ) : (
              availableModels.map((modelInfo) => (
                <option
                  key={`${modelInfo.provider}-${modelInfo.model}`}
                  value={modelInfo.model}
                  style={{
                    fontWeight:
                      modelInfo.provider === "ollama" ? "bold" : "normal",
                    color:
                      modelInfo.provider === "ollama" ? "#2E7D32" : "inherit",
                  }}
                >
                  {modelInfo.provider === "ollama" ? "🏠 " : ""}
                  {modelInfo.model}
                </option>
              ))
            )}
          </select>

          <button
            className={`rr-copilot-send-button ${
              canSend ? "active" : "inactive"
            }`}
            onClick={handleSend}
            disabled={!canSend}
            type="button"
            title="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 2L8 14M8 2L3 7M8 2L13 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Prompt Menu */}
      <PromptMenu
        isVisible={showPromptMenu}
        prompts={filteredPrompts}
        selectedIndex={selectedPromptIndex}
        onSelect={handlePromptSelect}
        onClose={closePromptMenu}
        position={promptMenuPosition}
        filter={promptFilter}
      />
    </div>
  );
};
