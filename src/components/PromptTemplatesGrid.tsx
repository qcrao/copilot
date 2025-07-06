// src/components/PromptTemplatesGrid.tsx
import React, { useState } from "react";
import { Icon } from "@blueprintjs/core";
import { PromptTemplate, PromptTemplateState } from "../types";
import { PromptCard } from "./PromptCard";
import { PromptModal } from "./PromptModal";
import { PROMPT_TEMPLATES } from "../data/promptTemplates";
import { RoamService } from "../services/roamService";
import { multiProviderSettings } from "../settings";

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

      // Handle special context types that require fetching historical data
      if (template.contextType === "date-range" && variables.date) {
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
    <div style={{ padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <Icon
          icon="lightbulb"
          size={32}
          style={{ opacity: 0.6, marginBottom: "12px", color: "#666" }}
        />
        {/* <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            margin: "0 0 6px 0",
            color: "#333",
          }}
        >
          Roam Copilot
        </h2> */}
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
      </div>

      {/* Templates by category */}
      {Object.entries(groupedTemplates).map(([category, templates]) => (
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
            {templates.map((template) => (
              <PromptCard
                key={template.id}
                template={template}
                onClick={handleTemplateClick}
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
    </div>
  );
};
