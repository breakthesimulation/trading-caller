import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSignal, generateSignals } from './generator.js';
import { runTechnicalAnalysis, getTechnicalSentiment } from '../technical/index.js';
import type { OHLCV, TechnicalAnalysis } from './types.js';

vi.mock('../technical/index.js', () => ({
  runTechnicalAnalysis: vi.fn(),
  getTechnicalSentiment: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Token {
  symbol: string;
  address: string;
  name: string;
  decimals?: number;
}

function createOHLCV(close: number): OHLCV[] {
  return [
    {
      timestamp: Date.now(),
      open: close * 0.99,
      high: close * 1.01,
      low: close * 0.98,
      close,
      volume: 1_000_000,
    },
  ];
}

function createAnalysis(
  overrides: Partial<TechnicalAnalysis> = {},
): { analysis: TechnicalAnalysis; summary: string } {
  const defaults: TechnicalAnalysis = {
    rsi: { value: 50, signal: 'NEUTRAL' },
    macd: {
      macd: 0,
      signal: 0,
      histogram: 0,
      trend: 'NEUTRAL',
      crossover: null,
    },
    trend: {
      direction: 'SIDEWAYS',
      strength: 50,
      ema20: 100,
      ema50: 100,
      ema200: 100,
    },
    support: [95],
    resistance: [105],
    momentum: { value: 0, increasing: false },
  };

  const analysis: TechnicalAnalysis = {
    ...defaults,
    ...overrides,
    rsi: { ...defaults.rsi, ...(overrides.rsi ?? {}) },
    macd: { ...defaults.macd, ...(overrides.macd ?? {}) },
    trend: { ...defaults.trend, ...(overrides.trend ?? {}) },
    momentum: { ...defaults.momentum, ...(overrides.momentum ?? {}) },
  };

  return { analysis, summary: 'Test analysis summary' };
}

interface SignalInput {
  token: Token;
  ohlcv: { '1H': OHLCV[]; '4H': OHLCV[]; '1D': OHLCV[] };
  fundamentalContext?: string;
  sentimentContext?: string;
}

function createSignalInput(token: Token, close: number): SignalInput {
  return {
    token,
    ohlcv: {
      '1H': createOHLCV(close),
      '4H': createOHLCV(close),
      '1D': createOHLCV(close),
    },
  };
}

const SOL: Token = { symbol: 'SOL', address: 'So1111...', name: 'Solana' };
const USDT: Token = { symbol: 'USDT', address: 'Es9v...', name: 'Tether USD' };
const USDC: Token = { symbol: 'USDC', address: 'EPjF...', name: 'USD Coin' };
const DAI: Token = { symbol: 'DAI', address: 'EJwZ...', name: 'Dai' };
const BUSD: Token = { symbol: 'BUSD', address: 'BUSD...', name: 'Binance USD' };

const mockedRunTA = vi.mocked(runTechnicalAnalysis);
const mockedGetSentiment = vi.mocked(getTechnicalSentiment);

// ---------------------------------------------------------------------------
// Default mock setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: neutral analysis across both timeframes
  mockedRunTA.mockReturnValue(createAnalysis());

  // Default: sentiment of 0 (neutral)
  mockedGetSentiment.mockReturnValue(0);
});

// ===========================================================================
// STABLECOIN SAFETY TESTS
// ===========================================================================

describe('Stablecoin safety', () => {
  it('1. returns null for USDT', () => {
    const input = createSignalInput(USDT, 1.0);
    expect(generateSignal(input)).toBeNull();
  });

  it('2. returns null for USDC', () => {
    const input = createSignalInput(USDC, 1.0);
    expect(generateSignal(input)).toBeNull();
  });

  it('3. returns null for DAI', () => {
    const input = createSignalInput(DAI, 1.0);
    expect(generateSignal(input)).toBeNull();
  });

  it('4. returns null for BUSD', () => {
    const input = createSignalInput(BUSD, 1.0);
    expect(generateSignal(input)).toBeNull();
  });

  it('5. case insensitive: "usdt" returns null', () => {
    const lowercaseUsdt: Token = { symbol: 'usdt', address: 'Es9v...', name: 'Tether' };
    const input = createSignalInput(lowercaseUsdt, 1.0);
    expect(generateSignal(input)).toBeNull();
  });
});

// ===========================================================================
// ACTION DETERMINATION TESTS
// ===========================================================================

describe('Action determination', () => {
  it('6. extreme RSI <= 20 produces a LONG signal', () => {
    const extremeOversold = createAnalysis({
      rsi: { value: 18, signal: 'OVERSOLD' },
    });
    mockedRunTA.mockReturnValue(extremeOversold);
    mockedGetSentiment.mockReturnValue(0);

    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.action).toBe('LONG');
  });

  it('7. extreme RSI >= 80 produces a SHORT signal', () => {
    const extremeOverbought = createAnalysis({
      rsi: { value: 85, signal: 'OVERBOUGHT' },
    });
    mockedRunTA.mockReturnValue(extremeOverbought);
    mockedGetSentiment.mockReturnValue(0);

    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.action).toBe('SHORT');
  });

  it('8. oversold RSI (30) with positive sentiment produces LONG', () => {
    const oversold = createAnalysis({
      rsi: { value: 30, signal: 'OVERSOLD' },
    });
    mockedRunTA.mockReturnValue(oversold);
    // Positive sentiment satisfies the `sentiment > 0` branch in determineAction
    mockedGetSentiment.mockReturnValue(15);

    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.action).toBe('LONG');
  });

  it('9. overbought RSI (70) with negative sentiment produces SHORT', () => {
    const overbought = createAnalysis({
      rsi: { value: 70, signal: 'OVERBOUGHT' },
    });
    mockedRunTA.mockReturnValue(overbought);
    // Negative sentiment satisfies the `sentiment < 0` branch in determineAction
    mockedGetSentiment.mockReturnValue(-15);

    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.action).toBe('SHORT');
  });

  it('SHORT signal with low confidence (< 80) is filtered out', () => {
    // 4H is overbought but 1D is neutral — so no multi-timeframe alignment
    const overbought4H = createAnalysis({
      rsi: { value: 82, signal: 'OVERBOUGHT' },
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', crossover: null },
      trend: { direction: 'SIDEWAYS', strength: 20, ema20: 100, ema50: 100, ema200: 100 },
    });
    const neutral1D = createAnalysis({
      rsi: { value: 50, signal: 'NEUTRAL' },
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', crossover: null },
      trend: { direction: 'SIDEWAYS', strength: 20, ema20: 100, ema50: 100, ema200: 100 },
    });
    // Return different analyses for 4H vs 1D calls
    mockedRunTA.mockReturnValueOnce(overbought4H).mockReturnValueOnce(neutral1D);
    mockedGetSentiment.mockReturnValue(-5);

    const signal = generateSignal(createSignalInput(SOL, 100));

    // Confidence = 50 (base) + 20 (extreme RSI) + 0 (no alignment) + 0.5 (sentiment) ≈ 71
    // Should be null because SHORT confidence < 80
    expect(signal).toBeNull();
  });

  it('10. neutral conditions with sentiment near 0 returns null (HOLD)', () => {
    // RSI neutral, MACD neutral, trend sideways, sentiment near 0
    const neutral = createAnalysis({
      rsi: { value: 50, signal: 'NEUTRAL' },
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', crossover: null },
      trend: { direction: 'SIDEWAYS', strength: 30, ema20: 100, ema50: 100, ema200: 100 },
    });
    mockedRunTA.mockReturnValue(neutral);
    // Sentiment within the [-8, +8] dead zone triggers HOLD
    mockedGetSentiment.mockReturnValue(3);

    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).toBeNull();
  });
});

