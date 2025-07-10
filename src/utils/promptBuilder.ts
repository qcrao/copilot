// src/utils/promptBuilder.ts
import { RoamQuery, BlockWithReferences } from './roamQuery';
import { RoamService } from '../services/roamService';

export interface PromptBuildResult {
  text: string;
  metadata: {
    referencesExpanded: number;
    totalTokensEstimate: number;
    truncated: boolean;
  };
}

export class PromptBuilder {
  /**
   * Build AI prompt from TipTap editor JSON
   * Expands reference chips to full block content
   */
  static async buildPrompt(editorJSON: any, maxTokens: number = 6000): Promise<PromptBuildResult> {
    try {
      console.log('PROMPT_BUILDER_DEBUG: Starting buildPrompt with editor JSON:', JSON.stringify(editorJSON, null, 2));
      
      const result = await this.processNode(editorJSON);
      
      console.log('PROMPT_BUILDER_DEBUG: Processing complete:', {
        originalLength: editorJSON ? JSON.stringify(editorJSON).length : 0,
        expandedTextLength: result.text.length,
        referencesExpanded: result.referencesExpanded,
        expandedText: result.text.substring(0, 200) + '...'
      });
      
      const metadata = {
        referencesExpanded: result.referencesExpanded,
        totalTokensEstimate: RoamService.estimateTokenCount(result.text),
        truncated: false
      };

      // Truncate if needed
      let finalText = result.text;
      if (metadata.totalTokensEstimate > maxTokens) {
        finalText = this.truncatePrompt(result.text, maxTokens);
        metadata.truncated = true;
        console.log('PROMPT_BUILDER_DEBUG: Prompt truncated due to token limit');
      }

      console.log('PROMPT_BUILDER_DEBUG: Final result:', {
        finalTextLength: finalText.length,
        metadata
      });

      return {
        text: finalText,
        metadata
      };
    } catch (error) {
      console.error('PROMPT_BUILDER_DEBUG: Error building prompt:', error);
      return {
        text: this.fallbackTextExtraction(editorJSON),
        metadata: {
          referencesExpanded: 0,
          totalTokensEstimate: 0,
          truncated: false
        }
      };
    }
  }

  /**
   * Process TipTap JSON node recursively
   */
  private static async processNode(node: any): Promise<{ text: string; referencesExpanded: number }> {
    if (!node) return { text: '', referencesExpanded: 0 };

    let text = '';
    let referencesExpanded = 0;

    console.log('PROMPT_BUILDER_DEBUG: Processing node:', { type: node.type, attrs: node.attrs });

    // Handle text nodes
    if (node.type === 'text') {
      console.log('PROMPT_BUILDER_DEBUG: Text node:', node.text);
      return { text: node.text || '', referencesExpanded: 0 };
    }

    // Handle reference chips - expand to full content
    if (node.type === 'referenceChip') {
      console.log('PROMPT_BUILDER_DEBUG: Found reference chip, expanding:', node.attrs);
      const expanded = await this.expandReferenceChip(node);
      console.log('PROMPT_BUILDER_DEBUG: Reference chip expanded to:', expanded.substring(0, 100) + '...');
      return {
        text: expanded,
        referencesExpanded: 1
      };
    }

    // Handle paragraphs
    if (node.type === 'paragraph') {
      const results = await Promise.all(
        (node.content || []).map((child: any) => this.processNode(child))
      );
      
      const paragraphText = results.map(r => r.text).join('');
      const paragraphReferences = results.reduce((sum, r) => sum + r.referencesExpanded, 0);
      
      return {
        text: paragraphText + '\n',
        referencesExpanded: paragraphReferences
      };
    }

    // Handle document root
    if (node.type === 'doc') {
      const results = await Promise.all(
        (node.content || []).map((child: any) => this.processNode(child))
      );
      
      const docText = results.map(r => r.text).join('');
      const docReferences = results.reduce((sum, r) => sum + r.referencesExpanded, 0);
      
      return {
        text: docText.trim(),
        referencesExpanded: docReferences
      };
    }

    // Handle other nodes with content
    if (node.content) {
      const results = await Promise.all(
        node.content.map((child: any) => this.processNode(child))
      );
      
      const nodeText = results.map(r => r.text).join('');
      const nodeReferences = results.reduce((sum, r) => sum + r.referencesExpanded, 0);
      
      return {
        text: nodeText,
        referencesExpanded: nodeReferences
      };
    }

    return { text: '', referencesExpanded: 0 };
  }

