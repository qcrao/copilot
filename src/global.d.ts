// src/global.d.ts

declare global {
  interface Window {
    roamAlphaAPI: {
      q: (query: string) => any[];
      ui: {
        mainWindow: {
          getOpenPageOrBlockUid?: () => string | null | Promise<string | null>;
        };
        rightSidebar: {
          open: () => Promise<void>;
          close: () => Promise<void>;
          addWindow: (config: { window: any }) => Promise<void>;
          removeWindow: (config: { window: any }) => Promise<void>;
          getWindows?: () => Array<{
            "collapsed?": boolean;
            order: number;
            "page-uid"?: string;
            "block-uid"?: string;
            "pinned?"?: boolean;
            type: "outline" | "block";
            "window-id": string;
          }>;
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
      util: {
        generateUID: () => string;
      };
      createPage: (config: {
        page: {
          title: string;
          uid: string;
        };
      }) => Promise<void>;
      createBlock: (config: {
        location: {
          "parent-uid": string;
          order: number | "first" | "last";
        };
        block: {
          string: string;
          uid: string;
        };
      }) => Promise<void>;
      updateBlock: (config: {
        block: {
          uid: string;
          string: string;
        };
      }) => Promise<void>;
      deleteBlock: (config: {
        block: {
          uid: string;
        };
      }) => Promise<void>;
      deletePage: (config: {
        page: {
          uid: string;
        };
      }) => Promise<void>;
    };
  }
}

export {};