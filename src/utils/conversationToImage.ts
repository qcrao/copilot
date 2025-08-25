// src/utils/conversationToImage.ts
import { ChatMessage } from '../types';

interface ConversationImageOptions {
  title?: string;
  subtitle?: string;
  maxMessages?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  fontFamily?: string;
}

export class ConversationImageGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<ConversationImageOptions>;

  constructor(options: ConversationImageOptions = {}) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    
    this.options = {
      title: options.title || 'Conversation',
      subtitle: options.subtitle || 'AI Chat',
      maxMessages: options.maxMessages || 6,
      width: options.width || 800,
      height: options.height || 1000,
      backgroundColor: options.backgroundColor || '#ffffff',
      fontFamily: options.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    this.ctx.font = `${fontSize}px ${this.options.fontFamily}`;
    
    // Split text into paragraphs first
    const paragraphs = text.split('\n').filter(p => p.trim());
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (this.ctx.measureText(paragraph).width <= maxWidth) {
        lines.push(paragraph);
        continue;
      }

      // Wrap long paragraphs
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = this.ctx.measureText(testLine).width;

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Word is too long, try to break it
            if (word.length > 20) {
              // Break very long words
              let remainingWord = word;
              while (remainingWord.length > 0) {
                let breakPoint = 20;
                while (breakPoint > 0 && this.ctx.measureText(remainingWord.substring(0, breakPoint)).width > maxWidth) {
                  breakPoint--;
                }
                if (breakPoint === 0) breakPoint = 1; // Ensure at least one character
                lines.push(remainingWord.substring(0, breakPoint));
                remainingWord = remainingWord.substring(breakPoint);
              }
            } else {
              lines.push(word);
            }
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      // Add spacing between paragraphs
      if (paragraph !== paragraphs[paragraphs.length - 1]) {
        lines.push(''); // Empty line for paragraph separation
      }
    }

    return lines;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private drawGradientBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(1, '#f1f5f9');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawHeader(y: number): number {
    const padding = 40;
    
    // Title
    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = `bold 32px ${this.options.fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.options.title, this.canvas.width / 2, y + padding);
    
    // Subtitle
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = `18px ${this.options.fontFamily}`;
    this.ctx.fillText(this.options.subtitle, this.canvas.width / 2, y + padding + 40);
    
    // Date
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `14px ${this.options.fontFamily}`;
    this.ctx.fillText(date, this.canvas.width / 2, y + padding + 65);

    return y + padding + 100;
  }

  private drawMessage(message: ChatMessage, x: number, y: number, width: number): number {
    const isUser = message.role === 'user';
    const padding = 20;
    const bubblePadding = 16;
    const maxTextWidth = width * 0.7;
    
    // Clean and truncate message content
    let content = message.content.replace(/```[\s\S]*?```/g, '[Code Block]');
    content = content.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markdown
    content = content.replace(/\*(.*?)\*/g, '$1'); // Remove italic markdown
    content = this.truncateText(content, 300);
    
    // Get wrapped text lines
    const lines = this.wrapText(content, maxTextWidth - bubblePadding * 2, 16);
    const lineHeight = 20;
    const bubbleHeight = lines.length * lineHeight + bubblePadding * 2;
    
    // Calculate bubble position
    const bubbleWidth = Math.min(maxTextWidth, this.ctx.measureText(lines[0] || '').width + bubblePadding * 2);
    const bubbleX = isUser ? width - bubbleWidth - padding : padding;
    
    // Draw bubble shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.beginPath();
    this.ctx.roundRect(bubbleX + 2, y + 2, bubbleWidth, bubbleHeight, 12);
    this.ctx.fill();
    
    // Draw bubble
    this.ctx.fillStyle = isUser ? '#3b82f6' : '#f1f5f9';
    this.ctx.beginPath();
    this.ctx.roundRect(bubbleX, y, bubbleWidth, bubbleHeight, 12);
    this.ctx.fill();
    
    // Draw bubble border
    this.ctx.strokeStyle = isUser ? '#2563eb' : '#e2e8f0';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    
    // Draw text
    this.ctx.fillStyle = isUser ? '#ffffff' : '#334155';
    this.ctx.font = `16px ${this.options.fontFamily}`;
    this.ctx.textAlign = 'left';
    
    lines.forEach((line, i) => {
      this.ctx.fillText(line, bubbleX + bubblePadding, y + bubblePadding + (i + 1) * lineHeight - 4);
    });
    
    // Draw sender label
    const labelY = isUser ? y - 8 : y + bubbleHeight + 16;
    this.ctx.fillStyle = '#6b7280';
    this.ctx.font = `12px ${this.options.fontFamily}`;
    this.ctx.textAlign = isUser ? 'right' : 'left';
    
    const labelX = isUser ? width - padding : padding;
    const senderName = isUser ? 'You' : 'AI Assistant';
    this.ctx.fillText(senderName, labelX, labelY);
    
    return y + bubbleHeight + 40;
  }

  private drawFooter(y: number): void {
    const footerY = this.canvas.height - 60;
    
    // Logo/Branding
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = `12px ${this.options.fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Generated by Roam Copilot', this.canvas.width / 2, footerY);
    
    // Decorative line
    this.ctx.strokeStyle = '#e2e8f0';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width * 0.3, footerY - 20);
    this.ctx.lineTo(this.canvas.width * 0.7, footerY - 20);
    this.ctx.stroke();
  }

  async generateImage(messages: ChatMessage[]): Promise<Blob> {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background
    this.drawGradientBackground();
    
    // Draw header
    let currentY = 0;
    currentY = this.drawHeader(currentY);
    
    // Filter and limit messages
    const filteredMessages = messages
      .filter(msg => msg.content.trim().length > 0)
      .slice(-this.options.maxMessages);
    
    // Calculate available space for messages
    const headerHeight = currentY;
    const footerHeight = 100;
    const availableHeight = this.canvas.height - headerHeight - footerHeight;
    const messageAreaWidth = this.canvas.width - 80; // 40px padding on each side
    
    // Draw messages
    currentY += 20;
    for (const message of filteredMessages) {
      currentY = this.drawMessage(message, 40, currentY, messageAreaWidth);
      
      // Stop if we're running out of space
      if (currentY > this.canvas.height - footerHeight - 50) {
        break;
      }
    }
    
    // Draw footer
    this.drawFooter(0);
    
    // Convert to blob
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png', 0.9);
    });
  }

  async downloadImage(messages: ChatMessage[], filename: string = 'conversation.png'): Promise<void> {
    const blob = await this.generateImage(messages);
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async copyToClipboard(messages: ChatMessage[]): Promise<boolean> {
    try {
      const blob = await this.generateImage(messages);
      
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        return true;
      } else {
        // Fallback: download the image
        await this.downloadImage(messages);
        return false;
      }
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      return false;
    }
  }
}

// Utility function for quick image generation
export const generateConversationImage = async (
  messages: ChatMessage[],
  options?: ConversationImageOptions
): Promise<Blob> => {
  const generator = new ConversationImageGenerator(options);
  return generator.generateImage(messages);
};

// Utility function for quick image download
export const downloadConversationImage = async (
  messages: ChatMessage[],
  filename?: string,
  options?: ConversationImageOptions
): Promise<void> => {
  const generator = new ConversationImageGenerator(options);
  return generator.downloadImage(messages, filename);
};

// Utility function for copying to clipboard
export const copyConversationImageToClipboard = async (
  messages: ChatMessage[],
  options?: ConversationImageOptions
): Promise<boolean> => {
  const generator = new ConversationImageGenerator(options);
  return generator.copyToClipboard(messages);
};