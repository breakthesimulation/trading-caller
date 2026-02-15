/**
 * Emergency fix: Read real performance from tracked_signals.json
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export function getRealPerformance() {
  try {
    const dataPath = join(process.cwd(), 'data', 'tracked_signals.json');
    const data = JSON.parse(readFileSync(dataPath, 'utf8'));
    
    // Calculate real stats
    const total = data.length;
    const resolvedSignals = data.filter(s => s.pnlPercent !== undefined);
    const winningSignals = resolvedSignals.filter(s => s.pnlPercent > 0);
    const longSignals = data.filter(s => s.action === 'LONG');
    const shortSignals = data.filter(s => s.action === 'SHORT');
    const longWins = longSignals.filter(s => s.pnlPercent > 0);
    const shortWins = shortSignals.filter(s => s.pnlPercent > 0);
    
    const winRate = resolvedSignals.length > 0 ? (winningSignals.length / resolvedSignals.length) * 100 : 0;
    const totalPnl = resolvedSignals.reduce((sum, s) => sum + s.pnlPercent, 0);
    const longWinRate = longSignals.length > 0 ? (longWins.length / longSignals.length) * 100 : 0;
    const shortWinRate = shortSignals.length > 0 ? (shortWins.length / shortSignals.length) * 100 : 0;
    
    const activeSignals = data.filter(s => s.status === 'ACTIVE').length;
    const resolvedCount = data.filter(s => s.status !== 'ACTIVE').length;
    
    return {
      winRate: winRate.toFixed(1) + '%',
      totalPnL: (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(2) + '%',
      longWinRate: longWinRate.toFixed(1) + '%',
      shortWinRate: shortWinRate.toFixed(1) + '%',
      totalSignals: total,
      activeSignals,
      resolvedSignals: resolvedCount,
      profitFactor: totalPnl > 0 ? (totalPnl / Math.abs(totalPnl)).toFixed(2) + 'x' : '0.00x',
      rawData: {
        winRate: winRate,
        totalPnL: totalPnl,
        longWinRate: longWinRate,
        shortWinRate: shortWinRate,
        total,
        active: activeSignals,
        resolved: resolvedCount
      }
    };
  } catch (e) {
    console.error('Failed to read real performance:', e);
    return {
      winRate: '0.0%',
      totalPnL: '0.00%',
      longWinRate: '0.0%',
      shortWinRate: '0.0%',
      totalSignals: 0,
      activeSignals: 0,
      resolvedSignals: 0,
      profitFactor: '0.00x'
    };
  }
}