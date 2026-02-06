// Storage for volume baselines and alerts

import fs from 'fs/promises';
import path from 'path';
import type { 
  VolumeBaseline, 
  VolumeSpike, 
  SentAlert, 
  AlertSubscription,
  VolumeData 
} from './types.js';

const DATA_DIR = path.join(process.cwd(), 'data', 'volume-scanner');

interface StorageData {
  baselines: Record<string, VolumeBaseline>;
  recentSpikes: VolumeSpike[];
  sentAlerts: SentAlert[];
  subscriptions: AlertSubscription[];
  lastScan: string | null;
}

const DEFAULT_DATA: StorageData = {
  baselines: {},
  recentSpikes: [],
  sentAlerts: [],
  subscriptions: [],
  lastScan: null,
};

class VolumeStorage {
  private data: StorageData = DEFAULT_DATA;
  private dataPath: string;
  private loaded: boolean = false;
  
  constructor() {
    this.dataPath = path.join(DATA_DIR, 'volume-data.json');
  }
  
  /**
   * Ensure data directory exists
   */
  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {
      // Directory exists
    }
  }
  
  /**
   * Load data from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    
    try {
      await this.ensureDir();
      const content = await fs.readFile(this.dataPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Merge with defaults to handle schema upgrades
      this.data = {
        ...DEFAULT_DATA,
        ...parsed,
      };
      
      // Convert date strings back to Date objects
      this.data.recentSpikes = this.data.recentSpikes.map(s => ({
        ...s,
        detectedAt: new Date(s.detectedAt),
      }));
      
      this.data.sentAlerts = this.data.sentAlerts.map(a => ({
        ...a,
        sentAt: new Date(a.sentAt),
      }));
      
      this.data.subscriptions = this.data.subscriptions.map(s => ({
        ...s,
        subscribedAt: new Date(s.subscribedAt),
      }));
      
      console.log(`[Storage] Loaded ${Object.keys(this.data.baselines).length} baselines, ${this.data.recentSpikes.length} spikes`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[Storage] No existing data, starting fresh');
        this.data = DEFAULT_DATA;
      } else {
        console.error('[Storage] Failed to load:', error);
      }
    }
    
    this.loaded = true;
  }
  
  /**
   * Save data to disk
   */
  async save(): Promise<void> {
    try {
      await this.ensureDir();
      await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('[Storage] Failed to save:', error);
    }
  }
  
  // ============ BASELINES ============
  
  /**
   * Get baseline for a token
   */
  getBaseline(tokenAddress: string): VolumeBaseline | null {
    return this.data.baselines[tokenAddress] || null;
  }
  
  /**
   * Update baseline from volume data
   */
  updateBaseline(volumeData: VolumeData): VolumeBaseline {
    const existing = this.data.baselines[volumeData.token.address];
    const avgHourlyVolume = volumeData.volume24h / 24;
    const avgHourlyTxns = (volumeData.txns24h.buys + volumeData.txns24h.sells) / 24;
    
    if (existing) {
      // Exponential moving average (weight recent data more)
      const alpha = 0.3;
      const newBaseline: VolumeBaseline = {
        tokenAddress: volumeData.token.address,
        symbol: volumeData.token.symbol,
        avgHourlyVolume: existing.avgHourlyVolume * (1 - alpha) + avgHourlyVolume * alpha,
        avgHourlyTxns: existing.avgHourlyTxns * (1 - alpha) + avgHourlyTxns * alpha,
        lastUpdated: new Date(),
        dataPoints: existing.dataPoints + 1,
      };
      this.data.baselines[volumeData.token.address] = newBaseline;
      return newBaseline;
    } else {
      // First data point
      const newBaseline: VolumeBaseline = {
        tokenAddress: volumeData.token.address,
        symbol: volumeData.token.symbol,
        avgHourlyVolume,
        avgHourlyTxns,
        lastUpdated: new Date(),
        dataPoints: 1,
      };
      this.data.baselines[volumeData.token.address] = newBaseline;
      return newBaseline;
    }
  }
  
  /**
   * Get all baselines
   */
  getAllBaselines(): VolumeBaseline[] {
    return Object.values(this.data.baselines);
  }
  
  // ============ SPIKES ============
  
  /**
   * Add a detected spike
   */
  addSpike(spike: VolumeSpike): void {
    this.data.recentSpikes.unshift(spike);
    
    // Keep only last 100 spikes
    if (this.data.recentSpikes.length > 100) {
      this.data.recentSpikes = this.data.recentSpikes.slice(0, 100);
    }
  }
  
  /**
   * Get recent spikes
   */
  getRecentSpikes(limit: number = 20): VolumeSpike[] {
    return this.data.recentSpikes.slice(0, limit);
  }
  
  /**
   * Get spikes by token
   */
  getSpikesByToken(tokenAddress: string, limit: number = 10): VolumeSpike[] {
    return this.data.recentSpikes
      .filter(s => s.token.address === tokenAddress)
      .slice(0, limit);
  }
  
  /**
   * Check if a spike was recently detected for a token
   */
  hasRecentSpike(tokenAddress: string, withinMs: number): boolean {
    const cutoff = Date.now() - withinMs;
    return this.data.recentSpikes.some(
      s => s.token.address === tokenAddress && s.detectedAt.getTime() > cutoff
    );
  }
  
  // ============ ALERTS ============
  
  /**
   * Record a sent alert
   */
  addSentAlert(alert: SentAlert): void {
    this.data.sentAlerts.push(alert);
    
    // Keep only last 500 alerts
    if (this.data.sentAlerts.length > 500) {
      this.data.sentAlerts = this.data.sentAlerts.slice(-500);
    }
  }
  
  /**
   * Check if alert was sent recently for a token/chat
   */
  wasAlertSentRecently(
    tokenAddress: string,
    chatId: string,
    withinMs: number
  ): boolean {
    const cutoff = Date.now() - withinMs;
    return this.data.sentAlerts.some(
      a => a.tokenAddress === tokenAddress && 
           a.chatId === chatId && 
           a.sentAt.getTime() > cutoff
    );
  }
  
  /**
   * Get sent alerts for a chat
   */
  getAlertHistory(chatId: string, limit: number = 20): SentAlert[] {
    return this.data.sentAlerts
      .filter(a => a.chatId === chatId)
      .slice(-limit);
  }
  
  // ============ SUBSCRIPTIONS ============
  
  /**
   * Add a subscription
   */
  addSubscription(subscription: AlertSubscription): void {
    // Remove existing subscription for this chat
    this.data.subscriptions = this.data.subscriptions.filter(
      s => s.chatId !== subscription.chatId
    );
    this.data.subscriptions.push(subscription);
  }
  
  /**
   * Remove a subscription
   */
  removeSubscription(chatId: string): boolean {
    const before = this.data.subscriptions.length;
    this.data.subscriptions = this.data.subscriptions.filter(
      s => s.chatId !== chatId
    );
    return this.data.subscriptions.length < before;
  }
  
  /**
   * Get all subscriptions
   */
  getSubscriptions(): AlertSubscription[] {
    return this.data.subscriptions;
  }
  
  /**
   * Get subscription for a chat
   */
  getSubscription(chatId: string): AlertSubscription | null {
    return this.data.subscriptions.find(s => s.chatId === chatId) || null;
  }
  
  // ============ SCAN STATE ============
  
  /**
   * Update last scan time
   */
  setLastScan(time: Date): void {
    this.data.lastScan = time.toISOString();
  }
  
  /**
   * Get last scan time
   */
  getLastScan(): Date | null {
    return this.data.lastScan ? new Date(this.data.lastScan) : null;
  }
  
  // ============ CLEANUP ============
  
  /**
   * Clean up old data
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    // Clean old spikes
    this.data.recentSpikes = this.data.recentSpikes.filter(
      s => s.detectedAt.getTime() > cutoff
    );
    
    // Clean old alerts (keep more history)
    const alertCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.data.sentAlerts = this.data.sentAlerts.filter(
      a => a.sentAt.getTime() > alertCutoff
    );
  }
}

// Singleton instance
export const storage = new VolumeStorage();

// Export class for testing
export { VolumeStorage };
