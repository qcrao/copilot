// src/utils/performance.ts

/**
 * Performance monitoring utility for Roam Copilot
 */
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();
  private static readonly MAX_MEASUREMENTS = 100; // Prevent memory leaks

  /**
   * Start measuring performance for a given operation
   */
  static start(operation: string): void {
    if (this.measurements.size >= this.MAX_MEASUREMENTS) {
      this.measurements.clear();
    }
    this.measurements.set(operation, performance.now());
  }

  /**
   * End measuring and log the result
   */
  static end(operation: string): number {
    const startTime = this.measurements.get(operation);
    if (!startTime) {
      console.warn(`Performance measurement not found for operation: ${operation}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log slow operations (提高阈值，减少冗余日志)
    if (duration > 1000) {
      console.warn(`⚠️ Very slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
    } else if (duration > 500) {
      console.warn(`⚠️ Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
    }
    // 移除50ms以上的常规日志，只保留真正慢的操作

    this.measurements.delete(operation);
    return duration;
  }

  /**
   * Measure a function execution
   */
  static async measure<T>(operation: string, fn: () => T | Promise<T>): Promise<T> {
    this.start(operation);
    try {
      const result = await fn();
      this.end(operation);
      return result;
    } catch (error) {
      this.end(operation);
      throw error;
    }
  }

  /**
   * Get memory usage information
   */
  static getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  /**
   * Log memory usage
   */
  static logMemoryUsage(): void {
    const memory = this.getMemoryUsage();
    if (memory) {
      const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      
      console.log(`📊 Memory Usage: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`);
      
      // Warn if memory usage is high
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
        console.warn('⚠️ High memory usage detected!');
      }
    }
  }

  /**
   * Debounce function for performance optimization
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    return function (...args: Parameters<T>) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        func(...args);
        timeoutId = null;
      }, delay);
    };
  }

  /**
   * Throttle function for performance optimization
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let lastFunc: ReturnType<typeof setTimeout> | null = null;
    let lastRan: number | null = null;
    
    return function (...args: Parameters<T>) {
      if (!lastRan) {
        func(...args);
        lastRan = Date.now();
      } else {
        if (lastFunc) {
          clearTimeout(lastFunc);
        }
        
        lastFunc = setTimeout(() => {
          if (Date.now() - lastRan! >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  }

  /**
   * Clear all measurements
   */
  static clear(): void {
    this.measurements.clear();
  }
}

/**
 * Hook for performance monitoring in React components
 */
export const usePerformanceMonitor = (operationName: string) => {
  const start = () => PerformanceMonitor.start(operationName);
  const end = () => PerformanceMonitor.end(operationName);
  const measure = async <T>(fn: () => T | Promise<T>) => 
    PerformanceMonitor.measure(operationName, fn);

  return { start, end, measure };
};