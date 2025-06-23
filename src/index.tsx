// src/index.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { CopilotWidget } from "./components/CopilotWidget";
import { loadInitialSettings, initPanelConfig } from "./settings";
import { loadRoamExtensionCommands } from "./commands";
import "./styles.css";

let copilotState = {
  isOpen: false,
  container: null as HTMLDivElement | null,
  root: null as any,
};

const toggleCopilot = () => {
  copilotState.isOpen = !copilotState.isOpen;
  renderCopilot();
};

const openCopilot = () => {
  copilotState.isOpen = true;
  renderCopilot();
};

const closeCopilot = () => {
  copilotState.isOpen = false;
  renderCopilot();
};

const renderCopilot = () => {
  if (!copilotState.root) return;

  copilotState.root.render(
    <CopilotWidget
      isOpen={copilotState.isOpen}
      onToggle={toggleCopilot}
      onClose={closeCopilot}
    />
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

  // Re-enable pointer events for the copilot area
  const style = document.createElement("style");
  style.textContent = `
    #roam-copilot-root .roam-copilot-container {
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);

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
