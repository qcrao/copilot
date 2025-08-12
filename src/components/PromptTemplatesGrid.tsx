// src/components/PromptTemplatesGrid.tsx
import React, { useState, useEffect } from "react";
import { Button, Icon } from "@blueprintjs/core";
import { PromptTemplate, PromptTemplateState } from "../types";
import { PromptCard } from "./PromptCard";
import { PromptModal } from "./PromptModal";
import { TemplateManagement } from "./TemplateManagement";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { RoamService } from "../services/roamService";
import { multiProviderSettings } from "../settings";
import { TemplateSettingsService } from "../services/templateSettingsService";
import { UserTemplateService } from "../services/userTemplateService";

interface PromptTemplatesGridProps {
  onPromptSelect: (prompt: string) => void;
}

export const PromptTemplatesGrid: React.FC<PromptTemplatesGridProps> = ({
  onPromptSelect,
}) => {
  const [state, setState] = useState<PromptTemplateState>({
    selectedTemplate: null,
    isModalOpen: false,
    variableValues: {},
    isProcessing: false,
  });

  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [hiddenTemplates, setHiddenTemplates] = useState<string[]>([]);
  const [hiddenCustomTemplates, setHiddenCustomTemplates] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [dismissedEmptyMessage, setDismissedEmptyMessage] = useState(false);

  useEffect(() => {
    // Load hidden templates and custom templates on mount
    setHiddenTemplates(TemplateSettingsService.getHiddenTemplates());
    setHiddenCustomTemplates(UserTemplateService.getSettings().hiddenCustomTemplates);
    setCustomTemplates(UserTemplateService.getCustomTemplates() as any);
    
    // Load dismissed message state from localStorage
    const dismissed = localStorage.getItem("copilot-empty-message-dismissed");
    setDismissedEmptyMessage(dismissed === "true");
  }, []);

  const handleManagementSettingsChanged = () => {
    setHiddenTemplates(TemplateSettingsService.getHiddenTemplates());
    setHiddenCustomTemplates(UserTemplateService.getSettings().hiddenCustomTemplates);
    setCustomTemplates(UserTemplateService.getCustomTemplates() as any);
    // Reset dismissed message when templates visibility changes
    setDismissedEmptyMessage(false);
    localStorage.removeItem("copilot-empty-message-dismissed");
  };

  const handleTemplateClick = (template: PromptTemplate) => {
    if (template.id === "daily-summary") {
      // Daily Summary: populate input with clickable date
      const today = new Date().toISOString().split("T")[0];
      const prompt = template.prompt.replace("[DATE]", `[${today}]`);

      // Add language instruction based on user's manual setting
      const responseLanguage =
        multiProviderSettings.responseLanguage || "English";
      const finalPrompt =
        responseLanguage !== "English"
          ? prompt + `\n\nIMPORTANT: Please respond in ${responseLanguage}.`
          : prompt;

      onPromptSelect(finalPrompt);
    } else {
      // Other templates: process immediately
      processTemplate(template, {});
    }
  };

  const processTemplate = async (
    template: PromptTemplate,
    variables: Record<string, any>
  ) => {
    try {
      let prompt = template.prompt;

      // Replace variables in the prompt (only for Daily Summary template)
      if (template.variables && template.variables.length > 0) {
        Object.entries(variables).forEach(([key, value]) => {
          prompt = prompt.replace(new RegExp(`{${key}}`, "g"), value);
        });
      }

      // Handle context types that require real-time data fetching
      if (template.requiresContext) {
        if (template.contextType === "current-page") {
          // Get fresh current page context when template is used
          console.log("🔄 Fetching fresh current page context for template:", template.id);
          try {
            const freshContext = await RoamService.getPageContext();
            if (freshContext?.currentPage) {
              console.log("✅ Got fresh context for page:", freshContext.currentPage.title);
              const contextString = RoamService.formatContextForAI(freshContext, 8000);
              // The context will be handled by the AI service system message
              // Template prompt itself doesn't need to be modified
            } else {
              console.log("⚠️ No current page found in fresh context");
            }
          } catch (error) {
            console.error("❌ Error fetching fresh context:", error);
          }
        } else if (template.contextType === "date-range" && variables.date) {
          // Handle date range context (existing logic)
          try {
            const dateNotes = await RoamService.getNotesFromDate(variables.date);
            if (dateNotes && dateNotes.blocks.length > 0) {
              const notesContent = RoamService.formatBlocksForAI(
                dateNotes.blocks,
                0
              );
              prompt += `\n\nHere are my notes from ${variables.date}:\n${notesContent}`;
            } else {
              prompt += `\n\nNote: No notes found for ${variables.date}. Please let me know that no notes were found for this date.`;
            }
          } catch (error) {
            console.error("Error fetching date notes:", error);
            prompt += `\n\nNote: Could not retrieve notes for ${variables.date}.`;
          }
        }
      }

      // Add language instruction based on user's manual setting
      const responseLanguage =
        multiProviderSettings.responseLanguage || "English";
      if (responseLanguage !== "English") {
        prompt += `\n\nIMPORTANT: Please respond in ${responseLanguage}.`;
      }

      // Send the processed prompt to populate input (not auto-send)
      onPromptSelect(prompt);

      // Only close modal if it was actually open (don't reset other state)
      if (state.isModalOpen) {
        setState((prev) => ({
          ...prev,
          isModalOpen: false,
        }));
      }
    } catch (error) {
      console.error("Error processing template:", error);
    }
  };

  const handleModalSubmit = (variables: Record<string, any>) => {
    if (state.selectedTemplate) {
      processTemplate(state.selectedTemplate, variables);
    }
  };

  const handleModalClose = () => {
    setState((prev) => ({
      ...prev,
      isModalOpen: false,
      selectedTemplate: null,
      variableValues: {},
      isProcessing: false,
    }));
  };

  // Combine official and custom templates
  const allTemplates = [
    ...PROMPT_TEMPLATES.filter(t => !hiddenTemplates.includes(t.id)),
    ...(customTemplates as any[]).filter((t: any) => !hiddenCustomTemplates.includes(t.id))
  ];

  // Group all visible templates by category
  const visibleGroupedTemplates: Record<string, PromptTemplate[]> = allTemplates.reduce((acc, template) => {
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
    <div style={{ padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px", position: "relative" }}>
        <Icon
          icon="lightbulb"
          size={32}
          style={{ opacity: 0.6, marginBottom: "12px", color: "#666" }}
        />
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            margin: 0,
            lineHeight: "1.5",
          }}
        >
          Your intelligent note companion
        </p>
        
        {/* Management button */}
        <Button
          minimal
          small
          icon="cog"
          onClick={() => setIsManagementOpen(true)}
          style={{
            position: "absolute",
            top: "0",
            right: "0",
            opacity: 0.6,
          }}
          title="Manage Templates"
        />
      </div>

      {/* Show message if no templates are visible */}
      {Object.keys(visibleGroupedTemplates).length === 0 && !dismissedEmptyMessage && (
        <div style={{ 
          textAlign: "center", 
          padding: "40px 20px",
          color: "#666",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          position: "relative"
        }}>
          <Button
            minimal
            small
            icon="cross"
            onClick={() => {
              setDismissedEmptyMessage(true);
              localStorage.setItem("copilot-empty-message-dismissed", "true");
            }}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              opacity: 0.6,
            }}
            title="Dismiss message"
          />
          <Icon icon="eye-off" size={24} style={{ marginBottom: "12px", opacity: 0.6 }} />
          <p style={{ margin: 0, fontSize: "14px" }}>
            All templates are hidden. Click the settings button above to manage templates.
          </p>
        </div>
      )}

      {/* Templates by category */}
      {Object.entries(visibleGroupedTemplates).map(([category, templates]) => (
        <div key={category} style={{ marginBottom: "32px" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "12px",
              color: "#393a3d",
              textTransform: "capitalize",
            }}
          >
            {categoryLabels[category as keyof typeof categoryLabels] ||
              category}
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {templates.map((template: PromptTemplate) => (
              <PromptCard
                key={template.id}
                template={template}
                onClick={handleTemplateClick}
                isCustom={(template as any).isCustom || false}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Modal for variable input */}
      {state.isModalOpen && state.selectedTemplate && (
        <PromptModal
          template={state.selectedTemplate}
          isOpen={state.isModalOpen}
          isProcessing={state.isProcessing}
          onSubmit={handleModalSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Template Management Modal */}
      <TemplateManagement
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        onSettingsChanged={handleManagementSettingsChanged}
      />
    </div>
  );
};
