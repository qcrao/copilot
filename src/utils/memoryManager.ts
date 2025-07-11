// src/utils/memoryManager.ts

/**
 * Memory management utility for Roam Copilot
 */
export class MemoryManager {
  private static cleanupTasks: Array<() => void> = [];
  private static readonly MAX_CLEANUP_TASKS = 50;

  /**
   * Register a cleanup task
   */
  static registerCleanup(cleanup: () => void): void {
    if (this.cleanupTasks.length >= this.MAX_CLEANUP_TASKS) {
      console.warn('⚠️ Too many cleanup tasks registered. Some may be leaked.');
      this.cleanupTasks.shift(); // Remove oldest task
    }
    this.cleanupTasks.push(cleanup);
  }

  /**
   * Run all cleanup tasks
   */
  static cleanup(): void {
    console.log(`🧹 Running ${this.cleanupTasks.length} cleanup tasks...`);
    
    this.cleanupTasks.forEach((cleanup, index) => {
      try {
        cleanup();
      } catch (error) {
        console.error(`❌ Cleanup task ${index} failed:`, error);
      }
    });
    
    this.cleanupTasks.length = 0;
  }

  /**
   * Create a managed timeout that will be cleaned up automatically
   */
  static createManagedTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timeoutId = setTimeout(callback, delay);
    
    this.registerCleanup(() => {
      clearTimeout(timeoutId);
    });
    
    return timeoutId;
  }

  /**
   * Create a managed interval that will be cleaned up automatically
   */
  static createManagedInterval(callback: () => void, interval: number): ReturnType<typeof setInterval> {
    const intervalId = setInterval(callback, interval);
    
    this.registerCleanup(() => {
      clearInterval(intervalId);
    });
    
    return intervalId;
  }

  /**
   * Create a managed event listener that will be cleaned up automatically
   */
  static createManagedEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  static createManagedEventListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  static createManagedEventListener<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  static createManagedEventListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    
    this.registerCleanup(() => {
      target.removeEventListener(type, listener, options);
    });
  }

  /**
   * Create a managed MutationObserver that will be cleaned up automatically
   */
  static createManagedMutationObserver(
    callback: MutationCallback,
    target: Node,
    options?: MutationObserverInit
  ): MutationObserver {
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    
    this.registerCleanup(() => {
      observer.disconnect();
    });
    
    return observer;
  }

  /**
   * Create a weak reference cache
   */
  static createWeakCache<K extends object, V>(): WeakMap<K, V> {
    const cache = new WeakMap<K, V>();
    
    // Register cleanup (though WeakMap should handle this automatically)
    this.registerCleanup(() => {
      // WeakMap cleanup is automatic, but we can log it
      console.log('🗑️ WeakMap cache cleaned up');
    });
    
    return cache;
  }

  /**
   * Create a limited-size cache that prevents memory leaks
   */
  static createLimitedCache<K, V>(maxSize: number = 100): Map<K, V> {
    const cache = new Map<K, V>();
    
    const originalSet = cache.set.bind(cache);
    cache.set = function(key: K, value: V): Map<K, V> {
      if (this.size >= maxSize) {
        const firstKey = this.keys().next().value;
        if (firstKey !== undefined) {
          this.delete(firstKey);
        }
      }
      return originalSet(key, value);
    };
    
    this.registerCleanup(() => {
      cache.clear();
    });
    
    return cache;
  }

  /**
   * Monitor memory usage and trigger cleanup if necessary
   */
  static monitorMemory(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usageRatio > 0.8) {
        console.warn('⚠️ High memory usage detected, running cleanup...');
        this.cleanup();
        
        // Suggest garbage collection if available
        if ('gc' in window) {
          console.log('🗑️ Running garbage collection...');
          (window as any).gc();
        }
      }
    }
  }

  /**
   * Get memory usage statistics
   */
  static getMemoryStats(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usagePercentage: number;
  } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }
}

/**
 * React hook for automatic memory management
 */
export const useMemoryManager = () => {
  const [cleanupTasks] = React.useState<Array<() => void>>([]);

  const registerCleanup = React.useCallback((cleanup: () => void) => {
    cleanupTasks.push(cleanup);
  }, [cleanupTasks]);

  const createManagedTimeout = React.useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(callback, delay);
    registerCleanup(() => clearTimeout(timeoutId));
    return timeoutId;
  }, [registerCleanup]);

  const createManagedInterval = React.useCallback((callback: () => void, interval: number) => {
    const intervalId = setInterval(callback, interval);
    registerCleanup(() => clearInterval(intervalId));
    return intervalId;
  }, [registerCleanup]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanupTasks.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error('❌ Component cleanup failed:', error);
        }
      });
    };
  }, [cleanupTasks]);

  return {
    registerCleanup,
    createManagedTimeout,
    createManagedInterval
  };
};

// Import React for the hook
import React from 'react';