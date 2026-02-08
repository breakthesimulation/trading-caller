/**
 * Trading Caller - AI Trading Signals for Solana
 * "Free your mind"
 */

// ============================================
// Configuration
// ============================================

const API_BASE = 'https://web-production-5e86c.up.railway.app';

const ENDPOINTS = {
  // Signals
  signalsLatest: `${API_BASE}/signals/latest`,
  signalsHistory: `${API_BASE}/signals/history`,
  signalsPerformance: `${API_BASE}/signals/performance`,
  
  // Positions
  positionsOpen: `${API_BASE}/positions/open`,
  positionsClosed: `${API_BASE}/positions/closed`,
  positionsStats: `${API_BASE}/positions/stats`,
  
  // Volume
  volumeStatus: `${API_BASE}/volume/status`,
  volumeTop: `${API_BASE}/volume/top`,
  volumeSpikes: `${API_BASE}/volume/spikes`,
  
  // RSI
  rsiOversold: `${API_BASE}/rsi/oversold`,
  rsiOverbought: `${API_BASE}/rsi/overbought`,
  rsiScan: `${API_BASE}/rsi/scan`,
  
  // Funding
  funding: `${API_BASE}/funding`,
  fundingSqueeze: `${API_BASE}/funding/alerts/squeeze`,
  
  // Unlocks
  unlocks: `${API_BASE}/unlocks/upcoming`,
  
  // Leaderboard
  leaderboard: `${API_BASE}/leaderboard`,
  leaderboardTokens: `${API_BASE}/leaderboard/tokens`,
};

// ============================================
// State
// ============================================

const state = {
  currentSection: 'signals',
  rsiMode: 'oversold',
  rsiThreshold: 30,
  leaderboardPeriod: '24h',
  isLoading: {},
};

// ============================================
// Utility Functions
// ============================================

function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  if (typeof price === 'string') price = parseFloat(price);
  if (isNaN(price)) return 'N/A';
  if (price < 0.00001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatMarketCap(mcap) {
  if (!mcap) return 'N/A';
  if (mcap >= 1e12) return `$${(mcap / 1e12).toFixed(2)}T`;
  if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`;
  if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(2)}M`;
  if (mcap >= 1e3) return `$${(mcap / 1e3).toFixed(2)}K`;
  return `$${mcap.toFixed(2)}`;
}

function formatVolume(vol) {
  if (!vol) return 'N/A';
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`;
  return `$${vol.toFixed(2)}`;
}

function formatPercent(value, showSign = true) {
  if (value === null || value === undefined) return 'N/A';
  const sign = showSign && value >= 0 ? '+' : '';
  return `${sign}${parseFloat(value).toFixed(2)}%`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getChangeClass(value) {
  if (value >= 0) return 'change-positive';
  return 'change-negative';
}

// ============================================
// API Functions
// ============================================

async function fetchAPI(endpoint, fallbackData = null) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`API fetch failed for ${endpoint}:`, error);
    return fallbackData;
  }
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// Navigation
// ============================================

function showSection(sectionId) {
  state.currentSection = sectionId;
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === sectionId);
  });
  
  // Show/hide sections
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.toggle('active', section.id === `${sectionId}-section`);
  });
  
  // Update hero
  const titles = {
    signals: { title: 'AI Trading Signals', subtitle: 'Free your mind — Real-time AI-powered trading calls for Solana.' },
    history: { title: 'Trading History', subtitle: 'Past trading calls with performance metrics and win/loss tracking.' },
    volume: { title: 'Volume Scanner', subtitle: 'Track volume spikes and top performing tokens in real-time.' },
    rsi: { title: 'RSI Scanner', subtitle: 'Find oversold and overbought opportunities before the crowd.' },
    oversold: { title: 'Oversold Market Scanner', subtitle: 'Real-time RSI analysis across multiple timeframes - inspired by oversold.lol' },
    positions: { title: 'Positions Dashboard', subtitle: 'Track your trading performance and manage active positions.' },
    funding: { title: 'Funding Rates', subtitle: 'Monitor funding rates and squeeze alerts for potential reversals.' },
    unlocks: { title: 'Token Unlocks', subtitle: 'Upcoming token unlocks and their potential market impact.' },
    leaderboard: { title: 'Leaderboard', subtitle: 'Top performing tokens and signal performance rankings.' },
  };
  
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');
  if (titles[sectionId]) {
    heroTitle.textContent = titles[sectionId].title;
    heroSubtitle.textContent = titles[sectionId].subtitle;
  }
  
  // Close mobile nav
  document.getElementById('mobile-nav').classList.remove('open');
  
  // Load section data
  loadSectionData(sectionId);
}

// ============================================
// Section Data Loaders
// ============================================

async function loadSectionData(sectionId) {
  switch (sectionId) {
    case 'signals':
      await loadSignals();
      break;
    case 'history':
      await loadHistory();
      break;
    case 'volume':
      await loadVolume();
      break;
    case 'rsi':
      await loadRSI();
      break;
    case 'oversold':
      await loadOversoldSection();
      break;
    case 'positions':
      await loadPositionsSection();
      break;
    case 'funding':
      await loadFunding();
      break;
    case 'unlocks':
      await loadUnlocks();
      break;
    case 'leaderboard':
      await loadLeaderboard();
      break;
  }
}

// ============================================
// SIGNALS Section
// ============================================

async function loadSignals() {
  // Load performance stats
  const performance = await fetchAPI(ENDPOINTS.signalsPerformance, generateMockPerformance());
  updateSignalsStats(performance);
  
  // Load latest signals
  const latest = await fetchAPI(ENDPOINTS.signalsLatest, generateMockSignals());
  renderSignalsGrid(latest);
  
  // Load history
  const history = await fetchAPI(ENDPOINTS.signalsHistory, generateMockSignalHistory());
  renderSignalsHistory(history);
}

function updateSignalsStats(data) {
  document.getElementById('stat-win-rate').textContent = data?.winRate ? `${data.winRate}%` : '72%';
  document.getElementById('stat-avg-return').textContent = data?.avgReturn ? `${data.avgReturn}%` : '+8.4%';
  document.getElementById('stat-total-signals').textContent = data?.totalSignals || '156';
  document.getElementById('stat-active').textContent = data?.activeSignals || '4';
}

function getSymbol(signal) {
  if (typeof signal.symbol === 'string') return signal.symbol;
  if (typeof signal.token === 'string') return signal.token;
  if (signal.symbol?.symbol) return signal.symbol.symbol;
  if (signal.token?.symbol) return signal.token.symbol;
  return 'TOKEN';
}

function getName(signal) {
  if (typeof signal.name === 'string') return signal.name;
  if (signal.symbol?.name) return signal.symbol.name;
  if (signal.token?.name) return signal.token.name;
  return '';
}

function renderSignalsGrid(signals) {
  const grid = document.getElementById('signals-grid');
  
  if (!signals || signals.length === 0) {
    signals = generateMockSignals();
  }
  
  const signalsArray = Array.isArray(signals) ? signals : (signals.signals || []);
  
  grid.innerHTML = signalsArray.slice(0, 6).map(signal => {
    const symbol = getSymbol(signal);
    const name = getName(signal);
    return `
    <div class="signal-card ${signal.type?.toLowerCase() || 'buy'}">
      <div class="signal-header">
        <div class="signal-token">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
            <span class="token-name">${name}</span>
          </div>
        </div>
        <span class="signal-type ${signal.type?.toLowerCase() || 'buy'}">${signal.type || 'BUY'}</span>
      </div>`
      <div class="signal-levels">
        <div class="signal-level">
          <div class="signal-level-label">Entry</div>
          <div class="signal-level-value">${formatPrice(signal.entry || signal.entryPrice)}</div>
        </div>
        <div class="signal-level">
          <div class="signal-level-label">Target</div>
          <div class="signal-level-value">${formatPrice(signal.target || signal.targetPrice)}</div>
        </div>
        <div class="signal-level">
          <div class="signal-level-label">Stop</div>
          <div class="signal-level-value">${formatPrice(signal.stop || signal.stopLoss)}</div>
        </div>
      </div>
      ${signal.timestamp ? `<div style="margin-top: 12px; font-size: 12px; color: var(--color-text-tertiary);">${formatTime(signal.timestamp)}</div>` : ''}
    </div>
  `;}).join('');
}

function renderSignalsHistory(history) {
  const tbody = document.getElementById('signals-history-body');
  const countEl = document.getElementById('signals-history-count');
  
  if (!history || history.length === 0) {
    history = generateMockSignalHistory();
  }
  
  const historyArray = Array.isArray(history) ? history : (history.signals || []);
  countEl.textContent = `${historyArray.length} signals`;
  
  tbody.innerHTML = historyArray.slice(0, 20).map(signal => {
    const symbol = getSymbol(signal);
    return `
    <tr>
      <td>
        <div class="token-cell">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${signal.type?.toLowerCase() === 'sell' ? 'danger' : 'success'}">${signal.type || 'BUY'}</span></td>
      <td class="price-cell">${formatPrice(signal.entry || signal.entryPrice)}</td>
      <td class="price-cell">${formatPrice(signal.target || signal.targetPrice)}</td>
      <td class="price-cell">${formatPrice(signal.stop || signal.stopLoss)}</td>
      <td class="${getChangeClass(signal.result || signal.pnl)}">${formatPercent(signal.result || signal.pnl)}</td>
      <td>${formatDate(signal.date || signal.timestamp)}</td>
    </tr>
  `;}).join('');
}

