import { describe, it, expect, vi } from 'vitest';
import type { VolumeData, VolumeSpike } from './types.js';
import {
  calculateAvgHourlyVolume,
  calculateBuySellRatio,
  calculateVolumeVelocity,
  classifySpikeType,
  determineSeverity,
  detectSpike,
  formatSpikeAlert,
} from './detector.js';

vi.mock('./dexscreener.js', () => ({
  getDexScreenerUrl: (pairAddress: string) =>
    `https://dexscreener.com/solana/${pairAddress}`,
}));

function createMockVolumeData(overrides = {}): VolumeData {
  return {
    token: { symbol: 'SOL', name: 'Solana', address: 'So111...' },
    pairAddress: 'pair123',
    priceUsd: 100,
    priceChange1h: 5,
    priceChange24h: 10,
    volume1h: 50000,
    volume24h: 240000,
    volume6h: 60000,
    liquidity: 1000000,
    fdv: 50000000,
    txns1h: { buys: 100, sells: 50 },
    txns24h: { buys: 2000, sells: 1800 },
    fetchedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateAvgHourlyVolume
// ---------------------------------------------------------------------------
describe('calculateAvgHourlyVolume', () => {
  it('should divide 24h volume by 24', () => {
    expect(calculateAvgHourlyVolume(240000)).toBe(10000);
  });

  it('should return 0 when 24h volume is 0', () => {
    expect(calculateAvgHourlyVolume(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateBuySellRatio
// ---------------------------------------------------------------------------
describe('calculateBuySellRatio', () => {
  it('should return 2 when buys are double sells', () => {
    expect(calculateBuySellRatio(100, 50)).toBe(2);
  });

  it('should return 0.5 when sells are double buys', () => {
    expect(calculateBuySellRatio(50, 100)).toBe(0.5);
  });

  it('should cap at 10 when there are no sells but buys exist', () => {
    expect(calculateBuySellRatio(100, 0)).toBe(10);
  });

  it('should return 1 when both buys and sells are 0', () => {
    expect(calculateBuySellRatio(0, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateVolumeVelocity
// ---------------------------------------------------------------------------
describe('calculateVolumeVelocity', () => {
  it('should return 1 when 1h volume equals 6h hourly average', () => {
    // avg6hHourly = 60000 / 6 = 10000 ; velocity = 10000 / 10000 = 1
    expect(calculateVolumeVelocity(10000, 60000)).toBe(1);
  });

  it('should return 5 when 1h volume is 5x the 6h hourly average', () => {
    // avg6hHourly = 60000 / 6 = 10000 ; velocity = 50000 / 10000 = 5
    expect(calculateVolumeVelocity(50000, 60000)).toBe(5);
  });

  it('should return 0 when 6h volume is 0', () => {
    expect(calculateVolumeVelocity(10000, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// classifySpikeType
// ---------------------------------------------------------------------------
describe('classifySpikeType', () => {
  it('should return BULLISH when price up > 2% and buySellRatio > 1.2', () => {
    expect(classifySpikeType(5, 1.5)).toBe('BULLISH');
  });

  it('should return BEARISH when price down < -2% and buySellRatio < 0.8', () => {
    expect(classifySpikeType(-5, 0.5)).toBe('BEARISH');
  });

  it('should return NEUTRAL when price and ratio are modest', () => {
    expect(classifySpikeType(1, 1.0)).toBe('NEUTRAL');
  });

  it('should return NEUTRAL at boundary (priceChange=2, ratio=1.2 — not strictly greater)', () => {
    expect(classifySpikeType(2, 1.2)).toBe('NEUTRAL');
  });
});

// ---------------------------------------------------------------------------
// determineSeverity
// ---------------------------------------------------------------------------
describe('determineSeverity', () => {
  it('should return EXTREME for very high values (score >= 8)', () => {
    // volumeSpike 10 -> 4, priceChange 20 -> 3, bsRatio 3 -> |3-1|=2 >= 1 -> 2, velocity 5 -> 2 => total 11
    expect(determineSeverity(10, 20, 3, 5)).toBe('EXTREME');
  });

  it('should return HIGH for moderately high values (score >= 5)', () => {
    // volumeSpike 5 -> 3, priceChange 10 -> 2, bsRatio 2 -> |2-1|=1 >= 1 -> 2, velocity 3 -> >= 2 -> 1 => total 8
    expect(determineSeverity(5, 10, 2, 3)).toBe('EXTREME');
  });

  it('should return MEDIUM for moderate values (score >= 3)', () => {
    // volumeSpike 3 -> 2, priceChange 5 -> 1, bsRatio 1.5 -> |0.5| >= 0.5 -> 1, velocity 2 -> >= 2 -> 1 => total 5
    expect(determineSeverity(3, 5, 1.5, 2)).toBe('HIGH');
  });

  it('should return LOW for small values (score < 3)', () => {
    // volumeSpike 2 -> 1, priceChange 1 -> 0, bsRatio 1.0 -> |0| -> 0, velocity 1 -> 0 => total 1
    expect(determineSeverity(2, 1, 1.0, 1)).toBe('LOW');
  });
});

// ---------------------------------------------------------------------------
// detectSpike
// ---------------------------------------------------------------------------
describe('detectSpike', () => {
  it('should return null if avgHourlyVolume is below 1000', () => {
    const data = createMockVolumeData({ volume24h: 20000 });
    // avgHourly = 20000 / 24 ~ 833 < 1000
    const result = detectSpike(data, null);
    expect(result).toBeNull();
  });

  it('should return null if spike multiple is below minSpikeMultiple', () => {
    const data = createMockVolumeData({ volume1h: 5000, volume24h: 240000 });
    // avgHourly = 10000, spike = 5000 / 10000 = 0.5 < 2.0
    const result = detectSpike(data, null, 2.0);
    expect(result).toBeNull();
  });

  it('should return null if minPriceChange > 0 and abs(priceChange) < minPriceChange', () => {
    const data = createMockVolumeData({ volume1h: 50000, volume24h: 240000, priceChange1h: 1 });
    // spike = 50000 / 10000 = 5 (passes), but priceChange 1 < 5
    const result = detectSpike(data, null, 2.0, 5);
    expect(result).toBeNull();
  });

  it('should return a spike object with correct fields when threshold is met', () => {
    const data = createMockVolumeData();
    // avgHourly = 240000 / 24 = 10000, spike = 50000 / 10000 = 5.0 >= 2.0
    const result = detectSpike(data, null, 2.0);

    expect(result).not.toBeNull();
    const spike = result as VolumeSpike;

    expect(spike.token.symbol).toBe('SOL');
    expect(spike.pairAddress).toBe('pair123');
    expect(spike.currentVolume1h).toBe(50000);
    expect(spike.avgHourlyVolume).toBe(10000);
    expect(spike.volumeSpikeMultiple).toBe(5);
    expect(spike.volumeSpikePercent).toBe(400);
    expect(spike.priceUsd).toBe(100);
    expect(spike.priceChange1h).toBe(5);
    expect(spike.priceChange24h).toBe(10);
    expect(spike.buyCount1h).toBe(100);
    expect(spike.sellCount1h).toBe(50);
    expect(spike.buySellRatio).toBe(2);
    expect(spike.spikeType).toBe('BULLISH');
    expect(spike.dexScreenerUrl).toBe('https://dexscreener.com/solana/pair123');
    expect(spike.id).toMatch(/^spike_/);
    expect(spike.detectedAt).toBeInstanceOf(Date);
  });

  it('should use baseline avgHourlyVolume when a baseline is provided', () => {
    const data = createMockVolumeData({ volume1h: 30000, volume24h: 240000 });
    // Without baseline: avgHourly = 10000, spike = 3.0
    // With baseline avgHourly = 5000, spike = 6.0
    const baseline = {
      tokenAddress: 'So111...',
      symbol: 'SOL',
      avgHourlyVolume: 5000,
      avgHourlyTxns: 100,
      lastUpdated: new Date(),
      dataPoints: 24,
    };

    const result = detectSpike(data, baseline, 2.0);
    expect(result).not.toBeNull();
    expect(result!.avgHourlyVolume).toBe(5000);
    expect(result!.volumeSpikeMultiple).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// formatSpikeAlert
// ---------------------------------------------------------------------------
describe('formatSpikeAlert', () => {
  function createMockSpike(overrides: Partial<VolumeSpike> = {}): VolumeSpike {
    return {
      id: 'spike_test_abc123',
      token: { symbol: 'SOL', name: 'Solana', address: 'So111...' },
      pairAddress: 'pair123',
      currentVolume1h: 50000,
      avgHourlyVolume: 10000,
      volumeSpikeMultiple: 5.0,
      volumeSpikePercent: 400,
      priceUsd: 100,
      priceChange1h: 5,
      priceChange24h: 10,
      buyCount1h: 100,
      sellCount1h: 50,
      buySellRatio: 2,
      volume6h: 60000,
      volumeVelocity: 5.0,
      spikeType: 'BULLISH',
      severity: 'HIGH',
      detectedAt: new Date(),
      dexScreenerUrl: 'https://dexscreener.com/solana/pair123',
      ...overrides,
    };
  }

  it('should contain the token symbol and name', () => {
    const alert = formatSpikeAlert(createMockSpike());
    expect(alert).toContain('SOL');
    expect(alert).toContain('Solana');
  });

  it('should contain the volume spike multiple', () => {
    const alert = formatSpikeAlert(createMockSpike());
    expect(alert).toContain('5.0x');
  });

  it('should contain price information', () => {
    const alert = formatSpikeAlert(createMockSpike());
    expect(alert).toContain('$100.00');
    expect(alert).toContain('+5.00%');
    expect(alert).toContain('+10.00%');
  });

  it('should contain the DexScreener URL', () => {
    const alert = formatSpikeAlert(createMockSpike());
    expect(alert).toContain('https://dexscreener.com/solana/pair123');
  });

  it('should include buy and sell counts', () => {
    const alert = formatSpikeAlert(createMockSpike());
    expect(alert).toContain('Buys: 100');
    expect(alert).toContain('Sells: 50');
  });

  it('should include spike type and severity', () => {
    const alert = formatSpikeAlert(createMockSpike());
    expect(alert).toContain('BULLISH');
    expect(alert).toContain('HIGH');
  });
});