// ===========================================================================
// SIGNAL STRUCTURE TESTS
// ===========================================================================

describe('Signal structure', () => {
  /** Helper that sets up mocks to produce a valid LONG signal. */
  function setupLongSignal(): void {
    const analysis = createAnalysis({
      rsi: { value: 15, signal: 'OVERSOLD' },
    });
    mockedRunTA.mockReturnValue(analysis);
    mockedGetSentiment.mockReturnValue(20);
  }

  /** Helper that sets up mocks to produce a valid SHORT signal (confidence > 80). */
  function setupShortSignal(): void {
    const analysis = createAnalysis({
      rsi: { value: 85, signal: 'OVERBOUGHT' },
      macd: { macd: -0.5, signal: -0.1, histogram: -0.4, trend: 'BEARISH', crossover: 'BEARISH_CROSS' },
      trend: { direction: 'DOWN', strength: 60, ema20: 95, ema50: 100, ema200: 105 },
    });
    mockedRunTA.mockReturnValue(analysis);
    mockedGetSentiment.mockReturnValue(-30);
  }

  it('11. signal id starts with "sig_"', () => {
    setupLongSignal();
    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.id).toMatch(/^sig_/);
  });

  it('12. signal has exactly 3 targets', () => {
    setupLongSignal();
    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.targets).toHaveLength(3);
  });

  it('13. LONG signal: stopLoss < entry < targets[0] < targets[1] < targets[2]', () => {
    setupLongSignal();
    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.action).toBe('LONG');
    expect(signal!.stopLoss).toBeLessThan(signal!.entry);
    expect(signal!.entry).toBeLessThan(signal!.targets[0]);
    expect(signal!.targets[0]).toBeLessThan(signal!.targets[1]);
    expect(signal!.targets[1]).toBeLessThan(signal!.targets[2]);
  });

  it('14. SHORT signal: targets[2] < targets[1] < targets[0] < entry < stopLoss', () => {
    setupShortSignal();
    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.action).toBe('SHORT');
    expect(signal!.targets[2]).toBeLessThan(signal!.targets[1]);
    expect(signal!.targets[1]).toBeLessThan(signal!.targets[0]);
    expect(signal!.targets[0]).toBeLessThan(signal!.entry);
    expect(signal!.entry).toBeLessThan(signal!.stopLoss);
  });

  it('15. confidence is between 25 and 95', () => {
    setupLongSignal();
    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    expect(signal!.confidence).toBeGreaterThanOrEqual(25);
    expect(signal!.confidence).toBeLessThanOrEqual(95);
  });
});

