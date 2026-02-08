/**
 * Position Manager
 * Handles position lifecycle: creation, monitoring, updates, closure
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Position, PositionStatus, PositionUpdate, PositionStats } from './types.js';
import type { TradingSignal } from '../research-engine/src/signals/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', 'data');
const positionsFile = join(dataDir, 'positions.json');

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// In-memory cache
let positions: Position[] = [];

/**
 * Load positions from disk
 */
function loadPositions(): Position[] {
  try {
    if (existsSync(positionsFile)) {
      const data = readFileSync(positionsFile, 'utf-8');
      positions = JSON.parse(data);
      return positions;
    }
  } catch (error) {
    console.error('[PositionManager] Failed to load positions:', error);
  }
  positions = [];
  return positions;
}

/**
 * Save positions to disk
 */
function savePositions(): void {
  try {
    writeFileSync(positionsFile, JSON.stringify(positions, null, 2));
  } catch (error) {
    console.error('[PositionManager] Failed to save positions:', error);
  }
}

/**
 * Create a new position from a trading signal
 */
export function createPosition(signal: TradingSignal): Position {
  const now = new Date().toISOString();
  
  const position: Position = {
    id: `pos_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    signalId: signal.id,
    
    tokenSymbol: signal.token.symbol,
    tokenAddress: signal.token.address,
    tokenName: signal.token.name,
    
    side: signal.action as 'LONG' | 'SHORT',
    status: 'WAITING',
    
    entryTarget: signal.entry,
    stopLoss: signal.stopLoss,
    targets: signal.targets,
    
    signalTime: signal.timestamp,
    
    riskLevel: signal.riskLevel,
    confidence: signal.confidence,
    timeframe: signal.timeframe,
    reasoning: signal.reasoning,
    
    createdAt: now,
    updatedAt: now,
  };
  
  positions.push(position);
  savePositions();
  
  console.log(`[PositionManager] Created position ${position.id} for ${signal.token.symbol} ${signal.action}`);
  
  return position;
}

/**
 * Update a position
 */
export function updatePosition(positionId: string, update: PositionUpdate): Position | null {
  const position = positions.find(p => p.id === positionId);
  
  if (!position) {
    console.error(`[PositionManager] Position ${positionId} not found`);
    return null;
  }
  
  // Apply updates
  Object.assign(position, update);
  position.updatedAt = new Date().toISOString();
  
  // Calculate time in position if closed
  if (update.exitTime && position.entryTime) {
    position.timeInPosition = new Date(update.exitTime).getTime() - new Date(position.entryTime).getTime();
  }
  
  savePositions();
  
  console.log(`[PositionManager] Updated position ${positionId}: status=${position.status}`);
  
  return position;
}

/**
 * Mark position as entered
 */
export function enterPosition(positionId: string, entryPrice: number): Position | null {
  return updatePosition(positionId, {
    status: 'ACTIVE',
    entryActual: entryPrice,
    entryTime: new Date().toISOString(),
  });
}

/**
 * Update current price for active position
 */
export function updateCurrentPrice(positionId: string, currentPrice: number): Position | null {
  const position = positions.find(p => p.id === positionId);
  
  if (!position || position.status !== 'ACTIVE') {
    return null;
  }
  
  const entryPrice = position.entryActual || position.entryTarget;
  
  // Calculate P&L
  let pnlPercent = 0;
  if (position.side === 'LONG') {
    pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
  }
  
  return updatePosition(positionId, {
    currentPrice,
    pnlPercent,
  });
}

/**
 * Close position
 */
export function closePosition(
  positionId: string,
  exitPrice: number,
  status: 'PROFITABLE' | 'LOSS' | 'STOPPED_OUT'
): Position | null {
  const position = positions.find(p => p.id === positionId);
  
  if (!position) {
    return null;
  }
  
  const entryPrice = position.entryActual || position.entryTarget;
  
  // Calculate final P&L
  let pnlPercent = 0;
  if (position.side === 'LONG') {
    pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
  }
  
  const roi = pnlPercent;
  
  return updatePosition(positionId, {
    status,
    exitPrice,
    exitTime: new Date().toISOString(),
    pnlPercent,
    roi,
  });
}

/**
 * Check if position should be stopped out
 */
export function checkStopLoss(position: Position, currentPrice: number): boolean {
  if (position.status !== 'ACTIVE') {
    return false;
  }
  
  if (position.side === 'LONG') {
    return currentPrice <= position.stopLoss;
  } else {
    return currentPrice >= position.stopLoss;
  }
}

/**
 * Check if position hit target
 */
export function checkTargets(position: Position, currentPrice: number): number | null {
  if (position.status !== 'ACTIVE') {
    return null;
  }
  
  for (const target of position.targets) {
    if (position.side === 'LONG' && currentPrice >= target) {
      return target;
    }
    if (position.side === 'SHORT' && currentPrice <= target) {
      return target;
    }
  }
  
  return null;
}

/**
 * Get position by ID
 */
export function getPosition(positionId: string): Position | null {
  return positions.find(p => p.id === positionId) || null;
}

/**
 * Get all positions
 */
export function getAllPositions(): Position[] {
  return [...positions];
}

/**
 * Get positions by status
 */
export function getPositionsByStatus(status: PositionStatus): Position[] {
  return positions.filter(p => p.status === status);
}

/**
 * Get positions by token
 */
export function getPositionsByToken(tokenSymbol: string): Position[] {
  return positions.filter(p => p.tokenSymbol === tokenSymbol);
}

/**
 * Get active positions
 */
export function getActivePositions(): Position[] {
  return positions.filter(p => p.status === 'ACTIVE');
}

/**
 * Get position statistics
 */
export function getPositionStats(): PositionStats {
  const waiting = positions.filter(p => p.status === 'WAITING').length;
  const active = positions.filter(p => p.status === 'ACTIVE').length;
  const profitable = positions.filter(p => p.status === 'PROFITABLE').length;
  const loss = positions.filter(p => p.status === 'LOSS').length;
  const stoppedOut = positions.filter(p => p.status === 'STOPPED_OUT').length;
  
  const closedPositions = positions.filter(p => 
    p.status === 'PROFITABLE' || p.status === 'LOSS' || p.status === 'STOPPED_OUT'
  );
  
  const totalPnl = closedPositions.reduce((sum, p) => sum + (p.pnlPercent || 0), 0);
  const avgPnlPercent = closedPositions.length > 0 ? totalPnl / closedPositions.length : 0;
  const winRate = closedPositions.length > 0 
    ? (profitable / closedPositions.length) * 100 
    : 0;
  
  const activeCapitalAtRisk = active; // TODO: Calculate based on position size
  
  const positionsWithTime = closedPositions.filter(p => p.timeInPosition);
  const avgTimeInPosition = positionsWithTime.length > 0
    ? positionsWithTime.reduce((sum, p) => sum + (p.timeInPosition || 0), 0) / positionsWithTime.length
    : 0;
  
  return {
    total: positions.length,
    waiting,
    active,
    profitable,
    loss,
    stoppedOut,
    totalPnl,
    totalPnlPercent: totalPnl,
    avgPnlPercent,
    winRate,
    activeCapitalAtRisk,
    avgTimeInPosition,
  };
}

/**
 * Delete position (for testing/cleanup)
 */
export function deletePosition(positionId: string): boolean {
  const index = positions.findIndex(p => p.id === positionId);
  
  if (index >= 0) {
    positions.splice(index, 1);
    savePositions();
    console.log(`[PositionManager] Deleted position ${positionId}`);
    return true;
  }
  
  return false;
}

// Initialize on module load
loadPositions();

console.log(`[PositionManager] Loaded ${positions.length} positions`);
