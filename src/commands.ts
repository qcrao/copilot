// src/commands.ts

export const loadRoamExtensionCommands = async (
  extensionAPI: any,
  toggleCopilot: () => void,
  openCopilot: () => void,
  closeCopilot: () => void
) => {
  extensionAPI.ui.commandPalette.addCommand({
    label: "Toggle Roam Copilot",
    callback: () => {
      toggleCopilot();
    },
  });

  extensionAPI.ui.commandPalette.addCommand({
    label: "Open Roam Copilot",
    callback: () => {
      openCopilot();
    },
  });

  extensionAPI.ui.commandPalette.addCommand({
    label: "Close Roam Copilot",
    callback: () => {
      closeCopilot();
    },
  });
};