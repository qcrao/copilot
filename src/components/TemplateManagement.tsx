// src/components/TemplateManagement.tsx
import React, { useState, useEffect } from "react";
import { Button, Dialog, Icon } from "@blueprintjs/core";
import { PromptTemplate, CustomPromptTemplate } from "../types";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { TemplateSettingsService } from "../services/templateSettingsService";
import { UserTemplateService } from "../services/userTemplateService";
import { TemplateForm } from "./TemplateForm";

interface TemplateManagementProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

export const TemplateManagement: React.FC<TemplateManagementProps> = ({
  isOpen,
  onClose,
  onSettingsChanged,
}) => {
  const [hiddenTemplates, setHiddenTemplates] = useState<string[]>([]);
  const [hiddenCustomTemplates, setHiddenCustomTemplates] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomPromptTemplate[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomPromptTemplate | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        try {
          const hiddenTemplatesData = await TemplateSettingsService.getHiddenTemplates();
          const userSettings = await UserTemplateService.getSettings();
          const customTemplatesData = await UserTemplateService.getCustomTemplates();
          
          setHiddenTemplates(hiddenTemplatesData);
          setHiddenCustomTemplates(userSettings.hiddenCustomTemplates);
          setCustomTemplates(customTemplatesData);
        } catch (error) {
          console.error("Failed to load template data:", error);
        }
      };
      
      loadData();
    }
  }, [isOpen]);

  const handleToggleTemplate = async (templateId: string, isCustom: boolean = false) => {
    try {
      if (isCustom) {
        const isCurrentlyHidden = hiddenCustomTemplates.includes(templateId);
        
        let newHiddenCustomTemplates: string[];
        if (isCurrentlyHidden) {
          await UserTemplateService.showTemplate(templateId);
          newHiddenCustomTemplates = hiddenCustomTemplates.filter(id => id !== templateId);
        } else {
          await UserTemplateService.hideTemplate(templateId);
          newHiddenCustomTemplates = [...hiddenCustomTemplates, templateId];
        }
        
        setHiddenCustomTemplates(newHiddenCustomTemplates);
      } else {
        const isCurrentlyHidden = hiddenTemplates.includes(templateId);
        
        let newHiddenTemplates: string[];
        if (isCurrentlyHidden) {
          await TemplateSettingsService.showTemplate(templateId);
          newHiddenTemplates = hiddenTemplates.filter(id => id !== templateId);
        } else {
          await TemplateSettingsService.hideTemplate(templateId);
          newHiddenTemplates = [...hiddenTemplates, templateId];
        }
        
        setHiddenTemplates(newHiddenTemplates);
      }
      
      onSettingsChanged();
    } catch (error) {
      console.error("Failed to toggle template:", error);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(undefined);
    setIsFormOpen(true);
  };

  const handleEditTemplate = (template: CustomPromptTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      try {
        await UserTemplateService.deleteTemplate(templateId);
        const [newCustomTemplates, userSettings] = await Promise.all([
          UserTemplateService.getCustomTemplates(),
          UserTemplateService.getSettings()
        ]);
        setCustomTemplates(newCustomTemplates);
        setHiddenCustomTemplates(userSettings.hiddenCustomTemplates);
        onSettingsChanged();
      } catch (error) {
        console.error("Failed to delete template:", error);
      }
    }
  };

  const handleFormSave = async (templateData: Omit<PromptTemplate, 'id'>) => {
    try {
      if (editingTemplate) {
        // Update existing template
        await UserTemplateService.updateTemplate(editingTemplate.id, templateData);
      } else {
        // Create new template
        await UserTemplateService.createTemplate(templateData);
      }
      
      // Refresh template list
      const newCustomTemplates = await UserTemplateService.getCustomTemplates();
      setCustomTemplates(newCustomTemplates);
      setIsFormOpen(false);
      setEditingTemplate(undefined);
      onSettingsChanged();
    } catch (error) {
      console.error("Failed to save template:", error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleReset = async () => {
    try {
      await TemplateSettingsService.resetToDefaults();
      // Get the actual default hidden templates after reset
      const defaultHiddenTemplates = await TemplateSettingsService.getHiddenTemplates();
      setHiddenTemplates(defaultHiddenTemplates);
      onSettingsChanged();
    } catch (error) {
      console.error("Failed to reset templates:", error);
    }
  };

  // Group official templates
  const groupedOfficialTemplates = PROMPT_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

  // Group custom templates
  const groupedCustomTemplates = customTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, CustomPromptTemplate[]>);

  const categoryLabels: Record<string, string> = {
    writing: "Writing & Creation",
    analysis: "Analysis & Insights", 
    planning: "Planning & Organization",
    research: "Research & Exploration",
    reflection: "Learning & Reflection",
  };

  const getCategoryLabel = (category: string) => {
    return categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Templates"
      style={{ width: "600px" }}
    >
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          <p style={{ marginBottom: "10px", color: "#5c7080" }}>
            Manage your prompt templates. Hide/show templates or create your own custom ones.
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "20px" }}>
            <Button
              icon="plus"
              intent="primary"
              onClick={handleCreateTemplate}
            >
              Create Template
            </Button>
            <Button
              icon="reset"
              outlined
              onClick={handleReset}
            >
              Reset Official Templates
            </Button>
          </div>
        </div>

        {/* Render all categories that have either official or custom templates */}
        {Object.keys({ ...groupedOfficialTemplates, ...groupedCustomTemplates }).map((category) => {
          const officialTemplates = groupedOfficialTemplates[category] || [];
          const customTemplatesInCategory = groupedCustomTemplates[category] || [];
          
          // Skip if no templates in this category
          if (officialTemplates.length === 0 && customTemplatesInCategory.length === 0) {
            return null;
          }

          return (
            <div key={category} style={{ marginBottom: "32px" }}>
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                  color: "#394b59",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {getCategoryLabel(category)}
              </h4>
              
              <div style={{ marginLeft: "12px" }}>
                {/* Official Templates */}
                {officialTemplates.map((template) => {
                  const isHidden = hiddenTemplates.includes(template.id);
                  return (
                    <div
                      key={template.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 12px",
                        border: "1px solid #d8e1e8",
                        backgroundColor: isHidden ? "#f5f8fa" : "white",
                        borderRadius: "6px",
                        marginBottom: "4px",
                      }}
                    >
                      <Icon
                        icon={template.icon as any}
                        size={16}
                        style={{ 
                          marginRight: "12px", 
                          color: isHidden ? "#8a9ba8" : template.color 
                        }}
                      />
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: "500", 
                          marginBottom: "2px",
                          color: isHidden ? "#8a9ba8" : "#182026"
                        }}>
                          {template.title}
                          <span style={{ 
                            fontSize: "10px", 
                            color: "#8a9ba8", 
                            marginLeft: "8px",
                            fontWeight: "400"
                          }}>
                            OFFICIAL
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: "12px", 
                          color: isHidden ? "#a7b6c2" : "#5c7080",
                          opacity: isHidden ? 0.7 : 1
                        }}>
                          {template.description}
                        </div>
                      </div>
                      
                      <Button
                        minimal
                        small
                        icon={isHidden ? "eye-off" : "eye-open"}
                        intent={isHidden ? "none" : "primary"}
                        onClick={() => handleToggleTemplate(template.id, false)}
                        style={{
                          marginLeft: "12px",
                          opacity: isHidden ? 0.6 : 1
                        }}
                        title={isHidden ? "Show template" : "Hide template"}
                      />
                    </div>
                  );
                })}

                {/* Custom Templates */}
                {customTemplatesInCategory.map((template) => {
                  const isHidden = hiddenCustomTemplates.includes(template.id);
                  return (
                    <div
                      key={template.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 12px",
                        border: "2px dashed #d8e1e8",
                        backgroundColor: isHidden ? "#f5f8fa" : "#fafbfc",
                        borderRadius: "6px",
                        marginBottom: "4px",
                      }}
                    >
                      <Icon
                        icon={template.icon as any}
                        size={16}
                        style={{ 
                          marginRight: "12px", 
                          color: isHidden ? "#8a9ba8" : template.color 
                        }}
                      />
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: "500", 
                          marginBottom: "2px",
                          color: isHidden ? "#8a9ba8" : "#182026"
                        }}>
                          {template.title}
                          <span style={{ 
                            fontSize: "10px", 
                            color: "#137cbd", 
                            marginLeft: "8px",
                            fontWeight: "400"
                          }}>
                            CUSTOM
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: "12px", 
                          color: isHidden ? "#a7b6c2" : "#5c7080",
                          opacity: isHidden ? 0.7 : 1
                        }}>
                          {template.description}
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", gap: "4px", marginLeft: "12px" }}>
                        <Button
                          minimal
                          small
                          icon="edit"
                          onClick={() => handleEditTemplate(template)}
                          title="Edit template"
                        />
                        <Button
                          minimal
                          small
                          icon="trash"
                          intent="danger"
                          onClick={() => handleDeleteTemplate(template.id)}
                          title="Delete template"
                        />
                        <Button
                          minimal
                          small
                          icon={isHidden ? "eye-off" : "eye-open"}
                          intent={isHidden ? "none" : "primary"}
                          onClick={() => handleToggleTemplate(template.id, true)}
                          style={{
                            opacity: isHidden ? 0.6 : 1
                          }}
                          title={isHidden ? "Show template" : "Hide template"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      </div>
      
      {/* Template Form Modal */}
      <TemplateForm
        isOpen={isFormOpen}
        template={editingTemplate}
        onClose={handleFormClose}
        onSave={handleFormSave}
      />
    </Dialog>
  );
};