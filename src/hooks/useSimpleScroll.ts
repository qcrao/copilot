// src/hooks/useSimpleScroll.ts
import { useEffect, useRef, useCallback } from 'react';

export interface SimpleScrollOptions {
  threshold?: number;
  respectUserIntent?: boolean;
}

export interface SimpleScrollActions {
  scrollToBottom: (force?: boolean) => void;
  isNearBottom: () => boolean;
}

export const useSimpleScroll = (
  dependencies: any[],
  options: SimpleScrollOptions = {}
): [React.RefCallback<HTMLDivElement>, SimpleScrollActions] => {
  const { threshold = 50, respectUserIntent = true } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simple function to check if near bottom
  const isNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [threshold]);

  // Force scroll to bottom
  const scrollToBottom = useCallback((force = false) => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any pending auto-scroll
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }

    if (force) {
      // Force scroll regardless of user state
      isUserScrollingRef.current = false;
      container.scrollTop = container.scrollHeight;
    } else if (!isUserScrollingRef.current || !respectUserIntent) {
      // Auto-scroll only if user isn't manually scrolling
      container.scrollTop = container.scrollHeight;
    }
  }, [respectUserIntent]);

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current);
    const isScrollingUp = currentScrollTop < lastScrollTopRef.current;
    
    // Detect significant user scrolling (especially upward scrolls)
    if (scrollDelta > 5 && isScrollingUp && respectUserIntent) {
      isUserScrollingRef.current = true;
      
      // Clear existing timeout
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      
      // Reset user scrolling flag after inactivity
      userScrollTimeoutRef.current = setTimeout(() => {
        // Only reset if user is now near bottom
        if (isNearBottom()) {
          isUserScrollingRef.current = false;
        }
      }, 2000);
    }
    
    // If user scrolled to bottom, allow auto-scrolling again
    if (isNearBottom()) {
      isUserScrollingRef.current = false;
    }

    lastScrollTopRef.current = currentScrollTop;
  }, [respectUserIntent, isNearBottom]);

  // Auto-scroll effect - simplified and more reliable
  useEffect(() => {
    if (dependencies.length === 0) return;

    // Clear any pending scroll
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }

    // Use double requestAnimationFrame for DOM update reliability
    autoScrollTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = containerRef.current;
          if (!container) return;

          // Always scroll if not respecting user intent or user isn't actively scrolling
          if (!respectUserIntent || !isUserScrollingRef.current) {
            container.scrollTop = container.scrollHeight;
          }
        });
      });
    }, 10); // Very short delay to ensure DOM is updated

    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
    };
  }, dependencies);

  // Setup scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

  // Ref callback to set up container
  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      // Initial scroll to bottom
      setTimeout(() => {
        if (node) node.scrollTop = node.scrollHeight;
      }, 0);
    } else {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = null;
    }
  }, []);

  return [
    refCallback,
    {
      scrollToBottom,
      isNearBottom,
    }
  ];
};