  /**
   * Expand a reference chip to full block content
   */
  private static async expandReferenceChip(chipNode: any): Promise<string> {
    const uid = chipNode.attrs?.uid;
    const type = chipNode.attrs?.type || 'block';
    const preview = chipNode.attrs?.preview;
    console.log('EXPAND_CHIP_DEBUG: Starting expansion for UID:', uid, 'Type:', type);
    
    if (!uid) {
      console.warn('EXPAND_CHIP_DEBUG: No UID found in chip node:', chipNode);
      return `((${uid || 'unknown'}))`;
    }

    try {
      // Handle page references differently from block references
      if (type === 'page') {
        console.log('EXPAND_CHIP_DEBUG: Expanding page reference:', preview);
        const pageData = await RoamQuery.getPageByTitle(preview);
        
        if (!pageData) {
          console.warn('EXPAND_CHIP_DEBUG: Page not found:', preview);
          return `[[${preview}]]`;
        }

        console.log('EXPAND_CHIP_DEBUG: Page data retrieved:', {
          title: pageData.title,
          uid: pageData.uid,
          blocksCount: pageData.blocks?.length || 0
        });

        let expandedContent = `\n### Referenced Page [[${pageData.title}]]\n`;
        
        // Add page blocks if any
        if (pageData.blocks && pageData.blocks.length > 0) {
          console.log('EXPAND_CHIP_DEBUG: Adding page blocks');
          expandedContent += this.formatBlocksForExpansion(pageData.blocks, 1);
        }
        
        expandedContent += '\n';
        
        console.log('EXPAND_CHIP_DEBUG: Final expanded page content:', {
          length: expandedContent.length,
          preview: expandedContent.substring(0, 200) + '...'
        });
        
        return expandedContent;
      } else {
        // Handle block references
        console.log('EXPAND_CHIP_DEBUG: Querying block data for UID:', uid);
        const blockData = await RoamQuery.getBlock(uid);
        
        if (!blockData) {
          console.warn('EXPAND_CHIP_DEBUG: Block not found for UID:', uid);
          // Return the original reference format without error text to avoid confusing the AI
          return `((${uid}))`;
        }

        console.log('EXPAND_CHIP_DEBUG: Block data retrieved:', {
          uid: blockData.uid,
          stringLength: blockData.string?.length || 0,
          childrenCount: blockData.children?.length || 0,
          referencesCount: blockData.references?.length || 0
        });

        let expandedContent = `\n### Referenced Block ((${uid}))\n`;
        
        // Add the main block content
        expandedContent += `${blockData.string}\n`;
        
        // Add children if any (with indentation)
        if (blockData.children && blockData.children.length > 0) {
          console.log('EXPAND_CHIP_DEBUG: Adding children blocks');
          expandedContent += this.formatBlocksForExpansion(blockData.children, 1);
        }

        // Add referenced pages if any
        if (blockData.references && blockData.references.length > 0) {
          console.log('EXPAND_CHIP_DEBUG: Adding referenced pages');
          expandedContent += '\n**Referenced Pages:**\n';
          for (const page of blockData.references) {
            expandedContent += `\n**Page: ${page.title}**\n`;
            if (page.blocks && page.blocks.length > 0) {
              expandedContent += this.formatBlocksForExpansion(page.blocks, 1);
            }
          }
        }
        
        expandedContent += '\n';
        
        console.log('EXPAND_CHIP_DEBUG: Final expanded content:', {
          length: expandedContent.length,
          preview: expandedContent.substring(0, 200) + '...'
        });
        
        return expandedContent;
      }
    } catch (error) {
      console.error('EXPAND_CHIP_DEBUG: Error expanding reference chip:', error);
      // Return the original reference format without error text to avoid confusing the AI
      return `((${uid}))`;
    }
  }

  /**
   * Format blocks for prompt expansion
   */
  private static formatBlocksForExpansion(blocks: any[], level: number): string {
    let formatted = '';
    const indent = '  '.repeat(level);

    for (const block of blocks) {
      if (block.string && block.string.trim()) {
        formatted += `${indent}- ${block.string}\n`;
        
        if (block.children && block.children.length > 0) {
          formatted += this.formatBlocksForExpansion(block.children, level + 1);
        }
      }
    }

    return formatted;
  }

