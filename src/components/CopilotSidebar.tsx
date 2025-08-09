// src/components/CopilotSidebar.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";

interface CopilotSidebarProps {
  isVisible: boolean;
  children: React.ReactNode;
}

const DEFAULT_WIDTH_PX = 480;
const MIN_WIDTH_PX = 360;
const MAX_WIDTH_RATIO = 0.66; // at most 66% of viewport width

export const CopilotSidebar: React.FC<CopilotSidebarProps> = ({
  isVisible,
  children,
}) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = window.localStorage.getItem("roamCopilotSidebarWidth");
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_WIDTH_PX;
    return Number.isFinite(parsed) ? parsed : DEFAULT_WIDTH_PX;
  });

  const isResizingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(width);

  // Apply right margin to the body to avoid overlapping Roam content
  useEffect(() => {
    if (isVisible) {
      document.body.style.marginRight = `${width}px`;
    } else {
      document.body.style.marginRight = "";
    }

    return () => {
      // On unmount, reset margin to avoid leaving the page shifted
      document.body.style.marginRight = "";
    };
  }, [isVisible, width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const deltaX = startXRef.current - e.clientX; // dragging left increases width
    const nextWidthRaw = Math.max(
      MIN_WIDTH_PX,
      Math.min(
        Math.floor(startWidthRef.current + deltaX),
        Math.floor(window.innerWidth * MAX_WIDTH_RATIO)
      )
    );
    setWidth(nextWidthRaw);
  }, []);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.localStorage.setItem("roamCopilotSidebarWidth", String(width));
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", stopResizing);
    window.removeEventListener("mouseleave", stopResizing);
    window.removeEventListener("blur", stopResizing);
  }, [handleMouseMove, width]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);
    window.addEventListener("mouseleave", stopResizing);
    window.addEventListener("blur", stopResizing);
  }, [handleMouseMove, stopResizing, width]);

  if (!isVisible) return null;

  return (
    <div className="roam-copilot-sidebar-container" style={{ width }}>
      <div
        className="roam-copilot-sidebar-resizer"
        title="Drag to resize"
        onMouseDown={startResizing}
      />
      <div className="roam-copilot-sidebar">
        {children}
      </div>
    </div>
  );
};


