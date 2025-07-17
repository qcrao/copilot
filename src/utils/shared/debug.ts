// src/utils/shared/debug.ts

/**
 * Centralized debugging utilities for Roam Copilot
 * Provides consistent logging patterns across the codebase
 */

import { DEBUG_CATEGORIES, FEATURE_FLAGS } from './constants';

type DebugCategory = keyof typeof DEBUG_CATEGORIES;
type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface DebugConfig {
  enabled: boolean;
  categories: Set<string>;
  logLevel: LogLevel;
  maxLogEntries: number;
}

class DebugLogger {
  private static config: DebugConfig = {
    enabled: FEATURE_FLAGS.ENABLE_DEBUG_LOGGING || process.env.NODE_ENV === 'development',
    categories: new Set(Object.values(DEBUG_CATEGORIES)),
    logLevel: 'log',
    maxLogEntries: 1000,
  };

  private static logHistory: Array<{
    timestamp: Date;
    category: string;
    level: LogLevel;
    message: string;
    data?: any;
  }> = [];

  /**
   * Configure debug settings
   */
  static configure(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable debugging for specific categories
   */
  static setCategories(categories: string[]): void {
    this.config.categories = new Set(categories);
  }

  /**
   * Enable debugging for a specific category
   */
  static enableCategory(category: DebugCategory): void {
    this.config.categories.add(DEBUG_CATEGORIES[category]);
  }

  /**
   * Disable debugging for a specific category
   */
  static disableCategory(category: DebugCategory): void {
    this.config.categories.delete(DEBUG_CATEGORIES[category]);
  }

  /**
   * Check if a category is enabled
   */
  static isCategoryEnabled(category: string): boolean {
    return this.config.enabled && this.config.categories.has(category);
  }

  /**
   * Main logging method
   */
  private static writeLog(
    category: string,
    level: LogLevel,
    message: string,
    data?: any
  ): void {
    if (!this.isCategoryEnabled(category)) {
      return;
    }

    const timestamp = new Date();
    const prefix = `[${timestamp.toISOString()}] [${category}]`;
    
    // Log to console
    const consoleMethods = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    if (data !== undefined) {
      consoleMethods[level](`${prefix} ${message}`, data);
    } else {
      consoleMethods[level](`${prefix} ${message}`);
    }

    // Store in history
    this.logHistory.push({
      timestamp,
      category,
      level,
      message,
      data,
    });

    // Maintain max log entries
    if (this.logHistory.length > this.config.maxLogEntries) {
      this.logHistory = this.logHistory.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Log a general message
   */
  static log(category: DebugCategory, message: string, data?: any): void {
    this.writeLog(DEBUG_CATEGORIES[category], 'log', message, data);
  }

  /**
   * Log a warning message
   */
  static warn(category: DebugCategory, message: string, data?: any): void {
    this.writeLog(DEBUG_CATEGORIES[category], 'warn', message, data);
  }

  /**
   * Log an error message
   */
  static error(category: DebugCategory, message: string, data?: any): void {
    this.writeLog(DEBUG_CATEGORIES[category], 'error', message, data);
  }

  /**
   * Log an info message
   */
  static info(category: DebugCategory, message: string, data?: any): void {
    this.writeLog(DEBUG_CATEGORIES[category], 'info', message, data);
  }

  /**
   * Log a debug message
   */
  static debug(category: DebugCategory, message: string, data?: any): void {
    this.writeLog(DEBUG_CATEGORIES[category], 'debug', message, data);
  }

  /**
   * Performance timing helper
   */
  static time(category: DebugCategory, label: string): void {
    if (this.isCategoryEnabled(DEBUG_CATEGORIES[category])) {
      console.time(`[${DEBUG_CATEGORIES[category]}] ${label}`);
    }
  }

  /**
   * End performance timing
   */
  static timeEnd(category: DebugCategory, label: string): void {
    if (this.isCategoryEnabled(DEBUG_CATEGORIES[category])) {
      console.timeEnd(`[${DEBUG_CATEGORIES[category]}] ${label}`);
    }
  }

  /**
   * Log execution time of a function
   */
  static async measureAsync<T>(
    category: DebugCategory,
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.isCategoryEnabled(DEBUG_CATEGORIES[category])) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.log(category, `${label} completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(category, `${label} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Log execution time of a synchronous function
   */
  static measure<T>(
    category: DebugCategory,
    label: string,
    fn: () => T
  ): T {
    if (!this.isCategoryEnabled(DEBUG_CATEGORIES[category])) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.log(category, `${label} completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(category, `${label} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Get log history
   */
  static getHistory(category?: string, limit?: number): Array<any> {
    let logs = this.logHistory;
    
    if (category) {
      logs = logs.filter(log => log.category === category);
    }
    
    if (limit) {
      logs = logs.slice(-limit);
    }
    
    return logs;
  }

  /**
   * Clear log history
   */
  static clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs as JSON
   */
  static exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Group related logs
   */
  static group(category: DebugCategory, label: string): void {
    if (this.isCategoryEnabled(DEBUG_CATEGORIES[category])) {
      console.group(`[${DEBUG_CATEGORIES[category]}] ${label}`);
    }
  }

  /**
   * End log group
   */
  static groupEnd(category: DebugCategory): void {
    if (this.isCategoryEnabled(DEBUG_CATEGORIES[category])) {
      console.groupEnd();
    }
  }

  /**
   * Create a scoped logger for a specific category
   */
  static createScopedLogger(category: DebugCategory) {
    const categoryName = DEBUG_CATEGORIES[category];
    
    return {
      log: (message: string, data?: any) => this.writeLog(categoryName, 'log', message, data),
      warn: (message: string, data?: any) => this.writeLog(categoryName, 'warn', message, data),
      error: (message: string, data?: any) => this.writeLog(categoryName, 'error', message, data),
      info: (message: string, data?: any) => this.writeLog(categoryName, 'info', message, data),
      debug: (message: string, data?: any) => this.writeLog(categoryName, 'debug', message, data),
      time: (label: string) => this.time(category, label),
      timeEnd: (label: string) => this.timeEnd(category, label),
      group: (label: string) => this.group(category, label),
      groupEnd: () => this.groupEnd(category),
      isEnabled: () => this.isCategoryEnabled(categoryName),
    };
  }
}

// Convenience functions for common categories
export const aiLogger = DebugLogger.createScopedLogger('AI_SERVICE');
export const roamLogger = DebugLogger.createScopedLogger('ROAM_QUERY');
export const contextLogger = DebugLogger.createScopedLogger('CONTEXT_MANAGER');
export const conversationLogger = DebugLogger.createScopedLogger('CONVERSATION');
export const performanceLogger = DebugLogger.createScopedLogger('PERFORMANCE');
export const memoryLogger = DebugLogger.createScopedLogger('MEMORY');
export const uiLogger = DebugLogger.createScopedLogger('UI');

export default DebugLogger;