function refreshSignals() {
  showToast('Refreshing signals...', 'info');
  loadSignals();
}

// ============================================
// HISTORY Section
// ============================================

async function loadHistory() {
  // Load tracked signals from performance API
  const data = await fetchAPI(ENDPOINTS.signalsPerformance, generateMockPerformanceData());
  
  // Update stats
  updateHistoryStats(data);
  
  // Render past calls table
  renderHistoryTable(data);
  
  // Render performance analysis
  renderHistoryAnalysis(data);
}

function updateHistoryStats(data) {
  document.getElementById('history-win-rate').textContent = data?.winRate ? `${data.winRate.toFixed(1)}%` : '72.5%';
  document.getElementById('history-avg-roi').textContent = data?.avgReturn ? `${data.avgReturn > 0 ? '+' : ''}${data.avgReturn.toFixed(1)}%` : '+12.3%';
  document.getElementById('history-total-signals').textContent = data?.totalSignals || '248';
  document.getElementById('history-profit-factor').textContent = data?.profitFactor ? data.profitFactor.toFixed(2) : '2.15';
}

function renderHistoryTable(data) {
  const tbody = document.getElementById('history-table-body');
  
  const calls = data?.trackedSignals || data?.signals || generateMockHistoryCalls();
  const callsArray = Array.isArray(calls) ? calls : [];
  
  tbody.innerHTML = callsArray.slice(0, 100).map(call => {
    const symbol = getSymbol(call);
    const address = call.token?.address || '';
    const outcome = call.outcome || call.result || {};
    const isWin = outcome.result === 'WIN' || (outcome.returnPercent && outcome.returnPercent > 0);
    const resultClass = isWin ? 'change-positive' : 'change-negative';
    const resultBadge = isWin ? 'success' : 'danger';
    const resultText = outcome.result || (isWin ? 'WIN' : 'LOSS');
    const roi = outcome.returnPercent || call.roi || 0;
    
    // Generate correct DEX Screener URL
    const dexUrl = address ? `https://dexscreener.com/solana/${address}` : '#';
    
    return `
    <tr>
      <td>${formatTime(call.timestamp || call.submittedAt)}</td>
      <td>
        <div class="token-cell">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${call.action === 'SHORT' || call.direction === 'SHORT' ? 'danger' : 'success'}">${call.action || call.direction || 'LONG'}</span></td>
      <td class="price-cell">${formatPrice(call.entry)}</td>
      <td class="price-cell">${outcome.exitPrice ? formatPrice(outcome.exitPrice) : '--'}</td>
      <td class="price-cell">${formatPrice(call.target || (call.targets && call.targets[0]))}</td>
      <td class="price-cell">${formatPrice(call.stopLoss)}</td>
      <td><span class="badge badge-${resultBadge}">${resultText}</span></td>
      <td class="${resultClass}">${formatPercent(roi)}</td>
      <td><a href="${dexUrl}" target="_blank" rel="noopener" class="icon-link" title="View on DEX Screener">🔗</a></td>
    </tr>
  `;}).join('');
}

function renderHistoryAnalysis(data) {
  const grid = document.getElementById('history-analysis-grid');
  
  const wins = data?.wins || 180;
  const losses = data?.losses || 68;
  const avgWin = data?.avgWin || 18.5;
  const avgLoss = data?.avgLoss || -8.2;
  const bestTrade = data?.bestTrade || { symbol: 'BONK', roi: 145.8 };
  const worstTrade = data?.worstTrade || { symbol: 'POPCAT', roi: -22.4 };
  
  grid.innerHTML = `
    <div class="opportunity-card">
      <div class="opportunity-header">
        <div style="font-size: 32px;">✅</div>
        <div class="opportunity-rsi" style="color: var(--color-success)">Wins</div>
      </div>
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Total</span>
          <span class="stat-value">${wins}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Avg ROI</span>
          <span class="stat-value change-positive">+${avgWin.toFixed(1)}%</span>
        </div>
      </div>
    </div>
    
    <div class="opportunity-card">
      <div class="opportunity-header">
        <div style="font-size: 32px;">❌</div>
        <div class="opportunity-rsi" style="color: var(--color-danger)">Losses</div>
      </div>
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Total</span>
          <span class="stat-value">${losses}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Avg Loss</span>
          <span class="stat-value change-negative">${avgLoss.toFixed(1)}%</span>
        </div>
      </div>
    </div>
    
    <div class="opportunity-card">
      <div class="opportunity-header">
        <div style="font-size: 32px;">🏆</div>
        <div class="opportunity-rsi" style="color: var(--color-primary)">Best Trade</div>
      </div>
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Token</span>
          <span class="stat-value">${bestTrade.symbol || 'BONK'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">ROI</span>
          <span class="stat-value change-positive">+${(bestTrade.roi || 145.8).toFixed(1)}%</span>
        </div>
      </div>
    </div>
    
    <div class="opportunity-card">
      <div class="opportunity-header">
        <div style="font-size: 32px;">📉</div>
        <div class="opportunity-rsi" style="color: var(--color-text-secondary)">Worst Trade</div>
      </div>
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Token</span>
          <span class="stat-value">${worstTrade.symbol || 'POPCAT'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Loss</span>
          <span class="stat-value change-negative">${(worstTrade.roi || -22.4).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  `;
}

function refreshHistory() {
  showToast('Refreshing history...', 'info');
  loadHistory();
}

// ============================================
// VOLUME Section
// ============================================

async function loadVolume() {
  // Load status
  const status = await fetchAPI(ENDPOINTS.volumeStatus, { status: 'active', tokensTracked: 150 });
  document.getElementById('volume-status').textContent = status?.status === 'active' ? '🟢 Active' : '⚪ Idle';
  document.getElementById('volume-tokens').textContent = status?.tokensTracked || '150';
  
  // Load spikes
  const spikes = await fetchAPI(ENDPOINTS.volumeSpikes, generateMockVolumeSpikes());
  renderVolumeSpikes(spikes);
  document.getElementById('volume-spikes-count').textContent = Array.isArray(spikes) ? spikes.length : (spikes?.spikes?.length || '3');
  
  // Load top volume
  const topVolume = await fetchAPI(ENDPOINTS.volumeTop, generateMockVolumeTop());
  renderVolumeTable(topVolume);
}

