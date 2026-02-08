/**
 * Token Unlock Checker
 * Monitors upcoming token unlocks and their market impact
 */

import type { TokenUnlock } from './types.js';

// Mock unlock data - in production, this would fetch from TokenUnlocks.app API or similar
const KNOWN_UNLOCKS: Record<string, TokenUnlock[]> = {
  'SOL': [],
  'JUP': [
    {
      token: 'JUP',
      date: '2026-03-15T00:00:00Z',
      amount: 150000000,
      percentage: 15,
      category: 'Team',
      impact: 'HIGH',
    },
  ],
  'BONK': [],
  'WIF': [],
};

/**
 * Get upcoming unlocks for a token
 */
export function getUpcomingUnlocks(
  symbol: string,
  days: 7 | 30 = 30
): TokenUnlock[] {
  const unlocks = KNOWN_UNLOCKS[symbol] || [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  return unlocks.filter(unlock => {
    const unlockDate = new Date(unlock.date);
    return unlockDate <= cutoffDate && unlockDate >= new Date();
  });
}

/**
 * Calculate unlock impact score
 * Returns a score from -100 (very bearish) to 0 (neutral)
 */
export function calculateUnlockImpact(unlocks: TokenUnlock[]): number {
  if (unlocks.length === 0) return 0;
  
  let totalImpact = 0;
  
  for (const unlock of unlocks) {
    // Base impact on percentage and category
    let impact = unlock.percentage * -1; // Unlocks are generally bearish
    
    // Multiply by impact level
    const impactMultiplier = {
      'LOW': 0.5,
      'MEDIUM': 1.0,
      'HIGH': 1.5,
      'CRITICAL': 2.0,
    };
    
    impact *= impactMultiplier[unlock.impact];
    
    // Time decay - closer unlocks have more impact
    const daysUntil = Math.floor(
      (new Date(unlock.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntil <= 3) {
      impact *= 1.5;
    } else if (daysUntil <= 7) {
      impact *= 1.2;
    } else if (daysUntil <= 14) {
      impact *= 1.0;
    } else {
      impact *= 0.7;
    }
    
    totalImpact += impact;
  }
  
  // Clamp to -100
  return Math.max(-100, totalImpact);
}

/**
 * Get unlock analysis summary
 */
export function getUnlockSummary(symbol: string): {
  hasUpcomingUnlocks: boolean;
  impactScore: number;
  summary: string;
} {
  const unlocks7d = getUpcomingUnlocks(symbol, 7);
  const unlocks30d = getUpcomingUnlocks(symbol, 30);
  const impactScore = calculateUnlockImpact(unlocks30d);
  
  let summary = '';
  
  if (unlocks7d.length > 0) {
    const totalPercent = unlocks7d.reduce((sum, u) => sum + u.percentage, 0);
    summary = `⚠️ ${unlocks7d.length} unlock(s) in next 7 days (~${totalPercent.toFixed(1)}% supply)`;
  } else if (unlocks30d.length > 0) {
    summary = `${unlocks30d.length} unlock(s) in next 30 days`;
  } else {
    summary = `No major unlocks in next 30 days`;
  }
  
  return {
    hasUpcomingUnlocks: unlocks30d.length > 0,
    impactScore,
    summary,
  };
}
