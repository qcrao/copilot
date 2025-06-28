import React from 'react';
import Select, { components, SingleValue, StylesConfig } from 'react-select';
import { Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

interface ModelOption {
  value: string;
  label: string;
  provider: string;
  providerName: string;
  modelInfo: ModelDisplayInfo;
}

interface ModelDisplayInfo {
  iconUrl: string | null;
  fallbackIcon: string;
  name: string;
  color: string;
  isLocal: boolean;
  blueprintIcon: any;
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  options: Array<{ model: string; provider: string; providerName: string }>;
  disabled?: boolean;
  isLoading?: boolean;
}

// Get model display info (borrowed from MessageList.tsx)
const getModelDisplayInfo = (model?: string, provider?: string): ModelDisplayInfo => {
  if (!model) {
    return { 
      iconUrl: null,
      fallbackIcon: '🤖', 
      name: 'AI Assistant', 
      color: '#666',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Check if it's a local model (Ollama)
  const isLocal = provider === 'ollama';
  
  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase();
  
  if (isLocal) {
    // For local models, use home icon from BlueprintJS
    return {
      iconUrl: null,
      fallbackIcon: '🏠',
      name: model,
      color: '#2E7D32',
      isLocal: true,
      blueprintIcon: IconNames.HOME
    };
  }
  
  if (normalizedModel.includes('gpt-4o')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-4o', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-4')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-4', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gpt-3.5')) {
    return { 
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', 
      fallbackIcon: '🤖', 
      name: 'GPT-3.5', 
      color: '#10A37F',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3.5-haiku')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude 3.5 Haiku', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude-3-haiku')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude 3 Haiku', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('claude')) {
    return { 
      iconUrl: 'https://www.anthropic.com/images/icons/claude-icon.svg', 
      fallbackIcon: '🧠', 
      name: 'Claude', 
      color: '#CC785C',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('llama')) {
    return { 
      iconUrl: 'https://llama.meta.com/llama-logo.png', 
      fallbackIcon: '⚡', 
      name: 'Llama', 
      color: '#FF6B6B',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('gemma')) {
    return { 
      iconUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_red_4ed1cbfcbc6c9e84c31b987da73fc4168e45e803.svg', 
      fallbackIcon: '💎', 
      name: 'Gemma', 
      color: '#4285F4',
      isLocal: false,
      blueprintIcon: null
    };
  }
  if (normalizedModel.includes('grok')) {
    return { 
      iconUrl: 'https://x.ai/favicon.ico', 
      fallbackIcon: '🚀', 
      name: 'Grok', 
      color: '#1D9BF0',
      isLocal: false,
      blueprintIcon: null
    };
  }

  // Default for unknown models
  return { 
    iconUrl: null,
    fallbackIcon: '🤖', 
    name: model, 
    color: '#666',
    isLocal: false,
    blueprintIcon: null
  };
};

// Custom Option component
const CustomOption = (props: any) => {
  const { data, isSelected, isFocused } = props;
  const modelInfo = data.modelInfo;

  return (
    <components.Option {...props}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0'
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: modelInfo.isLocal ? 'transparent' : 'white',
          border: modelInfo.isLocal ? 'none' : '1px solid #e1e4e8',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {modelInfo.blueprintIcon ? (
            <Icon 
              icon={modelInfo.blueprintIcon}
              size={12}
              style={{ 
                color: modelInfo.color || '#666'
              }}
            />
          ) : modelInfo.iconUrl ? (
            <img 
              src={modelInfo.iconUrl} 
              alt={`${modelInfo.name} logo`}
              style={{
                width: '12px',
                height: '12px',
                objectFit: 'contain',
                borderRadius: '1px'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = modelInfo.fallbackIcon || '🤖';
                e.currentTarget.parentElement!.style.color = '#666';
                e.currentTarget.parentElement!.style.fontSize = '12px';
              }}
            />
          ) : (
            <span style={{ color: '#666', fontSize: '12px' }}>
              {modelInfo.fallbackIcon || '🤖'}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: modelInfo.isLocal ? '600' : '500',
            color: modelInfo.isLocal ? '#2E7D32' : '#333'
          }}>
            {data.label}
          </div>
        </div>
      </div>
    </components.Option>
  );
};

// Custom SingleValue component (for selected value display)
const CustomSingleValue = (props: any) => {
  const { data } = props;
  const modelInfo = data.modelInfo;

  return (
    <components.SingleValue {...props}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: modelInfo.isLocal ? 'transparent' : 'white',
          border: modelInfo.isLocal ? 'none' : '1px solid #e1e4e8',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {modelInfo.blueprintIcon ? (
            <Icon 
              icon={modelInfo.blueprintIcon}
              size={10}
              style={{ 
                color: modelInfo.color || '#666'
              }}
            />
          ) : modelInfo.iconUrl ? (
            <img 
              src={modelInfo.iconUrl} 
              alt={`${modelInfo.name} logo`}
              style={{
                width: '10px',
                height: '10px',
                objectFit: 'contain',
                borderRadius: '1px'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = modelInfo.fallbackIcon || '🤖';
                e.currentTarget.parentElement!.style.color = '#666';
                e.currentTarget.parentElement!.style.fontSize = '10px';
              }}
            />
          ) : (
            <span style={{ color: '#666', fontSize: '10px' }}>
              {modelInfo.fallbackIcon || '🤖'}
            </span>
          )}
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: modelInfo.isLocal ? '600' : '500',
          color: modelInfo.isLocal ? '#2E7D32' : '#333'
        }}>
          {data.label}
        </span>
      </div>
    </components.SingleValue>
  );
};

// Custom styles for react-select
const customStyles: StylesConfig<ModelOption> = {
  control: (provided, state) => ({
    ...provided,
    minHeight: '32px',
    height: '32px',
    fontSize: '12px',
    fontWeight: '500',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: 'white',
    boxShadow: state.isFocused ? '0 0 0 1px #393a3d' : 'none',
    '&:hover': {
      borderColor: '#9ca3af'
    }
  }),
  valueContainer: (provided) => ({
    ...provided,
    height: '30px',
    padding: '0 4px'
  }),
  input: (provided) => ({
    ...provided,
    margin: '0px',
    paddingTop: '0px',
    paddingBottom: '0px'
  }),
  indicatorSeparator: () => ({
    display: 'none'
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: '30px'
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 99999,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e1e4e8',
    position: 'absolute'
  }),
  menuPortal: (provided) => ({
    ...provided,
    zIndex: 99999
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? '#f8f9fa' : 'white',
    color: '#333',
    cursor: 'pointer',
    padding: '6px 8px',
    '&:hover': {
      backgroundColor: '#f8f9fa'
    }
  })
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  isLoading = false
}) => {
  // Transform options to include model display info
  const selectOptions: ModelOption[] = options.map(option => ({
    value: option.model,
    label: option.model,
    provider: option.provider,
    providerName: option.providerName,
    modelInfo: getModelDisplayInfo(option.model, option.provider)
  }));

  // Find the selected option
  const selectedOption = selectOptions.find(opt => opt.value === value) || null;

  const handleChange = (option: SingleValue<ModelOption>) => {
    if (option) {
      onChange(option.value);
    }
  };

  return (
    <Select<ModelOption>
      value={selectedOption}
      onChange={handleChange}
      options={selectOptions}
      isDisabled={disabled || isLoading}
      isLoading={isLoading}
      isSearchable={false}
      components={{
        Option: CustomOption,
        SingleValue: CustomSingleValue
      }}
      styles={customStyles}
      placeholder={isLoading ? "Loading models..." : "Select model..."}
      menuPortalTarget={document.body}
      menuShouldScrollIntoView={false}
      menuPlacement="top"
    />
  );
}; 