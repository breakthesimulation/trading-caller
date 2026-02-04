/**
 * Self-Improvement Learner
 * 
 * Analyzes what patterns lead to wins, adjusts confidence weights,
 * and generates insights about performance.
 */

import { db } from '../db/index.js';
import brain from '../agent/brain.js';
import tracker from './tracker.js';

interface PatternAnalysis {
  pattern: string;
  winRate: number;
  sampleSize: number;
  avgPnl: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface LearningInsight {
  category: 'indicator' | 'token' | 'timing' | 'general';
  insight: string;
  actionable: boolean;
  adjustment?: {
    target: string;
    oldWeight: number;
    newWeight: number;
  };
}

/**
 * Analyze indicator patterns that lead to wins
 */
export function analyzeIndicatorPatterns(): PatternAnalysis[] {
  const weights = db.getAllLearningWeights();
  const patterns: PatternAnalysis[] = [];
  
  for (const weight of weights) {
    if (weight.category !== 'indicator') continue;
    
    const total = weight.winCount + weight.lossCount;
    if (total < 5) continue; // Need enough data
    
    const winRate = (weight.winCount / total) * 100;
    const avgPnl = total > 0 ? weight.totalPnl / total : 0;
    
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (total >= 20) confidence = 'high';
    else if (total >= 10) confidence = 'medium';
    
    let recommendation = '';
    if (winRate >= 60) {
      recommendation = 'Increase weight - strong performer';
    } else if (winRate <= 40) {
      recommendation = 'Decrease weight - underperforming';
    } else {
      recommendation = 'Maintain current weight';
    }
    
    patterns.push({
      pattern: weight.id,
      winRate,
      sampleSize: total,
      avgPnl,
      confidence,
      recommendation,
    });
  }
  
  // Sort by win rate
  return patterns.sort((a, b) => b.winRate - a.winRate);
}

/**
 * Analyze token-specific performance
 */
export function analyzeTokenPerformance(): PatternAnalysis[] {
  const weights = db.getAllLearningWeights();
  const patterns: PatternAnalysis[] = [];
  
  for (const weight of weights) {
    if (weight.category !== 'token') continue;
    
    const total = weight.winCount + weight.lossCount;
    if (total < 3) continue;
    
    const winRate = (weight.winCount / total) * 100;
    const avgPnl = total > 0 ? weight.totalPnl / total : 0;
    
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (total >= 15) confidence = 'high';
    else if (total >= 7) confidence = 'medium';
    
    const tokenName = weight.id.replace('token_', '');
    
    let recommendation = '';
    if (winRate >= 65) {
      recommendation = `${tokenName} shows strong predictability - prioritize`;
    } else if (winRate <= 35) {
      recommendation = `${tokenName} is hard to predict - reduce exposure`;
    } else {
      recommendation = `${tokenName} is average - standard weighting`;
    }
    
    patterns.push({
      pattern: tokenName,
      winRate,
      sampleSize: total,
      avgPnl,
      confidence,
      recommendation,
    });
  }
  
  return patterns.sort((a, b) => b.winRate - a.winRate);
}

/**
 * Generate learning insights from performance data
 */
export async function generateInsights(): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = [];
  
  // 1. Indicator insights
  const indicatorPatterns = analyzeIndicatorPatterns();
  
  // Find best indicator
  const bestIndicator = indicatorPatterns[0];
  if (bestIndicator && bestIndicator.winRate >= 55) {
    insights.push({
      category: 'indicator',
      insight: `${bestIndicator.pattern} is your best performing indicator (${bestIndicator.winRate.toFixed(1)}% win rate over ${bestIndicator.sampleSize} trades)`,
      actionable: true,
      adjustment: {
        target: bestIndicator.pattern,
        oldWeight: 1.0,
        newWeight: Math.min(1.5, 1 + (bestIndicator.winRate - 50) / 100),
      },
    });
  }
  
  // Find worst indicator
  const worstIndicator = indicatorPatterns[indicatorPatterns.length - 1];
  if (worstIndicator && worstIndicator.winRate <= 45 && worstIndicator.sampleSize >= 5) {
    insights.push({
      category: 'indicator',
      insight: `${worstIndicator.pattern} is underperforming (${worstIndicator.winRate.toFixed(1)}% win rate) - consider reducing its influence`,
      actionable: true,
      adjustment: {
        target: worstIndicator.pattern,
        oldWeight: 1.0,
        newWeight: Math.max(0.5, 1 - (50 - worstIndicator.winRate) / 100),
      },
    });
  }
  
  // 2. Token insights
  const tokenPatterns = analyzeTokenPerformance();
  
  // Best token
  const bestToken = tokenPatterns[0];
  if (bestToken && bestToken.winRate >= 60) {
    insights.push({
      category: 'token',
      insight: `${bestToken.pattern} is highly predictable (${bestToken.winRate.toFixed(1)}% win rate) - consider increasing coverage`,
      actionable: false,
    });
  }
  
