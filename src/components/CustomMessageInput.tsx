// src/components/CustomMessageInput.tsx
import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  aiSettings,
  multiProviderSettings,
  getAvailableModels,
} from "../settings";
import { AI_PROVIDERS, PromptTemplate } from "../types";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { PromptMenu } from "./PromptMenu";

interface CustomMessageInputProps {
  placeholder?: string;
  onSend: (message: string) => void;
  disabled?: boolean;
  onModelChange?: (model: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  onDateSelect?: (date: string, notes: string) => void;
}

export const CustomMessageInput: React.FC<CustomMessageInputProps> = ({
  placeholder = "Ask me anything about your notes...",
  onSend,
  disabled = false,
  onModelChange,
  value: controlledValue,
  onChange,
  onDateSelect,
}) => {
  const [value, setValue] = useState(controlledValue || "");
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

  // Update local state when controlled value changes
  useEffect(() => {
    if (controlledValue !== undefined) {
      setValue(controlledValue);
    }
  }, [controlledValue]);

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

    // Reload models when Ollama base URL changes
    const interval = setInterval(loadModels, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [multiProviderSettings.ollamaBaseUrl]);

  // Ensure selectedModel is valid (has API key)
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prompt menu utility functions
  const parsePromptCommand = (inputValue: string) => {
    // Match "/" at the end of string, optionally followed by filter text
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
    if (!textareaRef.current) {
      return { top: 0, left: 0 };
    }
    
    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    
    return {
      top: rect.top - 320, // Position above the textarea with more space
      left: rect.left
    };
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

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

  // Initialize selectedModel on component mount
  useEffect(() => {
    if (!isLoadingModels && availableModels.length > 0) {
      const validModel = getValidModel();
      if (validModel && validModel !== multiProviderSettings.currentModel) {
        setSelectedModel(validModel);
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
  }, [isLoadingModels, availableModels]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle prompt menu navigation
    if (showPromptMenu) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedPromptIndex(prev => 
            prev < filteredPrompts.length - 1 ? prev + 1 : 0
          );
          return;
        case "ArrowUp":
          e.preventDefault();
          setSelectedPromptIndex(prev => 
            prev > 0 ? prev - 1 : filteredPrompts.length - 1
          );
          return;
        case "Enter":
          e.preventDefault();
          if (filteredPrompts[selectedPromptIndex]) {
            handlePromptSelect(filteredPrompts[selectedPromptIndex]);
          }
          return;
        case "Escape":
          e.preventDefault();
          closePromptMenu();
          return;
      }
    }

    // Normal keyboard handling
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const message = value.trim();
    if (message && !disabled) {
      onSend(message);
      if (controlledValue === undefined) {
        setValue("");
      } else if (onChange) {
        onChange("");
      }
    }
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    multiProviderSettings.currentModel = newModel;

    // Save to extension settings if available
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

  const handlePromptSelect = (template: PromptTemplate) => {
    // Replace the command (e.g., "/write" or "/") with the prompt content
    const commandMatch = value.match(/\/[^\/\s]*$/);
    if (commandMatch) {
      const beforeCommand = value.slice(0, commandMatch.index);
      let processedPrompt = template.prompt;
      
      // Replace date placeholders with today's date
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      processedPrompt = processedPrompt.replace(/\[DATE\]/g, today);
      
      const newValue = beforeCommand + processedPrompt;
      
      setValue(newValue);
      if (controlledValue !== undefined && onChange) {
        onChange(newValue);
      }
    }
    
    closePromptMenu();
    
    // Focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const closePromptMenu = () => {
    setShowPromptMenu(false);
    setPromptFilter("");
    setSelectedPromptIndex(0);
    setFilteredPrompts([]);
  };

  const canSend = value.trim().length > 0 && !disabled;

  // Function to handle input changes
  const handleInputChange = (newValue: string) => {
    // Always update local state for display
    setValue(newValue);
    
    // For controlled mode: only notify parent when not composing to avoid interrupting Chinese input
    // For uncontrolled mode: always update (handled by local state above)
    if (controlledValue !== undefined && onChange && !isComposing) {
      onChange(newValue);
    }
  };

  // Function to handle date changes and fetch notes (only called when not composing)
  const handleDateChange = async (newValue: string) => {
    // Don't process date patterns while composing (Chinese input)
    if (isComposing) {
      return;
    }

    // Check if there's a date pattern and fetch notes
    const datePattern = /\[(\d{4}-\d{2}-\d{2})\]/;
    const match = newValue.match(datePattern);

    if (match && onDateSelect) {
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

  // Handle composition events for Chinese input
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    
    // Update local state and notify parent component after composition ends
    setValue(newValue);
    if (controlledValue !== undefined && onChange) {
      onChange(newValue);
    }
    
    // Process date patterns after composition ends
    handleDateChange(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    handleInputChange(newValue);
    
    // Check for prompt command
    const commandInfo = parsePromptCommand(newValue);
    
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
    
    // Only process date patterns if not composing
    if (!isComposing) {
      handleDateChange(newValue);
    }
  };

  // Render input - simple textarea for all cases
  const renderInput = () => {
    return (
      <textarea
        ref={textareaRef}
        className="input-textarea"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
    );
  };

  return (
    <div className="input-container" style={{ position: 'relative' }}>
      <div className="input-box">
        {renderInput()}

        <div className="input-toolbar">
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="model-selector"
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
            className={`send-button ${canSend ? "active" : "inactive"}`}
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
