// Main Volume Scanner Module

import cron from 'node-cron';
import { TRACKED_TOKENS } from './tokens.js';
import { getMultipleVolumeData } from './dexscreener.js';
import { detectSpike } from './detector.js';
import { TelegramNotifier, createTelegramNotifier } from './telegram.js';
import { storage } from './storage.js';
import type { 
  VolumeScannerConfig, 
  VolumeSpike, 
  ScanResult, 
  TrackedToken,
  DEFAULT_CONFIG
} from './types.js';
import { DEFAULT_CONFIG as CONFIG_DEFAULTS } from './types.js';

export class VolumeScanner {
  private config: VolumeScannerConfig;
  private telegram: TelegramNotifier;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private lastScanResult: ScanResult | null = null;
  
  constructor(config: Partial<VolumeScannerConfig> = {}) {
    this.config = { ...CONFIG_DEFAULTS, ...config };
    
    // Use provided token or create from env
    this.telegram = new TelegramNotifier({
      botToken: config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '',
      defaultChatId: config.telegramDefaultChatId || process.env.TELEGRAM_CHAT_ID,
    });
  }
  
  /**
   * Initialize the scanner (load storage, verify Telegram)
   */
  async initialize(): Promise<void> {
    await storage.load();
    
    // Verify Telegram if configured
    if (this.telegram.isConfigured()) {
      const valid = await this.telegram.verifyToken();
      if (valid) {
        const info = await this.telegram.getBotInfo();
        console.log(`[VolumeScanner] Telegram bot connected: @${info?.username}`);
      } else {
        console.warn('[VolumeScanner] Telegram token invalid, alerts disabled');
      }
    } else {
      console.log('[VolumeScanner] Telegram not configured, alerts disabled');
    }
    
    console.log(`[VolumeScanner] Initialized with ${TRACKED_TOKENS.length} tracked tokens`);
  }
  
