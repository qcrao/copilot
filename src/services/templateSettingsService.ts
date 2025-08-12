// src/services/templateSettingsService.ts
import { PromptTemplateSettings } from "../types";

const TEMPLATE_SETTINGS_KEY = "copilot-template-settings";

const DEFAULT_SETTINGS: PromptTemplateSettings = {
  hiddenTemplates: [],
};

export class TemplateSettingsService {
  private static settings: PromptTemplateSettings = { ...DEFAULT_SETTINGS };

  static loadSettings(): PromptTemplateSettings {
    try {
      const saved = localStorage.getItem(TEMPLATE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error("Failed to load template settings:", error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return this.settings;
  }

  static saveSettings(settings: PromptTemplateSettings): void {
    try {
      this.settings = settings;
      localStorage.setItem(TEMPLATE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save template settings:", error);
    }
  }

  static getSettings(): PromptTemplateSettings {
    return this.settings;
  }

  static hideTemplate(templateId: string): void {
    const currentSettings = this.getSettings();
    if (!currentSettings.hiddenTemplates.includes(templateId)) {
      currentSettings.hiddenTemplates.push(templateId);
      this.saveSettings(currentSettings);
    }
  }

  static showTemplate(templateId: string): void {
    const currentSettings = this.getSettings();
    currentSettings.hiddenTemplates = currentSettings.hiddenTemplates.filter(
      (id) => id !== templateId
    );
    this.saveSettings(currentSettings);
  }

  static isTemplateHidden(templateId: string): boolean {
    return this.getSettings().hiddenTemplates.includes(templateId);
  }

  static resetToDefaults(): void {
    this.saveSettings({ ...DEFAULT_SETTINGS });
  }

  static getHiddenTemplates(): string[] {
    return this.getSettings().hiddenTemplates;
  }
}

// Initialize settings on load
TemplateSettingsService.loadSettings();