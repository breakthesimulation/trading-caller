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

// Note: Import modules directly from their files if needed
// Top-level await default export removed for Railway compatibility
