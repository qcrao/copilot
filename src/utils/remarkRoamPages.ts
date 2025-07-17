// src/utils/remarkRoamPages.ts
// DEPRECATED: This file has been consolidated into remarkRoam.ts
// Use remarkRoam instead for all Roam syntax processing

import remarkRoam from './roam/remarkRoam';
import type { RoamPageNode } from './roam/remarkRoam';

// Re-export for backward compatibility
const remarkRoamPages = remarkRoam;

export default remarkRoamPages;
export type { RoamPageNode };