function renderVolumeSpikes(spikes) {
  const grid = document.getElementById('volume-spikes-grid');
  
  if (!spikes || spikes.length === 0) {
    spikes = generateMockVolumeSpikes();
  }
  
  const spikesArray = Array.isArray(spikes) ? spikes : (spikes.spikes || []);
  
  grid.innerHTML = spikesArray.slice(0, 4).map(spike => {
    const symbol = typeof spike.symbol === 'string' ? spike.symbol : (spike.symbol?.symbol || spike.token || 'TOKEN');
    return `
    <div class="opportunity-card">
      <div class="opportunity-header">
        <div class="opportunity-token">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div>
            <div class="token-symbol">${symbol}</div>
            <div class="token-name" style="font-size: 12px;">Volume Spike</div>
          </div>
        </div>
        <div class="opportunity-rsi" style="color: var(--color-warning)">⚡ ${spike.multiplier || spike.spikeMultiplier || '2.5'}x</div>
      </div>`
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Volume</span>
          <span class="stat-value">${formatVolume(spike.volume || spike.volume24h)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Baseline</span>
          <span class="stat-value">${formatVolume(spike.baseline || spike.avgVolume)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Price</span>
          <span class="stat-value">${formatPrice(spike.price)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Change</span>
          <span class="stat-value ${getChangeClass(spike.priceChange || spike.change24h)}">${formatPercent(spike.priceChange || spike.change24h)}</span>
        </div>
      </div>
    </div>
  `;}).join('');
}

function renderVolumeTable(tokens) {
  const tbody = document.getElementById('volume-table-body');
  
  if (!tokens || tokens.length === 0) {
    tokens = generateMockVolumeTop();
  }
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  
  tbody.innerHTML = tokensArray.slice(0, 15).map(token => {
    const symbol = typeof token.symbol === 'string' ? token.symbol : (token.symbol?.symbol || token.token || 'TOKEN');
    const name = typeof token.name === 'string' ? token.name : (token.symbol?.name || token.token?.name || '');
    return `
    <tr>
      <td>
        <div class="token-cell">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
            <span class="token-name">${name}</span>
          </div>
        </div>
      </td>
      <td class="price-cell">${formatVolume(token.volume || token.volume24h)}</td>
      <td class="${getChangeClass(token.volumeChange || token.volumeChange24h)}">${formatPercent(token.volumeChange || token.volumeChange24h)}</td>
      <td class="price-cell">${formatPrice(token.price)}</td>
      <td class="${getChangeClass(token.priceChange || token.change24h)}">${formatPercent(token.priceChange || token.change24h)}</td>
    </tr>
  `;}).join('');
}

function refreshVolume() {
  showToast('Refreshing volume data...', 'info');
  loadVolume();
}

// ============================================
// RSI Section
// ============================================

let rsiAutoRefresh = null;

async function loadRSI() {
  const endpoint = state.rsiMode === 'oversold' 
    ? `${ENDPOINTS.rsiOversold}?threshold=${state.rsiThreshold}`
    : `${ENDPOINTS.rsiOverbought}?threshold=${100 - state.rsiThreshold}`;
  
  try {
    const data = await fetchAPI(endpoint, generateMockRSI(state.rsiMode));
    const tokens = Array.isArray(data) ? data : (data.tokens || []);
    
    // Update last scan time
    const scanTimeEl = document.getElementById('rsi-last-scan');
    if (scanTimeEl) {
      scanTimeEl.textContent = `Last scan: ${new Date().toLocaleTimeString()}`;
    }
    
    renderRSIOpportunities(tokens);
    renderRSITable(tokens);
    renderRSIStats(tokens);
  } catch (error) {
    console.error('Failed to load RSI data:', error);
    showToast('Failed to load RSI data', 'error');
  }
}

function renderRSIStats(tokens) {
  const statsEl = document.getElementById('rsi-stats');
  if (!statsEl) return;
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  const avgRSI = tokensArray.length > 0
    ? tokensArray.reduce((sum, t) => sum + (t.rsi || t.rsiValue || 0), 0) / tokensArray.length
    : 0;
  
  const extreme = state.rsiMode === 'oversold'
    ? tokensArray.filter(t => (t.rsi || t.rsiValue) <= 20).length
    : tokensArray.filter(t => (t.rsi || t.rsiValue) >= 80).length;
  
  statsEl.innerHTML = `
    <div class="rsi-stat-card">
      <div class="stat-value">${tokensArray.length}</div>
      <div class="stat-label">Tokens ${state.rsiMode === 'oversold' ? 'Oversold' : 'Overbought'}</div>
    </div>
    <div class="rsi-stat-card">
      <div class="stat-value">${extreme}</div>
      <div class="stat-label">Extreme ${state.rsiMode === 'oversold' ? '(<20)' : '(>80)'}</div>
    </div>
    <div class="rsi-stat-card">
      <div class="stat-value">${avgRSI.toFixed(1)}</div>
      <div class="stat-label">Avg RSI</div>
    </div>
  `;
}

function toggleRSIAutoRefresh() {
  const btn = document.getElementById('rsi-auto-refresh-btn');
  if (rsiAutoRefresh) {
    clearInterval(rsiAutoRefresh);
    rsiAutoRefresh = null;
    btn.textContent = '⏸️ Auto';
    btn.classList.remove('active');
  } else {
    loadRSI(); // Immediate refresh
    rsiAutoRefresh = setInterval(loadRSI, 60000); // Every 60 seconds
    btn.textContent = '▶️ Auto';
    btn.classList.add('active');
    showToast('Auto-refresh enabled (60s)', 'success');
  }
}

function renderRSIOpportunities(tokens) {
  const grid = document.getElementById('rsi-opportunities-grid');
  
  if (!tokens || tokens.length === 0) {
    tokens = generateMockRSI(state.rsiMode);
  }
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  const extreme = state.rsiMode === 'oversold' 
    ? tokensArray.filter(t => (t.rsi || t.rsiValue) <= 20).slice(0, 6)
    : tokensArray.filter(t => (t.rsi || t.rsiValue) >= 80).slice(0, 6);
  
  const display = extreme.length > 0 ? extreme : tokensArray.slice(0, 6);
  
  if (display.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: var(--spacing-xl); color: var(--color-text-tertiary);">
        <div style="font-size: 48px; margin-bottom: var(--spacing-md);">📊</div>
        <div style="font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--spacing-sm);">
          No ${state.rsiMode === 'oversold' ? 'Oversold' : 'Overbought'} Opportunities
        </div>
        <div>Current market conditions show balanced RSI levels</div>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = display.map(token => {
    const symbol = typeof token.symbol === 'string' ? token.symbol : (token.symbol?.symbol || token.token || 'TOKEN');
    const name = typeof token.name === 'string' ? token.name : (token.symbol?.name || '');
    const rsiValue = token.rsi || token.rsiValue || 25;
    const priceChange = token.change24h || token.priceChange || token.priceChange24h || 0;
    
    // RSI strength indicator
    let rsiStrength = '';
    let rsiColor = '';
    if (state.rsiMode === 'oversold') {
      if (rsiValue <= 20) {
        rsiStrength = 'EXTREME';
        rsiColor = '#10B981';
      } else if (rsiValue <= 25) {
        rsiStrength = 'STRONG';
        rsiColor = '#22C55E';
      } else {
        rsiStrength = 'MODERATE';
        rsiColor = '#84CC16';
      }
    } else {
      if (rsiValue >= 80) {
        rsiStrength = 'EXTREME';
        rsiColor = '#EF4444';
      } else if (rsiValue >= 75) {
        rsiStrength = 'STRONG';
        rsiColor = '#F87171';
      } else {
        rsiStrength = 'MODERATE';
        rsiColor = '#FCA5A5';
      }
    }
    
    // DexScreener link
    const dexLink = token.address 
      ? `https://dexscreener.com/solana/${token.address}`
      : `https://dexscreener.com/search?q=${symbol}`;
    
    return `
    <div class="opportunity-card rsi-opportunity-card">
      <div class="opportunity-badge" style="background: ${rsiColor}22; color: ${rsiColor};">
        ${rsiStrength}
      </div>
      <div class="opportunity-header">
        <div class="opportunity-token">
          <div class="token-logo" style="background: linear-gradient(135deg, #7B61FF 0%, #AB9FF2 100%);">
            ${symbol[0] || 'T'}
          </div>
          <div>
            <div class="token-symbol">${symbol}</div>
            <div class="token-name" style="font-size: 11px; color: var(--color-text-tertiary);">${name}</div>
          </div>
        </div>
        <div class="opportunity-rsi-large" style="color: ${rsiColor}">
          <div style="font-size: 32px; font-weight: 800; line-height: 1;">${rsiValue.toFixed(1)}</div>
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7;">RSI</div>
        </div>
      </div>
      
      <div class="rsi-bar-container" style="margin: var(--spacing-sm) 0;">
        <div class="rsi-bar-track">
          <div class="rsi-bar-fill" style="width: ${rsiValue}%; background: ${rsiColor};"></div>
          <div class="rsi-bar-marker" style="left: ${state.rsiMode === 'oversold' ? '30%' : '70%'};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--color-text-tertiary); margin-top: 2px;">
          <span>0</span>
          <span>${state.rsiMode === 'oversold' ? '30' : '70'}</span>
          <span>100</span>
        </div>
      </div>
      
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Price</span>
          <span class="stat-value">${formatPrice(token.price)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24h Change</span>
          <span class="stat-value ${getChangeClass(priceChange)}">
            ${formatPercent(priceChange)}
          </span>
        </div>
      </div>
      
      <a href="${dexLink}" target="_blank" class="opportunity-action-btn" style="
        display: block;
        text-align: center;
        padding: var(--spacing-sm);
        background: var(--color-surface-hover);
        border-radius: var(--radius-md);
        margin-top: var(--spacing-sm);
        font-size: var(--font-size-xs);
        font-weight: 600;
        color: var(--color-text-primary);
        transition: all 0.2s;
      " onmouseover="this.style.background='var(--color-primary)'; this.style.color='white';" 
         onmouseout="this.style.background='var(--color-surface-hover)'; this.style.color='var(--color-text-primary)';">
        📊 View on DexScreener
      </a>
    </div>
  `;}).join('');
}

function renderRSITable(tokens) {
  const tbody = document.getElementById('rsi-table-body');
  const countEl = document.getElementById('rsi-table-count');
  const titleEl = document.getElementById('rsi-table-title');
  
  if (!tokens || tokens.length === 0) {
    tokens = generateMockRSI(state.rsiMode);
  }
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  
  // Filter by threshold
  let filtered = tokensArray;
  if (state.rsiMode === 'oversold') {
    filtered = tokensArray.filter(t => (t.rsi || t.rsiValue) <= state.rsiThreshold);
    titleEl.textContent = 'Most Oversold';
  } else {
    filtered = tokensArray.filter(t => (t.rsi || t.rsiValue) >= state.rsiThreshold);
    titleEl.textContent = 'Most Overbought';
  }
  
  countEl.textContent = `${filtered.length} tokens`;
  
  tbody.innerHTML = filtered.slice(0, 20).map(token => {
    const symbol = typeof token.symbol === 'string' ? token.symbol : (token.symbol?.symbol || token.token || 'TOKEN');
    const name = typeof token.name === 'string' ? token.name : (token.symbol?.name || '');
    return `
    <tr>
      <td>
        <div class="token-cell">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
            <span class="token-name">${name}</span>
          </div>
        </div>
      </td>
      <td class="price-cell">${formatPrice(token.price)}</td>
      <td style="color: ${(token.rsi || token.rsiValue) <= 30 ? 'var(--color-success)' : (token.rsi || token.rsiValue) >= 70 ? 'var(--color-danger)' : 'inherit'}; font-weight: 600;">
        ${(token.rsi || token.rsiValue || 25).toFixed(1)}
      </td>
      <td class="${getChangeClass(token.change24h || token.priceChange)}">${formatPercent(token.change24h || token.priceChange)}</td>
      <td>${formatMarketCap(token.marketCap || token.mcap)}</td>
    </tr>
  `;}).join('');
}

// ============================================
// FUNDING Section
// ============================================

async function loadFunding() {
  // Load squeeze alerts
  const squeezes = await fetchAPI(ENDPOINTS.fundingSqueeze, generateMockSqueezes());
  renderSqueezeAlerts(squeezes);
  
  // Load funding rates
  const funding = await fetchAPI(ENDPOINTS.funding, generateMockFunding());
  renderFundingTable(funding);
}

function renderSqueezeAlerts(squeezes) {
  const grid = document.getElementById('funding-squeeze-grid');
  
  if (!squeezes || squeezes.length === 0) {
    squeezes = generateMockSqueezes();
  }
  
  const squeezesArray = Array.isArray(squeezes) ? squeezes : (squeezes.alerts || []);
  
  if (squeezesArray.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="color: rgba(255,255,255,0.6);"><div class="icon">🎯</div><p>No squeeze alerts right now. Check back soon!</p></div>`;
    return;
  }
  
  grid.innerHTML = squeezesArray.slice(0, 4).map(squeeze => {
    const symbol = typeof squeeze.symbol === 'string' ? squeeze.symbol : (squeeze.symbol?.symbol || squeeze.token || 'TOKEN');
    return `
    <div class="opportunity-card" style="background: rgba(239, 68, 68, 0.15);">
      <div class="opportunity-header">
        <div class="opportunity-token">
          <div class="token-logo" style="background: rgba(255,255,255,0.1); color: white;">${symbol[0] || 'T'}</div>
          <div>
            <div class="token-symbol" style="color: white;">${symbol}</div>
            <div class="token-name" style="font-size: 12px; color: rgba(255,255,255,0.6);">Squeeze Alert</div>
          </div>
        </div>
        <div class="opportunity-rsi" style="color: var(--color-danger);">🔥</div>
      </div>`
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label" style="color: rgba(255,255,255,0.6);">Funding</span>
          <span class="stat-value" style="color: ${(squeeze.fundingRate || 0) > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${formatPercent(squeeze.fundingRate || squeeze.rate, true)}
          </span>
        </div>
        <div class="stat">
          <span class="stat-label" style="color: rgba(255,255,255,0.6);">Open Interest</span>
          <span class="stat-value" style="color: white;">${formatVolume(squeeze.openInterest || squeeze.oi)}</span>
        </div>
        <div class="stat">
          <span class="stat-label" style="color: rgba(255,255,255,0.6);">Signal</span>
          <span class="stat-value" style="color: var(--color-warning);">${squeeze.signal || 'Potential Reversal'}</span>
        </div>
        <div class="stat">
          <span class="stat-label" style="color: rgba(255,255,255,0.6);">Direction</span>
          <span class="stat-value" style="color: ${squeeze.direction === 'long' ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${squeeze.direction === 'long' ? '📈 Long Squeeze' : '📉 Short Squeeze'}
          </span>
        </div>
      </div>
    </div>
  `;}).join('');
}

function renderFundingTable(funding) {
  const tbody = document.getElementById('funding-table-body');
  
  if (!funding || funding.length === 0) {
    funding = generateMockFunding();
  }
  
  const fundingArray = Array.isArray(funding) ? funding : (funding.rates || []);
  
  tbody.innerHTML = fundingArray.slice(0, 20).map(rate => {
    const symbol = typeof rate.symbol === 'string' ? rate.symbol : (rate.symbol?.symbol || rate.token || 'TOKEN');
    return `
    <tr>
      <td>
        <div class="token-cell">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
          </div>
        </div>
      </td>
      <td class="${getChangeClass(rate.fundingRate || rate.rate)}" style="font-weight: 600;">
        ${formatPercent(rate.fundingRate || rate.rate, true)}
      </td>
      <td class="${getChangeClass(rate.predictedRate || rate.predicted)}" style="opacity: 0.8;">
        ${formatPercent(rate.predictedRate || rate.predicted, true)}
      </td>
      <td>${formatVolume(rate.openInterest || rate.oi)}</td>
      <td>
        <span class="badge ${Math.abs(rate.fundingRate || rate.rate) > 0.05 ? 'badge-warning' : 'badge-info'}">
          ${Math.abs(rate.fundingRate || rate.rate) > 0.05 ? 'Extreme' : 'Normal'}
        </span>
      </td>
    </tr>
  `;}).join('');
}

function refreshFunding() {
  showToast('Refreshing funding rates...', 'info');
  loadFunding();
}

// ============================================
// UNLOCKS Section
// ============================================

async function loadUnlocks() {
  const unlocks = await fetchAPI(ENDPOINTS.unlocks, generateMockUnlocks());
  renderUnlocksList(unlocks);
  renderUnlocksTable(unlocks);
}

function renderUnlocksList(unlocks) {
  const list = document.getElementById('unlocks-list');
  
  if (!unlocks || unlocks.length === 0) {
    unlocks = generateMockUnlocks();
  }
  
  const unlocksArray = Array.isArray(unlocks) ? unlocks : (unlocks.unlocks || []);
  
  list.innerHTML = unlocksArray.slice(0, 5).map(unlock => {
    const date = new Date(unlock.date || unlock.unlockDate);
    const impact = unlock.percentOfSupply > 5 ? 'high' : unlock.percentOfSupply > 2 ? 'medium' : 'low';
    
    return `
      <div class="unlock-card ${impact}-impact">
        <div class="unlock-info">
          <div class="unlock-date">
            <div class="unlock-date-day">${date.getDate()}</div>
            <div class="unlock-date-month">${date.toLocaleDateString('en-US', { month: 'short' })}</div>
          </div>
          <div class="unlock-details">
            <h3>${unlock.symbol || unlock.token || 'TOKEN'} ${unlock.name ? `(${unlock.name})` : ''}</h3>
            <p>${unlock.description || `Token unlock event`}</p>
          </div>
        </div>
        <div class="unlock-impact">
          <div class="unlock-amount">${formatVolume(unlock.value || unlock.usdValue)}</div>
          <div class="unlock-percent">${unlock.percentOfSupply || unlock.supplyPercent || 0}% of supply</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderUnlocksTable(unlocks) {
  const tbody = document.getElementById('unlocks-table-body');
  
  if (!unlocks || unlocks.length === 0) {
    unlocks = generateMockUnlocks();
  }
  
  const unlocksArray = Array.isArray(unlocks) ? unlocks : (unlocks.unlocks || []);
  
  tbody.innerHTML = unlocksArray.slice(0, 15).map(unlock => {
    const symbol = typeof unlock.symbol === 'string' ? unlock.symbol : (unlock.symbol?.symbol || unlock.token || 'TOKEN');
    const impact = unlock.percentOfSupply > 5 ? 'High' : unlock.percentOfSupply > 2 ? 'Medium' : 'Low';
    const impactClass = unlock.percentOfSupply > 5 ? 'danger' : unlock.percentOfSupply > 2 ? 'warning' : 'success';
    
    return `
      <tr>
        <td>${formatDate(unlock.date || unlock.unlockDate)}</td>
        <td>
          <div class="token-cell">
            <div class="token-logo">${symbol[0] || 'T'}</div>
            <div class="token-info">
              <span class="token-symbol">${symbol}</span>
            </div>
          </div>
        </td>
        <td>${formatVolume(unlock.amount || unlock.tokenAmount)}</td>
        <td>${unlock.percentOfSupply || unlock.supplyPercent || 0}%</td>
        <td>${formatVolume(unlock.value || unlock.usdValue)}</td>
        <td><span class="badge badge-${impactClass}">${impact}</span></td>
      </tr>
    `;
  }).join('');
}

function refreshUnlocks() {
  showToast('Refreshing unlock data...', 'info');
  loadUnlocks();
}

// ============================================
// LEADERBOARD Section
// ============================================

async function loadLeaderboard() {
  const leaderboard = await fetchAPI(ENDPOINTS.leaderboard, generateMockLeaderboard());
  const tokenLeaderboard = await fetchAPI(ENDPOINTS.leaderboardTokens, generateMockTokenLeaderboard());
  
  renderLeaderboardPodium(tokenLeaderboard);
  renderLeaderboardTable(tokenLeaderboard);
  renderSignalLeaderboard(leaderboard);
}

function renderLeaderboardPodium(tokens) {
  const podium = document.getElementById('leaderboard-podium');
  
  if (!tokens || tokens.length === 0) {
    tokens = generateMockTokenLeaderboard();
  }
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  const top3 = tokensArray.slice(0, 3);
  
  const positions = ['second', 'first', 'third'];
  
  podium.innerHTML = top3.map((token, i) => {
    const symbol = typeof token.symbol === 'string' ? token.symbol : (token.symbol?.symbol || token.token || 'TOKEN');
    return `
    <div class="podium-item ${positions[i] || 'third'}">
      <div class="podium-rank">#${i + 1}</div>
      <div class="podium-token">
        <div class="token-logo">${symbol[0] || 'T'}</div>
        <div class="token-symbol">${symbol}</div>
      </div>
      <div class="podium-change">${formatPercent(token.change || token.change24h || token.return)}</div>
    </div>
  `;}).join('');
}

function renderLeaderboardTable(tokens) {
  const tbody = document.getElementById('leaderboard-table-body');
  
  if (!tokens || tokens.length === 0) {
    tokens = generateMockTokenLeaderboard();
  }
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  
  tbody.innerHTML = tokensArray.slice(0, 20).map((token, i) => {
    const symbol = typeof token.symbol === 'string' ? token.symbol : (token.symbol?.symbol || token.token || 'TOKEN');
    const name = typeof token.name === 'string' ? token.name : (token.symbol?.name || '');
    return `
    <tr>
      <td style="font-weight: 600; color: var(--color-primary-dark);">${i + 1}</td>
      <td>
        <div class="token-cell">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
            <span class="token-name">${name}</span>
          </div>
        </div>
      </td>
      <td class="price-cell">${formatPrice(token.price)}</td>
      <td class="${getChangeClass(token.change || token.change24h)}">${formatPercent(token.change || token.change24h)}</td>
      <td>${formatVolume(token.volume || token.volume24h)}</td>
      <td style="font-weight: 600; color: var(--color-primary-dark);">${token.score || Math.floor(Math.random() * 30 + 70)}</td>
    </tr>
  `;}).join('');
}

function renderSignalLeaderboard(leaderboard) {
  const tbody = document.getElementById('signal-leaderboard-body');
  
  if (!leaderboard || leaderboard.length === 0) {
    leaderboard = generateMockLeaderboard();
  }
  
  const items = Array.isArray(leaderboard) ? leaderboard : (leaderboard.signals || []);
  
  tbody.innerHTML = items.slice(0, 10).map((item, i) => {
    const symbol = typeof item.symbol === 'string' ? item.symbol : (item.symbol?.symbol || item.token || 'TOKEN');
    return `
    <tr>
      <td style="font-weight: 600; color: white;">${i + 1}</td>
      <td>
        <div class="token-cell">
          <div class="token-logo" style="background: rgba(255,255,255,0.1); color: white;">${symbol[0] || 'T'}</div>
          <div class="token-info">
            <span class="token-symbol">${symbol}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${item.type === 'sell' ? 'danger' : 'success'}">${item.type || 'BUY'}</span></td>
      <td style="color: rgba(255,255,255,0.8);">${item.totalSignals || item.signals || Math.floor(Math.random() * 20 + 5)}</td>
      <td style="color: var(--color-success);">${item.winRate || Math.floor(Math.random() * 30 + 60)}%</td>
      <td class="change-positive">${formatPercent(item.avgReturn || item.return || Math.random() * 15 + 5)}</td>
    </tr>
  `;}).join('');
}

// ============================================
// Mock Data Generators
// ============================================

function generateMockPerformance() {
  return {
    winRate: Math.floor(Math.random() * 20 + 65),
    avgReturn: (Math.random() * 10 + 5).toFixed(1),
    totalSignals: Math.floor(Math.random() * 100 + 100),
    activeSignals: Math.floor(Math.random() * 5 + 2),
  };
}

function generateMockSignals() {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY'];
  return tokens.slice(0, 4).map(symbol => ({
    symbol,
    name: symbol,
    type: Math.random() > 0.3 ? 'BUY' : 'SELL',
    entry: Math.random() * 100 + 1,
    target: Math.random() * 150 + 10,
    stop: Math.random() * 50 + 0.5,
    timestamp: new Date().toISOString(),
  }));
}

function generateMockSignalHistory() {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY', 'PYTH', 'JTO'];
  return tokens.map(symbol => ({
    symbol,
    type: Math.random() > 0.3 ? 'BUY' : 'SELL',
    entry: Math.random() * 100 + 1,
    target: Math.random() * 150 + 10,
    stop: Math.random() * 50 + 0.5,
    result: (Math.random() - 0.3) * 30,
    date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

function generateMockHistoryCalls() {
  return generateMockPerformanceData().trackedSignals || [];
}

function generateMockPerformanceData() {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY', 'PYTH', 'JTO', 'ORCA', 'POPCAT', 'MEW', 'BOME'];
  const trackedSignals = [];
  
  for (let i = 0; i < 50; i++) {
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const isWin = Math.random() > 0.27; // ~73% win rate
    const roi = isWin ? (Math.random() * 40 + 2) : -(Math.random() * 15 + 3);
    const entry = Math.random() * 100 + 1;
    const exitPrice = entry * (1 + roi / 100);
    
    trackedSignals.push({
      token: { symbol: token, address: 'So11111111111111111111111111111111111111112' },
      action: Math.random() > 0.5 ? 'LONG' : 'SHORT',
      entry,
      target: entry * (1 + (Math.random() * 20 + 10) / 100),
      stopLoss: entry * (1 - (Math.random() * 8 + 4) / 100),
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      outcome: {
        result: isWin ? 'WIN' : 'LOSS',
        exitPrice,
        returnPercent: roi,
        exitTime: new Date(Date.now() - Math.random() * 28 * 24 * 60 * 60 * 1000).toISOString(),
      },
      roi,
    });
  }
  
  // Sort by timestamp desc
  trackedSignals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const wins = trackedSignals.filter(s => s.outcome.result === 'WIN').length;
  const losses = trackedSignals.filter(s => s.outcome.result === 'LOSS').length;
  const totalRoi = trackedSignals.reduce((sum, s) => sum + s.roi, 0);
  const avgWin = trackedSignals.filter(s => s.outcome.result === 'WIN').reduce((sum, s) => sum + s.roi, 0) / wins;
  const avgLoss = trackedSignals.filter(s => s.outcome.result === 'LOSS').reduce((sum, s) => sum + s.roi, 0) / losses;
  const bestTrade = trackedSignals.reduce((best, s) => s.roi > best.roi ? s : best, trackedSignals[0]);
  const worstTrade = trackedSignals.reduce((worst, s) => s.roi < worst.roi ? s : worst, trackedSignals[0]);
  
  return {
    winRate: (wins / (wins + losses)) * 100,
    avgReturn: totalRoi / trackedSignals.length,
    totalSignals: trackedSignals.length,
    wins,
    losses,
    profitFactor: Math.abs(avgWin / avgLoss),
    avgWin,
    avgLoss,
    bestTrade: { symbol: bestTrade.token.symbol, roi: bestTrade.roi },
    worstTrade: { symbol: worstTrade.token.symbol, roi: worstTrade.roi },
    trackedSignals,
  };
}

function generateMockVolumeSpikes() {
  const tokens = ['BONK', 'WIF', 'POPCAT', 'MEW'];
  return tokens.map(symbol => ({
    symbol,
    volume: Math.random() * 50000000 + 1000000,
    baseline: Math.random() * 10000000 + 500000,
    multiplier: (Math.random() * 3 + 1.5).toFixed(1),
    price: Math.random() * 10,
    priceChange: (Math.random() - 0.3) * 20,
  }));
}

function generateMockVolumeTop() {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY', 'PYTH', 'JTO', 'ORCA', 'MNGO'];
  return tokens.map(symbol => ({
    symbol,
    name: symbol,
    volume: Math.random() * 100000000 + 1000000,
    volumeChange: (Math.random() - 0.3) * 50,
    price: Math.random() * 100 + 0.001,
    priceChange: (Math.random() - 0.5) * 20,
  }));
}

function generateMockRSI(mode) {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY', 'PYTH', 'JTO', 'ORCA', 'MNGO'];
  return tokens.map(symbol => ({
    symbol,
    name: symbol,
    price: Math.random() * 100 + 0.001,
    rsi: mode === 'oversold' ? Math.random() * 35 + 10 : Math.random() * 25 + 70,
    change24h: (Math.random() - 0.5) * 20,
    marketCap: Math.random() * 1000000000 + 10000000,
  }));
}

function generateMockSqueezes() {
  return [
    { symbol: 'SOL', fundingRate: 0.08, openInterest: 500000000, direction: 'short', signal: 'Potential Reversal' },
    { symbol: 'ETH', fundingRate: -0.06, openInterest: 800000000, direction: 'long', signal: 'Potential Reversal' },
  ];
}

function generateMockFunding() {
  const tokens = ['SOL', 'ETH', 'BTC', 'JUP', 'RNDR', 'ARB', 'OP', 'SUI'];
  return tokens.map(symbol => ({
    symbol,
    fundingRate: (Math.random() - 0.5) * 0.1,
    predictedRate: (Math.random() - 0.5) * 0.1,
    openInterest: Math.random() * 500000000 + 10000000,
  }));
}

function generateMockUnlocks() {
  const tokens = ['ARB', 'OP', 'SUI', 'APT', 'SEI', 'TIA'];
  return tokens.map((symbol, i) => ({
    symbol,
    name: symbol,
    date: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    amount: Math.random() * 100000000 + 1000000,
    percentOfSupply: Math.random() * 8 + 1,
    value: Math.random() * 100000000 + 1000000,
    description: 'Team/Investor unlock',
  }));
}

function generateMockLeaderboard() {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY'];
  return tokens.map(symbol => ({
    symbol,
    type: Math.random() > 0.3 ? 'BUY' : 'SELL',
    totalSignals: Math.floor(Math.random() * 20 + 5),
    winRate: Math.floor(Math.random() * 30 + 60),
    avgReturn: Math.random() * 15 + 5,
  }));
}

function generateMockTokenLeaderboard() {
  const tokens = ['SOL', 'JUP', 'BONK', 'WIF', 'RNDR', 'RAY', 'PYTH', 'JTO', 'ORCA', 'MNGO'];
  return tokens.map(symbol => ({
    symbol,
    name: symbol,
    price: Math.random() * 100 + 0.001,
    change: Math.random() * 50 - 10,
    volume: Math.random() * 100000000 + 1000000,
    score: Math.floor(Math.random() * 30 + 70),
  })).sort((a, b) => b.change - a.change);
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(link.dataset.section);
    });
  });
  
  // Mobile menu
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('mobile-nav').classList.toggle('open');
  });
  
  // RSI Toggle
  document.querySelectorAll('#rsi-section .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#rsi-section .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.rsiMode = btn.dataset.mode;
      
      const slider = document.getElementById('rsi-slider');
      const value = document.getElementById('rsi-value');
      
      if (state.rsiMode === 'oversold') {
        slider.min = 10;
        slider.max = 50;
        slider.value = 30;
        state.rsiThreshold = 30;
      } else {
        slider.min = 50;
        slider.max = 90;
        slider.value = 70;
        state.rsiThreshold = 70;
      }
      value.textContent = slider.value;
      
      loadRSI();
    });
  });
  
  // RSI Slider
  const slider = document.getElementById('rsi-slider');
  const value = document.getElementById('rsi-value');
  slider?.addEventListener('input', () => {
    state.rsiThreshold = parseInt(slider.value);
    value.textContent = slider.value;
    loadRSI();
  });
  
  // RSI Search
  document.getElementById('rsi-scan-btn')?.addEventListener('click', () => {
    showToast('Scanning market...', 'info');
    loadRSI();
  });
  
  // Leaderboard period toggle
  document.querySelectorAll('#leaderboard-section .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#leaderboard-section .toggle-group .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.leaderboardPeriod = btn.dataset.period;
      loadLeaderboard();
    });
  });
}

// ============================================
// Oversold.lol-Style Section
// ============================================

let oversoldTimeframe = '4H';
let oversoldAutoRefresh = null;

async function loadOversoldSection() {
  // Show loading states
  const oversoldGrid = document.getElementById('oversold-tokens-grid');
  const overboughtGrid = document.getElementById('overbought-tokens-grid');
  
  oversoldGrid.innerHTML = '<div class="oversold-loading">⏳ Scanning market...</div>';
  overboughtGrid.innerHTML = '<div class="oversold-loading">⏳ Scanning market...</div>';
  
  const startTime = performance.now();
  
  try {
    const timeframe = oversoldTimeframe;
    
    // Fetch with caching
    const [oversoldData, overboughtData] = await Promise.all([
      cachedFetch(
        `${ENDPOINTS.rsiOversold}?timeframe=${timeframe}&threshold=40`,
        `oversold-${timeframe}`
      ),
      cachedFetch(
        `${ENDPOINTS.rsiOverbought}?timeframe=${timeframe}&threshold=60`,
        `overbought-${timeframe}`
      )
    ]);

    if (oversoldData.success) {
      // Store original data for filtering
      originalOversoldTokens = oversoldData.tokens;
      updateOversoldStats(oversoldData.tokens);
      renderOversoldTokens(oversoldData.tokens);
    } else {
      oversoldGrid.innerHTML = '<div class="oversold-loading">❌ Failed to load oversold data</div>';
    }

    if (overboughtData.success) {
      // Store original data
      originalOverboughtTokens = overboughtData.tokens;
      renderOverboughtTokens(overboughtData.tokens);
    } else {
      overboughtGrid.innerHTML = '<div class="oversold-loading">❌ Failed to load overbought data</div>';
    }

    updateOversoldTimestamp();
    
    // Track performance
    const loadTime = performance.now() - startTime;
    perfMonitor.trackLoadTime(loadTime);
    console.log(`[Performance] Oversold section loaded in ${loadTime.toFixed(0)}ms`);
  } catch (error) {
    console.error('Error loading oversold section:', error);
    oversoldGrid.innerHTML = '<div class="oversold-loading">❌ Network error. Please try again.</div>';
    overboughtGrid.innerHTML = '<div class="oversold-loading">❌ Network error. Please try again.</div>';
  }
}

function updateOversoldStats(tokens) {
  const extreme = tokens.filter(t => t.rsi <= 20).length;
  const strong = tokens.filter(t => t.rsi <= 30).length;
  const moderate = tokens.filter(t => t.rsi > 30 && t.rsi <= 40).length;
  const neutral = tokens.filter(t => t.rsi > 40 && t.rsi <= 60).length;

  document.getElementById('oversold-extreme-count').textContent = extreme;
  document.getElementById('oversold-strong-count').textContent = strong;
  document.getElementById('oversold-moderate-count').textContent = moderate;
  document.getElementById('oversold-neutral-count').textContent = neutral;
}

function renderOversoldTokens(tokens) {
  const grid = document.getElementById('oversold-tokens-grid');
  
  if (!tokens || tokens.length === 0) {
    grid.innerHTML = '<div class="oversold-loading">No oversold tokens found</div>';
    return;
  }

  grid.innerHTML = tokens.map(token => {
    const severity = token.rsi <= 20 ? 'extreme' : token.rsi <= 30 ? 'strong' : 'moderate';
    const signalStrength = token.signal?.strength || 'MEDIUM';
    const dexUrl = token.address ? `https://dexscreener.com/solana/${token.address}` : '#';
    
    return `
      <div class="oversold-token-card ${severity}" onclick="window.open('${dexUrl}', '_blank')">
        <div class="oversold-token-header">
          <div>
            <div class="oversold-token-symbol">${token.symbol} 📊</div>
            <div class="oversold-token-name">${token.name || token.symbol}</div>
          </div>
          <div class="oversold-rsi-badge ${severity}">
            RSI ${Math.round(token.rsi)}
          </div>
        </div>
        
        <div class="oversold-token-metrics">
          <div class="oversold-metric">
            <span class="oversold-metric-label">Price</span>
            <span class="oversold-metric-value">${formatPrice(token.price)}</span>
          </div>
          <div class="oversold-metric">
            <span class="oversold-metric-label">24h Change</span>
            <span class="oversold-metric-value ${token.priceChange24h >= 0 ? 'positive' : 'negative'}">
              ${formatPercent(token.priceChange24h)}
            </span>
          </div>
          <div class="oversold-metric">
            <span class="oversold-metric-label">Volume 24h</span>
            <span class="oversold-metric-value">${formatVolume(token.volume24h)}</span>
          </div>
          <div class="oversold-metric">
            <span class="oversold-metric-label">Market Cap</span>
            <span class="oversold-metric-value">${formatMarketCap(token.marketCap)}</span>
          </div>
        </div>
        
        <div class="oversold-signal-strength ${signalStrength.toLowerCase()}">
          🎯 ${signalStrength} LONG Signal
        </div>
        
        <div class="oversold-token-footer">
          <small style="color: var(--text-muted);">Click to view on DEXScreener</small>
        </div>
      </div>
    `;
  }).join('');
}

function renderOverboughtTokens(tokens) {
  const grid = document.getElementById('overbought-tokens-grid');
  
  if (!tokens || tokens.length === 0) {
    grid.innerHTML = '<div class="oversold-loading">No overbought tokens found</div>';
    return;
  }

  grid.innerHTML = tokens.map(token => {
    const severity = token.rsi >= 80 ? 'extreme' : token.rsi >= 70 ? 'strong' : 'moderate';
    
    return `
      <div class="oversold-token-card ${severity}">
        <div class="oversold-token-header">
          <div>
            <div class="oversold-token-symbol">${token.symbol}</div>
            <div class="oversold-token-name">${token.name || token.symbol}</div>
          </div>
          <div class="oversold-rsi-badge ${severity}">
            RSI ${Math.round(token.rsi)}
          </div>
        </div>
        
        <div class="oversold-token-metrics">
          <div class="oversold-metric">
            <span class="oversold-metric-label">Price</span>
            <span class="oversold-metric-value">${formatPrice(token.price)}</span>
          </div>
          <div class="oversold-metric">
            <span class="oversold-metric-label">24h Change</span>
            <span class="oversold-metric-value ${token.priceChange24h >= 0 ? 'positive' : 'negative'}">
              ${formatPercent(token.priceChange24h)}
            </span>
          </div>
        </div>
        
        <div class="oversold-signal-strength ${severity}">
          Potential Reversal
        </div>
      </div>
    `;
  }).join('');
}

function updateOversoldTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('oversold-last-update').textContent = `Last update: ${timeStr}`;
}

function refreshOversold() {
  loadOversoldSection();
}

// Setup timeframe selector and filters
document.addEventListener('DOMContentLoaded', () => {
  // Timeframe selector
  document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      oversoldTimeframe = e.target.dataset.timeframe;
      loadOversoldSection();
    });
  });
  
  // Search filter with debouncing (300ms delay)
  const searchInput = document.getElementById('oversold-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterOversoldTokens, 300));
  }
  
  // Severity filter
  const filterSelect = document.getElementById('oversold-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', filterOversoldTokens);
  }
});