  /**
   * Truncate prompt to fit within token limit
   */
  private static truncatePrompt(text: string, maxTokens: number): string {
    const currentTokens = RoamService.estimateTokenCount(text);
    
    if (currentTokens <= maxTokens) {
      return text;
    }

    // Calculate target length
    const targetLength = Math.floor(text.length * (maxTokens / currentTokens));
    
    // Split by sections (marked by ###)
    const sections = text.split('\n### ');
    let result = '';
    
    // Always include the main message (before first reference)
    const mainMessage = sections[0];
    result += mainMessage;
    
    // Add references until we hit the limit
    for (let i = 1; i < sections.length; i++) {
      const section = '\n### ' + sections[i];
      const testResult = result + section;
      
      if (RoamService.estimateTokenCount(testResult) > maxTokens) {
        // Try to include partial content
        const lines = section.split('\n');
        const header = lines[0] + '\n' + (lines[1] || '');
        const partialSection = result + header + '\n... (content truncated)\n';
        
        if (RoamService.estimateTokenCount(partialSection) <= maxTokens) {
          result = partialSection;
        }
        break;
      }
      
      result = testResult;
    }
    
    return result;
  }

  /**
   * Fallback text extraction for error cases
   */
  private static fallbackTextExtraction(editorJSON: any): string {
    try {
      if (!editorJSON || !editorJSON.content) return '';
      
      return editorJSON.content
        .map((node: any) => {
          if (node.type === 'paragraph' && node.content) {
            return node.content
              .map((child: any) => {
                if (child.type === 'text') {
                  return child.text || '';
                }
                if (child.type === 'referenceChip') {
                  return `((${child.attrs?.uid || 'unknown'}))`;
                }
                return '';
              })
              .join('');
          }
          return '';
        })
        .join('\n')
        .trim();
    } catch (error) {
      console.error('Error in fallback text extraction:', error);
      return '';
    }
  }

  /**
   * Extract just the plain text without expansions (for display)
   */
  static extractPlainText(editorJSON: any): string {
    try {
      return this.extractTextFromNode(editorJSON);
    } catch (error) {
      console.error('Error extracting plain text:', error);
      return '';
    }
  }

  private static extractTextFromNode(node: any): string {
    if (!node) return '';

    if (node.type === 'text') {
      return node.text || '';
    }

    if (node.type === 'referenceChip') {
      // Return the preview text for display
      return node.attrs?.preview || `((${node.attrs?.uid || 'ref'}))`;
    }

    if (node.type === 'paragraph') {
      const text = (node.content || [])
        .map((child: any) => this.extractTextFromNode(child))
        .join('');
      return text + '\n';
    }

    if (node.type === 'doc') {
      return (node.content || [])
        .map((child: any) => this.extractTextFromNode(child))
        .join('')
        .trim();
    }

    if (node.content) {
      return (node.content || [])
        .map((child: any) => this.extractTextFromNode(child))
        .join('');
    }

    return '';
  }

  /**
   * Serialize editor content to ((UID)) format for storage
   */
  static serializeForStorage(editorJSON: any): string {
    try {
      return this.serializeNodeForStorage(editorJSON);
    } catch (error) {
      console.error('Error serializing for storage:', error);
      return this.fallbackTextExtraction(editorJSON);
    }
  }

  private static serializeNodeForStorage(node: any): string {
    if (!node) return '';

    if (node.type === 'text') {
      return node.text || '';
    }

    if (node.type === 'referenceChip') {
      const type = node.attrs?.type || 'block';
      const uid = node.attrs?.uid || '';
      const preview = node.attrs?.preview || '';
      
      // For page references, use [[PageName]] format
      if (type === 'page') {
        return `[[${preview}]]`;
      }
      // For block references, use ((uid)) format
      return `((${uid}))`;
    }

    if (node.type === 'paragraph') {
      const text = (node.content || [])
        .map((child: any) => this.serializeNodeForStorage(child))
        .join('');
      return text + '\n';
    }

    if (node.type === 'doc') {
      return (node.content || [])
        .map((child: any) => this.serializeNodeForStorage(child))
        .join('')
        .trim();
    }

    if (node.content) {
      return (node.content || [])
        .map((child: any) => this.serializeNodeForStorage(child))
        .join('');
    }

    return '';
  }
}