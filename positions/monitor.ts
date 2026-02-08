/**
 * Position Monitor
 * Real-time monitoring of active positions for stop-loss and target hits
 */

import * as manager from './manager.js';
import { fetchTokenPrice } from '../research-engine/src/data/birdeye.js';

let monitorInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Monitor active positions
 */
async function monitorPositions(): Promise<void> {
  const activePositions = manager.getActivePositions();
  
  if (activePositions.length === 0) {
    return;
  }
  
  console.log(`[PositionMonitor] Checking ${activePositions.length} active positions...`);
  
  for (const position of activePositions) {
    try {
      // Fetch current price
      const currentPrice = await fetchTokenPrice(position.tokenAddress);
      
      if (!currentPrice) {
        console.warn(`[PositionMonitor] No price for ${position.tokenSymbol}`);
        continue;
      }
      
      // Update current price
      manager.updateCurrentPrice(position.id, currentPrice);
      
      // Check stop loss
      if (manager.checkStopLoss(position, currentPrice)) {
        console.log(`[PositionMonitor] 🛑 Stop loss hit for ${position.tokenSymbol} @ $${currentPrice}`);
        manager.closePosition(position.id, currentPrice, 'STOPPED_OUT');
        continue;
      }
      
      // Check targets
      const hitTarget = manager.checkTargets(position, currentPrice);
      if (hitTarget) {
        console.log(`[PositionMonitor] 🎯 Target hit for ${position.tokenSymbol} @ $${currentPrice}`);
        
        const entryPrice = position.entryActual || position.entryTarget;
        const isProfitable = position.side === 'LONG' 
          ? currentPrice > entryPrice 
          : currentPrice < entryPrice;
        
        manager.closePosition(
          position.id, 
          currentPrice, 
          isProfitable ? 'PROFITABLE' : 'LOSS'
        );
      }
      
    } catch (error) {
      console.error(`[PositionMonitor] Error monitoring ${position.tokenSymbol}:`, error);
    }
  }
}

/**
 * Start position monitoring
 */
export function startMonitoring(intervalMs: number = 60000): void {
  if (isRunning) {
    console.log('[PositionMonitor] Already running');
    return;
  }
  
  console.log(`[PositionMonitor] Starting with interval: ${intervalMs}ms`);
  
  isRunning = true;
  monitorInterval = setInterval(monitorPositions, intervalMs);
  
  // Run immediately
  monitorPositions();
}

/**
 * Stop position monitoring
 */
export function stopMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  
  isRunning = false;
  console.log('[PositionMonitor] Stopped');
}

/**
 * Get monitoring status
 */
export function getMonitoringStatus(): {
  running: boolean;
  activePositions: number;
} {
  return {
    running: isRunning,
    activePositions: manager.getActivePositions().length,
  };
}

/**
 * Manual monitor trigger
 */
export async function triggerMonitor(): Promise<void> {
  await monitorPositions();
}
