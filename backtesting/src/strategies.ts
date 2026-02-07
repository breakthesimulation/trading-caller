// Predefined Trading Strategies for Backtesting

import type { TradingStrategy } from './types.js';

/**
 * Strategy 1: RSI Oversold Long
 * Buy when RSI < 30, sell when RSI > 70 or stop-loss hit
 */
export const RSI_OVERSOLD_LONG: TradingStrategy = {
  name: 'RSI Oversold Long',
  description: 'Buy when RSI drops below 30 (oversold), sell when RSI exceeds 70 or hits stop-loss',
  signals: [
    {
      type: 'RSI',
      action: 'LONG',
      condition: 'RSI < 30',
      weight: 60,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI > 70',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 5,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 10,
  },
};

/**
 * Strategy 2: RSI Extreme Oversold
 * More aggressive - buy when RSI < 25
 */
export const RSI_EXTREME_OVERSOLD: TradingStrategy = {
  name: 'RSI Extreme Oversold',
  description: 'Buy only when RSI drops below 25 (extreme oversold)',
  signals: [
    {
      type: 'RSI',
      action: 'LONG',
      condition: 'RSI < 25',
      weight: 70,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI > 65',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 7,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 15,
  },
};

/**
 * Strategy 3: RSI Overbought Short
 * Short when RSI > 70, cover when RSI < 30
 */
export const RSI_OVERBOUGHT_SHORT: TradingStrategy = {
  name: 'RSI Overbought Short',
  description: 'Short when RSI exceeds 70 (overbought), cover when RSI drops below 30',
  signals: [
    {
      type: 'RSI',
      action: 'SHORT',
      condition: 'RSI > 70',
      weight: 60,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI < 30',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 5,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 10,
  },
};

/**
 * Strategy 4: RSI + Trend Alignment
 * Only buy oversold RSI when trend is up
 */
export const RSI_TREND_ALIGNED: TradingStrategy = {
  name: 'RSI + Trend Alignment',
  description: 'Buy oversold RSI only when overall trend is bullish',
  signals: [
    {
      type: 'RSI',
      action: 'LONG',
      condition: 'RSI < 35',
      weight: 40,
    },
    {
      type: 'TREND',
      action: 'LONG',
      condition: 'UPTREND',
      weight: 30,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI > 65',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 4,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 12,
  },
};

/**
 * Strategy 5: MACD Crossover
 * Buy on MACD bullish cross, sell on bearish cross
 */
export const MACD_CROSSOVER: TradingStrategy = {
  name: 'MACD Crossover',
  description: 'Buy when MACD crosses above signal line, sell on bearish cross',
  signals: [
    {
      type: 'MACD',
      action: 'LONG',
      condition: 'MACD CROSS_ABOVE',
      weight: 60,
    },
    {
      type: 'MACD',
      action: 'EXIT',
      condition: 'MACD CROSS_BELOW',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 6,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 12,
  },
};

/**
 * Strategy 6: Combined RSI + MACD
 * Require both RSI oversold AND MACD bullish
 */
export const RSI_MACD_COMBO: TradingStrategy = {
  name: 'RSI + MACD Combined',
  description: 'Buy when both RSI is oversold and MACD is bullish',
  signals: [
    {
      type: 'RSI',
      action: 'LONG',
      condition: 'RSI < 35',
      weight: 35,
    },
    {
      type: 'MACD',
      action: 'LONG',
      condition: 'MACD > 0',
      weight: 35,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI > 70',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 5,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 15,
  },
};

/**
 * Strategy 7: Conservative RSI
 * Tighter stops, smaller targets, higher win rate focus
 */
export const RSI_CONSERVATIVE: TradingStrategy = {
  name: 'Conservative RSI',
  description: 'Tight stops and modest targets for higher win rate',
  signals: [
    {
      type: 'RSI',
      action: 'LONG',
      condition: 'RSI < 30',
      weight: 60,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI > 55',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 3,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 6,
  },
};

/**
 * Strategy 8: Aggressive RSI
 * Wider stops, bigger targets, lower win rate but higher RR
 */
export const RSI_AGGRESSIVE: TradingStrategy = {
  name: 'Aggressive RSI',
  description: 'Wide stops and large targets for maximum profit potential',
  signals: [
    {
      type: 'RSI',
      action: 'LONG',
      condition: 'RSI < 30',
      weight: 60,
    },
    {
      type: 'RSI',
      action: 'EXIT',
      condition: 'RSI > 75',
      weight: 50,
    },
  ],
  stopLoss: {
    type: 'FIXED_PERCENT',
    value: 8,
  },
  takeProfit: {
    type: 'FIXED_PERCENT',
    value: 20,
  },
};

/**
 * All available strategies
 */
export const ALL_STRATEGIES = [
  RSI_OVERSOLD_LONG,
  RSI_EXTREME_OVERSOLD,
  RSI_OVERBOUGHT_SHORT,
  RSI_TREND_ALIGNED,
  MACD_CROSSOVER,
  RSI_MACD_COMBO,
  RSI_CONSERVATIVE,
  RSI_AGGRESSIVE,
];

/**
 * Get strategy by name
 */
export function getStrategy(name: string): TradingStrategy | undefined {
  return ALL_STRATEGIES.find(s => s.name === name);
}

/**
 * List all strategy names
 */
export function listStrategies(): string[] {
  return ALL_STRATEGIES.map(s => s.name);
}
