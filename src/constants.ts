// src/constants.ts
// DEPRECATED: This file has been consolidated into utils/shared/constants.ts
// Import from the new centralized constants file instead

import { CONTENT_LIMITS } from './utils/shared/constants';

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_MAP: { [key: string]: number } = MONTHS.reduce(
  (acc, month, index) => {
    acc[month] = index + 1;
    return acc;
  },
  {} as { [key: string]: number }
);

// Re-export for backward compatibility
export const BLOCK_PREVIEW_LENGTH = CONTENT_LIMITS.BLOCK_PREVIEW;
