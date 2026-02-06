/**
 * Performance Module - Signal Tracking & Analytics
 * 
 * Tracks trading signal outcomes and provides performance analytics.
 */

export * from './types.js';
export { storage } from './storage.js';
export { performanceTracker } from './tracker.js';
export { performanceScheduler } from './scheduler.js';

// Default export for convenience
import { performanceTracker } from './tracker.js';
import { performanceScheduler } from './scheduler.js';
import { storage } from './storage.js';

export default {
  tracker: performanceTracker,
  scheduler: performanceScheduler,
  storage,
};
