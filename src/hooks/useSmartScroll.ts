// src/hooks/useSmartScroll.ts
import { useEffect, useRef, useCallback, useState } from 'react';

export interface SmartScrollOptions {
  threshold?: number; // Distance from bottom to consider "at bottom"
  smoothBehavior?: boolean; // Use smooth scrolling
  debounceMs?: number; // Debounce scroll updates
  respectUserIntent?: boolean; // Respect when user manually scrolls up
}

export interface SmartScrollState {
  isAtBottom: boolean;
  isUserScrolling: boolean;
  shouldAutoScroll: boolean;
  hasNewContent: boolean;
}

export interface SmartScrollActions {
  scrollToBottom: (force?: boolean) => void;
  setAutoScrollEnabled: (enabled: boolean) => void;
  resetUserScrolling: () => void;
}

export const useSmartScroll = (
  dependencies: any[],
  options: SmartScrollOptions = {}
): [React.RefCallback<HTMLDivElement>, SmartScrollState, SmartScrollActions] => {
  const {
    threshold = 100,
    smoothBehavior = true,
    debounceMs = 50,
    respectUserIntent = true
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomElementRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef<number>(0);
  const userScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intersectionObserver = useRef<IntersectionObserver | null>(null);

  const [state, setState] = useState<SmartScrollState>({
    isAtBottom: true,
    isUserScrolling: false,
    shouldAutoScroll: true,
    hasNewContent: false
  });

  // Check if user is at bottom
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [threshold]);

  // Update scroll state
  const updateScrollState = useCallback(() => {
    const isAtBottom = checkIsAtBottom();
    
    setState(prev => ({
      ...prev,
      isAtBottom,
      shouldAutoScroll: isAtBottom && !prev.isUserScrolling
    }));
  }, [checkIsAtBottom]);

  // Debounced scroll state update
  const debouncedUpdateScrollState = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(updateScrollState, debounceMs);
  }, [updateScrollState, debounceMs]);

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const scrollDelta = Math.abs(currentScrollTop - lastScrollTop.current);
    
    // Detect if this was a user-initiated scroll (significant movement)
    if (scrollDelta > 5 && respectUserIntent) {
      setState(prev => ({ 
        ...prev, 
        isUserScrolling: true,
        hasNewContent: false // Clear new content indicator when user scrolls
      }));
      
      // Clear user scrolling flag after inactivity
      if (userScrollTimer.current) {
        clearTimeout(userScrollTimer.current);
      }
      
      userScrollTimer.current = setTimeout(() => {
        setState(prev => ({ ...prev, isUserScrolling: false }));
      }, 1000);
    }

    lastScrollTop.current = currentScrollTop;
    debouncedUpdateScrollState();
  }, [respectUserIntent, debouncedUpdateScrollState]);

  // Scroll to bottom function
  const scrollToBottom = useCallback((force = false) => {
    const container = containerRef.current;
    const bottomElement = bottomElementRef.current;
    
    if (!container) return;

    // Clear any user scrolling state if forcing
    if (force) {
      setState(prev => ({ 
        ...prev, 
        isUserScrolling: false,
        hasNewContent: false,
        shouldAutoScroll: true
      }));
    }

    // Use different scroll methods based on preference
    if (bottomElement && smoothBehavior) {
      bottomElement.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    } else {
      // Direct scroll for better performance during streaming
      container.scrollTop = container.scrollHeight;
    }
  }, [smoothBehavior]);

  // Set auto-scroll enabled
  const setAutoScrollEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ 
      ...prev, 
      shouldAutoScroll: enabled && prev.isAtBottom 
    }));
  }, []);

  // Reset user scrolling state
  const resetUserScrolling = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isUserScrolling: false,
      hasNewContent: false
    }));
  }, []);

  // Setup intersection observer for bottom detection
  useEffect(() => {
    const bottomElement = bottomElementRef.current;
    if (!bottomElement) return;

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setState(prev => ({ 
            ...prev, 
            isAtBottom: true,
            shouldAutoScroll: !prev.isUserScrolling,
            hasNewContent: false
          }));
        } else {
          setState(prev => ({ 
            ...prev, 
            isAtBottom: false
          }));
        }
      },
      {
        root: containerRef.current,
        rootMargin: `0px 0px ${threshold}px 0px`,
        threshold: 0
      }
    );

    intersectionObserver.current.observe(bottomElement);

    return () => {
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, []); // Only set up once

  // Setup scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Main auto-scroll effect
  useEffect(() => {
    if (!state.shouldAutoScroll) return;

    // Mark that there's new content if we're not at bottom
    if (!state.isAtBottom && dependencies.length > 0) {
      setState(prev => ({ ...prev, hasNewContent: true }));
    }

    // Only auto-scroll if we should and we're at bottom
    if (state.isAtBottom || !respectUserIntent) {
      const timeoutId = setTimeout(() => {
        scrollToBottom(false);
      }, 16); // Next frame

      return () => clearTimeout(timeoutId);
    }
  }, [...dependencies, state.shouldAutoScroll, state.isAtBottom]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (userScrollTimer.current) {
        clearTimeout(userScrollTimer.current);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, []);

  // Create a ref callback that sets up the container and bottom element
  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Assign to mutable refs
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      
      // Create or find bottom element
      let bottomEl = node.querySelector('.smart-scroll-bottom') as HTMLDivElement;
      if (!bottomEl) {
        bottomEl = document.createElement('div');
        bottomEl.className = 'smart-scroll-bottom';
        bottomEl.style.cssText = 'height: 1px; width: 1px; position: absolute; bottom: 0; pointer-events: none; visibility: hidden;';
        node.appendChild(bottomEl);
      }
      (bottomElementRef as React.MutableRefObject<HTMLDivElement | null>).current = bottomEl;
      
      // Update initial scroll state
      updateScrollState();
    } else {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = null;
      (bottomElementRef as React.MutableRefObject<HTMLDivElement | null>).current = null;
    }
  }, [updateScrollState]);

  return [
    refCallback,
    state,
    {
      scrollToBottom,
      setAutoScrollEnabled,
      resetUserScrolling
    }
  ];
};