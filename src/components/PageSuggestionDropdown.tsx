// src/components/PageSuggestionDropdown.tsx
import React, { useEffect, useRef } from "react";

interface PageSuggestion {
  title: string;
  uid: string;
}

interface PageSuggestionDropdownProps {
  isVisible: boolean;
  suggestions: PageSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: PageSuggestion) => void;
  onClose: () => void;
  position: { top: number; left: number };
  searchTerm: string;
}

export const PageSuggestionDropdown: React.FC<PageSuggestionDropdownProps> = ({
  isVisible,
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
  position,
  searchTerm,
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
    if (isVisible && dropdownRef.current) {
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
  }, [isVisible, selectedIndex]);

  console.log(`🔍 PageSuggestionDropdown render: visible=${isVisible}, suggestions.length=${suggestions.length}`, suggestions.map(s => s.title));
  
  if (!isVisible || suggestions.length === 0) {
    console.log(`🔍 PageSuggestionDropdown not rendering: visible=${isVisible}, suggestions.length=${suggestions.length}`);
    return null;
  }

  const highlightMatch = (title: string, searchTerm: string) => {
    if (!searchTerm.trim()) {
      return <span>{title}</span>;
    }

    const lowerTitle = title.toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
    const index = lowerTitle.indexOf(lowerSearchTerm);

    if (index === -1) {
      return <span>{title}</span>;
    }

    const before = title.slice(0, index);
    const match = title.slice(index, index + searchTerm.length);
    const after = title.slice(index + searchTerm.length);

    return (
      <span>
        {before}
        <strong className="rr-page-suggestion-highlight">{match}</strong>
        {after}
      </span>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className="rr-page-suggestion-dropdown"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1000,
      }}
    >
      <div className="rr-page-suggestion-header">
        <span className="rr-page-suggestion-title">Pages</span>
        <span className="rr-page-suggestion-count">
          {suggestions.length} result{suggestions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="rr-page-suggestion-list">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.uid}
            data-index={index}
            className={`rr-page-suggestion-item ${
              index === selectedIndex ? "selected" : ""
            }`}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => {
              // Could emit index change event here if needed
            }}
          >
            <div className="rr-page-suggestion-content">
              <span className="rr-page-suggestion-icon">📄</span>
              <span className="rr-page-suggestion-text">
                {highlightMatch(suggestion.title, searchTerm)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="rr-page-suggestion-footer">
        <span className="rr-page-suggestion-hint">
          ↑↓ to navigate • Enter to select • Esc to close
        </span>
      </div>
    </div>
  );
};