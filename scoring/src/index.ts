// MORPHEUS Scoring System
// Tracks analyst predictions and calculates performance metrics

import 'dotenv/config';
import type { 
  AnalystCall, 
  CallOutcome, 
  AnalystStats,
  Token 
} from '../../research-engine/src/signals/types.js';
import { getPrice } from '../../research-engine/src/data/jupiter.js';

interface StoredCall extends AnalystCall {
  currentPrice?: number;
  lastChecked?: string;
}

class ScoringEngine {
  private calls: Map<string, StoredCall> = new Map();
  private analysts: Map<string, AnalystStats> = new Map();
  private checkIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  private isRunning: boolean = false;

  /**
   * Submit a new call for tracking
   */
  submitCall(call: AnalystCall): StoredCall {
    const storedCall: StoredCall = {
      ...call,
      lastChecked: new Date().toISOString(),
    };
    
    this.calls.set(call.id, storedCall);
    
    // Initialize analyst if not exists
    if (!this.analysts.has(call.analystId)) {
      this.analysts.set(call.analystId, {
        analystId: call.analystId,
        name: call.analystId,
        totalCalls: 0,
        wins: 0,
        losses: 0,
        neutral: 0,
        winRate: 0,
        avgReturn: 0,
        profitFactor: 0,
        rank: 0,
        lastActive: new Date().toISOString(),
      });
    }
    
    const stats = this.analysts.get(call.analystId)!;
    stats.totalCalls++;
    stats.lastActive = new Date().toISOString();
    
    return storedCall;
  }

  /**
   * Get all active (unresolved) calls
   */
  getActiveCalls(): StoredCall[] {
    return Array.from(this.calls.values()).filter(c => !c.outcome);
  }

  /**
   * Get call by ID
   */
  getCall(id: string): StoredCall | undefined {
    return this.calls.get(id);
  }

  /**
   * Check and resolve a single call
   */
  async checkCall(callId: string): Promise<CallOutcome | null> {
    const call = this.calls.get(callId);
    if (!call || call.outcome) return null;

    // Get token address - for now just use SOL as demo
    const tokenAddress = (call.token as any).address || 'So11111111111111111111111111111111111111112';
    
    try {
      const currentPrice = await getPrice(tokenAddress);
      if (!currentPrice) return null;

      call.currentPrice = currentPrice;
      call.lastChecked = new Date().toISOString();

      // Check if call has expired based on timeframe
      const submittedAt = new Date(call.submittedAt).getTime();
      const now = Date.now();
      const timeframeMs = this.parseTimeframe(call.timeframe);
      const expired = now - submittedAt > timeframeMs;

      let outcome: CallOutcome | null = null;

      if (call.direction === 'LONG') {
        if (currentPrice >= call.target) {
          outcome = {
            result: 'WIN',
            exitPrice: currentPrice,
            exitTime: new Date().toISOString(),
            returnPercent: ((currentPrice - call.entry) / call.entry) * 100,
          };
        } else if (currentPrice <= call.stopLoss) {
          outcome = {
            result: 'LOSS',
            exitPrice: currentPrice,
            exitTime: new Date().toISOString(),
            returnPercent: ((currentPrice - call.entry) / call.entry) * 100,
          };
        } else if (expired) {
          const returnPct = ((currentPrice - call.entry) / call.entry) * 100;
          outcome = {
            result: returnPct > 0 ? 'WIN' : returnPct < -2 ? 'LOSS' : 'NEUTRAL',
            exitPrice: currentPrice,
            exitTime: new Date().toISOString(),
            returnPercent: returnPct,
          };
        }
      } else if (call.direction === 'SHORT') {
        if (currentPrice <= call.target) {
          outcome = {
            result: 'WIN',
            exitPrice: currentPrice,
            exitTime: new Date().toISOString(),
            returnPercent: ((call.entry - currentPrice) / call.entry) * 100,
          };
        } else if (currentPrice >= call.stopLoss) {
          outcome = {
            result: 'LOSS',
            exitPrice: currentPrice,
            exitTime: new Date().toISOString(),
            returnPercent: ((call.entry - currentPrice) / call.entry) * 100,
          };
        } else if (expired) {
          const returnPct = ((call.entry - currentPrice) / call.entry) * 100;
          outcome = {
            result: returnPct > 0 ? 'WIN' : returnPct < -2 ? 'LOSS' : 'NEUTRAL',
            exitPrice: currentPrice,
            exitTime: new Date().toISOString(),
            returnPercent: returnPct,
          };
        }
      }

      if (outcome) {
        call.outcome = outcome;
        this.updateAnalystStats(call.analystId, outcome);
      }

      return outcome;
    } catch (error) {
      console.error(`Error checking call ${callId}:`, error);
      return null;
    }
  }

