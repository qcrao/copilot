// src/components/CustomMessageInput.tsx
import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { aiSettings, multiProviderSettings, getAvailableModels } from "../settings";
import { AI_PROVIDERS } from "../types";

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
  const [internalValue, setInternalValue] = useState("");
  
  // Use controlled value if provided, otherwise use internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const setValue = controlledValue !== undefined ? (onChange || (() => {})) : setInternalValue;
  
  // Get all available models from providers with API keys
  const availableModels = getAvailableModels();
  
  // Ensure selectedModel is valid (has API key)
  const getValidModel = () => {
    if (availableModels.some(m => m.model === multiProviderSettings.currentModel)) {
      return multiProviderSettings.currentModel;
    }
    return availableModels.length > 0 ? availableModels[0].model : "";
  };
  
  const [selectedModel, setSelectedModel] = useState(getValidModel());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, [availableModels.length]);

  // Initialize selectedModel on component mount
  useEffect(() => {
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
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const message = value.trim();
    if (message && !disabled) {
      onSend(message);
      setValue("");
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

  const canSend = value.trim().length > 0 && !disabled;

  // Function to handle date changes and fetch notes
  const handleDateChange = async (newValue: string) => {
    setValue(newValue);
    
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

  // Render input - simple textarea for all cases
  const renderInput = () => {
    return (
      <textarea
        ref={textareaRef}
        className="input-textarea"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleDateChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
    );
  };

  return (
    <div className="input-container">
      <div className="input-box">
        {renderInput()}

        <div className="input-toolbar">
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="model-selector"
            disabled={disabled}
          >
            {availableModels.length === 0 ? (
              <option value="">No keys</option>
            ) : (
              availableModels.map((modelInfo) => (
                <option key={`${modelInfo.provider}-${modelInfo.model}`} value={modelInfo.model}>
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

    </div>
  );
};
