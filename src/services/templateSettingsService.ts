// src/services/templateSettingsService.ts
import { PromptTemplateSettings } from "../types";
import { RoamTemplateService } from "./roamTemplateService";

const TEMPLATE_SETTINGS_KEY = "copilot-template-settings";

const DEFAULT_SETTINGS: PromptTemplateSettings = {
  hiddenTemplates: [],
};

export class TemplateSettingsService {
  private static settings: PromptTemplateSettings = { ...DEFAULT_SETTINGS };
  private static isInitialized = false;
  private static useRoamStorage = false;

  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Check if Roam API is available
    this.useRoamStorage = RoamTemplateService.isRoamAvailable();
    
    if (this.useRoamStorage) {
      await this.loadSettingsFromRoam();
    } else {
      this.loadSettingsFromLocalStorage();
    }

    this.isInitialized = true;
  }

  private static async loadSettingsFromRoam(): Promise<void> {
    try {
      const { globalTemplateSettings } = await RoamTemplateService.loadTemplateSettings();
      this.settings = globalTemplateSettings;
    } catch (error) {
      console.error("Failed to load template settings from Roam:", error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private static loadSettingsFromLocalStorage(): void {
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
  }

  static async loadSettings(): Promise<PromptTemplateSettings> {
    await this.initialize();
    return this.settings;
  }

  static async saveSettings(settings: PromptTemplateSettings): Promise<void> {
    await this.initialize();
    
    try {
      this.settings = settings;
      
      if (this.useRoamStorage) {
        // Get user settings and save both to Roam
        const { UserTemplateService } = await import('./userTemplateService');
        const userSettings = await UserTemplateService.getSettings();
        await RoamTemplateService.saveTemplateSettings(userSettings, settings);
      } else {
        // Fallback to localStorage
        localStorage.setItem(TEMPLATE_SETTINGS_KEY, JSON.stringify(settings));
      }
    } catch (error) {
      console.error("Failed to save template settings:", error);
    }
  }

  static async getSettings(): Promise<PromptTemplateSettings> {
    await this.initialize();
    return this.settings;
  }

  static async hideTemplate(templateId: string): Promise<void> {
    await this.initialize();
    
    const currentSettings = this.settings;
    if (!currentSettings.hiddenTemplates.includes(templateId)) {
      currentSettings.hiddenTemplates.push(templateId);
      await this.saveSettings(currentSettings);
    }
  }

  static async showTemplate(templateId: string): Promise<void> {
    await this.initialize();
    
    const currentSettings = this.settings;
    currentSettings.hiddenTemplates = currentSettings.hiddenTemplates.filter(
      (id) => id !== templateId
    );
    await this.saveSettings(currentSettings);
  }

  static async isTemplateHidden(templateId: string): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.hiddenTemplates.includes(templateId);
  }

  static async resetToDefaults(): Promise<void> {
    await this.saveSettings({ ...DEFAULT_SETTINGS });
  }

  static async getHiddenTemplates(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.hiddenTemplates;
  }

  // Legacy synchronous methods for backward compatibility
  static getSettingsSync(): PromptTemplateSettings {
    return this.settings;
  }

  static isTemplateHiddenSync(templateId: string): boolean {
    return this.settings.hiddenTemplates.includes(templateId);
  }

  static getHiddenTemplatesSync(): string[] {
    return this.settings.hiddenTemplates;
  }
}

// Initialize settings on load (don't await here to avoid blocking)
TemplateSettingsService.initialize().catch(error => {
  console.error("Failed to initialize TemplateSettingsService:", error);
});