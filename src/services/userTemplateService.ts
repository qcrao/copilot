// src/services/userTemplateService.ts
import { CustomPromptTemplate, UserTemplateSettings, PromptTemplate } from "../types";

const USER_TEMPLATES_KEY = "copilot-user-templates";

const DEFAULT_SETTINGS: UserTemplateSettings = {
  customTemplates: [],
  hiddenCustomTemplates: [],
};

export class UserTemplateService {
  private static settings: UserTemplateSettings = { ...DEFAULT_SETTINGS };

  static loadSettings(): UserTemplateSettings {
    try {
      const saved = localStorage.getItem(USER_TEMPLATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error("Failed to load user template settings:", error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return this.settings;
  }

  static saveSettings(settings: UserTemplateSettings): void {
    try {
      this.settings = settings;
      localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save user template settings:", error);
    }
  }

  static getSettings(): UserTemplateSettings {
    return this.settings;
  }

  static createTemplate(template: Omit<PromptTemplate, 'id'>): string {
    const newTemplate: CustomPromptTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const currentSettings = this.getSettings();
    currentSettings.customTemplates.push(newTemplate);
    this.saveSettings(currentSettings);
    
    return newTemplate.id;
  }

  static updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'isCustom'>>): boolean {
    const currentSettings = this.getSettings();
    const templateIndex = currentSettings.customTemplates.findIndex(t => t.id === id);
    
    if (templateIndex === -1) {
      return false;
    }

    currentSettings.customTemplates[templateIndex] = {
      ...currentSettings.customTemplates[templateIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveSettings(currentSettings);
    return true;
  }

  static deleteTemplate(id: string): boolean {
    const currentSettings = this.getSettings();
    const initialLength = currentSettings.customTemplates.length;
    
    currentSettings.customTemplates = currentSettings.customTemplates.filter(t => t.id !== id);
    currentSettings.hiddenCustomTemplates = currentSettings.hiddenCustomTemplates.filter(hiddenId => hiddenId !== id);
    
    if (currentSettings.customTemplates.length !== initialLength) {
      this.saveSettings(currentSettings);
      return true;
    }
    
    return false;
  }

  static hideTemplate(templateId: string): void {
    const currentSettings = this.getSettings();
    if (!currentSettings.hiddenCustomTemplates.includes(templateId)) {
      currentSettings.hiddenCustomTemplates.push(templateId);
      this.saveSettings(currentSettings);
    }
  }

  static showTemplate(templateId: string): void {
    const currentSettings = this.getSettings();
    currentSettings.hiddenCustomTemplates = currentSettings.hiddenCustomTemplates.filter(
      (id) => id !== templateId
    );
    this.saveSettings(currentSettings);
  }

  static isTemplateHidden(templateId: string): boolean {
    return this.getSettings().hiddenCustomTemplates.includes(templateId);
  }

  static getCustomTemplates(): CustomPromptTemplate[] {
    return this.getSettings().customTemplates;
  }

  static getVisibleCustomTemplates(): CustomPromptTemplate[] {
    const { customTemplates, hiddenCustomTemplates } = this.getSettings();
    return customTemplates.filter(template => !hiddenCustomTemplates.includes(template.id));
  }

  static getAllTemplates(): (PromptTemplate | CustomPromptTemplate)[] {
    const { PROMPT_TEMPLATES } = require("../data/promptTemplates");
    const customTemplates = this.getCustomTemplates();
    return [...PROMPT_TEMPLATES, ...customTemplates];
  }

  static getTemplateById(id: string): PromptTemplate | CustomPromptTemplate | null {
    const customTemplate = this.getCustomTemplates().find(t => t.id === id);
    if (customTemplate) {
      return customTemplate;
    }

    const { PROMPT_TEMPLATES } = require("../data/promptTemplates");
    return PROMPT_TEMPLATES.find((t: PromptTemplate) => t.id === id) || null;
  }
}

// Initialize settings on load
UserTemplateService.loadSettings();