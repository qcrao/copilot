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
import { UserTemplateService } from "../services/userTemplateService";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";

interface TemplateFormProps {
  isOpen: boolean;
  template?: CustomPromptTemplate; // If provided, we're editing
  onClose: () => void;
  onSave: (template: Omit<PromptTemplate, 'id'>) => void;
}

const DEFAULT_CATEGORY_OPTIONS = [
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
  "#ef4444", "#e11d48", "#06b6d4", "#84cc16"
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
    category: "writing",
    icon: "edit",
    color: "#667eea",
    requiresContext: true,
    contextType: "current-page" as any,
  });

  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORY_OPTIONS);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadAvailableCategories = async () => {
    try {
      // Get all template categories (both default and custom)
      const customTemplates = await UserTemplateService.getCustomTemplates();
      const allTemplates = [...PROMPT_TEMPLATES, ...customTemplates];
      const usedCategories = [...new Set(allTemplates.map(t => t.category))];
      
      // Create category options
      const categoryOptions = DEFAULT_CATEGORY_OPTIONS.slice(); // Start with defaults
      
      // Add custom categories that are in use
      usedCategories.forEach(category => {
        const isDefaultCategory = DEFAULT_CATEGORY_OPTIONS.some(opt => opt.value === category);
        if (!isDefaultCategory) {
          categoryOptions.push({
            label: category.charAt(0).toUpperCase() + category.slice(1),
            value: category
          });
        }
      });
      
      setAvailableCategories(categoryOptions);
    } catch (error) {
      console.error("Failed to load available categories:", error);
      // Fallback to sync method if available
      try {
        const customTemplates = UserTemplateService.getCustomTemplatesSync();
        const allTemplates = [...PROMPT_TEMPLATES, ...customTemplates];
        const usedCategories = [...new Set(allTemplates.map(t => t.category))];
        
        const categoryOptions = DEFAULT_CATEGORY_OPTIONS.slice();
        usedCategories.forEach(category => {
          const isDefaultCategory = DEFAULT_CATEGORY_OPTIONS.some(opt => opt.value === category);
          if (!isDefaultCategory) {
            categoryOptions.push({
              label: category.charAt(0).toUpperCase() + category.slice(1),
              value: category
            });
          }
        });
        
        setAvailableCategories(categoryOptions);
      } catch (fallbackError) {
        console.error("Fallback to sync method also failed:", fallbackError);
        setAvailableCategories(DEFAULT_CATEGORY_OPTIONS);
      }
    }
  };

  // Reset form when template changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      const initializeForm = async () => {
        await loadAvailableCategories(); // Load available categories when dialog opens
        
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
            contextType: template.contextType || "current-page",
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
            requiresContext: true,
            contextType: "current-page",
          });
        }
        setErrors({});
        setIsAddingCustomCategory(false);
        setCustomCategoryInput("");
      };
      
      initializeForm();
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
      requiresContext: true,
      contextType: "current-page",
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
          <div style={{ display: "flex", gap: "16px", alignItems: "stretch" }}>
            {!isAddingCustomCategory ? (
              <>
                <div style={{ flex: "1" }}>
                  <HTMLSelect
                    value={availableCategories.find(opt => opt.value === formData.category) ? formData.category : ""}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                    fill
                  >
                    {formData.category && !availableCategories.find(opt => opt.value === formData.category) && (
                      <option value={formData.category}>
                        {formData.category.charAt(0).toUpperCase() + formData.category.slice(1)}
                      </option>
                    )}
                    {availableCategories.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </HTMLSelect>
                </div>
                <div style={{ flex: "1", display: "flex", justifyContent: "flex-start" }}>
                  <Button
                    minimal
                    icon="plus"
                    onClick={() => {
                      setIsAddingCustomCategory(true);
                      setCustomCategoryInput("");
                    }}
                    title="Add Custom Category"
                  >
                    Add Category
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: "1" }}>
                  <InputGroup
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="Enter custom category name..."
                    fill
                    autoFocus
                  />
                </div>
                <div style={{ flex: "1", display: "flex", justifyContent: "flex-start", gap: "4px" }}>
                  <Button
                    icon="tick"
                    intent="primary"
                    onClick={() => {
                      if (customCategoryInput.trim()) {
                        handleInputChange("category", customCategoryInput.trim().toLowerCase());
                        setIsAddingCustomCategory(false);
                        setCustomCategoryInput("");
                      }
                    }}
                    disabled={!customCategoryInput.trim()}
                  />
                  <Button
                    icon="cross"
                    onClick={() => {
                      setIsAddingCustomCategory(false);
                      setCustomCategoryInput("");
                    }}
                  />
                </div>
              </>
            )}
          </div>
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

        <FormGroup label="Context">
          <div style={{ padding: "8px", backgroundColor: "#f6f8fa", borderRadius: "4px", fontSize: "12px", color: "#586069" }}>
            <Icon icon="document" size={12} style={{ marginRight: "6px" }} />
            Current Page
          </div>
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
            Context will be automatically included when the template is used.
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