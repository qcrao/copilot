// src/components/ChatInput.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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
import { UserTemplateService } from "../services/userTemplateService";
import { UniversalSearchDropdown } from "./UniversalSearchDropdown";
import { RoamService } from "../services/roamService";
import { UniversalSearchResult } from "../types";
import { multiProviderSettings, getAvailableModels } from "../settings";
import { CONTENT_LIMITS } from "../utils/shared/constants";
import { ModelSelector } from "./ModelSelector";
import { ContextPreview } from "./ContextPreview";
import { PageContext } from "../types";
import { UI_CONSTANTS } from "../utils/shared/constants";

interface ChatInputProps {
  placeholder?: string;
  onSend: (message: string) => void;
  disabled?: boolean;
  onModelChange?: (model: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  onDateSelect?: (date: string, notes: string) => void;
  onTemplateSelect?: (templateId: string, prompt: string) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  context?: PageContext | null;
  onExcludeContextBlock?: (uid: string) => void;
  isContextLocked?: boolean;
  hasConversationSpecificContext?: boolean;
  templateSettingsVersion?: number;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  placeholder = UI_CONSTANTS.CHAT_INPUT.PLACEHOLDER_TEXT,
  onSend,
  disabled = false,
  onModelChange,
  value: controlledValue,
  onChange,
  onDateSelect,
  onTemplateSelect,
  isLoading = false,
  onCancel,
  context,
  onExcludeContextBlock,
  isContextLocked = false,
  hasConversationSpecificContext = false,
  templateSettingsVersion = 0,
}) => {
  const [availableModels, setAvailableModels] = useState<
    Array<{ model: string; provider: string; providerName: string }>
  >([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [editorContentVersion, setEditorContentVersion] = useState(0);

  // Prompt menu states
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [promptFilter, setPromptFilter] = useState("");
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [filteredPrompts, setFilteredPrompts] = useState<PromptTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<PromptTemplate[]>(PROMPT_TEMPLATES);
  const [promptMenuPosition, setPromptMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  // Universal search states for @ symbol triggered search
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [universalSearchResults, setUniversalSearchResults] = useState<
    UniversalSearchResult[]
  >([]);
  const [selectedUniversalIndex, setSelectedUniversalIndex] = useState(0);
  const [universalSearchTerm, setUniversalSearchTerm] = useState("");
  const [universalSearchPosition, setUniversalSearchPosition] = useState({
    top: 0,
    left: 0,
  });
  const [universalSearchLoading, setUniversalSearchLoading] = useState(false);
  // Removed unused at-symbol context state

  // Performance optimization: Simple cache for search results
  const searchCache = useRef<Map<string, UniversalSearchResult[]>>(new Map());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create refs for functions that need to be called from TipTap handleKeyDown
  const handlePromptSelectRef = useRef<(template: PromptTemplate) => void>();
  const closePromptMenuRef = useRef<() => void>();

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default drop cursor since we're using Dropcursor extension
        dropcursor: false,
      }),
      Dropcursor.configure({
        color: "#393a3d",
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
    autofocus: false, // Don't autofocus on creation
    editorProps: {
      handleKeyDown: (_view, event) => {
        // Handle universal search Enter key at TipTap level to prevent default paragraph creation
        if (
          showUniversalSearch &&
          universalSearchResults.length > 0 &&
          event.key === "Enter"
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (universalSearchResults[selectedUniversalIndex]) {
            insertUniversalSearchResult(
              universalSearchResults[selectedUniversalIndex]
            );
          }
          return true; // Prevent TipTap's default handling
        }

        // Handle prompt template Enter key at TipTap level to prevent default paragraph creation
        if (
          showPromptMenu &&
          filteredPrompts.length > 0 &&
          event.key === "Enter"
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (
            filteredPrompts[selectedPromptIndex] &&
            handlePromptSelectRef.current
          ) {
            handlePromptSelectRef.current(filteredPrompts[selectedPromptIndex]);
          }
          return true; // Prevent TipTap's default handling
        }

        return false; // Allow normal TipTap handling
      },
      attributes: {
        class: "rr-copilot-editor",
        style:
          "outline: none; min-height: 52px; max-height: 120px; overflow-y: auto; line-height: 1.5;",
        "data-placeholder": placeholder,
        tabindex: "0",
      },
      handleDrop: (_view, event) => {
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
      handleClick: () => {
        // Don't interfere with default click handling
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      handleContentChange(text);
      // Update content version to trigger canSend recalculation
      setEditorContentVersion((prev) => prev + 1);
    },
    onCreate: () => {
      // Initialize with controlled value if provided
      if (controlledValue) {
        initializeWithReferences(controlledValue);
      }
    },
    onFocus: ({ editor }) => {
      // Ensure caret is visible when focused
      setTimeout(() => {
        if (editor.view && editor.view.dom) {
          const dom = editor.view.dom as HTMLElement;
          dom.style.caretColor = "#393a3d";
        }
      }, 0);
    },
    onBlur: () => {
      // Keep caret color but allow natural blur
    },
  });

  // Define prompt menu functions and assign to refs
  const handlePromptSelect = (template: PromptTemplate) => {
    if (!editor) return;

    const text = editor.getText();
    const commandMatch = text.match(/\/[^\/\s]*$/);

    if (commandMatch) {
      const beforeCommand = text.slice(0, commandMatch.index).trim();
      let processedPrompt = template.prompt;

      // Replace date placeholders
      const today = new Date().toISOString().split("T")[0];
      processedPrompt = processedPrompt.replace(/\[DATE\]/g, today);

      // Combine any existing content before the command with the processed prompt
      const finalContent = beforeCommand
        ? `${beforeCommand} ${processedPrompt}`
        : processedPrompt;

      // Clear the input field first
      editor.commands.clearContent();
      if (onChange) {
        onChange("");
      }

      // Notify parent component about template selection and send directly
      if (onTemplateSelect) {
        onTemplateSelect(template.id, processedPrompt);
      }

      // Close prompt menu
      closePromptMenu();

      // Send the template content directly without showing in input
      onSend(finalContent);

      // Update content version to trigger canSend recalculation
      setEditorContentVersion((prev) => prev + 1);
    } else {
      closePromptMenu();
    }
  };

  const closePromptMenu = () => {
    setShowPromptMenu(false);
    setPromptFilter("");
    setSelectedPromptIndex(0);
    setFilteredPrompts([]);
  };

  // Assign functions to refs
  handlePromptSelectRef.current = handlePromptSelect;
  closePromptMenuRef.current = closePromptMenu;

  // Handle controlled value changes (e.g., when widget reopens)
  // Removed unused lastInitializedValue state

  useEffect(() => {
    if (editor && controlledValue !== undefined) {
      // Always update if controlled value is different from current editor content
      const currentSerializedContent = serializeWithReferences(editor);
      if (currentSerializedContent !== controlledValue) {
        initializeWithReferences(controlledValue);
      }
    }
  }, [editor, controlledValue]);

  // Load all visible templates (official + custom) on mount and when settings change
  useEffect(() => {
    const loadAllTemplates = async () => {
      try {
        const templates = await UserTemplateService.getAllVisibleTemplates();
        setAllTemplates(templates);
      } catch (error) {
        console.error("Failed to load templates:", error);
        setAllTemplates(PROMPT_TEMPLATES);
      }
    };

    loadAllTemplates();
  }, [templateSettingsVersion]);

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
              // Could not save model setting
            }
          }
        }
      }
    }
  }, [availableModels, isLoadingModels, selectedModel]);

  // Handle block drop
  const handleBlockDrop = async (uid: string, event: DragEvent) => {
    try {
      // Get block content
      const blockData = await RoamQuery.getBlock(uid);
      if (!blockData) {
        console.error("Could not fetch block data for:", uid);
        return;
      }

      // Create preview text
      const preview = RoamQuery.formatBlockPreview(
        blockData.string,
        CONTENT_LIMITS.BLOCK_PREVIEW
      );

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
            // Update content version to trigger canSend recalculation
            setEditorContentVersion((prev) => prev + 1);
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
            ? RoamQuery.formatBlockPreview(
                blockData.string,
                CONTENT_LIMITS.BLOCK_PREVIEW
              )
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
      // Trigger canSend recalculation after initialization
      setEditorContentVersion((prev) => prev + 1);
    }
  };

  // Handle content changes
  const handleContentChange = (text: string) => {
    if (onChange && !isComposing && !isInitializing) {
      // Serialize the editor content to include reference chips as ((UID)) format
      const serializedContent = editor ? serializeWithReferences(editor) : text;
      onChange(serializedContent);
    }

    // Get cursor position for bracket context
    const cursorPos = editor?.state.selection.from || 0;

    // Check for @ symbol context (universal search)
    updateAtSymbolContext(text, cursorPos);

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
    if (!filter) return allTemplates;

    return allTemplates.filter(
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
    const gapBetweenMenuAndInput = 16; // Distance between menu bottom and input top

    return {
      top: editorRect.top - gapBetweenMenuAndInput, // Menu bottom will be 16px above input top
      left: editorRect.left,
    };
  };

  // Universal search functions for @ symbol triggered search
  const closeUniversalSearch = () => {
    setShowUniversalSearch(false);
    setUniversalSearchResults([]);
    setSelectedUniversalIndex(0);
    setUniversalSearchTerm("");
    setUniversalSearchLoading(false);
  };

  const searchUniversal = async (searchTerm: string) => {
    try {
      // Check cache first
      const cacheKey = searchTerm.toLowerCase().trim();
      if (searchCache.current.has(cacheKey)) {
        const cachedResults = searchCache.current.get(cacheKey)!;
        setUniversalSearchResults(cachedResults);
        setSelectedUniversalIndex(0);
        setUniversalSearchLoading(false);
        return;
      }

      setUniversalSearchLoading(true);
      const response = await RoamService.universalSearch(searchTerm, 10);

      // Cache the results (limit cache size to prevent memory issues)
      if (searchCache.current.size > 50) {
        // Remove oldest entries
        const firstKey = searchCache.current.keys().next().value;
        if (firstKey !== undefined) {
          searchCache.current.delete(firstKey);
        }
      }
      searchCache.current.set(cacheKey, response.results);

      setUniversalSearchResults(response.results);
      setSelectedUniversalIndex(0);
    } catch (error) {
      console.error("Error in universal search:", error);
      setUniversalSearchResults([]);
    } finally {
      setUniversalSearchLoading(false);
    }
  };

  // Debounced search function to prevent excessive API calls
  const debouncedSearchUniversal = useCallback((searchTerm: string) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    // Set loading state immediately for better UX
    setUniversalSearchLoading(true);

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      searchUniversal(searchTerm);
    }, 300); // 300ms debounce delay
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const calculateUniversalSearchPosition = () => {
    if (!editor?.view?.dom) {
      return { top: 0, left: 0 };
    }

    const editorRect = (editor.view.dom as HTMLElement).getBoundingClientRect();

    // Align bottom with prompt template's bottom
    // Prompt template starts at editorRect.top - 320 and has max height of 300px
    // So its bottom is at editorRect.top - 320 + 300 = editorRect.top - 20
    return {
      top: editorRect.top - 20,
      left: editorRect.left,
    };
  };

  // src/components/ChatInput.tsx

  const insertUniversalSearchResult = (result: UniversalSearchResult) => {
    if (!editor) {
      return;
    }

    const searchTermWithAt = `@${universalSearchTerm}`;

    const { state } = editor;
    const { selection } = state;
    let start = -1;
    let end = -1;

    state.doc.nodesBetween(0, selection.from, (node, pos) => {
      if (node.isText) {
        const text = node.text || "";
        const index = text.lastIndexOf(searchTermWithAt);
        if (index !== -1) {
          start = pos + index;
          end = start + searchTermWithAt.length;
        }
      }
      return start === -1;
    });

    if (start === -1) {
      console.error(
        "Unable to locate search term in document: ",
        searchTermWithAt
      );
      return;
    }

    editor
      .chain()
      .focus()
      .setTextSelection({ from: start, to: end })
      .deleteSelection()
      .insertContent({
        type: "referenceChip",
        attrs: {
          uid: result.uid,
          preview:
            result.type === "page" || result.type === "daily-note"
              ? result.title || result.preview
              : result.preview,
          type:
            result.type === "page" || result.type === "daily-note"
              ? "page"
              : "block",
        },
      })
      .insertContent(" ")
      .run();

    // Update React state as before
    closeUniversalSearch();
    const serializedContent = serializeWithReferences(editor);
    if (onChange) {
      onChange(serializedContent);
    }
    setEditorContentVersion((prev) => prev + 1);
  };

  // Check for @ symbol context in text
  const updateAtSymbolContext = (text: string, cursorPos: number) => {
    // Look backwards to find @ symbol
    let atSymbolPos = -1;

    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === "@") {
        // Check if this @ symbol is at word boundary (start of line or after space)
        if (i === 0 || text[i - 1] === " " || text[i - 1] === "\n") {
          atSymbolPos = i;
          break;
        }
      }
      // For @ context, only stop on space, not newline (allow multiline @ context)
      if (text[i] === " " && i < cursorPos - 1) {
        break;
      }
    }

    // Check if we're in a valid @ context
    const isInAtContext = atSymbolPos !== -1;

    if (isInAtContext) {
      // Extract the current search term (everything after @ excluding newlines)
      const searchStart = atSymbolPos + 1;
      let currentSearchTerm = text.substring(searchStart, cursorPos);

      // Remove newlines but preserve other whitespace for now
      currentSearchTerm = currentSearchTerm.replace(/\n/g, "");
      const trimmedSearchTerm = currentSearchTerm.trim();

      // Context start position tracked implicitly via term updates

      // Use trimmed version for comparison but keep original for context
      if (trimmedSearchTerm !== universalSearchTerm) {
        setUniversalSearchTerm(trimmedSearchTerm);

        if (trimmedSearchTerm.length > 0) {
          debouncedSearchUniversal(trimmedSearchTerm);
        } else {
          // Show empty search state for @ with no search term
          setUniversalSearchResults([]);
          setUniversalSearchLoading(false);
        }

        if (!showUniversalSearch) {
          setShowUniversalSearch(true);
          setUniversalSearchPosition(calculateUniversalSearchPosition());
        }
      }
    } else {
      if (showUniversalSearch) {
        closeUniversalSearch();
      }
    }
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

      // Handle universal search navigation
      if (showUniversalSearch && universalSearchResults.length > 0) {
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setSelectedUniversalIndex((prev) =>
              prev < universalSearchResults.length - 1 ? prev + 1 : 0
            );
            return;
          case "ArrowUp":
            event.preventDefault();
            setSelectedUniversalIndex((prev) =>
              prev > 0 ? prev - 1 : universalSearchResults.length - 1
            );
            return;
          case "Escape":
            event.preventDefault();
            closeUniversalSearch();
            return;
        }
      }

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
    [
      editor,
      showPromptMenu,
      filteredPrompts,
      selectedPromptIndex,
      showUniversalSearch,
      universalSearchResults,
      selectedUniversalIndex,
      isComposing,
      allTemplates,
    ]
  );

  // Add keyboard event listener and focus management
  useEffect(() => {
    if (editor?.view?.dom) {
      const dom = editor.view.dom as HTMLElement;
      dom.addEventListener("keydown", handleKeyDown);

      // Add focus and blur event listeners to manage caret visibility
      const handleFocus = () => {
        // Ensure caret is visible and force a reflow
        dom.style.caretColor = "#393a3d";
        // Force cursor visibility by briefly setting selection
        setTimeout(() => {
          if (editor && editor.view) {
            const { selection } = editor.state;
            editor.view.dispatch(editor.state.tr.setSelection(selection));
          }
        }, 0);
      };

      const handleBlur = () => {
        // Keep caret color but allow natural blur behavior
      };

      // Add mouse events to ensure cursor is visible after clicks
      const handleMouseDown = () => {
        setTimeout(() => {
          if (editor && editor.view) {
            dom.style.caretColor = "#393a3d";
          }
        }, 0);
      };

      dom.addEventListener("focus", handleFocus);
      dom.addEventListener("blur", handleBlur);
      dom.addEventListener("mousedown", handleMouseDown);

      return () => {
        dom.removeEventListener("keydown", handleKeyDown);
        dom.removeEventListener("focus", handleFocus);
        dom.removeEventListener("blur", handleBlur);
        dom.removeEventListener("mousedown", handleMouseDown);
      };
    }
  }, [editor, handleKeyDown]);

  // Handle send
  const handleSend = () => {
    if (!editor) return;

    const text = editor.getText().trim();
    const serializedContent = serializeWithReferences(editor);

    if (
      (text ||
        serializedContent.includes("((") ||
        serializedContent.includes("[[")) &&
      !disabled
    ) {
      // Send the editor JSON for processing references
      const editorJSON = editor.getJSON();
      onSend(editorJSON as any);
      editor.commands.clearContent();
      if (onChange) {
        onChange("");
      }
      // Update content version to trigger canSend recalculation
      setEditorContentVersion((prev) => prev + 1);
    }
  };

  // Handle model change
  const handleModelChange = (newModel: string, newProvider?: string) => {
    setSelectedModel(newModel);
    multiProviderSettings.currentModel = newModel;
    if (newProvider) {
      multiProviderSettings.currentModelProvider = newProvider;
    }

    if (typeof window !== "undefined" && (window as any).roamAlphaAPI) {
      try {
        const extensionAPI = (window as any).roamAlphaAPI.ui.commandPalette;
        if (extensionAPI && extensionAPI.settings) {
          extensionAPI.settings.set("copilot-current-model", newModel);
          if (newProvider) {
            extensionAPI.settings.set("copilot-current-model-provider", newProvider);
          }
        }
      } catch (error) {
        // Could not save model setting
      }
    }

    if (onModelChange) {
      onModelChange(newModel);
    }
  };

  const canSend = useMemo(() => {
    if (!editor || disabled || isLoading) return false;

    // Check if editor has any text content
    const hasTextContent = (editor.getText()?.trim().length || 0) > 0;

    // Check if editor has any reference chips
    const serializedContent = serializeWithReferences(editor);
    const hasReferences =
      serializedContent.includes("((") || serializedContent.includes("[[");

    return hasTextContent || hasReferences;
  }, [editor, disabled, isLoading, editorContentVersion]);

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

  // Calculate selector width for ModelSelector
  const calculateSelectorWidth = () => {
    if (isLoadingModels || availableModels.length === 0) {
      return "140px";
    }

    // Find the longest model name
    const longestModel = availableModels.reduce((longest, current) => {
      return current.model.length > longest.model.length ? current : longest;
    });

    // Adjusted width calculation: roughly 7.5px per character + padding for icon and dropdown arrow
    const estimatedWidth = Math.max(140, longestModel.model.length * 7.5 + 55);
    // Increase max width to accommodate longer model names
    return `${Math.min(estimatedWidth, 260)}px`;
  };

  // Check if user has specified context through input
  const hasUserSpecifiedContext = useMemo(() => {
    if (!editor) return hasConversationSpecificContext;
    
    // Check if there are reference chips in the input
    const serializedContent = serializeWithReferences(editor);
    const hasReferences = serializedContent.includes("((") || serializedContent.includes("[[");
    
    // Check if @ symbol universal search is active
    const hasActiveSearch = showUniversalSearch && universalSearchTerm.length > 0;
    
    // If this conversation already has specific context, keep hiding preview
    return hasReferences || hasActiveSearch || hasConversationSpecificContext;
  }, [editor, editorContentVersion, showUniversalSearch, universalSearchTerm, hasConversationSpecificContext]);

  return (
    <div
      className="rr-copilot-input-container"
      style={{ position: "relative" }}
    >
      {/* Compact context chips right above the input box - hide when user specifies context */}
      {!hasUserSpecifiedContext && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "0 0 6px 0",
            flexWrap: "wrap",
          }}
        >
          <ContextPreview
            context={context || null}
            onExcludeBlock={onExcludeContextBlock}
            isContextLocked={isContextLocked}
          />
        </div>
      )}
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
          <div style={{ width: calculateSelectorWidth() }}>
            <ModelSelector
              value={selectedModel}
              onChange={handleModelChange}
              options={availableModels}
              disabled={disabled}
              isLoading={isLoadingModels}
            />
          </div>

          {isLoading ? (
            <button
              className="rr-copilot-cancel-button"
              onClick={onCancel}
              disabled={!onCancel}
              type="button"
              title="Cancel request"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="4"
                  y="4"
                  width="8"
                  height="8"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : (
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
          )}
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

      {/* Universal Search Dropdown */}
      <UniversalSearchDropdown
        isVisible={showUniversalSearch}
        results={universalSearchResults}
        selectedIndex={selectedUniversalIndex}
        onSelect={insertUniversalSearchResult}
        onClose={closeUniversalSearch}
        position={universalSearchPosition}
        searchTerm={universalSearchTerm}
        isLoading={universalSearchLoading}
      />
    </div>
  );
};
