/**
 * Funding Rate Data Integration
 * 
 * High funding rates with heavy shorting can signal incoming squeezes/bounces.
 * Uses Coinglass API (free tier) and Binance for funding data.
 */

const COINGLASS_API = 'https://open-api.coinglass.com/public/v2';
const BINANCE_API = 'https://fapi.binance.com/fapi/v1';

export interface FundingData {
  symbol: string;
  exchange: string;
  fundingRate: number;       // Current funding rate (%)
  predictedRate: number;     // Predicted next funding rate
  openInterest: number;      // Open interest in USD
  longShortRatio: number;    // Long/Short ratio (>1 = more longs)
  timestamp: number;
}

export interface FundingSummary {
  symbol: string;
  avgFundingRate: number;
  maxFundingRate: number;
  minFundingRate: number;
  exchanges: FundingData[];
  sentiment: 'EXTREME_LONG' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'EXTREME_SHORT';
  squeezeAlert: boolean;     // True if conditions suggest potential squeeze
  squeezePotential: 'LONG_SQUEEZE' | 'SHORT_SQUEEZE' | null;
}

/**
 * Map Solana token symbols to perpetual trading symbols
 */
const PERP_SYMBOL_MAP: Record<string, string> = {
  'SOL': 'SOLUSDT',
  'JUP': 'JUPUSDT', 
  'BONK': 'BONKUSDT',
  'WIF': 'WIFUSDT',
  'PYTH': 'PYTHUSDT',
  'JTO': 'JTOUSDT',
  'RNDR': 'RNDRUSDT',
  'RAY': 'RAYUSDT',
  'ORCA': 'ORCAUSDT',
};

/**
 * Get funding rate from Binance Futures
 */
