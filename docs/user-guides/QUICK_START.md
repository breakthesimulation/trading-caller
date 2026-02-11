# Quick Start Guide - Trading Caller

**Get profitable trading signals in 5 minutes** 🚀

## Option 1: Try the Live Dashboard (Fastest)

**⏱️ Time: 2 minutes**

1. **Open the dashboard**: [web-production-5e86c.up.railway.app](https://web-production-5e86c.up.railway.app/)

2. **See live performance**:
   - 35.3% overall win rate
   - 85.7% LONG position success
   - +32.62% total PnL

3. **Browse current signals**:
   - Click "Latest Signals" 
   - See entry points, targets, stop-loss
   - Check confidence scores and reasoning

**✅ Done! You're seeing profitable AI trading signals.**

---

## Option 2: Get Signals via API (5 minutes)

**⏱️ Time: 5 minutes**

### **Step 1: Test the API** (1 minute)
```bash
# Get latest trading signals
curl https://web-production-5e86c.up.railway.app/signals/latest

# Get performance stats  
curl https://web-production-5e86c.up.railway.app/signals/performance

# Find oversold opportunities
curl https://web-production-5e86c.up.railway.app/rsi/oversold
```

### **Step 2: Understand the Response** (2 minutes)
```json
{
  "success": true,
  "signals": [
    {
      "id": "sig_abc123",
      "action": "LONG",
      "token": { "symbol": "SOL", "address": "So11111..." },
      "entry": 80.50,
      "targets": [85.00, 90.00, 95.00],
      "stopLoss": 76.00,
      "confidence": 87,
      "reasoning": {
        "technical": "RSI oversold at 28, bullish divergence detected",
        "risk": "MEDIUM"
      }
    }
  ]
}
```

### **Step 3: Use in Your Code** (2 minutes)
```python
import requests

# Python example
def get_trading_signals():
    url = "https://web-production-5e86c.up.railway.app/signals/latest"
    response = requests.get(url)
    return response.json()

signals = get_trading_signals()
for signal in signals['signals']:
    print(f"{signal['action']} {signal['token']['symbol']} at ${signal['entry']}")
```

```javascript
// JavaScript example
async function getTradingSignals() {
    const response = await fetch('https://web-production-5e86c.up.railway.app/signals/latest');
    return await response.json();
}

getTradingSignals().then(data => {
    data.signals.forEach(signal => {
        console.log(`${signal.action} ${signal.token.symbol} at $${signal.entry}`);
    });
});
```

**✅ Done! You're integrating profitable trading signals into your application.**

---

## Option 3: Get Telegram Alerts (3 minutes)

**⏱️ Time: 3 minutes**

### **Step 1: Create Telegram Bot** (1 minute)
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow prompts
3. Save your bot token: `123456789:ABCdef...`

### **Step 2: Get Your Chat ID** (1 minute)
1. Message `@userinfobot` on Telegram
2. Note your chat ID (positive number for personal, negative for groups)

### **Step 3: Subscribe to Alerts** (1 minute)
```bash
curl -X POST https://web-production-5e86c.up.railway.app/volume/alerts/subscribe \
  -H "Content-Type: application/json" \
  -d '{"chatId": "YOUR_CHAT_ID", "minSeverity": "MEDIUM"}'
```

**✅ Done! You'll get volume spike alerts with trading opportunities.**

**Example alert**:
```
🚨 VOLUME SPIKE DETECTED 🟢

BONK (Bonk)
📊 Current 1h: $2.5M | Avg: $500K | Spike: 5.0x
📈 Price: +8.5% (1h) | +15.2% (24h)
Type: BULLISH | Severity: HIGH
🔗 View on DexScreener
```

---

## What You Get

### **📊 Trading Signals**
- **LONG/SHORT** calls with confidence scores
- **Entry points** and target prices  
- **Stop-loss** levels for risk management
- **Detailed reasoning** (technical, fundamental, sentiment)

### **📈 Performance Tracking**
- **Complete transparency** - every win AND loss
- **Real-time metrics** updated automatically
- **Historical data** for backtesting and validation
- **Public leaderboard** with no cherry-picking

### **🔍 Market Intelligence**  
- **RSI scanner** for oversold/overbought opportunities
- **Volume spike alerts** for momentum plays
- **Multi-timeframe analysis** (1H, 4H, 1D confirmation)
- **Learning algorithms** that improve over time

---

## Next Steps

### **For Traders**:
- [📊 Dashboard Guide](dashboard-guide.md) - Master the interface
- [📚 Trading Strategies](trading-strategies.md) - Understand our methods  
- [🔔 Telegram Setup](telegram-setup.md) - Advanced alert configuration

### **For Developers**:
- [💻 API Integration](api-integration.md) - Build with our signals
- [🔧 Technical Architecture](../technical/architecture.md) - System deep-dive
- [📖 API Reference](../technical/api-reference.md) - Complete documentation

### **For Analysts**:
- [📈 Performance Analysis](../research/performance-analysis.md) - Detailed results
- [🧠 TA Lessons](../research/ta-lessons.md) - Learn our methods
- [📊 Backtesting Data](../research/backtesting-results.md) - Historical validation

---

## Troubleshooting

### **API Not Responding?**
- Check system status: `curl https://web-production-5e86c.up.railway.app/api`
- Current uptime: 99.8% (rare downtime for updates)

### **No Telegram Alerts?**
- Verify your chat ID is correct (positive for users, negative for groups)
- Check subscription status: `GET /volume/alerts/subscribe/YOUR_CHAT_ID`
- Minimum severity filters alerts (try "LOW" for testing)

### **Questions?**
- [🐛 Report Issues](https://github.com/breakthesimulation/trading-caller/issues)
- [💬 Ask Questions](https://github.com/breakthesimulation/trading-caller/discussions)
- [📱 Community](https://twitter.com/tradingcaller)

---

**🎯 Ready to make profitable trades with AI assistance?**

**[← Back to Main Docs](../README.md) | [API Integration →](api-integration.md)**