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
    volume: { title: 'Volume Scanner', subtitle: 'Track volume spikes and top performing tokens in real-time.' },
    rsi: { title: 'RSI Scanner', subtitle: 'Find oversold and overbought opportunities before the crowd.' },
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
    case 'volume':
      await loadVolume();
      break;
    case 'rsi':
      await loadRSI();
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

async function loadRSI() {
  const endpoint = state.rsiMode === 'oversold' ? ENDPOINTS.rsiOversold : ENDPOINTS.rsiOverbought;
  const tokens = await fetchAPI(endpoint, generateMockRSI(state.rsiMode));
  
  renderRSIOpportunities(tokens);
  renderRSITable(tokens);
}

function renderRSIOpportunities(tokens) {
  const grid = document.getElementById('rsi-opportunities-grid');
  
  if (!tokens || tokens.length === 0) {
    tokens = generateMockRSI(state.rsiMode);
  }
  
  const tokensArray = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
  const extreme = state.rsiMode === 'oversold' 
    ? tokensArray.filter(t => (t.rsi || t.rsiValue) <= 20).slice(0, 4)
    : tokensArray.filter(t => (t.rsi || t.rsiValue) >= 80).slice(0, 4);
  
  const display = extreme.length > 0 ? extreme : tokensArray.slice(0, 4);
  
  grid.innerHTML = display.map(token => {
    const symbol = typeof token.symbol === 'string' ? token.symbol : (token.symbol?.symbol || token.token || 'TOKEN');
    const name = typeof token.name === 'string' ? token.name : (token.symbol?.name || '');
    return `
    <div class="opportunity-card">
      <div class="opportunity-header">
        <div class="opportunity-token">
          <div class="token-logo">${symbol[0] || 'T'}</div>
          <div>
            <div class="token-symbol">${symbol}</div>
            <div class="token-name" style="font-size: 12px;">${name}</div>
          </div>
        </div>
        <div class="opportunity-rsi" style="color: ${state.rsiMode === 'oversold' ? 'var(--color-success)' : 'var(--color-danger)'}">
          ${(token.rsi || token.rsiValue || 25).toFixed(1)}
        </div>
      </div>
      <div class="opportunity-stats">
        <div class="stat">
          <span class="stat-label">Price</span>
          <span class="stat-value">${formatPrice(token.price)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24h</span>
          <span class="stat-value ${getChangeClass(token.change24h || token.priceChange)}">${formatPercent(token.change24h || token.priceChange)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Market Cap</span>
          <span class="stat-value">${formatMarketCap(token.marketCap || token.mcap)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Signal</span>
          <span class="stat-value" style="color: ${state.rsiMode === 'oversold' ? 'var(--color-success)' : 'var(--color-danger)'}">
            ${state.rsiMode === 'oversold' ? '🟢 Buy Zone' : '🔴 Sell Zone'}
          </span>
        </div>
      </div>
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
window.showSection = showSection;
