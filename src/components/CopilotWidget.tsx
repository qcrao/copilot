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
      await updatePageContext();
      
      const contextString = pageContext 
        ? RoamService.formatContextForAI(pageContext)
        : 'No context available';

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