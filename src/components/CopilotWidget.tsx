// src/components/CopilotWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button, Icon, Spinner } from '@blueprintjs/core';
// Temporarily removed marked and DOMPurify to fix import issues
// import { marked } from 'marked';
// import DOMPurify from 'dompurify';
import { ChatMessage, CopilotState, PageContext } from '../types';
import { AIService } from '../services/aiService';
import { RoamService } from '../services/roamService';
import { aiSettings } from '../settings';

interface CopilotWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const CopilotWidget: React.FC<CopilotWidgetProps> = ({
  isOpen,
  onToggle,
  onClose,
}) => {
  const [state, setState] = useState<CopilotState>({
    isOpen,
    isMinimized: !isOpen,
    messages: [],
    isLoading: false,
  });

  const [inputValue, setInputValue] = useState('');
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setState(prev => ({
      ...prev,
      isOpen,
      isMinimized: !isOpen,
    }));
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  useEffect(() => {
    if (isOpen) {
      updatePageContext();
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    // Listen for page changes in Roam
    const handlePageChange = () => {
      console.log('Page change detected, updating context...');
      updatePageContext();
    };

    // Listen for URL changes (page navigation)
    const handlePopState = () => {
      console.log('URL change detected, updating context...');
      setTimeout(updatePageContext, 100); // Small delay to ensure page is loaded
    };

    // Listen for focus changes (switching between pages)
    const handleFocus = () => {
      if (isOpen) {
        console.log('Focus change detected, updating context...');
        updatePageContext();
      }
    };

    // Add event listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('focus', handleFocus);
    
    // Also listen for hash changes (Roam uses hash routing)
    window.addEventListener('hashchange', handlePageChange);

    // Use MutationObserver to detect DOM changes that indicate page changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if the main content area changed
          const hasPageContent = Array.from(mutation.addedNodes).some(node => 
            node instanceof Element && (
              node.classList?.contains('roam-main') ||
              node.classList?.contains('rm-title-display') ||
              node.querySelector?.('.rm-title-display')
            )
          );
          
          if (hasPageContent) {
            console.log('Page content change detected, updating context...');
            setTimeout(updatePageContext, 200); // Delay to ensure content is rendered
          }
        }
      });
    });

    // Start observing the document body for changes
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('hashchange', handlePageChange);
      observer.disconnect();
    };
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updatePageContext = async () => {
    try {
      const context = await RoamService.getPageContext();
      setPageContext(context);
    } catch (error) {
      console.error('Failed to get page context:', error);
    }
  };

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || state.isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
    addMessage({
      role: 'user',
      content: userMessage,
    });

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Get fresh context before sending to AI
      const freshContext = await RoamService.getPageContext();
      setPageContext(freshContext);
      
      const contextString = freshContext 
        ? RoamService.formatContextForAI(freshContext)
        : 'No context available';

      console.log('Sending message with context:', {
        currentPage: freshContext?.currentPage?.title,
        blocksCount: freshContext?.currentPage?.blocks?.length || 0
      });

      const response = await AIService.sendMessage(
        aiSettings,
        userMessage,
        contextString
      );

      addMessage({
        role: 'assistant',
        content: response,
      });
    } catch (error: any) {
      addMessage({
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    if (isUser) {
      return (
        <div key={message.id} className="roam-copilot-message user">
          {message.content}
        </div>
      );
    }

    // Render assistant message as plain text for now
    // TODO: Add markdown support back later
    return (
      <div key={message.id} className="roam-copilot-message assistant">
        <div className="roam-copilot-markdown">
          {message.content.split('\n').map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </div>
    );
  };

  if (state.isMinimized) {
    return (
      <div className="roam-copilot-container">
        <div 
          className="roam-copilot-minimized"
          onClick={onToggle}
          title="Open Roam Copilot"
        >
          <Icon icon="chat" size={24} color="white" />
        </div>
      </div>
    );
  }

  return (
    <div className="roam-copilot-container">
      <div className="roam-copilot-expanded">
        <div className="roam-copilot-header">
          <span className="flex items-center gap-2">
            <Icon icon="chat" size={16} />
            Roam Copilot
          </span>
          <div className="flex items-center gap-2">
            <Button
              minimal
              small
              icon="minus"
              onClick={onToggle}
              title="Minimize"
            />
            <Button
              minimal
              small
              icon="cross"
              onClick={onClose}
              title="Close"
            />
          </div>
        </div>

        <div className="roam-copilot-messages">
          {state.messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Icon icon="chat" size={48} className="mb-4 opacity-50" />
              <p>Hello! I'm your Roam Research assistant.</p>
              <p className="text-sm mt-2">
                I can help you with your notes and answer questions based on your current page content.
              </p>
            </div>
          )}
          
          {state.messages.map(renderMessage)}
          
          {state.isLoading && (
            <div className="roam-copilot-loading">
              <Spinner size={16} />
              <span>Thinking...</span>
              <div className="roam-copilot-loading-dots">
                <div className="roam-copilot-loading-dot"></div>
                <div className="roam-copilot-loading-dot"></div>
                <div className="roam-copilot-loading-dot"></div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="roam-copilot-input">
          <textarea
            ref={inputRef}
            className="roam-copilot-textarea"
            placeholder="Ask me anything about your notes..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={state.isLoading}
            rows={1}
          />
          <button
            className="roam-copilot-send-button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || state.isLoading}
            title="Send message"
          >
            <Icon icon="send-message" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};