// ===========================================================================
// CONFIDENCE CALCULATION TESTS
// ===========================================================================

describe('Confidence calculation', () => {
  it('16. extreme RSI alignment across timeframes boosts confidence', () => {
    // Both timeframes deeply oversold — should add the extreme bonus (+20)
    // AND the alignment bonus (+15) on top of the base (50)
    const extremeOversold = createAnalysis({
      rsi: { value: 15, signal: 'OVERSOLD' },
    });
    mockedRunTA.mockReturnValue(extremeOversold);
    mockedGetSentiment.mockReturnValue(10);

    const signal = generateSignal(createSignalInput(SOL, 100));

    expect(signal).not.toBeNull();
    // Base 50 + extreme RSI 20 + alignment 15 = at least 85 before other factors
    expect(signal!.confidence).toBeGreaterThanOrEqual(80);
  });

  it('17. MACD crossover adds confidence', () => {
    // Use moderate RSI values to avoid hitting the 95 confidence cap
    const noCrossover = createAnalysis({
      rsi: { value: 28, signal: 'OVERSOLD' },
      macd: { macd: 0.1, signal: 0, histogram: 0.1, trend: 'NEUTRAL', crossover: null },
      trend: { direction: 'SIDEWAYS', strength: 30, ema20: 100, ema50: 100, ema200: 100 },
    });

    mockedRunTA.mockReturnValue(noCrossover);
    mockedGetSentiment.mockReturnValue(5);
    const signalWithout = generateSignal(createSignalInput(SOL, 100));

    // Same setup but with a bullish crossover
    const withCrossover = createAnalysis({
      rsi: { value: 28, signal: 'OVERSOLD' },
      macd: { macd: 0.1, signal: 0, histogram: 0.1, trend: 'NEUTRAL', crossover: 'BULLISH_CROSS' },
      trend: { direction: 'SIDEWAYS', strength: 30, ema20: 100, ema50: 100, ema200: 100 },
    });

    mockedRunTA.mockReturnValue(withCrossover);
    mockedGetSentiment.mockReturnValue(5);
    const signalWith = generateSignal(createSignalInput(SOL, 100));

    expect(signalWithout).not.toBeNull();
    expect(signalWith).not.toBeNull();
    // Crossover adds +10 to confidence
    expect(signalWith!.confidence).toBeGreaterThan(signalWithout!.confidence);
  });

  it('18. trend alignment across timeframes adds confidence', () => {
    // No trend alignment (sideways)
    const sideways = createAnalysis({
      rsi: { value: 18, signal: 'OVERSOLD' },
      trend: { direction: 'SIDEWAYS', strength: 50, ema20: 100, ema50: 100, ema200: 100 },
    });

    mockedRunTA.mockReturnValue(sideways);
    mockedGetSentiment.mockReturnValue(10);
    const signalSideways = generateSignal(createSignalInput(SOL, 100));

    // Both timeframes trending UP
    const trendingUp = createAnalysis({
      rsi: { value: 18, signal: 'OVERSOLD' },
      trend: { direction: 'UP', strength: 60, ema20: 102, ema50: 100, ema200: 98 },
    });

    mockedRunTA.mockReturnValue(trendingUp);
    mockedGetSentiment.mockReturnValue(10);
    const signalTrending = generateSignal(createSignalInput(SOL, 100));

    expect(signalSideways).not.toBeNull();
    expect(signalTrending).not.toBeNull();
    // Trend alignment adds +15
    expect(signalTrending!.confidence).toBeGreaterThan(signalSideways!.confidence);
  });
});

