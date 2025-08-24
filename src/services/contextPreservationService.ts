// src/services/contextPreservationService.ts
import { PageContext, PreservedContext, PreservedContextItem } from "../types";
import { RoamService } from "./roamService";

export class ContextPreservationService {
  /**
   * Convert current page context to preserved context format using UIDs
   */
  static async preserveContext(context: PageContext): Promise<PreservedContext> {
    const timestamp = new Date().toISOString();
    
    // Extract UIDs from context
    const currentPageUid = context.currentPage?.uid;
    const visibleBlockUids = context.visibleBlocks?.map(block => block.uid) || [];
    const dailyNoteUid = context.dailyNote?.uid;
    const linkedReferenceUids = context.linkedReferences?.map(ref => ref.uid) || [];
    const sidebarNoteUids = context.sidebarNotes?.map(note => note.uid) || [];
    const visibleDailyNoteUids = context.visibleDailyNotes?.map(note => note.uid) || [];
    
    // Create context items for key information (fallback if UID lookup fails later)
    const contextItems: PreservedContextItem[] = [];
    
    // Add current page
    if (context.currentPage) {
      contextItems.push({
        uid: context.currentPage.uid,
        type: 'page',
        title: context.currentPage.title,
        timestamp
      });
    }
    
    // Add daily note
    if (context.dailyNote) {
      contextItems.push({
        uid: context.dailyNote.uid,
        type: 'dailyNote',
        title: context.dailyNote.title,
        timestamp
      });
    }
    
    // Add sidebar notes
    if (context.sidebarNotes) {
      for (const note of context.sidebarNotes) {
        contextItems.push({
          uid: note.uid,
          type: 'sidebarNote',
          title: note.title,
          timestamp
        });
      }
    }
    
    // Add visible daily notes
    if (context.visibleDailyNotes) {
      for (const note of context.visibleDailyNotes) {
        contextItems.push({
          uid: note.uid,
          type: 'dailyNote',
          title: note.title,
          timestamp
        });
      }
    }

    return {
      timestamp,
      currentPageUid,
      visibleBlockUids,
      selectedText: context.selectedText,
      dailyNoteUid,
      linkedReferenceUids,
      sidebarNoteUids,
      visibleDailyNoteUids,
      contextItems
    };
  }