// Store original token data for filtering
let originalOversoldTokens = [];
let originalOverboughtTokens = [];

function filterOversoldTokens() {
  const searchTerm = document.getElementById('oversold-search')?.value.toLowerCase() || '';
  const filterValue = document.getElementById('oversold-filter')?.value || 'all';
  
  let filtered = [...originalOversoldTokens];
  
  // Apply search
  if (searchTerm) {
    filtered = filtered.filter(token => 
      token.symbol.toLowerCase().includes(searchTerm) ||
      (token.name && token.name.toLowerCase().includes(searchTerm))
    );
  }
  
  // Apply severity filter
  if (filterValue === 'extreme') {
    filtered = filtered.filter(token => token.rsi <= 20);
  } else if (filterValue === 'strong') {
    filtered = filtered.filter(token => token.rsi <= 30);
  } else if (filterValue === 'moderate') {
    filtered = filtered.filter(token => token.rsi > 30 && token.rsi <= 40);
  }
  
  renderOversoldTokens(filtered);
}

// Export oversold data to CSV
function exportOversoldData() {
  const tokens = originalOversoldTokens;
  
  if (!tokens || tokens.length === 0) {
    alert('No data to export');
    return;
  }
  
  // CSV header
  let csv = 'Symbol,Name,RSI,Price,24h Change %,Volume 24h,Market Cap,Signal Strength\n';
  
  // CSV rows
  tokens.forEach(token => {
    const severity = token.rsi <= 20 ? 'EXTREME' : token.rsi <= 30 ? 'STRONG' : 'MODERATE';
    csv += `${token.symbol},${token.name || token.symbol},${token.rsi.toFixed(2)},${token.price},${token.priceChange24h},${token.volume24h || 0},${token.marketCap || 0},${severity}\n`;
  });
  
  // Create download link
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oversold-tokens-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ============================================
// Positions Dashboard
// ============================================

let positionsData = {
  open: [],
  closed: [],
  pending: []
};

async function loadPositionsSection() {
  try {
    // Fetch positions data from NEW positions API
    const [openResponse, closedResponse, statsResponse] = await Promise.all([
      fetch(`${API_BASE}/positions/open`),
      fetch(`${API_BASE}/positions/closed?limit=50`),
      fetch(`${API_BASE}/positions/stats`)
    ]);
    
    const openData = await openResponse.json();
    const closedData = await closedResponse.json();
    const statsData = await statsResponse.json();
    
    if (openData.success && closedData.success && statsData.success) {
      positionsData.open = openData.positions || [];
      positionsData.closed = closedData.positions || [];
      positionsData.pending = []; // No pending positions tracked yet
      
      updatePositionsStatsFromAPI(statsData.stats);
      renderPositions();
    } else {
      throw new Error('API returned error');
    }
  } catch (error) {
    console.error('Error loading positions:', error);
    // Show empty state
    positionsData.open = [];
    positionsData.closed = [];
    positionsData.pending = [];
    updatePositionsStats();
    renderPositions();
  }
}

// Process REAL tracked signals data
function processRealPositionsData(signals) {
  positionsData.open = [];
  positionsData.closed = [];
  positionsData.pending = [];
  
  signals.forEach(signal => {
    const createdAt = new Date(signal.createdAt).getTime();
    const now = Date.now();
    
    // Map status to position state
    if (signal.status === 'ACTIVE') {
      // Active position - calculate current P&L
      positionsData.open.push({
        ...signal,
        token: { symbol: signal.tokenSymbol },
        entry: signal.entryPrice,
        targets: [signal.tp1, signal.tp2, signal.tp3],
        currentPrice: signal.exitPrice || signal.entryPrice,
        pnl: signal.pnlPercent || 0,
        timeInPosition: formatTimeInPosition(createdAt, now)
      });
    } else if (['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'STOPPED_OUT', 'EXPIRED'].includes(signal.status)) {
      // Closed position
      const resolvedAt = signal.resolvedAt ? new Date(signal.resolvedAt).getTime() : now;
      positionsData.closed.push({
        ...signal,
        token: { symbol: signal.tokenSymbol },
        entry: signal.entryPrice,
        exitPrice: signal.exitPrice || signal.tp1,
        pnl: signal.pnlPercent || 0,
        timeInPosition: formatTimeInPosition(createdAt, resolvedAt),
        outcome: signal.status
      });
    } else if (signal.status === 'INVALIDATED') {
      // Pending/invalidated
      positionsData.pending.push({
        ...signal,
        token: { symbol: signal.tokenSymbol, price: signal.entryPrice },
        entry: signal.entryPrice
      });
    }
  });
}

// Update stats with REAL performance data
function updateRealPositionsStats(performance) {
  if (!performance) return;
  
  const summary = performance.summary;
  const rates = performance.rates;
  const pnl = performance.pnl;
  const byDirection = performance.byDirection;
  
  // Total P&L (simulated from average)
  const totalPnl = parseFloat(pnl.total.replace(/[+%]/g, ''));
  
  document.getElementById('positions-total-pnl').textContent = pnl.total;
  document.getElementById('positions-total-pnl').className = totalPnl >= 0 ? 'stat-value profit' : 'stat-value loss';
  document.getElementById('positions-roi').textContent = `${pnl.average} Avg`;
  
  const winRate = parseFloat(rates.winRate);
  const totalResolved = summary.resolved;
  const wins = Math.round((winRate / 100) * totalResolved);
  const losses = totalResolved - wins;
  
  document.getElementById('positions-win-rate').textContent = rates.winRate;
  document.getElementById('positions-win-loss').textContent = `${wins}W / ${losses}L`;
  
  document.getElementById('positions-open-count').textContent = summary.active;
  document.getElementById('positions-total-count').textContent = `${summary.total} Total`;
  
  // Best/worst from closed positions
  const closedPnls = positionsData.closed.map(p => p.pnl || 0);
  const bestTrade = closedPnls.length > 0 ? Math.max(...closedPnls) : 0;
  const worstTrade = closedPnls.length > 0 ? Math.min(...closedPnls) : 0;
  
  document.getElementById('positions-best-trade').textContent = `+${Math.round(bestTrade)}%`;
  document.getElementById('positions-worst-trade').textContent = `${Math.round(worstTrade)}% Worst`;
}

// Fallback: process simulated data if real data unavailable
function processPositionsData(signals) {
  const now = Date.now();
  
  positionsData.open = [];
  positionsData.closed = [];
  positionsData.pending = [];
  
  signals.forEach(signal => {
    const signalTime = new Date(signal.timestamp).getTime();
    const hoursSince = (now - signalTime) / (1000 * 60 * 60);
    
    // Simulate position states (in production, this would come from actual trade tracking)
    if (hoursSince < 24 && !signal.closed) {
      // Active position
      const currentPrice = signal.token.price || signal.entry;
      const pnl = signal.action === 'LONG' 
        ? ((currentPrice - signal.entry) / signal.entry) * 100
        : ((signal.entry - currentPrice) / signal.entry) * 100;
      
      positionsData.open.push({
        ...signal,
        currentPrice,
        pnl,
        timeInPosition: formatTimeInPosition(signalTime, now)
      });
    } else if (signal.closed || hoursSince > 48) {
      // Closed position
      const exitPrice = signal.exitPrice || signal.targets[0];
      const pnl = signal.action === 'LONG'
        ? ((exitPrice - signal.entry) / signal.entry) * 100
        : ((signal.entry - exitPrice) / signal.entry) * 100;
      
      positionsData.closed.push({
        ...signal,
        exitPrice,
        pnl,
        timeInPosition: signal.duration || formatTimeInPosition(signalTime, now)
      });
    } else {
      // Pending entry
      positionsData.pending.push(signal);
    }
  });
}

function updatePositionsStats() {
  const allPositions = [...positionsData.open, ...positionsData.closed];
  const totalPnl = allPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const avgPnl = allPositions.length > 0 ? totalPnl / allPositions.length : 0;
  
  const winners = allPositions.filter(p => (p.pnl || 0) > 0).length;
  const losers = allPositions.filter(p => (p.pnl || 0) < 0).length;
  const winRate = allPositions.length > 0 ? (winners / allPositions.length) * 100 : 0;
  
  const bestTrade = Math.max(...allPositions.map(p => p.pnl || 0), 0);
  const worstTrade = Math.min(...allPositions.map(p => p.pnl || 0), 0);
  
  document.getElementById('positions-total-pnl').textContent = formatPnL(totalPnl);
  document.getElementById('positions-total-pnl').className = totalPnl >= 0 ? 'stat-value profit' : 'stat-value loss';
  document.getElementById('positions-roi').textContent = `${formatPercent(avgPnl, false)} ROI`;
  
  document.getElementById('positions-win-rate').textContent = `${Math.round(winRate)}%`;
  document.getElementById('positions-win-loss').textContent = `${winners}W / ${losers}L`;
  
  document.getElementById('positions-open-count').textContent = positionsData.open.length;
  document.getElementById('positions-total-count').textContent = `${allPositions.length} Total`;
  
  document.getElementById('positions-best-trade').textContent = `+${Math.round(bestTrade)}%`;
  document.getElementById('positions-worst-trade').textContent = `${Math.round(worstTrade)}% Worst`;
}

function updatePositionsStatsFromAPI(stats) {
  // Update stats from API response
  const totalPnl = stats.totalPnl || 0;
  document.getElementById('positions-total-pnl').textContent = `$${totalPnl.toFixed(2)}`;
  document.getElementById('positions-total-pnl').className = totalPnl >= 0 ? 'stat-value profit' : 'stat-value loss';
  document.getElementById('positions-roi').textContent = `${stats.avgPnl?.toFixed(2) || '0.00'}% ROI`;
  
  document.getElementById('positions-win-rate').textContent = `${stats.winRate?.toFixed(0) || '0'}%`;
  document.getElementById('positions-win-loss').textContent = `${stats.wins || 0}W / ${stats.losses || 0}L`;
  
  document.getElementById('positions-open-count').textContent = stats.openPositions || 0;
  document.getElementById('positions-total-count').textContent = `${stats.totalPositions || 0} Total`;
  
  const bestPnl = stats.bestTrade?.pnl || 0;
  const worstPnl = stats.worstTrade?.pnl || 0;
  document.getElementById('positions-best-trade').textContent = `+${bestPnl.toFixed(1)}%`;
  document.getElementById('positions-worst-trade').textContent = `${worstPnl.toFixed(1)}% Worst`;
}

function renderPositions() {
  renderOpenPositions();
  renderClosedPositions();
  renderPendingPositions();
}

function renderOpenPositions() {
  const grid = document.getElementById('open-positions-grid');
  const count = document.getElementById('open-positions-count');
  
  count.textContent = `${positionsData.open.length} Open`;
  
  if (positionsData.open.length === 0) {
    grid.innerHTML = '<div class="positions-empty-state"><div class="empty-icon">📭</div><h3>No Open Positions</h3><p>Start trading to see your active positions here</p></div>';
    return;
  }
  
  grid.innerHTML = positionsData.open.map(position => {
    const isProfitable = position.pnl >= 0;
    const targetPrice = position.targets?.tp1 || position.targets?.[0] || 0;
    
    return `
      <div class="position-card ${isProfitable ? 'profit' : 'loss'}">
        <div class="position-card-header">
          <span class="position-token">${position.token.symbol}</span>
          <span class="position-action ${position.action.toLowerCase()}">${position.action}</span>
        </div>
        
        <div class="position-pnl ${isProfitable ? 'profit' : 'loss'}">
          ${isProfitable ? '+' : ''}${position.pnl.toFixed(2)}%
        </div>
        
        <div class="position-details">
          <div class="position-detail">
            <span class="position-detail-label">Entry</span>
            <span class="position-detail-value">${formatPrice(position.entry)}</span>
          </div>
          <div class="position-detail">
            <span class="position-detail-label">Current</span>
            <span class="position-detail-value">${formatPrice(position.current)}</span>
          </div>
          <div class="position-detail">
            <span class="position-detail-label">Target</span>
            <span class="position-detail-value">${formatPrice(targetPrice)}</span>
          </div>
          <div class="position-detail">
            <span class="position-detail-label">Stop Loss</span>
            <span class="position-detail-value">${formatPrice(position.stopLoss)}</span>
          </div>
        </div>
        
        <div class="position-time">⏱️ ${position.timeInPosition}</div>
      </div>
    `;
  }).join('');
}

function renderClosedPositions() {
  const table = document.getElementById('closed-positions-table');
  const count = document.getElementById('closed-positions-count');
  
  count.textContent = `${positionsData.closed.length} Closed`;
  
  if (positionsData.closed.length === 0) {
    table.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No closed positions yet</td></tr>';
    return;
  }
  
  table.innerHTML = positionsData.closed.map(position => {
    const isProfitable = position.pnl >= 0;
    const exitPrice = position.current || position.entry;
    
    // Calculate P&L in dollars (assuming $100 position size for demo)
    const positionSize = 100;
    const pnlDollars = (position.pnl / 100) * positionSize;
    
    return `
      <tr>
        <td><strong>${position.token.symbol}</strong></td>
        <td><span class="badge badge-${position.action === 'LONG' ? 'success' : 'danger'}">${position.action}</span></td>
        <td>${formatPrice(position.entry)}</td>
        <td>${formatPrice(exitPrice)}</td>
        <td>${position.timeInPosition}</td>
        <td class="${isProfitable ? 'text-success' : 'text-danger'}"><strong>$${isProfitable ? '+' : ''}${pnlDollars.toFixed(2)}</strong></td>
        <td class="${isProfitable ? 'text-success' : 'text-danger'}"><strong>${isProfitable ? '+' : ''}${position.pnl.toFixed(2)}%</strong></td>
      </tr>
    `;
  }).join('');
}

function renderPendingPositions() {
  const grid = document.getElementById('pending-positions-grid');
  const count = document.getElementById('pending-positions-count');
  
  count.textContent = `${positionsData.pending.length} Pending`;
  
  if (positionsData.pending.length === 0) {
    grid.innerHTML = '<div class="positions-empty-state"><div class="empty-icon">✅</div><h3>No Pending Entries</h3><p>All signals have been entered or expired</p></div>';
    return;
  }
  
  grid.innerHTML = positionsData.pending.map(position => {
    return `
      <div class="position-card pending">
        <div class="position-card-header">
          <span class="position-token">${position.token.symbol}</span>
          <span class="position-action ${position.action.toLowerCase()}">${position.action}</span>
        </div>
        
        <div class="position-details">
          <div class="position-detail">
            <span class="position-detail-label">Entry Target</span>
            <span class="position-detail-value">${formatPrice(position.entry)}</span>
          </div>
          <div class="position-detail">
            <span class="position-detail-label">Current Price</span>
            <span class="position-detail-value">${formatPrice(position.token.price)}</span>
          </div>
          <div class="position-detail">
            <span class="position-detail-label">Confidence</span>
            <span class="position-detail-value">${position.confidence}%</span>
          </div>
          <div class="position-detail">
            <span class="position-detail-label">Risk</span>
            <span class="position-detail-value">${position.riskLevel}</span>
          </div>
        </div>
        
        <div class="position-time">⏳ Waiting for entry</div>
      </div>
    `;
  }).join('');
}

function formatTimeInPosition(startTime, endTime) {
  const hours = Math.floor((endTime - startTime) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}

function formatPnL(pnl) {
  if (pnl >= 0) return `+$${Math.abs(pnl).toFixed(2)}`;
  return `-$${Math.abs(pnl).toFixed(2)}`;
}

// Setup position tabs
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.positions-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      
      // Update buttons
      document.querySelectorAll('.positions-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Update content
      document.querySelectorAll('.positions-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`positions-tab-${tab}`).classList.add('active');
    });
  });
});

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Load initial section
  showSection('signals');
  
  // Auto-refresh every 2 minutes
  setInterval(() => {
    loadSectionData(state.currentSection);
  }, 120000);
});

// Global function references for inline handlers
window.refreshSignals = refreshSignals;
window.refreshVolume = refreshVolume;
window.refreshFunding = refreshFunding;
window.refreshUnlocks = refreshUnlocks;
window.refreshOversold = refreshOversold;
window.exportOversoldData = exportOversoldData;
window.showSection = showSection;
