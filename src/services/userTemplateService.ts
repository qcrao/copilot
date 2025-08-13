// src/services/userTemplateService.ts
import { CustomPromptTemplate, UserTemplateSettings, PromptTemplate } from "../types";
import { RoamTemplateService } from "./roamTemplateService";
import { TemplateSettingsService } from "./templateSettingsService";

const USER_TEMPLATES_KEY = "copilot-user-templates";

const DEFAULT_SETTINGS: UserTemplateSettings = {
  customTemplates: [],
  hiddenCustomTemplates: [],
};

export class UserTemplateService {
  private static settings: UserTemplateSettings = { ...DEFAULT_SETTINGS };
  private static isInitialized = false;
  private static useRoamStorage = false;

  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Check if Roam API is available
    this.useRoamStorage = RoamTemplateService.isRoamAvailable();
    
    if (this.useRoamStorage) {
      console.log("Using Roam Research for template storage");
      await this.loadSettingsFromRoam();
    } else {
      console.log("Using localStorage for template storage (Roam API not available)");
      this.loadSettingsFromLocalStorage();
    }

    this.isInitialized = true;
  }

  private static async loadSettingsFromRoam(): Promise<void> {
    try {
      const { userTemplateSettings } = await RoamTemplateService.loadTemplateSettings();
      const customTemplates = await RoamTemplateService.loadCustomTemplates();
      
      this.settings = {
        customTemplates,
        hiddenCustomTemplates: userTemplateSettings.hiddenCustomTemplates || []
      };
    } catch (error) {
      console.error("Failed to load template settings from Roam:", error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private static loadSettingsFromLocalStorage(): void {
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
  }

  static async loadSettings(): Promise<UserTemplateSettings> {
    await this.initialize();
    return this.settings;
  }

  static async saveSettings(settings: UserTemplateSettings): Promise<void> {
    await this.initialize();
    
    try {
      this.settings = settings;
      
      if (this.useRoamStorage) {
        // Save settings to Roam
        const globalSettings = await TemplateSettingsService.getSettings();
        await RoamTemplateService.saveTemplateSettings(settings, globalSettings);
      } else {
        // Fallback to localStorage
        localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(settings));
      }
    } catch (error) {
      console.error("Failed to save user template settings:", error);
    }
  }

  static async getSettings(): Promise<UserTemplateSettings> {
    await this.initialize();
    return this.settings;
  }

  static async createTemplate(template: Omit<PromptTemplate, 'id'>): Promise<string> {
    await this.initialize();
    
    const newTemplate: CustomPromptTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const currentSettings = this.settings;
    currentSettings.customTemplates.push(newTemplate);
    
    if (this.useRoamStorage) {
      // Save the template directly to Roam
      await RoamTemplateService.saveCustomTemplate(newTemplate);
    }
    
    await this.saveSettings(currentSettings);
    
    return newTemplate.id;
  }

  static async updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'isCustom'>>): Promise<boolean> {
    await this.initialize();
    
    const currentSettings = this.settings;
    const templateIndex = currentSettings.customTemplates.findIndex(t => t.id === id);
    
    if (templateIndex === -1) {
      return false;
    }

    const updatedTemplate = {
      ...currentSettings.customTemplates[templateIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    currentSettings.customTemplates[templateIndex] = updatedTemplate;
    
    if (this.useRoamStorage) {
      // Update the template directly in Roam
      await RoamTemplateService.updateCustomTemplate(updatedTemplate);
    }
    
    await this.saveSettings(currentSettings);
    return true;
  }

  static async deleteTemplate(id: string): Promise<boolean> {
    await this.initialize();
    
    const currentSettings = this.settings;
    const initialLength = currentSettings.customTemplates.length;
    
    currentSettings.customTemplates = currentSettings.customTemplates.filter(t => t.id !== id);
    currentSettings.hiddenCustomTemplates = currentSettings.hiddenCustomTemplates.filter(hiddenId => hiddenId !== id);
    
    if (currentSettings.customTemplates.length !== initialLength) {
      if (this.useRoamStorage) {
        // Delete the template directly from Roam
        await RoamTemplateService.deleteCustomTemplate(id);
      }
      
      await this.saveSettings(currentSettings);
      return true;
    }
    
    return false;
  }

  static async hideTemplate(templateId: string): Promise<void> {
    await this.initialize();
    
    const currentSettings = this.settings;
    if (!currentSettings.hiddenCustomTemplates.includes(templateId)) {
      currentSettings.hiddenCustomTemplates.push(templateId);
      await this.saveSettings(currentSettings);
    }
  }

  static async showTemplate(templateId: string): Promise<void> {
    await this.initialize();
    
    const currentSettings = this.settings;
    currentSettings.hiddenCustomTemplates = currentSettings.hiddenCustomTemplates.filter(
      (id) => id !== templateId
    );
    await this.saveSettings(currentSettings);
  }

  static async isTemplateHidden(templateId: string): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.hiddenCustomTemplates.includes(templateId);
  }

  static async getCustomTemplates(): Promise<CustomPromptTemplate[]> {
    const settings = await this.getSettings();
    return settings.customTemplates;
  }

  static async getVisibleCustomTemplates(): Promise<CustomPromptTemplate[]> {
    const { customTemplates, hiddenCustomTemplates } = await this.getSettings();
    return customTemplates.filter(template => !hiddenCustomTemplates.includes(template.id));
  }

  static async getAllTemplates(): Promise<(PromptTemplate | CustomPromptTemplate)[]> {
    const { PROMPT_TEMPLATES } = require("../data/promptTemplates");
    const customTemplates = await this.getCustomTemplates();
    return [...PROMPT_TEMPLATES, ...customTemplates];
  }

  static async getTemplateById(id: string): Promise<PromptTemplate | CustomPromptTemplate | null> {
    const customTemplates = await this.getCustomTemplates();
    const customTemplate = customTemplates.find(t => t.id === id);
    if (customTemplate) {
      return customTemplate;
    }

    const { PROMPT_TEMPLATES } = require("../data/promptTemplates");
    return PROMPT_TEMPLATES.find((t: PromptTemplate) => t.id === id) || null;
  }

  // Legacy synchronous methods for backward compatibility
  // These will use cached data if available
  static getSettingsSync(): UserTemplateSettings {
    return this.settings;
  }

  static getCustomTemplatesSync(): CustomPromptTemplate[] {
    return this.settings.customTemplates;
  }

  static getVisibleCustomTemplatesSync(): CustomPromptTemplate[] {
    const { customTemplates, hiddenCustomTemplates } = this.settings;
    return customTemplates.filter(template => !hiddenCustomTemplates.includes(template.id));
  }

  static isTemplateHiddenSync(templateId: string): boolean {
    return this.settings.hiddenCustomTemplates.includes(templateId);
  }
}

// Initialize settings on load (don't await here to avoid blocking)
UserTemplateService.initialize().catch(error => {
  console.error("Failed to initialize UserTemplateService:", error);
});