// ===========================================================================
// BATCH GENERATION TESTS (generateSignals)
// ===========================================================================

describe('generateSignals (batch)', () => {
  it('19. filters out stablecoins from batch results', async () => {
    // Set up mocks to produce a valid signal for non-stablecoins
    const oversold = createAnalysis({
      rsi: { value: 15, signal: 'OVERSOLD' },
    });
    mockedRunTA.mockReturnValue(oversold);
    mockedGetSentiment.mockReturnValue(20);

    const inputs: SignalInput[] = [
      createSignalInput(SOL, 100),
      createSignalInput(USDT, 1),
      createSignalInput(USDC, 1),
    ];

    const signals = await generateSignals(inputs);

    // Only SOL should produce a signal; both stablecoins are filtered out
    expect(signals).toHaveLength(1);
    expect(signals[0].token.symbol).toBe('SOL');
  });

  it('20. sorts results by confidence descending', async () => {
    const BTC: Token = { symbol: 'BTC', address: 'btc...', name: 'Bitcoin' };
    const ETH: Token = { symbol: 'ETH', address: 'eth...', name: 'Ethereum' };

    // BTC gets extreme RSI (higher confidence)
    const highConfAnalysis = createAnalysis({
      rsi: { value: 10, signal: 'OVERSOLD' },
      macd: { macd: 1, signal: 0, histogram: 1, trend: 'BULLISH', crossover: 'BULLISH_CROSS' },
      trend: { direction: 'UP', strength: 80, ema20: 102, ema50: 100, ema200: 98 },
    });

    // ETH gets moderate oversold (lower confidence)
    const lowerConfAnalysis = createAnalysis({
      rsi: { value: 28, signal: 'OVERSOLD' },
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', crossover: null },
      trend: { direction: 'SIDEWAYS', strength: 30, ema20: 100, ema50: 100, ema200: 100 },
    });

    // Return different analyses based on call order: ETH first (lower), BTC second (higher)
    let callCount = 0;
    mockedRunTA.mockImplementation(() => {
      callCount++;
      // ETH input is processed first (inputs[0]), BTC second (inputs[1])
      // Each generateSignal call invokes runTA twice (4H then 1D)
      if (callCount <= 2) {
        return lowerConfAnalysis;
      }
      return highConfAnalysis;
    });

    mockedGetSentiment.mockReturnValue(20);

    const inputs: SignalInput[] = [
      createSignalInput(ETH, 3000),
      createSignalInput(BTC, 40000),
    ];

    const signals = await generateSignals(inputs);

    expect(signals).toHaveLength(2);
    // Highest confidence should come first
    expect(signals[0].confidence).toBeGreaterThanOrEqual(signals[1].confidence);
    expect(signals[0].token.symbol).toBe('BTC');
    expect(signals[1].token.symbol).toBe('ETH');
  });

  it('21. returns empty array if all inputs are stablecoins', async () => {
    const inputs: SignalInput[] = [
      createSignalInput(USDT, 1),
      createSignalInput(USDC, 1),
      createSignalInput(DAI, 1),
      createSignalInput(BUSD, 1),
    ];

    const signals = await generateSignals(inputs);

    expect(signals).toEqual([]);
  });
});
