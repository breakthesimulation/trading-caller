// Trading Caller Frontend
// Vanilla JS - No frameworks needed

const API_URL = 'https://web-production-5e86c.up.railway.app/signals/latest';
const REFRESH_INTERVAL = 30000; // 30 seconds

// State
let signals = [];
let filter = 'ALL';
let sortBy = 'confidence';
let refreshTimer = null;

// DOM Elements
const signalsGrid = document.getElementById('signals-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sort-select');
const totalSignals = document.getElementById('total-signals');
const longCount = document.getElementById('long-count');
const shortCount = document.getElementById('short-count');
const lastUpdate = document.getElementById('last-update');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchSignals();
  startAutoRefresh();
});

// Event Listeners
function setupEventListeners() {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active', 'long', 'short'));
      btn.classList.add('active');
      if (btn.dataset.filter === 'LONG') btn.classList.add('long');
      if (btn.dataset.filter === 'SHORT') btn.classList.add('short');
      filter = btn.dataset.filter;
      renderSignals();
    });
  });

  sortSelect.addEventListener('change', (e) => {
    sortBy = e.target.value;
    renderSignals();
  });
}

// Fetch Signals
async function fetchSignals() {
  try {
    showLoading();
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch signals');
    
    const data = await response.json();
    signals = data.signals || [];
    
    updateStats();
    renderSignals();
    updateLastRefresh();
  } catch (error) {
    console.error('Error fetching signals:', error);
    showError();
  }
}

// Auto Refresh
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchSignals, REFRESH_INTERVAL);
}

// Update Stats
function updateStats() {
  const longs = signals.filter(s => s.action === 'LONG').length;
  const shorts = signals.filter(s => s.action === 'SHORT').length;
  
  totalSignals.textContent = signals.length;
  longCount.textContent = longs;
  shortCount.textContent = shorts;
}

