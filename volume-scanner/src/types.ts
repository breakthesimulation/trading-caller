// Volume Scanner Types

export interface TrackedToken {
  symbol: string;
  name: string;
  address: string;
  pairAddress?: string;
}

export interface VolumeData {
  token: TrackedToken;
  pairAddress: string;
  priceUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  volume1h: number;
  volume24h: number;
  volume6h: number;
  liquidity: number;
  fdv: number;
  txns1h: {
    buys: number;
    sells: number;
  };
  txns24h: {
    buys: number;
    sells: number;
  };
  fetchedAt: Date;
}

export interface VolumeBaseline {
  tokenAddress: string;
  symbol: string;
  avgHourlyVolume: number;
  avgHourlyTxns: number;
  lastUpdated: Date;
  dataPoints: number;
}

export interface VolumeSpike {
  id: string;
  token: TrackedToken;
  pairAddress: string;
  
  // Volume metrics
  currentVolume1h: number;
  avgHourlyVolume: number;
  volumeSpikeMultiple: number;
  volumeSpikePercent: number;
  
  // Price metrics
  priceUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  
  // Transaction metrics
  buyCount1h: number;
  sellCount1h: number;
  buySellRatio: number;
  
  // Volume velocity (acceleration)
  volume6h: number;
  volumeVelocity: number; // How fast volume is accelerating
  
  // Classification
  spikeType: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  
  detectedAt: Date;
  dexScreenerUrl: string;
}

export interface SentAlert {
  spikeId: string;
  tokenAddress: string;
  chatId: string;
  sentAt: Date;
  messageId?: number;
}

export interface AlertSubscription {
  chatId: string;
  subscribedAt: Date;
  minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  tokens?: string[]; // If empty, subscribe to all
}

export interface ScanResult {
  scannedAt: Date;
  tokensScanned: number;
  spikesDetected: number;
  alertsSent: number;
  spikes: VolumeSpike[];
}

export interface VolumeScannerConfig {
  // Scan settings
  scanIntervalMs: number;
  
  // Spike detection thresholds
  minSpikeMultiple: number;      // Default 2x
  minPriceChangePercent: number; // Minimum price change to alert
  
  // Cooldown settings
  alertCooldownMs: number;       // Per token per chat
  
  // Telegram settings
  telegramBotToken?: string;
  telegramDefaultChatId?: string;
}

export const DEFAULT_CONFIG: VolumeScannerConfig = {
  scanIntervalMs: 5 * 60 * 1000, // 5 minutes
  minSpikeMultiple: 2.0,
  minPriceChangePercent: 0,      // Alert on any price move with volume spike
  alertCooldownMs: 60 * 60 * 1000, // 1 hour per token
};