  /**
   * Run a single scan for volume spikes
   */
  async scan(): Promise<ScanResult> {
    console.log('[VolumeScanner] Starting volume scan...');
    const startTime = Date.now();
    
    const spikes: VolumeSpike[] = [];
    let alertsSent = 0;
    
    try {
      // Fetch volume data for all tracked tokens
      const volumeData = await getMultipleVolumeData(TRACKED_TOKENS, 300);
      console.log(`[VolumeScanner] Fetched data for ${volumeData.size} tokens`);
      
      // Process each token
      for (const [address, data] of volumeData.entries()) {
        // Update baseline
        const baseline = storage.updateBaseline(data);
        
        // Detect spike
        const spike = detectSpike(
          data,
          baseline,
          this.config.minSpikeMultiple,
          this.config.minPriceChangePercent
        );
        
        if (spike) {
          console.log(`[VolumeScanner] Spike detected: ${spike.token.symbol} ${spike.volumeSpikeMultiple.toFixed(1)}x`);
          
          // Store spike
          storage.addSpike(spike);
          spikes.push(spike);
          
          // Send alerts to subscribers
          const sentCount = await this.sendAlerts(spike);
          alertsSent += sentCount;
        }
      }
      
      // Save storage
      storage.setLastScan(new Date());
      await storage.save();
      
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`[VolumeScanner] Scan complete: ${spikes.length} spikes, ${alertsSent} alerts sent in ${elapsed.toFixed(1)}s`);
      
      const result: ScanResult = {
        scannedAt: new Date(),
        tokensScanned: volumeData.size,
        spikesDetected: spikes.length,
        alertsSent,
        spikes,
      };
      
      this.lastScanResult = result;
      return result;
      
    } catch (error) {
      console.error('[VolumeScanner] Scan failed:', error);
      return {
        scannedAt: new Date(),
        tokensScanned: 0,
        spikesDetected: 0,
        alertsSent: 0,
        spikes: [],
      };
    }
  }
  
  /**
   * Send alerts for a spike to all subscribers
   */
  private async sendAlerts(spike: VolumeSpike): Promise<number> {
    if (!this.telegram.isConfigured()) {
      return 0;
    }
    
    let sent = 0;
    const subscriptions = storage.getSubscriptions();
    
    // Also check default chat ID from config
    const defaultChatId = this.config.telegramDefaultChatId || process.env.TELEGRAM_CHAT_ID;
    if (defaultChatId && !subscriptions.find(s => s.chatId === defaultChatId)) {
      subscriptions.push({
        chatId: defaultChatId,
        subscribedAt: new Date(),
        minSeverity: 'LOW',
      });
    }
    
    for (const sub of subscriptions) {
      // Check severity threshold
      const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
      const minSeverityIndex = severityOrder.indexOf(sub.minSeverity);
      const spikeSeverityIndex = severityOrder.indexOf(spike.severity);
      
      if (spikeSeverityIndex < minSeverityIndex) {
        continue;
      }
      
      // Check token filter
      if (sub.tokens && sub.tokens.length > 0) {
        if (!sub.tokens.includes(spike.token.symbol)) {
          continue;
        }
      }
      
      // Check cooldown
      if (storage.wasAlertSentRecently(
        spike.token.address,
        sub.chatId,
        this.config.alertCooldownMs
      )) {
        console.log(`[VolumeScanner] Skipping alert for ${spike.token.symbol} to ${sub.chatId} (cooldown)`);
        continue;
      }
      
      // Send alert
      const alert = await this.telegram.sendSpikeAlert(spike, sub.chatId);
      
      if (alert) {
        storage.addSentAlert(alert);
        sent++;
      }
    }
    
    return sent;
  }
  
  /**
   * Start the scanner with scheduled scans
   */
  start(): void {
    if (this.isRunning) {
      console.log('[VolumeScanner] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[VolumeScanner] Starting scheduled scans...');
    
    // Run initial scan
    this.scan();
    
    // Schedule scans every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', () => {
      if (this.isRunning) {
        this.scan();
      }
    });
    
    console.log('[VolumeScanner] Scheduled to run every 5 minutes');
  }
  
  /**
   * Stop the scanner
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    
    console.log('[VolumeScanner] Stopped');
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    running: boolean;
    telegramConfigured: boolean;
    trackedTokens: number;
    subscriptions: number;
    lastScan: Date | null;
    lastResult: ScanResult | null;
  } {
    return {
      running: this.isRunning,
      telegramConfigured: this.telegram.isConfigured(),
      trackedTokens: TRACKED_TOKENS.length,
      subscriptions: storage.getSubscriptions().length,
      lastScan: storage.getLastScan(),
      lastResult: this.lastScanResult,
    };
  }
  
  /**
   * Get recent spikes
   */
  getRecentSpikes(limit: number = 20): VolumeSpike[] {
    return storage.getRecentSpikes(limit);
  }
  
  /**
   * Get top tokens by current volume
   */
  async getTopByVolume(limit: number = 10): Promise<Array<{
    token: TrackedToken;
    volume1h: number;
    volume24h: number;
    priceChange1h: number;
  }>> {
    const volumeData = await getMultipleVolumeData(TRACKED_TOKENS, 300);
    
    const sorted = Array.from(volumeData.values())
      .sort((a, b) => b.volume1h - a.volume1h)
      .slice(0, limit);
    
    return sorted.map(d => ({
      token: d.token,
      volume1h: d.volume1h,
      volume24h: d.volume24h,
      priceChange1h: d.priceChange1h,
    }));
  }
  
  /**
   * Subscribe a chat to alerts
   */
  subscribe(
    chatId: string,
    minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'MEDIUM',
    tokens?: string[]
  ): void {
    storage.addSubscription({
      chatId,
      subscribedAt: new Date(),
      minSeverity,
      tokens,
    });
    storage.save();
    console.log(`[VolumeScanner] Chat ${chatId} subscribed to alerts (min severity: ${minSeverity})`);
  }
  
  /**
   * Unsubscribe a chat
   */
  unsubscribe(chatId: string): boolean {
    const removed = storage.removeSubscription(chatId);
    if (removed) {
      storage.save();
      console.log(`[VolumeScanner] Chat ${chatId} unsubscribed from alerts`);
    }
    return removed;
  }
  
  /**
   * Get subscription status for a chat
   */
  getSubscription(chatId: string) {
    return storage.getSubscription(chatId);
  }
  
  /**
   * Get baselines for all tokens
   */
  getBaselines() {
    return storage.getAllBaselines();
  }
}

// Singleton instance
let scannerInstance: VolumeScanner | null = null;

export function getVolumeScanner(config?: Partial<VolumeScannerConfig>): VolumeScanner {
  if (!scannerInstance) {
    scannerInstance = new VolumeScanner(config);
  }
  return scannerInstance;
}

export { VolumeScanner as default };
