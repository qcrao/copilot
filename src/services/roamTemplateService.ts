// src/services/roamTemplateService.ts
import { 
  CustomPromptTemplate, 
  UserTemplateSettings, 
  PromptTemplateSettings 
} from "../types";

/**
 * Service for saving prompt templates to Roam Research
 * Based on the ConversationService pattern
 */
export class RoamTemplateService {
  private static readonly MAIN_PAGE_TITLE = "Roam Copilot Templates";
  
  private static readonly TEMPLATE_BLOCK_PREFIX = "TEMPLATE:";
  private static readonly SETTINGS_BLOCK_PREFIX = "SETTINGS:";
  
  /**
   * Ensure main templates page exists
   */
  private static async ensureMainPageExists(): Promise<string> {
    try {
      // Check if page already exists
      const query = `
        [:find ?uid
         :where
         [?e :node/title "${this.MAIN_PAGE_TITLE}"]
         [?e :block/uid ?uid]]
      `;
      
      const result = window.roamAlphaAPI.q(query);
      if (result && result.length > 0) {
        return result[0][0];
      }

      // Create the main page
      const pageUid = window.roamAlphaAPI.util.generateUID();
      await window.roamAlphaAPI.createPage({
        page: {
          title: this.MAIN_PAGE_TITLE,
          uid: pageUid
        }
      });

      // Add description block
      const descriptionUid = window.roamAlphaAPI.util.generateUID();
      await window.roamAlphaAPI.createBlock({
        location: {
          "parent-uid": pageUid,
          order: 0
        },
        block: {
          string: "Custom prompt templates and settings - This page is automatically managed by Roam Copilot",
          uid: descriptionUid
        }
      });

      console.log("Created main templates page:", pageUid);
      return pageUid;
    } catch (error) {
      console.error("Error ensuring main templates page exists:", error);
      throw new Error("Failed to create templates storage page");
    }
  }

  /**
   * Helper: Get page blocks
   */
  private static async getPageBlocks(pageUid: string): Promise<any[]> {
    try {
      const query = `
        [:find ?uid ?string ?order
         :where
         [?page :block/uid "${pageUid}"]
         [?page :block/children ?block]
         [?block :block/uid ?uid]
         [?block :block/string ?string]
         [?block :block/order ?order]]
      `;

      const result = window.roamAlphaAPI.q(query);
      if (!result) return [];

      return result.map(([uid, string, order]: [string, string, number]) => ({
        uid,
        string,
        order
      }));
    } catch (error) {
      console.error("Error getting page blocks:", error);
      return [];
    }
  }

  /**
   * Save custom template to Roam
   */
  static async saveCustomTemplate(template: CustomPromptTemplate): Promise<void> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blockUid = window.roamAlphaAPI.util.generateUID();
      const templateData = JSON.stringify(template, null, 2);
      
      await window.roamAlphaAPI.createBlock({
        location: {
          "parent-uid": mainPageUid,
          order: "first"
        },
        block: {
          string: `${this.TEMPLATE_BLOCK_PREFIX} ${template.title}\n\`\`\`json\n${templateData}\n\`\`\``,
          uid: blockUid
        }
      });

