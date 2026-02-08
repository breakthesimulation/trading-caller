/**
 * Fundamental Analysis Types
 * News, unlocks, TVL, whale activity
 */

export interface TokenUnlock {
  token: string;
  date: string;
  amount: number;
  percentage: number;
  category: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  relevance: number; // 0-100
}

export interface TVLData {
  current: number;
  change24h: number;
  changePercent24h: number;
  change7d: number;
  changePercent7d: number;
  trend: 'UP' | 'STABLE' | 'DOWN';
}

export interface WhaleActivity {
  timestamp: string;
  type: 'BUY' | 'SELL';
  amountUSD: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FundamentalAnalysis {
  token: string;
  timestamp: string;
  
  // Unlocks
  unlocks: {
    upcoming7d: TokenUnlock[];
    upcoming30d: TokenUnlock[];
    impactScore: number; // -100 to 100
  };
  
  // News
  news: {
    recent24h: NewsItem[];
    sentimentScore: number; // -100 to 100
    majorEvents: string[];
  };
  
  // TVL
  tvl: TVLData | null;
  
  // Whale Activity
  whales: {
    recent24h: WhaleActivity[];
    netFlow24h: number;
    trend: 'ACCUMULATION' | 'NEUTRAL' | 'DISTRIBUTION';
  };
  
  // Overall Score
  overallScore: number; // -100 to 100
  recommendation: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  reasoning: string[];
}

export interface ConfidenceFactor {
  name: string;
  category: 'TECHNICAL' | 'FUNDAMENTAL' | 'SENTIMENT' | 'HISTORICAL';
  weight: number;
  value: number;
  contribution: number; // To overall confidence
  description: string;
}

export interface ConfidenceBreakdown {
  totalConfidence: number;
  factors: ConfidenceFactor[];
  historicalWinRate: number; // For this setup type
  similarSetups: number; // Count of similar historical setups
  reasoning: string;
}
