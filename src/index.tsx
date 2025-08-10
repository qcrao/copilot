// src/index.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { CopilotWidget } from "./components/CopilotWidget";
import { CopilotSidebar } from "./components/CopilotSidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { loadInitialSettings, initPanelConfig } from "./settings";
import { loadRoamExtensionCommands } from "./commands";
import "./styles.css";

// Sidebar width management  
const DEFAULT_WIDTH_PX = 380;

let copilotState = {
  // Sidebar mode: we control visibility and open state
  isOpen: true,
  isVisible: true,
  container: null as HTMLDivElement | null,
  root: null as any,
  sidebarWidth: DEFAULT_WIDTH_PX,
};

const toggleCopilot = () => {
  copilotState.isVisible = !copilotState.isVisible;
  // keep widget logically open in sidebar mode when visible
  copilotState.isOpen = copilotState.isVisible;
  renderCopilot();
};

const toggleMinimize = () => {
  copilotState.isOpen = !copilotState.isOpen;
  // keep visible but toggle open state for minimize/expand
  renderCopilot();
};

const openCopilot = () => {
  copilotState.isVisible = true;
  copilotState.isOpen = true;
  renderCopilot();
};

const closeCopilot = () => {
  copilotState.isVisible = false;
  copilotState.isOpen = false;
  renderCopilot();
};

const onSidebarWidthChange = (newWidth: number) => {
  copilotState.sidebarWidth = newWidth;
  // Trigger re-render with updated width
  renderCopilot();
};

const renderCopilot = () => {
  if (!copilotState.root) return;

  if (!copilotState.isVisible) {
    copilotState.root.render(null);
    return;
  }

  // If minimized, render just the widget without sidebar wrapper
  if (!copilotState.isOpen) {
    // Reset body margin when minimized to show icon in correct position
    document.body.style.marginRight = "";
    copilotState.root.render(
      <ErrorBoundary>
        <CopilotWidget
          isOpen={copilotState.isOpen}
          onToggle={toggleMinimize}
          onClose={closeCopilot}
          embedMode="sidebar"
        />
      </ErrorBoundary>
    );
    return;
  }

  // Render as right-side sidebar when expanded
  copilotState.root.render(
    <ErrorBoundary>
      <CopilotSidebar 
        isVisible={copilotState.isVisible}
        width={copilotState.sidebarWidth}
        onWidthChange={onSidebarWidthChange}
      >
        <CopilotWidget
          isOpen={copilotState.isOpen}
          onToggle={toggleMinimize}
          onClose={closeCopilot}
          embedMode="sidebar"
        />
      </CopilotSidebar>
    </ErrorBoundary>
  );
};

const createCopilotContainer = () => {
  // Remove existing container if it exists
  const existingContainer = document.getElementById("roam-copilot-root");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create new container
  const container = document.createElement("div");
  container.id = "roam-copilot-root";
  // No full-screen overlay; sidebar component positions itself
  container.style.cssText = `
    position: static;
    z-index: 99999;
  `;

  // No need to capture clicks at the root in sidebar mode

  // Insert as child of #app div 
  const appDiv = document.getElementById("app");
  if (appDiv) {
    appDiv.appendChild(container);
  } else {
    // Fallback to body if #app not found
    document.body.appendChild(container);
  }
  copilotState.container = container;
  copilotState.root = createRoot(container);

  // No additional styles needed - handled in CSS file

  return container;
};

const onload = async ({ extensionAPI }: { extensionAPI: any }) => {
  console.log("Roam Copilot loading...");

  try {
    // Load settings
    loadInitialSettings(extensionAPI);

    // Initialize panel config
    await extensionAPI.settings.panel.create(initPanelConfig(extensionAPI));

    // Load commands
    await loadRoamExtensionCommands(
      extensionAPI,
      toggleCopilot,
      openCopilot,
      closeCopilot
    );

    // Create copilot container and render
    createCopilotContainer();
    renderCopilot();

    console.log("Roam Copilot loaded successfully!");
  } catch (error) {
    console.error("Error loading Roam Copilot:", error);
  }
};

const onunload = () => {
  // Clean up
  if (copilotState.root) {
    copilotState.root.unmount();
    copilotState.root = null;
  }
  if (copilotState.container) {
    copilotState.container.remove();
    copilotState.container = null;
  }

  // Reset any page-level layout changes
  try {
    (document.body.style as any).marginRight = "";
  } catch (e) {
    // ignore
  }

  // Remove any added styles
  const styleElements = document.querySelectorAll("style[data-roam-copilot]");
  styleElements.forEach((el) => el.remove());

  console.log("Roam Copilot unloaded!");
};

export default {
  onload,
  onunload,
};
