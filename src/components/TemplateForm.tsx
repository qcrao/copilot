// src/components/TemplateForm.tsx
import React, { useState, useEffect } from "react";
import { 
  Button, 
  Dialog, 
  FormGroup, 
  InputGroup, 
  TextArea, 
  HTMLSelect, 
  Switch,
  Icon,
  Colors
} from "@blueprintjs/core";
import { PromptTemplate, CustomPromptTemplate } from "../types";

interface TemplateFormProps {
  isOpen: boolean;
  template?: CustomPromptTemplate; // If provided, we're editing
  onClose: () => void;
  onSave: (template: Omit<PromptTemplate, 'id'>) => void;
}

const CATEGORY_OPTIONS = [
  { label: "Writing & Creation", value: "writing" },
  { label: "Analysis & Insights", value: "analysis" },
  { label: "Planning & Organization", value: "planning" },
  { label: "Research & Exploration", value: "research" },
  { label: "Learning & Reflection", value: "reflection" },
];

const ICON_OPTIONS = [
  "edit", "lightbulb", "graph", "timeline-events", "learning", "search", 
  "people", "document", "chart", "book", "lab-test", "settings",
  "star", "heart", "thumbs-up", "chat", "code", "globe"
];

const COLOR_OPTIONS = [
  "#667eea", "#4facfe", "#fa709a", "#a8edea", "#8B5CF6", 
  "#ffecd2", "#d299c2", "#89f7fe", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"
];

const CONTEXT_TYPE_OPTIONS = [
  { label: "None", value: "" },
  { label: "Current Page", value: "current-page" },
  { label: "Date Range", value: "date-range" },
  { label: "Selected Text", value: "selected-text" },
];

export const TemplateForm: React.FC<TemplateFormProps> = ({
  isOpen,
  template,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prompt: "",
    category: "writing" as "writing" | "analysis" | "planning" | "research" | "reflection",
    icon: "edit",
    color: "#667eea",
    requiresContext: false,
    contextType: "" as any,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when template changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (template) {
        // Editing existing template
        setFormData({
          title: template.title,
          description: template.description,
          prompt: template.prompt,
          category: template.category,
          icon: template.icon,
          color: template.color,
          requiresContext: template.requiresContext,
          contextType: template.contextType || "",
        });
      } else {
        // Creating new template
        setFormData({
          title: "",
          description: "",
          prompt: "",
          category: "writing",
          icon: "edit",
          color: "#667eea",
          requiresContext: false,
          contextType: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, template]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.prompt.trim()) {
      newErrors.prompt = "Prompt content is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const templateData: Omit<PromptTemplate, 'id'> = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      prompt: formData.prompt.trim(),
      category: formData.category,
      icon: formData.icon,
      color: formData.color,
      requiresContext: formData.requiresContext,
      contextType: formData.requiresContext && formData.contextType ? formData.contextType : undefined,
    };

    onSave(templateData);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={template ? "Edit Template" : "Create Template"}
      style={{ width: "600px", maxHeight: "80vh" }}
    >
      <div style={{ padding: "20px", maxHeight: "60vh", overflowY: "auto" }}>
        <FormGroup label="Title" labelInfo="(required)">
          <InputGroup
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Enter template title..."
            intent={errors.title ? "danger" : "none"}
          />
          {errors.title && <div style={{ color: "#db3737", fontSize: "12px", marginTop: "4px" }}>{errors.title}</div>}
        </FormGroup>

        <FormGroup label="Description" labelInfo="(required)">
          <InputGroup
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Brief description of what this template does..."
            intent={errors.description ? "danger" : "none"}
          />
          {errors.description && <div style={{ color: "#db3737", fontSize: "12px", marginTop: "4px" }}>{errors.description}</div>}
        </FormGroup>

        <FormGroup label="Category">
          <HTMLSelect
            value={formData.category}
            onChange={(e) => handleInputChange("category", e.target.value)}
            fill
          >
            {CATEGORY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </HTMLSelect>
        </FormGroup>

        <div style={{ display: "flex", gap: "16px" }}>
          <FormGroup label="Icon" style={{ flex: 1 }}>
            <HTMLSelect
              value={formData.icon}
              onChange={(e) => handleInputChange("icon", e.target.value)}
              fill
            >
              {ICON_OPTIONS.map(icon => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </HTMLSelect>
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon icon={formData.icon as any} size={16} style={{ color: formData.color }} />
              <span style={{ fontSize: "12px", color: "#5c7080" }}>Preview</span>
            </div>
          </FormGroup>

          <FormGroup label="Color" style={{ flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleInputChange("color", color)}
                  style={{
                    width: "24px",
                    height: "24px",
                    backgroundColor: color,
                    border: formData.color === color ? "2px solid #137cbd" : "1px solid #d8e1e8",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  title={color}
                />
              ))}
            </div>
          </FormGroup>
        </div>

        <FormGroup label="Context Settings">
          <Switch
            checked={formData.requiresContext}
            onChange={(e) => handleInputChange("requiresContext", (e.target as HTMLInputElement).checked)}
            label="This template requires page context"
          />
          
          {formData.requiresContext && (
            <div style={{ marginTop: "8px" }}>
              <HTMLSelect
                value={formData.contextType}
                onChange={(e) => handleInputChange("contextType", e.target.value)}
                fill
              >
                {CONTEXT_TYPE_OPTIONS.slice(1).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </HTMLSelect>
            </div>
          )}
        </FormGroup>

        <FormGroup label="Prompt Content" labelInfo="(required)">
          <TextArea
            value={formData.prompt}
            onChange={(e) => handleInputChange("prompt", e.target.value)}
            placeholder="Enter the prompt content that will be sent to the AI..."
            rows={8}
            fill
            style={{ fontFamily: "monospace", fontSize: "13px" }}
            intent={errors.prompt ? "danger" : "none"}
          />
          {errors.prompt && <div style={{ color: "#db3737", fontSize: "12px", marginTop: "4px" }}>{errors.prompt}</div>}
          <div style={{ fontSize: "11px", color: "#5c7080", marginTop: "4px" }}>
            You can use variables like {"{variable_name}"} and context will be automatically included if enabled.
          </div>
        </FormGroup>
      </div>

      <div style={{ padding: "20px", borderTop: "1px solid #d8e1e8", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          intent="primary"
          onClick={handleSave}
        >
          {template ? "Update Template" : "Create Template"}
        </Button>
      </div>
    </Dialog>
  );
};