// Update Last Refresh Time
function updateLastRefresh() {
  const now = new Date();
  lastUpdate.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

// Render Signals
function renderSignals() {
  let filtered = [...signals];
  
  // Apply filter
  if (filter !== 'ALL') {
    filtered = filtered.filter(s => s.action === filter);
  }
  
  // Apply sort
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence;
      case 'timestamp':
        return new Date(b.timestamp) - new Date(a.timestamp);
      case 'risk':
        const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      default:
        return 0;
    }
  });
  
  if (filtered.length === 0) {
    signalsGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p>No signals match your filter criteria.</p>
      </div>
    `;
    return;
  }
  
  signalsGrid.innerHTML = filtered.map(signal => renderSignalCard(signal)).join('');
  
  // Attach event listeners to new elements
  attachCardListeners();
}

// Render Single Signal Card
function renderSignalCard(signal) {
  const isLong = signal.action === 'LONG';
  const directionClass = isLong ? 'long' : 'short';
  const directionIcon = isLong 
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17l5-5 5 5M7 7l5 5 5-5"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7l5 5 5-5M7 17l5-5 5 5"/></svg>';
  
  const timestamp = new Date(signal.timestamp).toLocaleString();
  const tokenSymbol = signal.token?.symbol || 'UNKNOWN';
  const tokenName = signal.token?.name || tokenSymbol;
  const tokenAddress = signal.token?.address || '';
  const tokenInitials = tokenSymbol.substring(0, 2).toUpperCase();
  
  // Format prices
  const formatPrice = (price) => {
    if (price === undefined || price === null) return 'N/A';
    if (Math.abs(price) < 0.0001) return price.toExponential(4);
    if (Math.abs(price) < 1) return price.toPrecision(4);
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };
  
  const targets = signal.targets || [];
  const validTargets = targets.filter(t => t > 0);
  
  const reasoning = signal.reasoning || {};
  
  const dexScreenerUrl = tokenAddress 
    ? `https://dexscreener.com/solana/${tokenAddress}`
    : '#';
  
  return `
    <div class="signal-card ${directionClass}" data-id="${signal.id}">
      <div class="card-meta">
        <span class="timestamp">${timestamp}</span>
        <span class="timeframe-badge">${signal.timeframe || '1D'}</span>
      </div>
      
      <div class="card-header">
        <div class="token-info">
          <div class="token-icon">${tokenInitials}</div>
          <div class="token-details">
            <h3>${tokenSymbol}</h3>
            <span class="token-name">${tokenName}</span>
          </div>
        </div>
        <div class="direction-badge ${directionClass}">
          ${directionIcon}
          <span>${signal.action}</span>
        </div>
      </div>
      
      <div class="card-body">
        <div class="price-grid">
          <div class="price-item">
            <div class="price-label">Entry Price</div>
            <div class="price-value">$${formatPrice(signal.entry)}</div>
          </div>
          <div class="price-item">
            <div class="price-label">Stop Loss</div>
            <div class="price-value stop-loss">$${formatPrice(signal.stopLoss)}</div>
          </div>
        </div>
        
        ${validTargets.length > 0 ? `
          <div class="targets-section">
            <div class="targets-label">Target Prices</div>
            <div class="targets-grid">
              ${validTargets.map((target, i) => `
                <div class="target-item">
                  <div class="target-label">TP${i + 1}</div>
                  <div class="target-value">$${formatPrice(target)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="metrics-row">
          <div class="metric">
            <div class="metric-header">
              <span class="metric-label">Confidence</span>
              <span class="metric-value">${signal.confidence}%</span>
            </div>
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: ${signal.confidence}%"></div>
            </div>
          </div>
          <div class="metric">
            <div class="metric-header">
              <span class="metric-label">Risk Level</span>
              <span class="risk-badge ${signal.riskLevel?.toLowerCase()}">${signal.riskLevel || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="reasoning-accordion">
          <button class="reasoning-toggle" data-id="${signal.id}">
            <span>📊 Analysis Summary</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div class="reasoning-content" id="reasoning-${signal.id}">
            ${reasoning.technical ? `
              <div class="reasoning-item">
                <div class="reasoning-item-label">Technical</div>
                <div class="reasoning-item-text">${reasoning.technical}</div>
              </div>
            ` : ''}
            ${reasoning.fundamental && reasoning.fundamental !== 'No significant fundamental factors' ? `
              <div class="reasoning-item">
                <div class="reasoning-item-label">Fundamental</div>
                <div class="reasoning-item-text">${reasoning.fundamental}</div>
              </div>
            ` : ''}
            ${reasoning.sentiment && reasoning.sentiment !== 'Neutral market sentiment' ? `
              <div class="reasoning-item">
                <div class="reasoning-item-label">Sentiment</div>
                <div class="reasoning-item-text">${reasoning.sentiment}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="card-footer">
        <button class="card-btn copy-btn" data-signal='${JSON.stringify({
          token: tokenSymbol,
          action: signal.action,
          entry: signal.entry,
          targets: validTargets,
          stopLoss: signal.stopLoss,
          confidence: signal.confidence,
          timeframe: signal.timeframe
        })}'>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy Trade
        </button>
        <a href="${dexScreenerUrl}" target="_blank" rel="noopener" class="card-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          DexScreener
        </a>
      </div>
    </div>
  `;
}

// Attach Card Event Listeners
function attachCardListeners() {
  // Reasoning toggles
  document.querySelectorAll('.reasoning-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const content = document.getElementById(`reasoning-${id}`);
      btn.classList.toggle('open');
      content.classList.toggle('show');
    });
  });
  
  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const signal = JSON.parse(btn.dataset.signal);
      copyToClipboard(signal);
    });
  });
}

// Copy Trade Setup to Clipboard
function copyToClipboard(signal) {
  const text = `🎯 ${signal.token} ${signal.action}

📍 Entry: $${signal.entry}
🎯 Targets: ${signal.targets.map((t, i) => `TP${i+1}: $${t}`).join(' | ')}
🛑 Stop Loss: $${signal.stopLoss}
📊 Confidence: ${signal.confidence}%
⏰ Timeframe: ${signal.timeframe}

via Trading Caller 🤖`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Trade setup copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy');
  });
}

// Show Toast
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Show Loading State
function showLoading() {
  signalsGrid.innerHTML = `
    <div class="loading" style="grid-column: 1 / -1;">
      <div class="loading-spinner"></div>
      <p>Loading signals...</p>
    </div>
  `;
}

// Show Error State
function showError() {
  signalsGrid.innerHTML = `
    <div class="error-state" style="grid-column: 1 / -1;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h3>Failed to load signals</h3>
      <p>Please try again later.</p>
      <button class="card-btn" onclick="fetchSignals()" style="margin-top: 16px;">
        Retry
      </button>
    </div>
  `;
}
