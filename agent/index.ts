/**
 * Agent Module - Main Export
 * 
 * Re-exports all agent functionality for easy importing.
 */

export * from './hackathon.js';
export { default as hackathon } from './hackathon.js';

export * from './heartbeat.js';
export { default as heartbeat } from './heartbeat.js';

export * from './forum.js';
export { default as forum } from './forum.js';

export * from './brain.js';
export { default as brain } from './brain.js';

// Default export with all modules
export default {
  hackathon: await import('./hackathon.js').then(m => m.default),
  heartbeat: await import('./heartbeat.js').then(m => m.default),
  forum: await import('./forum.js').then(m => m.default),
  brain: await import('./brain.js').then(m => m.default),
};
