// MORPHEUS Research Engine - Main Entry Point

import 'dotenv/config';
import { getTopTokens, getMultiTimeframeOHLCV, getQualityTokens } from './data/birdeye.js';
import { KNOWN_TOKENS, getPrice } from './data/jupiter.js';
import { generateSignal, generateSignals } from './signals/generator.js';
import { runTechnicalAnalysis } from './technical/index.js';
import type { Token, TradingSignal, OHLCV } from './signals/types.js';

// Re-export types and modules
export * from './signals/types.js';
export * from './technical/index.js';
export * from './signals/generator.js';
export * from './data/birdeye.js';
export * from './data/jupiter.js';

interface EngineConfig {
  tier1Limit: number;      // CoinGecko/CMC top N tokens
  tier2Limit: number;      // Solana ecosystem tokens
  minMarketCap: number;    // Minimum market cap for Tier 2
  minOrganicScore: number; // Minimum organic score for Tier 2
  updateIntervalMs: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  tier1Limit: 50,
  tier2Limit: 400,
  minMarketCap: 1000000,
  minOrganicScore: 63,
  updateIntervalMs: 60 * 60 * 1000, // 1 hour
};

class MorpheusEngine {
  private config: EngineConfig;
  private signals: TradingSignal[] = [];
  private lastUpdate: Date | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current signals
   */
  getSignals(): TradingSignal[] {
    return this.signals;
  }

  /**
   * Get latest signals (top N by confidence)
   */
  getLatestSignals(limit: number = 10): TradingSignal[] {
    return this.signals.slice(0, limit);
  }

  /**
   * Analyze a single token
   */
  async analyzeToken(tokenAddress: string): Promise<{
    token: Token | null;
    analysis: ReturnType<typeof runTechnicalAnalysis> | null;
    signal: TradingSignal | null;
  }> {
    try {
      // Get token info
      let token: Token | null = null;
      for (const t of Object.values(KNOWN_TOKENS)) {
        if (t.address === tokenAddress) {
          token = t;
          break;
        }
      }

      // Get OHLCV data
      const ohlcv = await getMultiTimeframeOHLCV(tokenAddress);
      
      if (!ohlcv['4H'].length) {
        return { token, analysis: null, signal: null };
      }

      // Run analysis
      const analysis = runTechnicalAnalysis(ohlcv['4H']);

      // Generate signal if token info available
      let signal: TradingSignal | null = null;
      if (token) {
        signal = generateSignal({ token, ohlcv });
      }

      return { token, analysis, signal };
    } catch (error) {
      console.error(`Error analyzing token ${tokenAddress}:`, error);
      return { token: null, analysis: null, signal: null };
    }
  }

  /**
   * Run full market scan
   */
  async scan(): Promise<TradingSignal[]> {
    console.log('[MORPHEUS] Starting market scan...');
    const startTime = Date.now();

    try {
      // Get quality tokens from Birdeye
      const tokens = await getQualityTokens(
        this.config.minMarketCap,
        this.config.minOrganicScore,
        this.config.tier2Limit
      );

      console.log(`[MORPHEUS] Found ${tokens.length} quality tokens`);

      const signals: TradingSignal[] = [];
      let processed = 0;

      for (const tokenInfo of tokens) {
        try {
          // Get OHLCV data
          const ohlcv = await getMultiTimeframeOHLCV(tokenInfo.address);
          
          if (!ohlcv['4H'].length || ohlcv['4H'].length < 20) {
            continue;
          }

          const token: Token = {
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            address: tokenInfo.address,
            decimals: tokenInfo.decimals,
          };

          const signal = generateSignal({ token, ohlcv });
          
          if (signal) {
            signals.push(signal);
          }

          processed++;
          
          // Rate limiting
          if (processed % 10 === 0) {
            console.log(`[MORPHEUS] Processed ${processed}/${tokens.length} tokens, ${signals.length} signals generated`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error processing ${tokenInfo.symbol}:`, error);
        }
      }

      // Sort by confidence
      signals.sort((a, b) => b.confidence - a.confidence);
      
      this.signals = signals;
      this.lastUpdate = new Date();

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`[MORPHEUS] Scan complete. ${signals.length} signals generated in ${elapsed.toFixed(1)}s`);

      return signals;
    } catch (error) {
      console.error('[MORPHEUS] Scan failed:', error);
      return [];
    }
  }

  /**
   * Start continuous scanning
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MORPHEUS] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[MORPHEUS] Engine started');

    // Initial scan
    this.scan();

    // Schedule periodic scans
    setInterval(() => {
      if (this.isRunning) {
        this.scan();
      }
    }, this.config.updateIntervalMs);
  }

  /**
   * Stop scanning
   */
  stop(): void {
    this.isRunning = false;
    console.log('[MORPHEUS] Engine stopped');
  }

  /**
   * Get engine status
   */
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

// Export engine class
export { MorpheusEngine };

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║          SIGNAL Research Engine          ║');
  console.log('║   24/7 Autonomous Market Intelligence    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const engine = new MorpheusEngine();
  
  // Quick demo: analyze SOL
  const solAddress = KNOWN_TOKENS.SOL.address;
  
  console.log(`[DEMO] Analyzing SOL...`);
  
  engine.analyzeToken(solAddress).then(result => {
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
      console.log('\n[No signal generated - conditions not met]');
    }
  }).catch(error => {
    console.error('Demo failed:', error);
  });
}
