// Trading Caller Research Engine - Main Entry Point

import 'dotenv/config';
import { getTopTokens, getTokenOverview, searchTokens } from './data/dexscreener.js';
import { KNOWN_TOKENS, getPrice } from './data/jupiter.js';
import { getMarketData } from './data/index.js';
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
  tokenLimit: number;        // Max tokens to scan
  updateIntervalMs: number;  // How often to scan
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
   * Analyze a single token by address or symbol
   */
  async analyzeToken(tokenAddressOrSymbol: string): Promise<{
    token: Token | null;
    analysis: ReturnType<typeof runTechnicalAnalysis> | null;
    signal: TradingSignal | null;
    marketData: MarketData | null;
  }> {
    try {
      // Check if it's a known token
      let tokenAddress = tokenAddressOrSymbol;
      let token: Token | null = null;

      for (const t of Object.values(KNOWN_TOKENS)) {
        if (t.address === tokenAddressOrSymbol || t.symbol.toUpperCase() === tokenAddressOrSymbol.toUpperCase()) {
          token = t;
          tokenAddress = t.address;
          break;
        }
      }

      // Get market data
      const marketData = await getMarketData(tokenAddress);
      
      if (!marketData) {
        // Try searching by symbol
        const searchResults = await searchTokens(tokenAddressOrSymbol);
        if (searchResults.length > 0) {
          const found = searchResults[0];
          tokenAddress = found.address;
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

      const data = marketData || await getMarketData(tokenAddress);
      if (!data || !data.ohlcv['4H'].length) {
        return { token, analysis: null, signal: null, marketData: data };
      }

      // Run technical analysis
      const analysis = runTechnicalAnalysis(data.ohlcv['4H']);

      // Generate signal
      const signal = generateSignal({ token: token!, ohlcv: data.ohlcv });

      return { token, analysis, signal, marketData: data };
    } catch (error) {
      console.error(`Error analyzing token ${tokenAddressOrSymbol}:`, error);
      return { token: null, analysis: null, signal: null, marketData: null };
    }
  }

  /**
   * Run full market scan
   */
  async scan(): Promise<TradingSignal[]> {
    console.log('[TradingCaller] Starting market scan...');
    const startTime = Date.now();

    try {
      // Start with known tokens (always free, always work)
      const tokensToScan: Token[] = Object.values(KNOWN_TOKENS);
      
      // Try to get additional tokens from DexScreener
      try {
        const topTokens = await getTopTokens(this.config.tokenLimit);
        for (const t of topTokens) {
          if (!tokensToScan.find(existing => existing.address === t.address)) {
            tokensToScan.push({
              symbol: t.symbol,
              name: t.name,
              address: t.address,
              decimals: 9,
            });
          }
        }
      } catch (e) {
        console.log('[TradingCaller] Could not fetch top tokens, using known tokens only');
      }

      console.log(`[TradingCaller] Scanning ${tokensToScan.length} tokens...`);

      const signals: TradingSignal[] = [];
      let processed = 0;

      for (const token of tokensToScan) {
        try {
          // Get market data
          const marketData = await getMarketData(token.address);
          
          if (!marketData || !marketData.ohlcv['4H'].length) {
            continue;
          }

          const signal = generateSignal({ 
            token: marketData.token, 
            ohlcv: marketData.ohlcv 
          });
          
          if (signal) {
            signals.push(signal);
          }

          processed++;
          
          // Progress logging
          if (processed % 5 === 0) {
            console.log(`[TradingCaller] Processed ${processed}/${tokensToScan.length} tokens, ${signals.length} signals`);
          }
          
          // Rate limiting - be nice to free APIs
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error processing ${token.symbol}:`, error);
        }
      }

      // Sort by confidence
      signals.sort((a, b) => b.confidence - a.confidence);
      
      this.signals = signals;
      this.lastUpdate = new Date();

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`[TradingCaller] Scan complete. ${signals.length} signals in ${elapsed.toFixed(1)}s`);

      return signals;
    } catch (error) {
      console.error('[TradingCaller] Scan failed:', error);
      return [];
    }
  }

  /**
   * Start continuous scanning
   */
  start(): void {
    if (this.isRunning) {
      console.log('[TradingCaller] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[TradingCaller] Engine started');

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
    console.log('[TradingCaller] Engine stopped');
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

// Export engine class (keep MorpheusEngine as alias for backward compat)
export { TradingCallerEngine, TradingCallerEngine as MorpheusEngine };

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        Trading Caller Engine             ║');
  console.log('║     "Free your mind" - Make the call     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const engine = new TradingCallerEngine();
  
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
