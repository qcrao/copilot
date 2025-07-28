// src/index.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { CopilotWidget } from "./components/CopilotWidget";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { loadInitialSettings, initPanelConfig } from "./settings";
import { loadRoamExtensionCommands } from "./commands";
import "./styles.css";

let copilotState = {
  isOpen: false,
  isVisible: true,
  container: null as HTMLDivElement | null,
  root: null as any,
};

const toggleCopilot = () => {
  const previousState = copilotState.isOpen;
  copilotState.isOpen = !copilotState.isOpen;
  console.log("🔄 [toggleCopilot] State changed:", {
    previous: previousState,
    current: copilotState.isOpen,
    isVisible: copilotState.isVisible
  });
  renderCopilot();
};

const openCopilot = () => {
  copilotState.isOpen = true;
  copilotState.isVisible = true;
  renderCopilot();
};

const closeCopilot = () => {
  copilotState.isOpen = false;
  copilotState.isVisible = false;
  renderCopilot();
};

const renderCopilot = () => {
  console.log("🎨 [renderCopilot] Rendering with state:", {
    isOpen: copilotState.isOpen,
    isVisible: copilotState.isVisible,
    hasRoot: !!copilotState.root
  });
  
  if (!copilotState.root) {
    console.log("⚠️ [renderCopilot] No root found, skipping render");
    return;
  }

  if (!copilotState.isVisible) {
    console.log("🎨 [renderCopilot] Not visible, rendering null");
    copilotState.root.render(null);
    return;
  }

  console.log("🎨 [renderCopilot] Rendering CopilotWidget with isOpen:", copilotState.isOpen);
  copilotState.root.render(
    <ErrorBoundary>
      <CopilotWidget
        isOpen={copilotState.isOpen}
        onToggle={toggleCopilot}
        onClose={closeCopilot}
      />
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
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 99999;
  `;

  // Make sure we can interact with the copilot widget
  container.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.body.appendChild(container);
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

  // Remove any added styles
  const styleElements = document.querySelectorAll("style[data-roam-copilot]");
  styleElements.forEach((el) => el.remove());

  console.log("Roam Copilot unloaded!");
};

export default {
  onload,
  onunload,
};
