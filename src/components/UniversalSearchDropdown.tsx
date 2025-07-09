// src/components/UniversalSearchDropdown.tsx
import React, { useEffect, useRef } from "react";
import { UniversalSearchResult } from "../types";

interface UniversalSearchDropdownProps {
  isVisible: boolean;
  results: UniversalSearchResult[];
  selectedIndex: number;
  onSelect: (result: UniversalSearchResult) => void;
  onClose: () => void;
  position: { top: number; left: number };
  searchTerm: string;
  isLoading?: boolean;
}

export const UniversalSearchDropdown: React.FC<UniversalSearchDropdownProps> = ({
  isVisible,
  results,
  selectedIndex,
  onSelect,
  onClose,
  position,
  searchTerm,
  isLoading = false,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVisible, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (isVisible && dropdownRef.current && results.length > 0) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      ) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth"
        });
      }
    }
  }, [isVisible, selectedIndex, results.length]);

  console.log(`🔍 UniversalSearchDropdown render: visible=${isVisible}, results.length=${results.length}`, results.map(r => r.preview));
  
  if (!isVisible) {
    return null;
  }

  // Get appropriate icon for result type
  const getResultIcon = (type: UniversalSearchResult['type']) => {
    switch (type) {
      case 'page':
        return '📄';
      case 'daily-note':
        return '📅';
      case 'block':
        return '📝';
      default:
        return '📄';
    }
  };

  // Get appropriate color class for result type
  const getResultColorClass = (type: UniversalSearchResult['type']) => {
    switch (type) {
      case 'page':
        return 'rr-universal-search-page';
      case 'daily-note':
        return 'rr-universal-search-daily';
      case 'block':
        return 'rr-universal-search-block';
      default:
        return 'rr-universal-search-page';
    }
  };

  // Get display text for result type
  const getResultTypeLabel = (type: UniversalSearchResult['type']) => {
    switch (type) {
      case 'page':
        return 'Page';
      case 'daily-note':
        return 'Daily Note';
      case 'block':
        return 'Block';
      default:
        return 'Page';
    }
  };

  // Highlight search term in text
  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) {
      return <span>{text}</span>;
    }

    const lowerText = text.toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
    const index = lowerText.indexOf(lowerSearchTerm);

    if (index === -1) {
      return <span>{text}</span>;
    }

    const before = text.slice(0, index);
    const match = text.slice(index, index + searchTerm.length);
    const after = text.slice(index + searchTerm.length);

    return (
      <span>
        {before}
        <strong className="rr-universal-search-highlight">{match}</strong>
        {after}
      </span>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className="rr-universal-search-dropdown"
      style={{
        position: "fixed",
        bottom: window.innerHeight - position.top,
        left: position.left,
        zIndex: 1000,
      }}
    >
      <div className="rr-universal-search-header">
        <span className="rr-universal-search-title">
          {isLoading ? "Searching..." : "Search Results"}
        </span>
        {!isLoading && (
          <span className="rr-universal-search-count">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      {isLoading ? (
        <div className="rr-universal-search-loading">
          <div className="rr-universal-search-spinner"></div>
          <span>Searching pages and blocks...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="rr-universal-search-empty">
          <span>No results found for "{searchTerm}"</span>
        </div>
      ) : (
        <div className="rr-universal-search-list">
          {results.map((result, index) => (
            <div
              key={result.uid}
              data-index={index}
              className={`rr-universal-search-item ${getResultColorClass(result.type)} ${
                index === selectedIndex ? "selected" : ""
              }`}
              onClick={() => onSelect(result)}
              onMouseEnter={() => {
                // Could emit index change event here if needed for mouse hover
              }}
            >
              <div className="rr-universal-search-content">
                <div className="rr-universal-search-main">
                  <span className="rr-universal-search-icon">
                    {getResultIcon(result.type)}
                  </span>
                  <div className="rr-universal-search-text">
                    <div className="rr-universal-search-primary">
                      {result.title ? (
                        highlightMatch(result.title, searchTerm)
                      ) : (
                        highlightMatch(result.preview, searchTerm)
                      )}
                    </div>
                    {result.type === 'block' && result.pageTitle && (
                      <div className="rr-universal-search-secondary">
                        in {result.pageTitle}
                      </div>
                    )}
                  </div>
                </div>
                <div className="rr-universal-search-type">
                  {getResultTypeLabel(result.type)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="rr-universal-search-footer">
        <span className="rr-universal-search-hint">
          ↑↓ to navigate • Enter to select • Esc to close
        </span>
      </div>
    </div>
  );
};