/**
 * Position Tracking Types
 * Comprehensive position lifecycle management
 */

export type PositionStatus = 
  | 'WAITING'      // Limit order pending, entry not hit yet
  | 'ACTIVE'       // Position open, in trade now
  | 'PROFITABLE'   // Closed with profit
  | 'LOSS'         // Closed with loss
  | 'STOPPED_OUT'; // Hit stop loss

export type PositionSide = 'LONG' | 'SHORT';

export interface Position {
  id: string;
  signalId: string;
  
  // Token info
  tokenSymbol: string;
  tokenAddress: string;
  tokenName?: string;
  
  // Position details
  side: PositionSide;
  status: PositionStatus;
  
  // Pricing
  entryTarget: number;      // Original signal entry price
  entryActual?: number;     // Actual entry price (when filled)
  currentPrice?: number;    // Current market price (for active positions)
  exitPrice?: number;       // Exit price (when closed)
  stopLoss: number;
  targets: number[];        // Take profit targets
  
  // P&L
  pnlUsd?: number;         // Profit/loss in USD
  pnlPercent?: number;     // Profit/loss in %
  roi?: number;            // Return on investment
  
  // Timing
  signalTime: string;      // When signal was generated
  entryTime?: string;      // When position was entered
  exitTime?: string;       // When position was closed
  timeInPosition?: number; // Milliseconds in position
  
  // Risk management
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;      // Original signal confidence
  
  // Metadata
  timeframe: string;
  reasoning?: {
    technical: string;
    fundamental: string;
    sentiment: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

export interface PositionStats {
  total: number;
  waiting: number;
  active: number;
  profitable: number;
  loss: number;
  stoppedOut: number;
  
  // Performance
  totalPnl: number;
  totalPnlPercent: number;
  avgPnlPercent: number;
  winRate: number;
  
  // Active positions
  activeCapitalAtRisk: number;
  avgTimeInPosition: number;
}

export interface PositionUpdate {
  status?: PositionStatus;
  entryActual?: number;
  currentPrice?: number;
  exitPrice?: number;
  pnlUsd?: number;
  pnlPercent?: number;
  roi?: number;
  entryTime?: string;
  exitTime?: string;
}