  /**
   * Restore preserved context back to PageContext format
   */
  static async restoreContext(preserved: PreservedContext): Promise<PageContext | null> {
    try {
      const context: PageContext = {
        visibleBlocks: [],
        linkedReferences: [],
        selectedText: preserved.selectedText
      };

      // Restore current page
      if (preserved.currentPageUid) {
        try {
          const currentPage = await RoamService.getPageByUid(preserved.currentPageUid);
          if (currentPage) {
            context.currentPage = currentPage;
          } else {
            // Fallback to context items
            const pageItem = preserved.contextItems?.find(
              item => item.uid === preserved.currentPageUid && item.type === 'page'
            );
            if (pageItem && pageItem.title) {
              const pageByTitle = await RoamService.getPageByTitle(pageItem.title);
              if (pageByTitle) {
                context.currentPage = pageByTitle;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to restore current page ${preserved.currentPageUid}:`, error);
        }
      }

      // Restore visible blocks
      if (preserved.visibleBlockUids && preserved.visibleBlockUids.length > 0) {
        const restoredBlocks = [];
        for (const uid of preserved.visibleBlockUids) {
          try {
            const block = await RoamService.getBlockByUid(uid);
            if (block) {
              restoredBlocks.push(block);
            }
          } catch (error) {
            console.warn(`Failed to restore visible block ${uid}:`, error);
          }
        }
        context.visibleBlocks = restoredBlocks;
      }

      // Restore daily note
      if (preserved.dailyNoteUid) {
        try {
          const dailyNote = await RoamService.getPageByUid(preserved.dailyNoteUid);
          if (dailyNote) {
            context.dailyNote = dailyNote;
          } else {
            // Fallback to context items
            const dailyNoteItem = preserved.contextItems?.find(
              item => item.uid === preserved.dailyNoteUid && item.type === 'dailyNote'
            );
            if (dailyNoteItem && dailyNoteItem.title) {
              const pageByTitle = await RoamService.getPageByTitle(dailyNoteItem.title);
              if (pageByTitle) {
                context.dailyNote = pageByTitle;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to restore daily note ${preserved.dailyNoteUid}:`, error);
        }
      }

      // Restore linked references
      if (preserved.linkedReferenceUids && preserved.linkedReferenceUids.length > 0) {
        const restoredRefs = [];
        for (const uid of preserved.linkedReferenceUids) {
          try {
            const block = await RoamService.getBlockByUid(uid);
            if (block) {
              restoredRefs.push(block);
            }
          } catch (error) {
            console.warn(`Failed to restore linked reference ${uid}:`, error);
          }
        }
        context.linkedReferences = restoredRefs;
      }

      // Restore sidebar notes
      if (preserved.sidebarNoteUids && preserved.sidebarNoteUids.length > 0) {
        const restoredNotes = [];
        for (const uid of preserved.sidebarNoteUids) {
          try {
            const page = await RoamService.getPageByUid(uid);
            if (page) {
              restoredNotes.push(page);
            } else {
              // Fallback to context items
              const noteItem = preserved.contextItems?.find(
                item => item.uid === uid && item.type === 'sidebarNote'
              );
              if (noteItem && noteItem.title) {
                const pageByTitle = await RoamService.getPageByTitle(noteItem.title);
                if (pageByTitle) {
                  restoredNotes.push(pageByTitle);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to restore sidebar note ${uid}:`, error);
          }
        }
        context.sidebarNotes = restoredNotes;
      }

      // Restore visible daily notes
      if (preserved.visibleDailyNoteUids && preserved.visibleDailyNoteUids.length > 0) {
        const restoredDailyNotes = [];
        for (const uid of preserved.visibleDailyNoteUids) {
          try {
            const page = await RoamService.getPageByUid(uid);
            if (page) {
              restoredDailyNotes.push(page);
            } else {
              // Fallback to context items  
              const noteItem = preserved.contextItems?.find(
                item => item.uid === uid && item.type === 'dailyNote'
              );
              if (noteItem && noteItem.title) {
                const pageByTitle = await RoamService.getPageByTitle(noteItem.title);
                if (pageByTitle) {
                  restoredDailyNotes.push(pageByTitle);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to restore visible daily note ${uid}:`, error);
          }
        }
        context.visibleDailyNotes = restoredDailyNotes;
      }

      console.log('✅ Context restored successfully from preserved state');
      return context;
    } catch (error) {
      console.error('❌ Failed to restore preserved context:', error);
      return null;
    }
  }

  /**
   * Check if two preserved contexts are equivalent
   */
  static areContextsEquivalent(context1: PreservedContext, context2: PreservedContext): boolean {
    return (
      context1.currentPageUid === context2.currentPageUid &&
      context1.dailyNoteUid === context2.dailyNoteUid &&
      JSON.stringify(context1.visibleBlockUids.sort()) === JSON.stringify(context2.visibleBlockUids.sort()) &&
      JSON.stringify(context1.linkedReferenceUids.sort()) === JSON.stringify(context2.linkedReferenceUids.sort()) &&
      JSON.stringify(context1.sidebarNoteUids.sort()) === JSON.stringify(context2.sidebarNoteUids.sort()) &&
      JSON.stringify(context1.visibleDailyNoteUids?.sort()) === JSON.stringify(context2.visibleDailyNoteUids?.sort())
    );
  }

  /**
   * Create a summary of preserved context for display
   */
  static summarizePreservedContext(preserved: PreservedContext): string {
    const parts = [];
    
    if (preserved.contextItems) {
      const pages = preserved.contextItems.filter(item => item.type === 'page').map(item => item.title).filter(Boolean);
      const dailyNotes = preserved.contextItems.filter(item => item.type === 'dailyNote').map(item => item.title).filter(Boolean);
      const sidebarNotes = preserved.contextItems.filter(item => item.type === 'sidebarNote').map(item => item.title).filter(Boolean);
      
      if (pages.length > 0) parts.push(`${pages.length} page(s)`);
      if (dailyNotes.length > 0) parts.push(`${dailyNotes.length} daily note(s)`);
      if (sidebarNotes.length > 0) parts.push(`${sidebarNotes.length} sidebar note(s)`);
    }
    
    if (preserved.visibleBlockUids.length > 0) {
      parts.push(`${preserved.visibleBlockUids.length} visible block(s)`);
    }
    
    if (preserved.linkedReferenceUids.length > 0) {
      parts.push(`${preserved.linkedReferenceUids.length} linked reference(s)`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No context preserved';
  }
}