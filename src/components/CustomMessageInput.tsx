// src/components/CustomMessageInput.tsx
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface CustomMessageInputProps {
  placeholder?: string;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const CustomMessageInput: React.FC<CustomMessageInputProps> = ({
  placeholder = "Ask me anything about your notes...",
  onSend,
  disabled = false,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const message = value.trim();
    if (message && !disabled) {
      onSend(message);
      setValue('');
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="custom-message-input">
      <div className="custom-message-input__container">
        <textarea
          ref={textareaRef}
          className="custom-message-input__textarea"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          className={`custom-message-input__send-button ${canSend ? 'active' : 'inactive'}`}
          onClick={handleSend}
          disabled={!canSend}
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 2L8 14M8 2L3 7M8 2L13 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};