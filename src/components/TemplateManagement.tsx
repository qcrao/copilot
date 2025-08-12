// src/components/TemplateManagement.tsx
import React, { useState, useEffect } from "react";
import { Button, Dialog, Icon } from "@blueprintjs/core";
import { PromptTemplate } from "../types";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { TemplateSettingsService } from "../services/templateSettingsService";

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

  useEffect(() => {
    if (isOpen) {
      setHiddenTemplates(TemplateSettingsService.getHiddenTemplates());
    }
  }, [isOpen]);

  const handleToggleTemplate = (templateId: string) => {
    const isCurrentlyHidden = hiddenTemplates.includes(templateId);
    
    // Update local state immediately for instant feedback
    let newHiddenTemplates: string[];
    if (isCurrentlyHidden) {
      TemplateSettingsService.showTemplate(templateId);
      newHiddenTemplates = hiddenTemplates.filter(id => id !== templateId);
    } else {
      TemplateSettingsService.hideTemplate(templateId);
      newHiddenTemplates = [...hiddenTemplates, templateId];
    }
    
    // Update state immediately
    setHiddenTemplates(newHiddenTemplates);
    onSettingsChanged();
  };

  const handleReset = () => {
    TemplateSettingsService.resetToDefaults();
    setHiddenTemplates([]);
    onSettingsChanged();
  };

  const groupedTemplates = PROMPT_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

  const categoryLabels = {
    writing: "Writing & Creation",
    analysis: "Analysis & Insights", 
    planning: "Planning & Organization",
    research: "Research & Exploration",
    reflection: "Learning & Reflection",
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
            Hide or show prompt templates. Hidden templates won't appear in the main list.
          </p>
          <Button
            icon="reset"
            intent="primary"
            outlined
            onClick={handleReset}
            style={{ marginBottom: "20px" }}
          >
            Reset All Templates
          </Button>
        </div>

        {Object.entries(groupedTemplates).map(([category, templates]) => (
          <div key={category} style={{ marginBottom: "24px" }}>
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
              {categoryLabels[category as keyof typeof categoryLabels] || category}
            </h4>
            
            <div style={{ marginLeft: "12px" }}>
              {templates.map((template) => {
                const isHidden = hiddenTemplates.includes(template.id);
                return (
                  <div
                    key={template.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderBottom: "1px solid #d8e1e8",
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
                      onClick={() => handleToggleTemplate(template.id)}
                      style={{
                        marginLeft: "12px",
                        opacity: isHidden ? 0.6 : 1
                      }}
                      title={isHidden ? "Show template" : "Hide template"}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </Dialog>
  );
};