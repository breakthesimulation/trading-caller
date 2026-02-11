/**
 * Risk Calculator for Trading Caller
 * 
 * Calculate position sizing, risk/reward, and trade metrics
 */

class RiskCalculator {
  constructor() {
    this.defaultRiskPercent = 2; // 2% of portfolio per trade
    this.defaultPortfolioSize = 10000; // $10,000 default
  }
  
  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(params) {
    const {
      portfolioSize = this.defaultPortfolioSize,
      riskPercent = this.defaultRiskPercent,
      entryPrice,
      stopLoss,
    } = params;
    
    if (!entryPrice || !stopLoss || entryPrice === stopLoss) {
      return null;
    }
    
    const riskAmount = (portfolioSize * riskPercent) / 100;
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const positionSize = riskAmount / riskPerUnit;
    const positionValue = positionSize * entryPrice;
    
    return {
      positionSize: positionSize.toFixed(4),
      positionValue: positionValue.toFixed(2),
      riskAmount: riskAmount.toFixed(2),
      riskPerUnit: riskPerUnit.toFixed(6),
      maxLoss: riskAmount.toFixed(2),
    };
  }
  
  /**
   * Calculate risk/reward ratio
   */
  calculateRiskReward(entry, stopLoss, target) {
    if (!entry || !stopLoss || !target) return null;
    
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(target - entry);
    const ratio = reward / risk;
    
    return {
      risk: risk.toFixed(6),
      reward: reward.toFixed(6),
      ratio: ratio.toFixed(2),
      isGood: ratio >= 2, // 2:1 or better
    };
  }
  
  /**
   * Calculate expected value of a trade
   */
  calculateExpectedValue(params) {
    const {
      winRate, // e.g., 0.65 for 65%
      avgWin,  // Average win in $
      avgLoss, // Average loss in $ (positive number)
    } = params;
    
    if (winRate === undefined || !avgWin || !avgLoss) return null;
    
    const lossRate = 1 - winRate;
    const ev = (winRate * avgWin) - (lossRate * avgLoss);
    const evPercent = (ev / avgLoss) * 100;
    
    return {
      expectedValue: ev.toFixed(2),
      expectedValuePercent: evPercent.toFixed(2),
      isPositive: ev > 0,
    };
  }
  
  /**
   * Calculate Kelly Criterion for optimal position sizing
   */
  calculateKelly(params) {
    const {
      winRate,    // e.g., 0.65
      avgWin,     // Average win %
      avgLoss,    // Average loss %
    } = params;
    
    if (!winRate || !avgWin || !avgLoss) return null;
    
    const lossRate = 1 - winRate;
    const winLossRatio = avgWin / avgLoss;
    
    // Kelly % = (Win% * Win/Loss Ratio - Loss%) / Win/Loss Ratio
    const kelly = ((winRate * winLossRatio) - lossRate) / winLossRatio;
    const kellyPercent = kelly * 100;
    
    // Half-Kelly is recommended for safety
    const halfKelly = kellyPercent / 2;
    
    return {
      fullKelly: kellyPercent.toFixed(2),
      halfKelly: halfKelly.toFixed(2),
      recommended: halfKelly.toFixed(2), // Half Kelly is safer
      isValid: kelly > 0 && kelly < 1,
    };
  }
  
  /**
   * Calculate drawdown risk
   */
  calculateDrawdownRisk(params) {
    const {
      portfolioSize,
      riskPerTrade,   // % risk per trade
      consecutiveLosses, // Max expected consecutive losses
    } = params;
    
    if (!portfolioSize || !riskPerTrade || !consecutiveLosses) return null;
    
    let currentSize = portfolioSize;
    let totalLoss = 0;
    
    // Compound losses
    for (let i = 0; i < consecutiveLosses; i++) {
      const loss = currentSize * (riskPerTrade / 100);
      totalLoss += loss;
      currentSize -= loss;
    }
    
    const drawdownPercent = (totalLoss / portfolioSize) * 100;
    const remainingPercent = (currentSize / portfolioSize) * 100;
    
    return {
      totalLoss: totalLoss.toFixed(2),
      drawdownPercent: drawdownPercent.toFixed(2),
      remainingValue: currentSize.toFixed(2),
      remainingPercent: remainingPercent.toFixed(2),
      recoveryNeeded: ((portfolioSize / currentSize - 1) * 100).toFixed(2),
    };
  }
  
  /**
   * Analyze a signal for risk metrics
   */
  analyzeSignal(signal) {
    const positionSize = this.calculatePositionSize({
      entryPrice: signal.entry,
      stopLoss: signal.stopLoss,
    });
    
    const riskReward = this.calculateRiskReward(
      signal.entry,
      signal.stopLoss,
      signal.targets[0]
    );
    
    const isLowRisk = signal.riskLevel === 'LOW';
    const isHighConfidence = signal.confidence >= 70;
    const isGoodRR = riskReward && riskReward.ratio >= 2;
    
    return {
      signal: signal.id,
      token: signal.token.symbol,
      action: signal.action,
      positionSize,
      riskReward,
      quality: {
        lowRisk: isLowRisk,
        highConfidence: isHighConfidence,
        goodRiskReward: isGoodRR,
        overall: isLowRisk && isHighConfidence && isGoodRR ? 'EXCELLENT' :
                 (isHighConfidence && isGoodRR) ? 'GOOD' :
                 isGoodRR ? 'FAIR' : 'POOR',
      },
    };
  }
  
  /**
   * Calculate portfolio metrics
   */
  calculatePortfolioMetrics(positions) {
    const totalValue = positions.reduce((sum, p) => sum + (p.value || 0), 0);
    const totalPnL = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const totalPnLPercent = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;
    
    const winners = positions.filter(p => (p.pnl || 0) > 0);
    const losers = positions.filter(p => (p.pnl || 0) < 0);
    
    const winRate = positions.length > 0 ? (winners.length / positions.length) * 100 : 0;
    
    const avgWin = winners.length > 0 
      ? winners.reduce((sum, p) => sum + p.pnl, 0) / winners.length 
      : 0;
    
    const avgLoss = losers.length > 0
      ? Math.abs(losers.reduce((sum, p) => sum + p.pnl, 0) / losers.length)
      : 0;
    
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : Infinity;
    
    return {
      totalValue: totalValue.toFixed(2),
      totalPnL: totalPnL.toFixed(2),
      totalPnLPercent: totalPnLPercent.toFixed(2),
      positions: positions.length,
      winners: winners.length,
      losers: losers.length,
      winRate: winRate.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
    };
  }
}

// Create global instance
const riskCalc = new RiskCalculator();

// Make available globally
window.riskCalc = riskCalc;
window.RiskCalculator = RiskCalculator;