  /**
   * Parse timeframe string to milliseconds
   */
  private parseTimeframe(tf: string): number {
    const match = tf.match(/^(\d+)(m|h|d|w)$/i);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24h

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Update analyst stats after a call resolves
   */
  private updateAnalystStats(analystId: string, outcome: CallOutcome): void {
    const stats = this.analysts.get(analystId);
    if (!stats) return;

    if (outcome.result === 'WIN') {
      stats.wins++;
    } else if (outcome.result === 'LOSS') {
      stats.losses++;
    } else {
      stats.neutral++;
    }

    // Recalculate metrics
    const resolvedCalls = Array.from(this.calls.values()).filter(
      c => c.analystId === analystId && c.outcome
    );

    if (resolvedCalls.length > 0) {
      const totalReturns = resolvedCalls.reduce(
        (sum, c) => sum + (c.outcome?.returnPercent || 0), 
        0
      );
      stats.avgReturn = totalReturns / resolvedCalls.length;

      const wins = resolvedCalls.filter(c => c.outcome?.result === 'WIN');
      const losses = resolvedCalls.filter(c => c.outcome?.result === 'LOSS');

      stats.winRate = (stats.wins / (stats.wins + stats.losses)) * 100 || 0;

      const avgWin = wins.length > 0 
        ? wins.reduce((s, c) => s + (c.outcome?.returnPercent || 0), 0) / wins.length 
        : 0;
      const avgLoss = losses.length > 0 
        ? Math.abs(losses.reduce((s, c) => s + (c.outcome?.returnPercent || 0), 0) / losses.length)
        : 0;

      stats.profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;
    }

    // Update rankings
    this.updateRankings();
  }

  /**
   * Update all analyst rankings
   */
  private updateRankings(): void {
    const sorted = Array.from(this.analysts.values())
      .sort((a, b) => {
        // Sort by win rate, then by profit factor, then by total calls
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.profitFactor !== a.profitFactor) return b.profitFactor - a.profitFactor;
        return b.totalCalls - a.totalCalls;
      });

    sorted.forEach((stats, index) => {
      stats.rank = index + 1;
    });
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(limit: number = 20): AnalystStats[] {
    return Array.from(this.analysts.values())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
  }

  /**
   * Get analyst stats
   */
  getAnalystStats(analystId: string): AnalystStats | undefined {
    return this.analysts.get(analystId);
  }

  /**
   * Check all active calls
   */
  async checkAllCalls(): Promise<void> {
    const activeCalls = this.getActiveCalls();
    console.log(`[SCORING] Checking ${activeCalls.length} active calls...`);

    for (const call of activeCalls) {
      await this.checkCall(call.id);
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Start continuous monitoring
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[SCORING] Engine started');

    setInterval(() => {
      if (this.isRunning) {
        this.checkAllCalls();
      }
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    console.log('[SCORING] Engine stopped');
  }

  /**
   * Get engine status
   */
  status(): {
    running: boolean;
    activeCalls: number;
    resolvedCalls: number;
    totalAnalysts: number;
  } {
    const allCalls = Array.from(this.calls.values());
    return {
      running: this.isRunning,
      activeCalls: allCalls.filter(c => !c.outcome).length,
      resolvedCalls: allCalls.filter(c => c.outcome).length,
      totalAnalysts: this.analysts.size,
    };
  }
}

// Export
export { ScoringEngine };
export type { StoredCall };

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║         MORPHEUS Scoring Engine          ║');
  console.log('║       Prediction Tracking System         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const engine = new ScoringEngine();
  
  // Demo: Submit a test call
  const testCall = engine.submitCall({
    id: `test_${Date.now()}`,
    analystId: 'demo-analyst',
    token: { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112' },
    direction: 'LONG',
    entry: 100,
    target: 110,
    stopLoss: 95,
    timeframe: '24h',
    submittedAt: new Date().toISOString(),
  });

  console.log('Submitted test call:', testCall.id);
  console.log('Status:', engine.status());
}
