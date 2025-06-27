// src/components/ChatInput.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { ReferenceChip, insertReferenceChip, parseReferencesFromText } from './ReferenceChip';
import { RoamQuery } from '../utils/roamQuery';
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
  
  // Prompt menu states
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [promptFilter, setPromptFilter] = useState("");
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [filteredPrompts, setFilteredPrompts] = useState<PromptTemplate[]>([]);
  const [promptMenuPosition, setPromptMenuPosition] = useState({ top: 0, left: 0 });

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default drop cursor since we're using Dropcursor extension
        dropcursor: false,
      }),
      Dropcursor.configure({
        color: '#1565c0',
        width: 3,
      }),
      ReferenceChip,
    ],
    content: controlledValue || '',
    editorProps: {
      attributes: {
        class: 'rr-copilot-editor',
        style: 'outline: none; padding: 8px 12px; min-height: 40px; max-height: 120px; overflow-y: auto; line-height: 1.4;',
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
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      handleContentChange(text);
    },
    onCreate: ({ editor }) => {
      // Initialize with controlled value if provided
      if (controlledValue) {
        initializeWithReferences(controlledValue);
      }
    },
  });

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
              const extensionAPI = (window as any).roamAlphaAPI.ui.commandPalette;
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
      const preview = RoamQuery.formatBlockPreview(blockData.string, 50);
      
      // Insert the reference chip at drop position
      if (editor) {
        // Get the drop position
        const coords = { left: event.clientX, top: event.clientY };
        const pos = editor.view.posAtCoords(coords);
        
        if (pos) {
          editor.commands.setTextSelection(pos.pos);
        }
        
        insertReferenceChip(editor, uid, preview);
        
        // Focus the editor
        editor.commands.focus();
      }
    } catch (error) {
      console.error("Error handling block drop:", error);
    }
  };

  // Initialize editor with references from text
  const initializeWithReferences = async (text: string) => {
    if (!editor) return;

    const references = parseReferencesFromText(text);
    
    if (references.length === 0) {
      editor.commands.setContent(text);
      return;
    }

    // Replace ((UID)) patterns with reference chips
    let processedText = text;
    
    for (const ref of references) {
      try {
        const blockData = await RoamQuery.getBlock(ref.uid);
        const preview = blockData 
          ? RoamQuery.formatBlockPreview(blockData.string, 50)
          : `Block ${ref.uid}`;
        
        // We'll need to handle this differently since we can't easily replace text with nodes
        // For now, just set the text content and let the user re-drag blocks
        processedText = processedText.replace(ref.text, `[${preview}]`);
      } catch (error) {
        console.error("Error loading reference:", ref.uid, error);
      }
    }
    
    editor.commands.setContent(processedText);
  };

  // Handle content changes
  const handleContentChange = (text: string) => {
    if (onChange && !isComposing) {
      onChange(text);
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
      return { isCommand: true, filter: match[1] || "", startIndex: match.index };
    }
    return { isCommand: false };
  };

  const filterPrompts = (filter: string) => {
    if (!filter) return PROMPT_TEMPLATES;
    
    return PROMPT_TEMPLATES.filter(template => 
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
      left: editorRect.left
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
      const today = new Date().toISOString().split('T')[0];
      processedPrompt = processedPrompt.replace(/\[DATE\]/g, today);
      
      const newContent = beforeCommand + processedPrompt;
      editor.commands.setContent(newContent);
      editor.commands.focus('end');
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
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!editor) return;

    // Handle prompt menu navigation
    if (showPromptMenu) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedPromptIndex(prev => 
            prev < filteredPrompts.length - 1 ? prev + 1 : 0
          );
          return;
        case "ArrowUp":
          event.preventDefault();
          setSelectedPromptIndex(prev => 
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
  }, [editor, showPromptMenu, filteredPrompts, selectedPromptIndex, isComposing]);

  // Add keyboard event listener
  useEffect(() => {
    if (editor?.view?.dom) {
      const dom = editor.view.dom as HTMLElement;
      dom.addEventListener('keydown', handleKeyDown);
      return () => {
        dom.removeEventListener('keydown', handleKeyDown);
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
      onChange(editor.getText());
    }
  };

  return (
    <div className="rr-copilot-input-container" style={{ position: 'relative' }}>
      <div className="rr-copilot-input-box">
        <div 
          style={{ 
            border: '1px solid #ccc',
            borderRadius: '8px',
            backgroundColor: 'white',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        >
          <EditorContent 
            editor={editor} 
            placeholder={placeholder}
          />
        </div>

        <div className="rr-copilot-input-toolbar">
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="rr-copilot-model-selector"
            disabled={disabled || isLoadingModels}
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
            className={`rr-copilot-send-button ${canSend ? "active" : "inactive"}`}
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