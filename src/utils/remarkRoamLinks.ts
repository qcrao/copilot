// src/utils/remarkRoamLinks.ts
// DEPRECATED: This file has been consolidated into remarkRoam.ts
// Use remarkRoam instead for all Roam syntax processing

import remarkRoam from './roam/remarkRoam';
import type { RoamBlockNode } from './roam/remarkRoam';

// Re-export for backward compatibility
const remarkRoamLinks = remarkRoam;
type RoamLinkNode = RoamBlockNode; // For backward compatibility

export default remarkRoamLinks;
export type { RoamLinkNode };