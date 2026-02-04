/**
 * Learning Module - Main Export
 * 
 * Re-exports all learning functionality.
 */

export * from './tracker.js';
export { default as tracker } from './tracker.js';

export * from './learner.js';
export { default as learner } from './learner.js';

export default {
  tracker: await import('./tracker.js').then(m => m.default),
  learner: await import('./learner.js').then(m => m.default),
};
