// src/utils/shared/validation.ts

/**
 * Centralized validation utilities for Roam Copilot
 * Consolidates validation logic from across the codebase
 */

export class ValidationUtils {
  // UID validation constants
  static readonly UID_MIN_LENGTH = 6;
  static readonly UID_MAX_LENGTH = 20;
  static readonly UID_REGEX = /^[a-zA-Z0-9_-]+$/;
  static readonly BLOCK_REFERENCE_REGEX = /\({2,3}([^)]+)\){2,3}/g;
  static readonly PAGE_REFERENCE_REGEX = /\[\[([^\]]+)\]\]/g;

  /**
   * Validates if a string is a valid Roam block UID
   */
  static isValidUID(uid: string): boolean {
    if (!uid || typeof uid !== 'string') {
      return false;
    }

    const trimmed = uid.trim();
    
    // Check length constraints
    if (trimmed.length < this.UID_MIN_LENGTH || trimmed.length > this.UID_MAX_LENGTH) {
      return false;
    }

    // Check character constraints
    return this.UID_REGEX.test(trimmed);
  }

  /**
   * Sanitizes and validates a UID, removing common artifacts
   */
  static sanitizeUID(uid: string): string | null {
    if (!uid || typeof uid !== 'string') {
      return null;
    }

    // Remove trailing ellipsis that might be added by Roam
    let cleaned = uid.trim().replace(/\.{3,}$/, '');
    
    // Remove any surrounding whitespace or quotes
    cleaned = cleaned.replace(/^["'\s]+|["'\s]+$/g, '');

    return this.isValidUID(cleaned) ? cleaned : null;
  }

  /**
   * Validates if a string is a valid Roam page name
   */
  static isValidPageName(pageName: string): boolean {
    if (!pageName || typeof pageName !== 'string') {
      return false;
    }

    const trimmed = pageName.trim();
    
    // Page names can't be empty or too long
    if (trimmed.length === 0 || trimmed.length > 500) {
      return false;
    }

    // Exclude common false positives
    const excludePatterns = [
      /^https?:\/\//, // URLs
      /^[\w.-]+@[\w.-]+\.\w+$/, // Email addresses
      /^\d+$/, // Pure numbers
      /^[(),.\s]*$/ // Only punctuation and spaces
    ];

    return !excludePatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Extracts and validates block references from text
   */
  static extractBlockReferences(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const references: string[] = [];
    const regex = new RegExp(this.BLOCK_REFERENCE_REGEX);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const sanitized = this.sanitizeUID(match[1]);
      if (sanitized) {
        references.push(sanitized);
      }
    }

    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Extracts and validates page references from text
   */
  static extractPageReferences(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const references: string[] = [];
    const regex = new RegExp(this.PAGE_REFERENCE_REGEX);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const pageName = match[1].trim();
      if (this.isValidPageName(pageName)) {
        references.push(pageName);
      }
    }

    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Validates text length for various content types
   */
  static isValidLength(text: string, type: 'block' | 'page' | 'comment' | 'prompt'): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const limits = {
      block: 10000,      // Roam block content limit
      page: 50000,       // Page content limit
      comment: 1000,     // Comment/note limit
      prompt: 100000     // AI prompt limit
    };

    return text.length <= limits[type];
  }

  /**
   * Validates if a string can be safely used as a filename
   */
  static isValidFilename(filename: string): boolean {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    
    return !invalidChars.test(filename) && 
           !reserved.test(filename) && 
           filename.trim().length > 0 &&
           filename.length <= 255;
  }

  /**
   * Validates URL format
   */
  static isValidURL(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates email format
   */
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validates date string in various formats
   */
  static isValidDate(dateStr: string): boolean {
    if (!dateStr || typeof dateStr !== 'string') {
      return false;
    }

    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Validates if a string contains valid JSON
   */
  static isValidJSON(jsonStr: string): boolean {
    if (!jsonStr || typeof jsonStr !== 'string') {
      return false;
    }

    try {
      JSON.parse(jsonStr);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Specific validation patterns for Roam content
 */
export class RoamValidation {
  /**
   * Validates Roam date format (January 1st, 2024)
   */
  static isRoamDateFormat(dateStr: string): boolean {
    if (!dateStr || typeof dateStr !== 'string') {
      return false;
    }

    const roamDateRegex = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th),\s+\d{4}$/;
    return roamDateRegex.test(dateStr.trim());
  }

  /**
   * Validates Roam block structure
   */
  static isValidBlockStructure(block: any): boolean {
    return (
      block &&
      typeof block === 'object' &&
      typeof block.uid === 'string' &&
      ValidationUtils.isValidUID(block.uid) &&
      typeof block.string === 'string'
    );
  }

  /**
   * Validates Roam page structure
   */
  static isValidPageStructure(page: any): boolean {
    return (
      page &&
      typeof page === 'object' &&
      typeof page.title === 'string' &&
      ValidationUtils.isValidPageName(page.title) &&
      typeof page.uid === 'string' &&
      ValidationUtils.isValidUID(page.uid) &&
      Array.isArray(page.blocks)
    );
  }
}

export default ValidationUtils;