// src/types.ts
export interface HistoricalPage {
  date: Date;
  uid: string;
}

export interface RoamWindow {
  type: string;
  "block-uid": string;
  title: string;
}
