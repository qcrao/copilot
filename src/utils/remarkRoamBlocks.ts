// src/utils/remarkRoamBlocks.ts
// DEPRECATED: This file has been consolidated into remarkRoam.ts
// Use remarkRoam instead for all Roam syntax processing

import remarkRoam from './roam/remarkRoam';
import type { RoamBlockNode } from './roam/remarkRoam';

// Re-export for backward compatibility
const remarkRoamBlocks = remarkRoam;

export default remarkRoamBlocks;
export type { RoamBlockNode };