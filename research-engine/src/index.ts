// Trading Caller Research Engine - Main Entry Point

import 'dotenv/config';
import { getTopTokens, getTokenOverview, searchTokens } from './data/dexscreener.js';
import {
  KNOWN_TOKENS,
  getPrice,
  getTopJupiterTokens,
  extractMarketMetrics,
} from './data/jupiter.js';
import {
  getMarketData,
  getEnrichedMarketData,
  validateMarketQuality,
} from './data/index.js';
import { generateSignal, generateSignals } from './signals/generator.js';
import { runTechnicalAnalysis } from './technical/index.js';
import type { Token, TradingSignal, OHLCV, MarketData } from './signals/types.js';

// Re-export types and modules
export * from './signals/types.js';
export * from './technical/index.js';
export * from './signals/generator.js';
export * from './data/dexscreener.js';
export * from './data/jupiter.js';

interface EngineConfig {
  tokenLimit: number;
  updateIntervalMs: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  tokenLimit: 50,
  updateIntervalMs: 60 * 60 * 1000, // 1 hour
};

class TradingCallerEngine {
  private config: EngineConfig;
  private signals: TradingSignal[] = [];
  private lastUpdate: Date | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getSignals(): TradingSignal[] {
    return this.signals;
  }

  getLatestSignals(limit: number = 10): TradingSignal[] {
    return this.signals.slice(0, limit);
  }

  /**
   * Analyze a single token by address or symbol
   */
  async analyzeToken(tokenAddressOrSymbol: string): Promise<{
    token: Token | null;
    analysis: ReturnType<typeof runTechnicalAnalysis> | null;
    signal: TradingSignal | null;
    marketData: MarketData | null;
  }> {
    try {
      let tokenAddress = tokenAddressOrSymbol;
      let token: Token | null = null;

      for (const t of Object.values(KNOWN_TOKENS)) {
        if (
          t.address === tokenAddressOrSymbol ||
          t.symbol.toUpperCase() === tokenAddressOrSymbol.toUpperCase()
        ) {
          token = t;
          tokenAddress = t.address;
          break;
        }
      }

      const marketData = await getMarketData(tokenAddress);

      if (!marketData) {
        const searchResults = await searchTokens(tokenAddressOrSymbol);
        if (searchResults.length > 0) {
          tokenAddress = searchResults[0].address;
          const retryData = await getMarketData(tokenAddress);
          if (retryData) {
            token = retryData.token;
          }
        }

        if (!marketData && !token) {
          return { token: null, analysis: null, signal: null, marketData: null };
        }
      } else {
        token = marketData.token;
      }

      const data = marketData || (await getMarketData(tokenAddress));
      if (!data || !data.ohlcv['4H'].length) {
        return { token, analysis: null, signal: null, marketData: data };
      }

      const analysis = runTechnicalAnalysis(data.ohlcv['4H']);
      const signal = generateSignal({ token: token!, ohlcv: data.ohlcv });

      return { token, analysis, signal, marketData: data };
    } catch (error) {
      console.error(`Error analyzing token ${tokenAddressOrSymbol}:`, error);
      return { token: null, analysis: null, signal: null, marketData: null };
    }
  }

