// src/components/PromptModal.tsx
import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  Button, 
  InputGroup, 
  FormGroup,
  HTMLSelect,
  Spinner,
  Icon
} from "@blueprintjs/core";
import { PromptTemplate, PromptVariable } from "../types";
import { DateSelector } from "./DateSelector";

interface PromptModalProps {
  template: PromptTemplate;
  isOpen: boolean;
  isProcessing: boolean;
  onSubmit: (variables: Record<string, any>) => void;
  onClose: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  template,
  isOpen,
  isProcessing,
  onSubmit,
  onClose
}) => {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && template.variables) {
      // Initialize values with defaults
      const initialValues: Record<string, any> = {};
      template.variables.forEach(variable => {
        if (variable.type === 'date') {
          initialValues[variable.name] = new Date().toISOString().split('T')[0];
        } else {
          initialValues[variable.name] = '';
        }
      });
      setValues(initialValues);
      setErrors({});
    }
  }, [isOpen, template]);

  const handleValueChange = (variableName: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [variableName]: value
    }));
    
    // Clear error when user starts typing
    if (errors[variableName]) {
      setErrors(prev => ({
        ...prev,
        [variableName]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (template.variables) {
      template.variables.forEach(variable => {
        if (variable.required && !values[variable.name]?.toString().trim()) {
          newErrors[variable.name] = `${variable.name} is required`;
          isValid = false;
        }
      });
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(values);
    }
  };

  const renderVariableInput = (variable: PromptVariable) => {
    const value = values[variable.name] || '';
    const hasError = !!errors[variable.name];

    switch (variable.type) {
      case 'date':
        return (
          <DateSelector
            value={value}
            onChange={(date) => handleValueChange(variable.name, date)}
            placeholder={variable.placeholder}
          />
        );
      
      case 'select':
        return (
          <HTMLSelect
            value={value}
            onChange={(e) => handleValueChange(variable.name, e.target.value)}
            options={[
              { label: variable.placeholder, value: '' },
              ...(variable.options || []).map(option => ({ label: option, value: option }))
            ]}
            fill
            disabled={isProcessing}
          />
        );
      
      case 'text':
      default:
        return (
          <InputGroup
            value={value}
            onChange={(e) => handleValueChange(variable.name, e.target.value)}
            placeholder={variable.placeholder}
            disabled={isProcessing}
            intent={hasError ? "danger" : "none"}
          />
        );
    }
  };

  if (!template.variables || template.variables.length === 0) {
    return null;
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon={template.icon as any} size={20} />
          <span>{template.title}</span>
        </div>
      }
      style={{ width: '500px' }}
      canOutsideClickClose={!isProcessing}
      canEscapeKeyClose={!isProcessing}
    >
      <div style={{ padding: '20px' }}>
        <p style={{ 
          marginBottom: '24px', 
          color: '#666', 
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {template.description}
        </p>

        {template.variables.map((variable) => (
          <FormGroup
            key={variable.name}
            label={
              <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>
                {variable.name}
                {variable.required && <span style={{ color: '#d9534f' }}> *</span>}
              </span>
            }
            helperText={errors[variable.name]}
            intent={errors[variable.name] ? "danger" : "none"}
            style={{ marginBottom: '20px' }}
          >
            {renderVariableInput(variable)}
          </FormGroup>
        ))}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px',
          marginTop: '24px',
          borderTop: '1px solid #f0f0f0',
          paddingTop: '20px'
        }}>
          <Button 
            onClick={onClose}
            disabled={isProcessing}
            large
          >
            Cancel
          </Button>
          <Button 
            intent="primary"
            onClick={handleSubmit}
            disabled={isProcessing}
            large
            style={{ minWidth: '120px' }}
          >
            {isProcessing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Spinner size={16} />
                <span>Processing...</span>
              </div>
            ) : (
              'Generate Prompt'
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};