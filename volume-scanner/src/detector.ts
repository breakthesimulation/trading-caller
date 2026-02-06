// Volume Spike Detection Logic

import type { VolumeData, VolumeSpike, VolumeBaseline } from './types.js';
import { getDexScreenerUrl } from './dexscreener.js';

/**
 * Generate a unique spike ID
 */
function generateSpikeId(): string {
  return `spike_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Calculate the average hourly volume from 24h volume
 */
export function calculateAvgHourlyVolume(volume24h: number): number {
  return volume24h / 24;
}

/**
 * Calculate buy/sell ratio
 * >1 = more buys, <1 = more sells, 1 = balanced
 */
export function calculateBuySellRatio(buys: number, sells: number): number {
  if (sells === 0) return buys > 0 ? 10 : 1; // Cap at 10x if no sells
  return buys / sells;
}

/**
 * Calculate volume velocity (how fast volume is accelerating)
 * Compares 1h volume to 6h average hourly
 */
export function calculateVolumeVelocity(volume1h: number, volume6h: number): number {
  const avg6hHourly = volume6h / 6;
  if (avg6hHourly === 0) return 0;
  return volume1h / avg6hHourly;
}

/**
 * Classify spike type based on price action and buy/sell ratio
 */
export function classifySpikeType(
  priceChange1h: number,
  buySellRatio: number
): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  // Strong buying pressure with price up = BULLISH
  if (priceChange1h > 2 && buySellRatio > 1.2) {
    return 'BULLISH';
  }
  
  // Strong selling pressure with price down = BEARISH
  if (priceChange1h < -2 && buySellRatio < 0.8) {
    return 'BEARISH';
  }
  
  // High volume with minimal price change = NEUTRAL (absorption)
  return 'NEUTRAL';
}

/**
 * Determine spike severity based on multiple factors
 */
export function determineSeverity(
  volumeSpikeMultiple: number,
  priceChange1h: number,
  buySellRatio: number,
  volumeVelocity: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  let score = 0;
  
  // Volume spike contribution (0-4 points)
  if (volumeSpikeMultiple >= 10) score += 4;
  else if (volumeSpikeMultiple >= 5) score += 3;
  else if (volumeSpikeMultiple >= 3) score += 2;
  else if (volumeSpikeMultiple >= 2) score += 1;
  
  // Price change contribution (0-3 points)
  const absPriceChange = Math.abs(priceChange1h);
  if (absPriceChange >= 20) score += 3;
  else if (absPriceChange >= 10) score += 2;
  else if (absPriceChange >= 5) score += 1;
  
  // Buy/sell imbalance contribution (0-2 points)
  const buySellDiff = Math.abs(buySellRatio - 1);
  if (buySellDiff >= 1) score += 2;
  else if (buySellDiff >= 0.5) score += 1;
  
  // Volume acceleration contribution (0-2 points)
  if (volumeVelocity >= 5) score += 2;
  else if (volumeVelocity >= 2) score += 1;
  
  // Classify severity (max possible: 11)
  if (score >= 8) return 'EXTREME';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

/**
 * Detect if a volume spike occurred
 */
export function detectSpike(
  data: VolumeData,
  baseline: VolumeBaseline | null,
  minSpikeMultiple: number = 2.0,
  minPriceChange: number = 0
): VolumeSpike | null {
  // Calculate average hourly volume from 24h data
  const avgHourlyVolume = baseline?.avgHourlyVolume || calculateAvgHourlyVolume(data.volume24h);
  
  // Skip if no meaningful baseline
  if (avgHourlyVolume < 1000) {
    return null;
  }
  
  // Calculate spike multiple
  const volumeSpikeMultiple = data.volume1h / avgHourlyVolume;
  
  // Check if it meets minimum threshold
  if (volumeSpikeMultiple < minSpikeMultiple) {
    return null;
  }
  
  // Check price change requirement (if specified)
  if (minPriceChange > 0 && Math.abs(data.priceChange1h) < minPriceChange) {
    return null;
  }
  
  // Calculate additional metrics
  const buySellRatio = calculateBuySellRatio(data.txns1h.buys, data.txns1h.sells);
  const volumeVelocity = calculateVolumeVelocity(data.volume1h, data.volume6h);
  const spikeType = classifySpikeType(data.priceChange1h, buySellRatio);
  const severity = determineSeverity(volumeSpikeMultiple, data.priceChange1h, buySellRatio, volumeVelocity);
  
  return {
    id: generateSpikeId(),
    token: data.token,
    pairAddress: data.pairAddress,
    
    // Volume metrics
    currentVolume1h: data.volume1h,
    avgHourlyVolume,
    volumeSpikeMultiple,
    volumeSpikePercent: (volumeSpikeMultiple - 1) * 100,
    
    // Price metrics
    priceUsd: data.priceUsd,
    priceChange1h: data.priceChange1h,
    priceChange24h: data.priceChange24h,
    
    // Transaction metrics
    buyCount1h: data.txns1h.buys,
    sellCount1h: data.txns1h.sells,
    buySellRatio,
    
    // Velocity
    volume6h: data.volume6h,
    volumeVelocity,
    
    // Classification
    spikeType,
    severity,
    
    detectedAt: new Date(),
    dexScreenerUrl: getDexScreenerUrl(data.pairAddress),
  };
}

/**
 * Format spike for display
 */
export function formatSpikeAlert(spike: VolumeSpike): string {
  const emoji = spike.spikeType === 'BULLISH' ? '🟢' : spike.spikeType === 'BEARISH' ? '🔴' : '⚪';
  const severityEmoji = {
    EXTREME: '🚨🚨',
    HIGH: '🚨',
    MEDIUM: '⚠️',
    LOW: '📊',
  }[spike.severity];
  
  const priceEmoji = spike.priceChange1h > 0 ? '📈' : spike.priceChange1h < 0 ? '📉' : '➡️';
  
  // Format numbers nicely
  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  
  const formatPrice = (p: number) => {
    if (p < 0.001) return `$${p.toFixed(8)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(2)}`;
  };

  return `${severityEmoji} **VOLUME SPIKE DETECTED** ${emoji}

**${spike.token.symbol}** (${spike.token.name})

📊 **Volume**
• Current 1h: ${formatVolume(spike.currentVolume1h)}
• Avg hourly: ${formatVolume(spike.avgHourlyVolume)}
• Spike: **${spike.volumeSpikeMultiple.toFixed(1)}x** (+${spike.volumeSpikePercent.toFixed(0)}%)

${priceEmoji} **Price**
• Current: ${formatPrice(spike.priceUsd)}
• 1h change: ${spike.priceChange1h > 0 ? '+' : ''}${spike.priceChange1h.toFixed(2)}%
• 24h change: ${spike.priceChange24h > 0 ? '+' : ''}${spike.priceChange24h.toFixed(2)}%

🔄 **Transactions (1h)**
• Buys: ${spike.buyCount1h} | Sells: ${spike.sellCount1h}
• B/S Ratio: ${spike.buySellRatio.toFixed(2)}x
• Velocity: ${spike.volumeVelocity.toFixed(1)}x

Type: **${spike.spikeType}** | Severity: **${spike.severity}**

🔗 [View on DexScreener](${spike.dexScreenerUrl})`;
}
