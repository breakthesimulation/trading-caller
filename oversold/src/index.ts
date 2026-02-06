// Oversold/Overbought RSI Module
//
// Provides RSI-based signal detection for trading calls.
// Uses internal RSI calculation since oversold.lol has bot protection.

export * from './types.js';
export * from './scanner.js';
export * from './oversold-lol.js';

import {
  scanAllTokensRSI,
  getOversoldTokens,
  getOverboughtTokens,
  getTokenRSI,
  calculateRSISignalStrength,
  clearRSICache,
  getCacheStatus,
} from './scanner.js';

import { checkApiAvailability } from './oversold-lol.js';

// Export routes for API integration
export { default as rsiRoutes } from './routes.js';

// Re-export as default object for convenience
export default {
  // Main scanning functions
  scanAll: scanAllTokensRSI,
  getOversold: getOversoldTokens,
  getOverbought: getOverboughtTokens,
  getTokenRSI,
  
  // Signal strength calculation
  calculateSignalStrength: calculateRSISignalStrength,
  
  // Cache management
  clearCache: clearRSICache,
  getCacheStatus,
  
  // External API check
  checkExternalApiAvailability: checkApiAvailability,
};