      console.log("Saved custom template:", template.id);
    } catch (error) {
      console.error("Error saving custom template:", error);
      throw error;
    }
  }

  /**
   * Update existing custom template in Roam
   */
  static async updateCustomTemplate(template: CustomPromptTemplate): Promise<void> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      // Find the block containing this template
      for (const block of blocks) {
        if (block.string.includes(this.TEMPLATE_BLOCK_PREFIX) && 
            block.string.includes(template.id)) {
          const templateData = JSON.stringify(template, null, 2);
          const newString = `${this.TEMPLATE_BLOCK_PREFIX} ${template.title}\n\`\`\`json\n${templateData}\n\`\`\``;
          
          await window.roamAlphaAPI.updateBlock({
            block: {
              uid: block.uid,
              string: newString
            }
          });
          
          console.log("Updated custom template:", template.id);
          return;
        }
      }
      
      // If not found, create new block
      await this.saveCustomTemplate(template);
    } catch (error) {
      console.error("Error updating custom template:", error);
      throw error;
    }
  }

  /**
   * Delete custom template from Roam
   */
  static async deleteCustomTemplate(templateId: string): Promise<void> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      // Find and delete the block containing this template
      for (const block of blocks) {
        if (block.string.includes(this.TEMPLATE_BLOCK_PREFIX) && 
            block.string.includes(templateId)) {
          await window.roamAlphaAPI.deleteBlock({ block: { uid: block.uid } });
          console.log("Deleted custom template:", templateId);
          return;
        }
      }
    } catch (error) {
      console.error("Error deleting custom template:", error);
      throw error;
    }
  }

  /**
   * Load all custom templates from Roam
   */
  static async loadCustomTemplates(): Promise<CustomPromptTemplate[]> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      const templates: CustomPromptTemplate[] = [];
      
      for (const block of blocks) {
        if (block.string.includes(this.TEMPLATE_BLOCK_PREFIX) && 
            block.string.includes('```json')) {
          try {
            // Extract JSON from the block
            const jsonMatch = block.string.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
              const template: CustomPromptTemplate = JSON.parse(jsonMatch[1]);
              templates.push(template);
            }
          } catch (error) {
            console.warn("Failed to parse template data:", error);
          }
        }
      }

      console.log("Loaded custom templates from Roam:", templates.length);
      return templates;
    } catch (error) {
      console.error("Error loading custom templates:", error);
      return [];
    }
  }

  /**
   * Save template settings to Roam
   */
  static async saveTemplateSettings(userSettings: UserTemplateSettings, globalSettings: PromptTemplateSettings): Promise<void> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const settingsData = JSON.stringify({
        userTemplateSettings: userSettings,
        globalTemplateSettings: globalSettings
      }, null, 2);
      
      // Check if settings block already exists
      const blocks = await this.getPageBlocks(mainPageUid);
      let settingsBlockUid: string | null = null;
      
      for (const block of blocks) {
        if (block.string.includes(this.SETTINGS_BLOCK_PREFIX)) {
          settingsBlockUid = block.uid;
          break;
        }
      }
      
      if (settingsBlockUid) {
        // Update existing settings block
        await window.roamAlphaAPI.updateBlock({
          block: {
            uid: settingsBlockUid,
            string: `${this.SETTINGS_BLOCK_PREFIX} Template Settings\n\`\`\`json\n${settingsData}\n\`\`\``
          }
        });
      } else {
        // Create new settings block
        const newBlockUid = window.roamAlphaAPI.util.generateUID();
        await window.roamAlphaAPI.createBlock({
          location: {
            "parent-uid": mainPageUid,
            order: 1
          },
          block: {
            string: `${this.SETTINGS_BLOCK_PREFIX} Template Settings\n\`\`\`json\n${settingsData}\n\`\`\``,
            uid: newBlockUid
          }
        });
      }

      console.log("Saved template settings to Roam");
    } catch (error) {
      console.error("Error saving template settings:", error);
      throw error;
    }
  }

  /**
   * Load template settings from Roam
   */
  static async loadTemplateSettings(): Promise<{
    userTemplateSettings: UserTemplateSettings;
    globalTemplateSettings: PromptTemplateSettings;
  }> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      for (const block of blocks) {
        if (block.string.includes(this.SETTINGS_BLOCK_PREFIX) && 
            block.string.includes('```json')) {
          try {
            // Extract JSON from the block
            const jsonMatch = block.string.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
              const settings = JSON.parse(jsonMatch[1]);
              console.log("Loaded template settings from Roam");
              return {
                userTemplateSettings: settings.userTemplateSettings || { customTemplates: [], hiddenCustomTemplates: [] },
                globalTemplateSettings: settings.globalTemplateSettings || { hiddenTemplates: [] }
              };
            }
          } catch (error) {
            console.warn("Failed to parse template settings:", error);
          }
        }
      }

      // Return default settings if not found
      console.log("No template settings found in Roam, using defaults");
      return {
        userTemplateSettings: { customTemplates: [], hiddenCustomTemplates: [] },
        globalTemplateSettings: { hiddenTemplates: [] }
      };
    } catch (error) {
      console.error("Error loading template settings:", error);
      return {
        userTemplateSettings: { customTemplates: [], hiddenCustomTemplates: [] },
        globalTemplateSettings: { hiddenTemplates: [] }
      };
    }
  }

  /**
   * Check if Roam API is available
   */
  static isRoamAvailable(): boolean {
    return typeof window !== 'undefined' && 
           window.roamAlphaAPI && 
           typeof window.roamAlphaAPI.q === 'function';
  }
}
