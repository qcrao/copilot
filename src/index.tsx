// src/index.tsx
import { HistoricalPagesService } from "./services/historicalPagesService";
import { RoamService } from "./services/roamService";
import { DateUtils } from "./utils/dateUtils";
import {
  loadInitialSettings,
  initPanelConfig,
  yearsBack,
  dailyUpdateHour,
} from "./settings";
import { loadRoamExtensionCommands } from "./commands";

let cleanupObserver: (() => void) | null = null;
let updateTimer: NodeJS.Timer | null = null;

const openHistoricalPages = async (today: string) => {
  const historicalPages = await HistoricalPagesService.getHistoricalPages(
    today,
    yearsBack
  );

  if (historicalPages.length > 0) {
    // Open right sidebar
    await (window as any).roamAlphaAPI.ui.rightSidebar.open();

    // Reverse historical pages so they are in order from oldest to newest
    historicalPages.reverse();

    // Open windows for each historical page
    for (const page of historicalPages) {
      const formattedDate = DateUtils.formatRoamDate(page.date);
      await (window as any).roamAlphaAPI.ui.rightSidebar.addWindow({
        window: {
          type: "outline",
          "block-uid": page.uid,
          title: formattedDate,
        },
      });
    }

    // Mark historical windows with custom styles and store cleanup function
    cleanupObserver = RoamService.markHistoricalWindows();
    console.log("Historical pages opened successfully!");
  } else {
    console.log("No historical pages found");
  }
};

const closeHistoricalPages = async (today: string) => {
  const historicalPages = await HistoricalPagesService.getHistoricalPages(
    today,
    yearsBack
  );

  // Check if rightSidebar API exists before using it
  const roamAPI = window as any;
  if (!roamAPI?.roamAlphaAPI?.ui?.rightSidebar) {
    console.error("Right sidebar API not available");
    return;
  }

  // Close windows for each historical page
  for (const page of historicalPages) {
    try {
      await roamAPI.roamAlphaAPI.ui.rightSidebar.removeWindow({
        window: {
          type: "outline",
          "block-uid": page.uid,
        },
      });
    } catch (error) {
      console.error(`Failed to close window for page ${page.uid}:`, error);
    }
  }
};

const scheduleNextUpdate = () => {
  const now = new Date();
  const nextUpdate = new Date(now);

  // If current hour is before update hour, schedule for today
  // Otherwise schedule for tomorrow
  if (now.getHours() < dailyUpdateHour) {
    nextUpdate.setHours(dailyUpdateHour, 0, 3, 0); // set seconds to 3 to avoid timezone issues
  } else {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
    nextUpdate.setHours(dailyUpdateHour, 0, 3, 0); // set seconds to 3 to avoid timezone issues
  }

  const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
  console.log(
    `Next update scheduled in ${Math.round(
      timeUntilUpdate / 1000 / 60
    )} minutes`
  );

  return setTimeout(async () => {
    const today = DateUtils.formatRoamDate(new Date());
    await openHistoricalPages(today);
    // Schedule next update
    updateTimer = scheduleNextUpdate();
  }, timeUntilUpdate);
};

const onload = async ({ extensionAPI }: { extensionAPI: any }) => {
  console.log("Last Year Today plugin loading...");

  try {
    // Load settings
    console.log("loadInitialSettings...");
    loadInitialSettings(extensionAPI);
    console.log("yearsBack", yearsBack);
    console.log("dailyUpdateHour", dailyUpdateHour);

    // Initialize panel config
    await extensionAPI.settings.panel.create(initPanelConfig(extensionAPI));

    // Listen for settings changes
    window.addEventListener(
      "lastYearToday:hour-to-open-last-year-today-page:settingsChanged",
      () => {
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
        updateTimer = scheduleNextUpdate();
      }
    );

    await loadRoamExtensionCommands(
      extensionAPI,
      openHistoricalPages,
      closeHistoricalPages
    );

    // Initialize custom styles
    RoamService.injectCustomStyles();

    // Get current date in Roam format
    const now = new Date();
    const today = DateUtils.formatRoamDate(now);

    await openHistoricalPages(today);

    // Schedule next update
    updateTimer = scheduleNextUpdate();
  } catch (error) {
    console.error("Error loading Last Year Today plugin:", error);
  }
};

const onunload = () => {
  // Remove settings change listener
  window.removeEventListener(
    "lastYearToday:hour-to-open-last-year-today-page:settingsChanged",
    () => {}
  );

  // Clean up custom styles
  const styleElement = document.getElementById("last-year-today-styles");
  if (styleElement) {
    styleElement.remove();
  }

  // Clean up observer
  if (cleanupObserver) {
    cleanupObserver();
    cleanupObserver = null;
  }

  // Clear update timer
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }

  console.log("Last Year Today plugin unloaded!");
};

export default {
  onload,
  onunload,
};