export async function getBinanceFunding(symbol: string): Promise<FundingData | null> {
  const perpSymbol = PERP_SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
  
  try {
    const [fundingRes, oiRes, ratioRes] = await Promise.all([
      fetch(`${BINANCE_API}/fundingRate?symbol=${perpSymbol}&limit=1`),
      fetch(`${BINANCE_API}/openInterest?symbol=${perpSymbol}`),
      fetch(`${BINANCE_API}/globalLongShortAccountRatio?symbol=${perpSymbol}&period=1h&limit=1`),
    ]);

    if (!fundingRes.ok) return null;

    const fundingData = await fundingRes.json();
    const oiData = oiRes.ok ? await oiRes.json() : null;
    const ratioData = ratioRes.ok ? await ratioRes.json() : null;

    if (!fundingData || fundingData.length === 0) return null;

    const rate = parseFloat(fundingData[0].fundingRate) * 100; // Convert to percentage

    return {
      symbol: symbol.toUpperCase(),
      exchange: 'binance',
      fundingRate: rate,
      predictedRate: rate, // Binance shows current rate
      openInterest: oiData ? parseFloat(oiData.openInterest) : 0,
      longShortRatio: ratioData?.[0] ? parseFloat(ratioData[0].longShortRatio) : 1,
      timestamp: fundingData[0].fundingTime,
    };
  } catch (error) {
    console.error(`Error fetching Binance funding for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get funding rates from multiple exchanges via Coinglass
 */
export async function getCoinglassFunding(symbol: string): Promise<FundingData[]> {
  const results: FundingData[] = [];
  
  try {
    // Coinglass aggregated funding endpoint
    const response = await fetch(
      `${COINGLASS_API}/funding?symbol=${symbol.toUpperCase()}`
    );

    if (!response.ok) {
      // Fallback to Binance only
      const binance = await getBinanceFunding(symbol);
      return binance ? [binance] : [];
    }

    const data = await response.json();
    
    if (data.code !== '0' || !data.data) {
      const binance = await getBinanceFunding(symbol);
      return binance ? [binance] : [];
    }

    // Parse Coinglass response
    for (const item of data.data) {
      results.push({
        symbol: symbol.toUpperCase(),
        exchange: item.exchangeName?.toLowerCase() || 'unknown',
        fundingRate: parseFloat(item.rate) * 100 || 0,
        predictedRate: parseFloat(item.predictedRate) * 100 || 0,
        openInterest: parseFloat(item.openInterest) || 0,
        longShortRatio: parseFloat(item.longShortRatio) || 1,
        timestamp: item.time || Date.now(),
      });
    }

    return results;
  } catch (error) {
    console.error(`Error fetching Coinglass funding for ${symbol}:`, error);
    // Fallback to Binance
    const binance = await getBinanceFunding(symbol);
    return binance ? [binance] : [];
  }
}

/**
 * Analyze funding rates and detect squeeze potential
 */
export async function analyzeFunding(symbol: string): Promise<FundingSummary | null> {
  const fundingData = await getCoinglassFunding(symbol);
  
  if (fundingData.length === 0) return null;

  const rates = fundingData.map(d => d.fundingRate);
  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const maxRate = Math.max(...rates);
  const minRate = Math.min(...rates);

  // Calculate average long/short ratio
  const ratios = fundingData.filter(d => d.longShortRatio > 0).map(d => d.longShortRatio);
  const avgRatio = ratios.length > 0 
    ? ratios.reduce((a, b) => a + b, 0) / ratios.length 
    : 1;

  // Determine sentiment
  let sentiment: FundingSummary['sentiment'];
  if (avgRate > 0.1) sentiment = 'EXTREME_LONG';      // >0.1% = very bullish positioning
  else if (avgRate > 0.03) sentiment = 'BULLISH';     // >0.03% = bullish
  else if (avgRate > -0.03) sentiment = 'NEUTRAL';   // -0.03% to 0.03%
  else if (avgRate > -0.1) sentiment = 'BEARISH';    // <-0.03% = bearish
  else sentiment = 'EXTREME_SHORT';                   // <-0.1% = very bearish

  // Detect squeeze potential
  // HIGH funding + lots of longs = potential long squeeze (price drops, longs get rekt)
  // NEGATIVE funding + lots of shorts = potential short squeeze (price pumps, shorts get rekt)
  let squeezePotential: FundingSummary['squeezePotential'] = null;
  let squeezeAlert = false;

  if (avgRate > 0.05 && avgRatio > 1.2) {
    // High positive funding + more longs = LONG SQUEEZE potential
    squeezePotential = 'LONG_SQUEEZE';
    squeezeAlert = avgRate > 0.08;
  } else if (avgRate < -0.03 && avgRatio < 0.8) {
    // Negative funding + more shorts = SHORT SQUEEZE potential
    squeezePotential = 'SHORT_SQUEEZE';
    squeezeAlert = avgRate < -0.05;
  }

  return {
    symbol: symbol.toUpperCase(),
    avgFundingRate: avgRate,
    maxFundingRate: maxRate,
    minFundingRate: minRate,
    exchanges: fundingData,
    sentiment,
    squeezeAlert,
    squeezePotential,
  };
}

/**
 * Get funding summary for multiple tokens
 */
export async function getMultipleFundingAnalysis(
  symbols: string[]
): Promise<Map<string, FundingSummary>> {
  const results = new Map<string, FundingSummary>();
  
  for (const symbol of symbols) {
    try {
      const analysis = await analyzeFunding(symbol);
      if (analysis) {
        results.set(symbol.toUpperCase(), analysis);
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }
  
  return results;
}

/**
 * Get squeeze alerts - tokens with high squeeze potential
 */
export async function getSqueezeAlerts(
  symbols: string[]
): Promise<FundingSummary[]> {
  const analyses = await getMultipleFundingAnalysis(symbols);
  
  return Array.from(analyses.values())
    .filter(a => a.squeezeAlert || a.squeezePotential)
    .sort((a, b) => Math.abs(b.avgFundingRate) - Math.abs(a.avgFundingRate));
}

export default {
  getBinanceFunding,
  getCoinglassFunding,
  analyzeFunding,
  getMultipleFundingAnalysis,
  getSqueezeAlerts,
};