  /**
   * Run full market scan using Jupiter Token API v2 for discovery
   * and quality filters to skip low-liquidity/suspicious tokens
   */
  async scan(): Promise<TradingSignal[]> {
    console.log('[TradingCaller] Starting market scan...');
    const startTime = Date.now();

    try {
      // Phase 1: Discover tokens via Jupiter Token API v2
      const jupiterTokens = await getTopJupiterTokens('toptraded', '1h', this.config.tokenLimit);
      console.log(`[TradingCaller] Jupiter returned ${jupiterTokens.length} top traded tokens`);

      const signals: TradingSignal[] = [];
      let processed = 0;
      let skippedQuality = 0;

      for (const jupToken of jupiterTokens) {
        try {
          // Extract market metrics from Jupiter data
          const metrics = extractMarketMetrics(jupToken);
          if (!metrics) continue;

          // Quick quality pre-check before expensive OHLCV fetch
          if (metrics.isSuspicious) {
            console.log(`[TradingCaller] ${jupToken.symbol}: skipped (suspicious)`);
            skippedQuality++;
            continue;
          }
          if (metrics.liquidity < 500_000) {
            skippedQuality++;
            continue;
          }
          if (metrics.marketCap < 5_000_000) {
            skippedQuality++;
            continue;
          }

          // Fetch enriched market data (OHLCV + quality validation)
          const enriched = await getEnrichedMarketData(jupToken);
          if (!enriched) continue;

          if (!enriched.quality.isValid) {
            console.log(
              `[TradingCaller] ${jupToken.symbol}: skipped (${enriched.quality.rejectionReason})`,
            );
            skippedQuality++;
            continue;
          }

          // Generate signal with Jupiter buy/sell pressure
          const signal = generateSignal({
            token: enriched.marketData.token,
            ohlcv: enriched.marketData.ohlcv,
            buyPressureRatio: metrics.buyPressureRatio,
            liquidity: metrics.liquidity,
            marketCap: metrics.marketCap,
          });

          if (signal) {
            signals.push(signal);
          }

          processed++;

          if (processed % 5 === 0) {
            console.log(
              `[TradingCaller] Processed ${processed} tokens, ${signals.length} signals, ${skippedQuality} skipped`,
            );
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error processing ${jupToken.symbol}:`, error);
        }
      }

      // Phase 2: Also scan known tokens not in Jupiter top list
      for (const knownToken of Object.values(KNOWN_TOKENS)) {
        // Skip stablecoins and tokens already processed
        if (['USDC', 'USDT'].includes(knownToken.symbol)) continue;
        if (jupiterTokens.some((jt) => jt.id === knownToken.address)) continue;

        try {
          const marketData = await getMarketData(knownToken.address);
          if (!marketData || !marketData.ohlcv['4H'].length) continue;

          const quality = validateMarketQuality(
            marketData.marketCap,
            marketData.volume24h, // Use volume as liquidity proxy
            marketData.ohlcv['4H'].length,
          );

          if (!quality.isValid) continue;

          const signal = generateSignal({
            token: marketData.token,
            ohlcv: marketData.ohlcv,
          });

          if (signal) signals.push(signal);
          processed++;

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error processing ${knownToken.symbol}:`, error);
        }
      }

      // Sort by confidence
      signals.sort((a, b) => b.confidence - a.confidence);
      this.signals = signals;
      this.lastUpdate = new Date();

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(
        `[TradingCaller] Scan complete: ${signals.length} signals from ${processed} tokens (${skippedQuality} skipped for quality) in ${elapsed.toFixed(1)}s`,
      );

      return signals;
    } catch (error) {
      console.error('[TradingCaller] Scan failed:', error);
      return [];
    }
  }

  start(): void {
    if (this.isRunning) {
      console.log('[TradingCaller] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[TradingCaller] Engine started');
    this.scan();

    setInterval(() => {
      if (this.isRunning) {
        this.scan();
      }
    }, this.config.updateIntervalMs);
  }

  stop(): void {
    this.isRunning = false;
    console.log('[TradingCaller] Engine stopped');
  }

  status(): {
    running: boolean;
    signalCount: number;
    lastUpdate: Date | null;
    config: EngineConfig;
  } {
    return {
      running: this.isRunning,
      signalCount: this.signals.length,
      lastUpdate: this.lastUpdate,
      config: this.config,
    };
  }
}

export { TradingCallerEngine, TradingCallerEngine as MorpheusEngine };

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        Trading Caller Engine             ║');
  console.log('║     "Free your mind" - Make the call     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const engine = new TradingCallerEngine();
  const solAddress = KNOWN_TOKENS.SOL.address;

  console.log(`[DEMO] Analyzing SOL...`);

  engine
    .analyzeToken(solAddress)
    .then((result) => {
      if (result.analysis) {
        console.log('\n[SOL Technical Analysis]');
        console.log(result.analysis.summary);
        console.log('\nRSI:', result.analysis.analysis.rsi);
        console.log('MACD:', result.analysis.analysis.macd);
        console.log('Trend:', result.analysis.analysis.trend);
      }

      if (result.signal) {
        console.log('\n[Generated Signal]');
        console.log(JSON.stringify(result.signal, null, 2));
      } else {
        console.log('\n[No signal generated — conditions not met]');
      }
    })
    .catch((error) => {
      console.error('Demo failed:', error);
    });
}
