/**
 * Unit tests for the determineOutcome logic from learning/tracker.ts
 *
 * The determineOutcome function is private (not exported), so we mirror its
 * logic here and validate the business rules for trade outcome determination.
 *
 * PnL formula:
 *   rawPnl  = ((currentPrice - entryPrice) / entryPrice) * 100
 *   adjustedPnl = action === 'SHORT' ? -rawPnl : rawPnl
 *
 * Outcome rules:
 *   LONG  + currentPrice <= stopLoss    → LOSS
 *   SHORT + currentPrice >= stopLoss    → LOSS
 *   LONG  + currentPrice >= target[0]   → WIN
 *   SHORT + currentPrice <= target[0]   → WIN
 *   Otherwise                           → NEUTRAL
 */

import { describe, it, expect } from 'vitest';

// Mirror of the private determineOutcome function from tracker.ts
// Kept in sync with the source to validate our understanding of the logic.
function determineOutcome(
  action: string,
  entryPrice: number,
  currentPrice: number,
  targetPrices: number[],
  stopLoss: number
): { outcome: 'WIN' | 'LOSS' | 'NEUTRAL'; pnlPercent: number } {
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

  // Adjust for direction
  const adjustedPnl = action === 'SHORT' ? -pnlPercent : pnlPercent;

  // Check if stop loss was hit
  if (action === 'LONG' && currentPrice <= stopLoss) {
    return { outcome: 'LOSS', pnlPercent: adjustedPnl };
  }
  if (action === 'SHORT' && currentPrice >= stopLoss) {
    return { outcome: 'LOSS', pnlPercent: adjustedPnl };
  }

  // Check if first target was hit
  const firstTarget = targetPrices[0];
  if (action === 'LONG' && currentPrice >= firstTarget) {
    return { outcome: 'WIN', pnlPercent: adjustedPnl };
  }
  if (action === 'SHORT' && currentPrice <= firstTarget) {
    return { outcome: 'WIN', pnlPercent: adjustedPnl };
  }

  // Neither target nor stop hit
  return { outcome: 'NEUTRAL', pnlPercent: adjustedPnl };
}

