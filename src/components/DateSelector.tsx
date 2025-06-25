// src/components/DateSelector.tsx
import React, { useState } from "react";
import { InputGroup, Button, Popover, Card } from "@blueprintjs/core";

interface DateSelectorProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select date"
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatInputDate = (dateString: string): string => {
    if (!dateString) return "";
    return dateString.split('T')[0]; // Get YYYY-MM-DD format
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleQuickSelect = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    onChange(date.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const handleToday = () => {
    onChange(new Date().toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const quickOptions = [
    { label: "Today", days: 0, handler: handleToday },
    { label: "Yesterday", days: 1, handler: () => handleQuickSelect(1) },
    { label: "3 days ago", days: 3, handler: () => handleQuickSelect(3) },
    { label: "1 week ago", days: 7, handler: () => handleQuickSelect(7) },
    { label: "2 weeks ago", days: 14, handler: () => handleQuickSelect(14) },
    { label: "1 month ago", days: 30, handler: () => handleQuickSelect(30) }
  ];

  const calendarContent = (
    <Card style={{ padding: "16px", minWidth: "300px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600" }}>
          Quick Select
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {quickOptions.map((option) => (
            <Button
              key={option.label}
              text={option.label}
              small
              minimal
              onClick={option.handler}
              style={{
                justifyContent: "flex-start",
                padding: "6px 12px",
                fontSize: "13px"
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600" }}>
          Custom Date
        </h4>
        <input
          type="date"
          value={formatInputDate(value)}
          onChange={handleDateChange}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: "white"
          }}
        />
      </div>

      <div style={{ marginTop: "16px", textAlign: "right" }}>
        <Button
          text="Close"
          small
          onClick={() => setIsOpen(false)}
        />
      </div>
    </Card>
  );

  return (
    <Popover
      content={calendarContent}
      isOpen={isOpen}
      onInteraction={(nextOpenState) => setIsOpen(nextOpenState)}
      position="bottom-left"
      minimal
    >
      <InputGroup
        value={value ? formatDisplayDate(value) : ""}
        placeholder={placeholder}
        readOnly
        rightElement={
          <Button
            icon="calendar"
            minimal
            onClick={() => setIsOpen(!isOpen)}
          />
        }
        style={{ cursor: "pointer" }}
        onClick={() => setIsOpen(!isOpen)}
      />
    </Popover>
  );
};