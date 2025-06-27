// src/services/conversationService.ts
import { 
  ConversationMetadata, 
  ConversationData, 
  ConversationSettings, 
  ChatMessage,
  CompressedMessage
} from "../types";

export class ConversationService {
  private static readonly MAIN_PAGE_TITLE = "Roam Copilot Conversations";
  private static readonly DATA_PAGE_PREFIX = "Roam Copilot Data";
  
  private static readonly DEFAULT_SETTINGS: ConversationSettings = {
    maxConversations: 50,
    maxMessagesPerConversation: 100,
    autoCleanup: true,
    compressionThreshold: 1000,
    maxAge: 30 // days
  };

  /**
   * Generate unique conversation ID
   */
  private static generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate conversation title from first user message
   */
  private static generateTitle(firstMessage: string): string {
    // Clean the message by removing reference symbols and normalizing whitespace
    const cleanMessage = firstMessage.trim()
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove [[ ]] but keep the content
      .replace(/\(\(([^\)]+)\)\)/g, '$1') // Remove (( )) but keep the content  
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim();
    
    if (cleanMessage.length <= 30) {
      return cleanMessage;
    }
    return cleanMessage.substring(0, 27) + '...';
  }

  /**
   * No compression - return message as is
   */
  private static compressMessage(message: ChatMessage): ChatMessage {
    return message;
  }

  /**
   * Ensure main conversations page exists
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
          string: "AI conversation history - This page is automatically managed by Roam Copilot",
          uid: descriptionUid
        }
      });

      console.log("Created main conversations page:", pageUid);
      return pageUid;
    } catch (error) {
      console.error("Error ensuring main page exists:", error);
      throw new Error("Failed to create conversations storage page");
    }
  }

  /**
   * Create data page for conversation
   */
  private static async createDataPage(conversationId: string): Promise<string> {
    try {
      const pageTitle = `${this.DATA_PAGE_PREFIX}/${conversationId}`;
      const pageUid = window.roamAlphaAPI.util.generateUID();
      
      await window.roamAlphaAPI.createPage({
        page: {
          title: pageTitle,
          uid: pageUid
        }
      });

      console.log("Created data page:", pageTitle, pageUid);
      return pageUid;
    } catch (error) {
      console.error("Error creating data page:", error);
      throw new Error("Failed to create conversation data page");
    }
  }

  /**
   * Save conversation metadata to main page
   */
  private static async saveConversationMetadata(metadata: ConversationMetadata, mainPageUid: string): Promise<void> {
    try {
      const blockUid = window.roamAlphaAPI.util.generateUID();
      const metadataString = JSON.stringify(metadata, null, 2);
      
      await window.roamAlphaAPI.createBlock({
        location: {
          "parent-uid": mainPageUid,
          order: "first"
        },
        block: {
          string: `Conversation: ${metadata.title}\n\`\`\`json\n${metadataString}\n\`\`\`\n[[${this.DATA_PAGE_PREFIX}/${metadata.id}]]`,
          uid: blockUid
        }
      });

      console.log("Saved conversation metadata:", metadata.id);
    } catch (error) {
      console.error("Error saving conversation metadata:", error);
      throw error;
    }
  }

  /**
   * Save messages to data page
   */
  private static async saveMessagesToDataPage(messages: ChatMessage[], dataPageUid: string): Promise<void> {
    try {
      // Clear existing messages
      const existingBlocks = await this.getPageBlocks(dataPageUid);
      for (const block of existingBlocks) {
        await window.roamAlphaAPI.deleteBlock({ block: { uid: block.uid } });
      }

      // Save new messages
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const processedMessage = this.compressMessage(message);
        const messageString = JSON.stringify(processedMessage, null, 2);
        const blockUid = window.roamAlphaAPI.util.generateUID();

        await window.roamAlphaAPI.createBlock({
          location: {
            "parent-uid": dataPageUid,
            order: i
          },
          block: {
            string: `\`\`\`json\n${messageString}\n\`\`\``,
            uid: blockUid
          }
        });
      }

      console.log("Saved messages to data page:", messages.length);
    } catch (error) {
      console.error("Error saving messages to data page:", error);
      throw error;
    }
  }

  /**
   * Load conversations list from main page
   */
  static async loadConversations(): Promise<ConversationMetadata[]> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      const conversations: ConversationMetadata[] = [];
      
      for (const block of blocks) {
        if (block.string.includes('```json') && block.string.includes('Conversation:')) {
          try {
            // Extract JSON from the block
            const jsonMatch = block.string.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
              const metadata: ConversationMetadata = JSON.parse(jsonMatch[1]);
              conversations.push(metadata);
            }
          } catch (error) {
            console.warn("Failed to parse conversation metadata:", error);
          }
        }
      }

      // Sort by last updated (newest first)
      conversations.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      
      console.log("Loaded conversations:", conversations.length);
      return conversations;
    } catch (error) {
      console.error("Error loading conversations:", error);
      return [];
    }
  }

  /**
   * Load messages for specific conversation
   */
  static async loadConversationMessages(conversationId: string, offset = 0, limit = 20): Promise<ChatMessage[]> {
    try {
      const dataPageTitle = `${this.DATA_PAGE_PREFIX}/${conversationId}`;
      const query = `
        [:find ?uid
         :where
         [?e :node/title "${dataPageTitle}"]
         [?e :block/uid ?uid]]
      `;
      
      const result = window.roamAlphaAPI.q(query);
      if (!result || result.length === 0) {
        console.log("Conversation data page not found:", conversationId);
        return [];
      }

      const dataPageUid = result[0][0];
      const blocks = await this.getPageBlocks(dataPageUid);
      
      const messages: ChatMessage[] = [];
      const sortedBlocks = blocks
        .filter(block => block.string.includes('```json'))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .slice(offset, offset + limit);

      for (const block of sortedBlocks) {
        try {
          const jsonMatch = block.string.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            const messageData = JSON.parse(jsonMatch[1]);
            
            // All messages are stored without compression
            messages.push({
              id: messageData.id,
              role: messageData.role,
              content: messageData.content,
              timestamp: new Date(messageData.timestamp),
              model: messageData.model,           // Include model information
              modelProvider: messageData.modelProvider  // Include model provider information
            });
          }
        } catch (error) {
          console.warn("Failed to parse message data:", error);
        }
      }

      console.log("Loaded messages for conversation:", conversationId, messages.length);
      return messages;
    } catch (error) {
      console.error("Error loading conversation messages:", error);
      return [];
    }
  }

  /**
   * Save new conversation
   */
  static async saveConversation(messages: ChatMessage[]): Promise<string> {
    if (messages.length === 0) {
      throw new Error("Cannot save empty conversation");
    }

    try {
      const conversationId = this.generateConversationId();
      const firstUserMessage = messages.find(m => m.role === 'user');
      const title = firstUserMessage ? this.generateTitle(firstUserMessage.content) : 'New Chat';
      
      const metadata: ConversationMetadata = {
        id: conversationId,
        title,
        lastUpdated: new Date().toISOString(),
        messageCount: messages.length,
        createdAt: new Date().toISOString()
      };

      // Ensure main page exists
      const mainPageUid = await this.ensureMainPageExists();
      
      // Create data page
      const dataPageUid = await this.createDataPage(conversationId);
      
      // Save metadata and messages
      await this.saveConversationMetadata(metadata, mainPageUid);
      await this.saveMessagesToDataPage(messages, dataPageUid);
      
      // Auto cleanup if needed
      await this.autoCleanup();

      console.log("Saved new conversation:", conversationId);
      return conversationId;
    } catch (error) {
      console.error("Error saving conversation:", error);
      throw new Error("Failed to save conversation");
    }
  }

  /**
   * Update existing conversation
   */
  static async updateConversation(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      // Load existing metadata
      const conversations = await this.loadConversations();
      const existingConversation = conversations.find(c => c.id === conversationId);
      
      if (!existingConversation) {
        throw new Error("Conversation not found");
      }

      // Update metadata
      const updatedMetadata: ConversationMetadata = {
        ...existingConversation,
        lastUpdated: new Date().toISOString(),
        messageCount: messages.length
      };

      // Get data page UID
      const dataPageTitle = `${this.DATA_PAGE_PREFIX}/${conversationId}`;
      const query = `
        [:find ?uid
         :where
         [?e :node/title "${dataPageTitle}"]
         [?e :block/uid ?uid]]
      `;
      
      const result = window.roamAlphaAPI.q(query);
      if (!result || result.length === 0) {
        throw new Error("Conversation data page not found");
      }

      const dataPageUid = result[0][0];
      
      // Update messages
      await this.saveMessagesToDataPage(messages, dataPageUid);
      
      // Update metadata in main page
      await this.updateConversationMetadata(updatedMetadata);

      console.log("Updated conversation:", conversationId);
    } catch (error) {
      console.error("Error updating conversation:", error);
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Delete data page
      const dataPageTitle = `${this.DATA_PAGE_PREFIX}/${conversationId}`;
      const dataQuery = `
        [:find ?uid
         :where
         [?e :node/title "${dataPageTitle}"]
         [?e :block/uid ?uid]]
      `;
      
      const dataResult = window.roamAlphaAPI.q(dataQuery);
      if (dataResult && dataResult.length > 0) {
        const dataPageUid = dataResult[0][0];
        await window.roamAlphaAPI.deletePage({ page: { uid: dataPageUid } });
      }

      // Delete metadata from main page
      await this.deleteConversationMetadata(conversationId);

      console.log("Deleted conversation:", conversationId);
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw error;
    }
  }

  /**
   * Auto cleanup old conversations
   */
  private static async autoCleanup(): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const settings = this.DEFAULT_SETTINGS;
      
      if (!settings.autoCleanup) return;

      const now = new Date();
      const maxAgeMs = settings.maxAge * 24 * 60 * 60 * 1000;
      
      // Find conversations to delete
      const conversationsToDelete = conversations.filter((conv, index) => {
        const age = now.getTime() - new Date(conv.createdAt).getTime();
        const isOld = age > maxAgeMs;
        const exceedsLimit = index >= settings.maxConversations;
        const hasMinimalContent = conv.messageCount < 3;
        
        return isOld || exceedsLimit || (hasMinimalContent && index > 10);
      });

      // Delete old conversations
      for (const conv of conversationsToDelete) {
        await this.deleteConversation(conv.id);
      }

      if (conversationsToDelete.length > 0) {
        console.log("Auto cleanup: deleted", conversationsToDelete.length, "conversations");
      }
    } catch (error) {
      console.error("Error during auto cleanup:", error);
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
   * Helper: Update conversation metadata
   */
  private static async updateConversationMetadata(metadata: ConversationMetadata): Promise<void> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      // Find the block containing this conversation's metadata
      for (const block of blocks) {
        if (block.string.includes(metadata.id)) {
          const metadataString = JSON.stringify(metadata, null, 2);
          const newString = `Conversation: ${metadata.title}\n\`\`\`json\n${metadataString}\n\`\`\`\n[[${this.DATA_PAGE_PREFIX}/${metadata.id}]]`;
          
          await window.roamAlphaAPI.updateBlock({
            block: {
              uid: block.uid,
              string: newString
            }
          });
          break;
        }
      }
    } catch (error) {
      console.error("Error updating conversation metadata:", error);
      throw error;
    }
  }

  /**
   * Helper: Delete conversation metadata
   */
  private static async deleteConversationMetadata(conversationId: string): Promise<void> {
    try {
      const mainPageUid = await this.ensureMainPageExists();
      const blocks = await this.getPageBlocks(mainPageUid);
      
      // Find and delete the block containing this conversation's metadata
      for (const block of blocks) {
        if (block.string.includes(conversationId)) {
          await window.roamAlphaAPI.deleteBlock({ block: { uid: block.uid } });
          break;
        }
      }
    } catch (error) {
      console.error("Error deleting conversation metadata:", error);
      throw error;
    }
  }

  /**
   * Export conversation data
   */
  static async exportConversation(conversationId: string): Promise<string> {
    try {
      const conversations = await this.loadConversations();
      const metadata = conversations.find(c => c.id === conversationId);
      const messages = await this.loadConversationMessages(conversationId, 0, 1000);
      
      if (!metadata) {
        throw new Error("Conversation not found");
      }

      const exportData: ConversationData = {
        id: conversationId,
        messages,
        metadata
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Error exporting conversation:", error);
      throw error;
    }
  }
}