// ---------------------------------------------------------------------------
// LONG position tests
// ---------------------------------------------------------------------------
describe('determineOutcome — LONG positions', () => {
  it('returns WIN when current price exceeds first target', () => {
    const result = determineOutcome('LONG', 100, 115, [110, 120, 130], 90);

    expect(result.outcome).toBe('WIN');
    expect(result.pnlPercent).toBeCloseTo(15);
  });

  it('returns LOSS when current price falls to stop loss', () => {
    const result = determineOutcome('LONG', 100, 85, [110], 90);

    expect(result.outcome).toBe('LOSS');
    expect(result.pnlPercent).toBeCloseTo(-15);
  });

  it('returns NEUTRAL when price is between stop and target', () => {
    const result = determineOutcome('LONG', 100, 105, [110], 90);

    expect(result.outcome).toBe('NEUTRAL');
    expect(result.pnlPercent).toBeCloseTo(5);
  });

  it('returns LOSS when current price is exactly at stop loss', () => {
    const result = determineOutcome('LONG', 100, 90, [110], 90);

    expect(result.outcome).toBe('LOSS');
    expect(result.pnlPercent).toBeCloseTo(-10);
  });

  it('returns WIN when current price is exactly at first target', () => {
    const result = determineOutcome('LONG', 100, 110, [110], 90);

    expect(result.outcome).toBe('WIN');
    expect(result.pnlPercent).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// SHORT position tests
// ---------------------------------------------------------------------------
describe('determineOutcome — SHORT positions', () => {
  it('returns WIN when current price drops below first target', () => {
    const result = determineOutcome('SHORT', 100, 85, [90, 80, 70], 110);

    expect(result.outcome).toBe('WIN');
    // rawPnl = -15%, adjustedPnl = +15% (short profits from price drop)
    expect(result.pnlPercent).toBeCloseTo(15);
  });

  it('returns LOSS when current price rises above stop loss', () => {
    const result = determineOutcome('SHORT', 100, 115, [90], 110);

    expect(result.outcome).toBe('LOSS');
    // rawPnl = +15%, adjustedPnl = -15% (short loses when price rises)
    expect(result.pnlPercent).toBeCloseTo(-15);
  });

  it('returns NEUTRAL when price is between target and stop', () => {
    const result = determineOutcome('SHORT', 100, 95, [90], 110);

    expect(result.outcome).toBe('NEUTRAL');
    // rawPnl = -5%, adjustedPnl = +5% (short is slightly profitable)
    expect(result.pnlPercent).toBeCloseTo(5);
  });

  it('returns LOSS when current price is exactly at stop loss', () => {
    const result = determineOutcome('SHORT', 100, 110, [90], 110);

    expect(result.outcome).toBe('LOSS');
    // rawPnl = +10%, adjustedPnl = -10%
    expect(result.pnlPercent).toBeCloseTo(-10);
  });

  it('returns WIN when current price is exactly at first target', () => {
    const result = determineOutcome('SHORT', 100, 90, [90], 110);

    expect(result.outcome).toBe('WIN');
    // rawPnl = -10%, adjustedPnl = +10%
    expect(result.pnlPercent).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// PnL calculation tests
// ---------------------------------------------------------------------------
describe('determineOutcome — PnL calculations', () => {
  it('calculates positive PnL for LONG when price goes up', () => {
    const result = determineOutcome('LONG', 50, 60, [70], 40);

    expect(result.pnlPercent).toBeCloseTo(20); // (60-50)/50 * 100 = 20%
  });

  it('calculates negative PnL for LONG when price goes down', () => {
    const result = determineOutcome('LONG', 200, 180, [250], 170);

    expect(result.pnlPercent).toBeCloseTo(-10); // (180-200)/200 * 100 = -10%
  });

  it('calculates positive adjusted PnL for SHORT when price drops', () => {
    const result = determineOutcome('SHORT', 200, 160, [170], 220);

    // rawPnl = (160-200)/200 * 100 = -20%, adjustedPnl = 20%
    expect(result.pnlPercent).toBeCloseTo(20);
  });

  it('calculates negative adjusted PnL for SHORT when price rises', () => {
    const result = determineOutcome('SHORT', 50, 55, [40], 60);

    // rawPnl = (55-50)/50 * 100 = 10%, adjustedPnl = -10%
    expect(result.pnlPercent).toBeCloseTo(-10);
  });

  it('returns zero PnL when current price equals entry price', () => {
    const result = determineOutcome('LONG', 100, 100, [110], 90);

    expect(result.pnlPercent).toBeCloseTo(0);
    expect(result.outcome).toBe('NEUTRAL');
  });

  it('returns zero PnL for SHORT when current price equals entry price', () => {
    const result = determineOutcome('SHORT', 100, 100, [90], 110);

    expect(result.pnlPercent).toBeCloseTo(0);
    expect(result.outcome).toBe('NEUTRAL');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('determineOutcome — edge cases', () => {
  it('uses only the first target for WIN determination', () => {
    // Price is above target[0] but below target[1] — still a WIN
    const result = determineOutcome('LONG', 100, 115, [110, 120, 130], 90);

    expect(result.outcome).toBe('WIN');
  });

  it('handles very small price movements correctly', () => {
    const result = determineOutcome('LONG', 100, 100.001, [110], 90);

    expect(result.outcome).toBe('NEUTRAL');
    expect(result.pnlPercent).toBeCloseTo(0.001);
  });

  it('handles large price swings correctly', () => {
    const result = determineOutcome('LONG', 1, 10, [5], 0.5);

    expect(result.outcome).toBe('WIN');
    expect(result.pnlPercent).toBeCloseTo(900); // 9x gain = 900%
  });

  it('handles very low-priced tokens (sub-cent)', () => {
    const result = determineOutcome(
      'LONG',
      0.000001,
      0.000002,
      [0.0000015],
      0.0000005
    );

    expect(result.outcome).toBe('WIN');
    expect(result.pnlPercent).toBeCloseTo(100); // doubled in price
  });

  it('LONG: stop loss takes precedence when price is below both stop and target', () => {
    // Unusual setup: target is below stop (mis-configured), price is below both
    // The stop-loss check runs first in the code, so LOSS wins
    const result = determineOutcome('LONG', 100, 80, [85], 90);

    expect(result.outcome).toBe('LOSS');
  });

  it('SHORT: stop loss takes precedence when price is above both stop and target', () => {
    // Unusual setup: target is above stop (mis-configured), price is above both
    const result = determineOutcome('SHORT', 100, 120, [115], 110);

    expect(result.outcome).toBe('LOSS');
  });

  it('handles single-element target array', () => {
    const result = determineOutcome('LONG', 100, 115, [110], 90);

    expect(result.outcome).toBe('WIN');
    expect(result.pnlPercent).toBeCloseTo(15);
  });
});
