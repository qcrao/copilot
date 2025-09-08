import React from "react";
import Select, { components, SingleValue, StylesConfig } from "react-select";
import { Icon } from "@blueprintjs/core";
import { getModelDisplayInfo } from "../utils/iconUtils";

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
  onChange: (model: string, provider?: string) => void;
  options: Array<{ model: string; provider: string; providerName: string }>;
  disabled?: boolean;
  isLoading?: boolean;
}

// Note: getModelDisplayInfo is now imported from iconUtils

// Custom Option component
const CustomOption = (props: any) => {
  const { data } = props;
  const modelInfo = data.modelInfo;

  const getModelDisplayName = (data: any) => {
    const { modelInfo } = data;
    return modelInfo.name;
  };

  return (
    <components.Option {...props}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "3px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: modelInfo.isLocal ? "transparent" : "white",
            border: modelInfo.isLocal ? "none" : "1px solid #e1e4e8",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {modelInfo.blueprintIcon ? (
            <Icon
              icon={modelInfo.blueprintIcon}
              size={14}
              style={{
                color: modelInfo.color || "#666",
              }}
            />
          ) : modelInfo.iconUrl ? (
            <img
              src={modelInfo.iconUrl}
              alt={`${modelInfo.name} logo`}
              style={{
                width: "14px",
                height: "14px",
                objectFit: "contain",
                borderRadius: "1px",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.innerHTML =
                  modelInfo.fallbackIcon || "🤖";
                e.currentTarget.parentElement!.style.color = "#666";
                e.currentTarget.parentElement!.style.fontSize = "14px";
              }}
            />
          ) : (
            <span style={{ color: "#666", fontSize: "14px" }}>
              {modelInfo.fallbackIcon || "🤖"}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: modelInfo.isLocal ? "600" : "500",
              color: modelInfo.isLocal ? "#2E7D32" : (data.provider === "custom-openai" ? "#6366F1" : "#333"),
            }}
          >
            {getModelDisplayName(data)}
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

  const getModelDisplayName = (data: any) => {
    const { modelInfo } = data;
    return modelInfo.name;
  };

  return (
    <components.SingleValue {...props}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: modelInfo.isLocal ? "transparent" : "white",
            border: modelInfo.isLocal ? "none" : "1px solid #e1e4e8",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {modelInfo.blueprintIcon ? (
            <Icon
              icon={modelInfo.blueprintIcon}
              size={12}
              style={{
                color: modelInfo.color || "#666",
              }}
            />
          ) : modelInfo.iconUrl ? (
            <img
              src={modelInfo.iconUrl}
              alt={`${modelInfo.name} logo`}
              style={{
                width: "12px",
                height: "12px",
                objectFit: "contain",
                borderRadius: "1px",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.innerHTML =
                  modelInfo.fallbackIcon || "🤖";
                e.currentTarget.parentElement!.style.color = "#666";
                e.currentTarget.parentElement!.style.fontSize = "12px";
              }}
            />
          ) : (
            <span style={{ color: "#666", fontSize: "12px" }}>
              {modelInfo.fallbackIcon || "🤖"}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: "12px",
            fontWeight: modelInfo.isLocal ? "600" : "500",
            color: modelInfo.isLocal ? "#2E7D32" : (data.provider === "custom-openai" ? "#6366F1" : "#333"),
          }}
        >
          {getModelDisplayName(data)}
        </span>
      </div>
    </components.SingleValue>
  );
};

// Custom styles for react-select
const customStyles: StylesConfig<ModelOption> = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "32px",
    height: "32px",
    fontSize: "12px",
    fontWeight: "500",
    border: state.isFocused ? "1px solid #393a3d" : "1px solid #d1d5db",
    borderRadius: "8px",
    backgroundColor: "white",
    boxShadow: "none",
    minWidth: "120px",
    maxWidth: "220px",
    width: "fit-content",
    "&:hover": {
      borderColor: state.isFocused ? "#393a3d" : "#9ca3af",
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    height: "30px",
    padding: "0 4px",
  }),
  input: (provided) => ({
    ...provided,
    margin: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: "30px",
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 99999,
    boxShadow:
      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    border: "1px solid #e1e4e8",
    borderRadius: "8px",
    position: "absolute",
    minWidth: "160px",
    maxWidth: "240px",
    width: "fit-content",
  }),
  menuPortal: (provided) => ({
    ...provided,
    zIndex: 99999,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? "#f8f9fa" : "white",
    color: "#333",
    cursor: "pointer",
    padding: "6px 8px",
    "&:hover": {
      backgroundColor: "#f8f9fa",
    },
  }),
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  isLoading = false,
}) => {
  // Transform options to include model display info
  const selectOptions: ModelOption[] = options.map((option) => ({
    value: option.model,
    label: option.model,
    provider: option.provider,
    providerName: option.providerName,
    modelInfo: getModelDisplayInfo(option.model, option.provider),
  }));

  // Find the selected option
  const selectedOption =
    selectOptions.find((opt) => opt.value === value) || null;

  const handleChange = (option: SingleValue<ModelOption>) => {
    if (option) {
      onChange(option.value, option.provider);
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
        SingleValue: CustomSingleValue,
      }}
      styles={customStyles}
      placeholder={isLoading ? "Loading models..." : "Select model..."}
      menuPortalTarget={document.body}
      menuShouldScrollIntoView={false}
      menuPlacement="top"
    />
  );
};
