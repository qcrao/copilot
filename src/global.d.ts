// src/global.d.ts

declare global {
  interface Window {
    roamAlphaAPI: {
      q: (query: string) => any[];
      ui: {
        mainWindow: {
          getOpenPageOrBlockUid?: () => string | null;
        };
        rightSidebar: {
          open: () => Promise<void>;
          close: () => Promise<void>;
          addWindow: (config: { window: any }) => Promise<void>;
          removeWindow: (config: { window: any }) => Promise<void>;
        };
        commandPalette: {
          addCommand: (config: {
            label: string;
            callback: () => void;
          }) => void;
        };
      };
      data: {
        q: (query: string) => any[];
      };
    };
  }
}

export {};