  // Worst token
  const worstToken = tokenPatterns[tokenPatterns.length - 1];
  if (worstToken && worstToken.winRate <= 40 && worstToken.sampleSize >= 3) {
    insights.push({
      category: 'token',
      insight: `${worstToken.pattern} signals are unreliable (${worstToken.winRate.toFixed(1)}% win rate) - consider excluding`,
      actionable: false,
    });
  }
  
  // 3. Overall performance insight
  const stats = tracker.getPerformanceStats();
  if (stats.total >= 10) {
    const overallStatus = stats.winRate >= 55 ? 'performing well' : stats.winRate >= 45 ? 'average' : 'needs improvement';
    insights.push({
      category: 'general',
      insight: `Overall win rate is ${stats.winRate.toFixed(1)}% (${overallStatus}). Average PnL: ${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}%`,
      actionable: false,
    });
  }
  
  // 4. Use AI brain for deeper analysis if available
  if (brain.isAvailable() && stats.total >= 20) {
    try {
      const aiInsight = await generateAIInsight(indicatorPatterns, tokenPatterns, stats);
      if (aiInsight) {
        insights.push(aiInsight);
      }
    } catch (error) {
      console.error('[Learner] AI insight generation failed:', error);
    }
  }
  
  return insights;
}

/**
 * Use AI to generate deeper insights
 */
async function generateAIInsight(
  indicatorPatterns: PatternAnalysis[],
  tokenPatterns: PatternAnalysis[],
  stats: ReturnType<typeof tracker.getPerformanceStats>
): Promise<LearningInsight | null> {
  const decision = await brain.makeStrategicDecision({
    situation: `Trading signal performance analysis. Win rate: ${stats.winRate.toFixed(1)}%. Total calls: ${stats.total}. Best indicator: ${indicatorPatterns[0]?.pattern || 'N/A'}. Best token: ${tokenPatterns[0]?.pattern || 'N/A'}.`,
    options: [
      'Focus on high-confidence signals only (increase quality)',
      'Expand token coverage (increase quantity)',
      'Adjust indicator weights based on performance',
      'Maintain current strategy',
    ],
    constraints: [
      'Need to maintain signal frequency for hackathon visibility',
      'Risk management is crucial',
      'Learning from both wins and losses',
    ],
    goal: 'Maximize win rate while maintaining useful signal generation',
  });
  
  return {
    category: 'general',
    insight: `AI Analysis: ${decision.reasoning}. Recommended: ${decision.decision}`,
    actionable: true,
  };
}

/**
 * Apply learned adjustments to confidence weights
 */
export function applyLearnings(): {
  adjustments: Array<{ target: string; oldWeight: number; newWeight: number }>;
} {
  console.log('[Learner] Applying learned adjustments...');
  
  const adjustments: Array<{ target: string; oldWeight: number; newWeight: number }> = [];
  const weights = db.getAllLearningWeights();
  
  for (const weight of weights) {
    const total = weight.winCount + weight.lossCount;
    if (total < 5) continue; // Need minimum data
    
    const winRate = weight.winCount / total;
    
    // Calculate new weight based on win rate
    // Win rate of 0.5 = weight of 1.0
    // Win rate of 0.6 = weight of 1.1
    // Win rate of 0.4 = weight of 0.9
    const newWeight = 0.5 + winRate;
    
    // Only adjust if significant change
    if (Math.abs(newWeight - weight.adjustedWeight) > 0.05) {
      adjustments.push({
        target: weight.id,
        oldWeight: weight.adjustedWeight,
        newWeight,
      });
      
      // Update in database (we update the adjusted weight through normal updates)
      // The updateLearningWeight function handles this
    }
  }
  
  console.log(`[Learner] Made ${adjustments.length} weight adjustments`);
  return { adjustments };
}

/**
 * Get the current confidence multiplier for a pattern
 */
export function getConfidenceMultiplier(patternId: string): number {
  const weight = db.getLearningWeight(patternId);
  return weight?.adjustedWeight || 1.0;
}

/**
 * Run full learning cycle
 */
export async function runLearningCycle(): Promise<{
  insights: LearningInsight[];
  adjustments: Array<{ target: string; oldWeight: number; newWeight: number }>;
  indicatorPatterns: PatternAnalysis[];
  tokenPatterns: PatternAnalysis[];
}> {
  console.log('[Learner] Starting learning cycle...');
  
  const indicatorPatterns = analyzeIndicatorPatterns();
  const tokenPatterns = analyzeTokenPerformance();
  const insights = await generateInsights();
  const { adjustments } = applyLearnings();
  
  console.log(`[Learner] Learning cycle complete: ${insights.length} insights, ${adjustments.length} adjustments`);
  
  return {
    insights,
    adjustments,
    indicatorPatterns,
    tokenPatterns,
  };
}

export default {
  analyzeIndicatorPatterns,
  analyzeTokenPerformance,
  generateInsights,
  applyLearnings,
  getConfidenceMultiplier,
  runLearningCycle,
};
