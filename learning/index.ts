/**
 * Learning Module - Main Export
 * 
 * Re-exports all learning functionality.
 */

export * from './tracker.js';
export { default as tracker } from './tracker.js';

export * from './learner.js';
export { default as learner } from './learner.js';

// Note: Import tracker/learner directly from their modules if needed
// Lazy async initialization removed to prevent top-level await issues
