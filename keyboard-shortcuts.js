/**
 * Keyboard Shortcuts for Trading Caller
 * 
 * Shortcuts:
 * - 1-7: Switch between sections
 * - R: Refresh current section
 * - /: Focus search
 * - ESC: Clear search/close modals
 * - E: Export data (when available)
 */

// Keyboard shortcut handler
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    // Allow ESC to blur
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }
  
  // Section shortcuts (1-7)
  const sectionKeys = {
    '1': 'signals',
    '2': 'history',
    '3': 'volume',
    '4': 'rsi',
    '5': 'oversold',
    '6': 'positions',
    '7': 'funding',
    '8': 'unlocks',
    '9': 'leaderboard',
  };
  
  if (sectionKeys[e.key]) {
    e.preventDefault();
    showSection(sectionKeys[e.key]);
    return;
  }
  
  // Refresh (R or F5)
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    refreshCurrentSection();
    showToast('Refreshing data...', 'info');
    return;
  }
  
  // Search (/)
  if (e.key === '/') {
    e.preventDefault();
    const searchInput = document.getElementById('oversold-search') || 
                       document.getElementById('rsi-search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    return;
  }
  
  // Export (E)
  if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    const currentSection = state.currentSection;
    if (currentSection === 'oversold' && typeof exportOversoldData === 'function') {
      exportOversoldData();
      showToast('Exporting data...', 'success');
    }
    return;
  }
  
  // Help (?)
  if (e.key === '?') {
    e.preventDefault();
    showKeyboardShortcutsHelp();
    return;
  }
});

// Refresh current section
function refreshCurrentSection() {
  const section = state.currentSection;
  
  switch (section) {
    case 'signals':
      refreshSignals();
      break;
    case 'volume':
      refreshVolume();
      break;
    case 'funding':
      refreshFunding();
      break;
    case 'unlocks':
      refreshUnlocks();
      break;
    case 'oversold':
      refreshOversold();
      break;
    case 'positions':
      loadPositionsSection();
      break;
    default:
      loadSectionData(section);
  }
}

// Toast notification system
function showToast(message, type = 'info') {
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Keyboard shortcuts help modal
function showKeyboardShortcutsHelp() {
  const existingModal = document.getElementById('shortcuts-modal');
  if (existingModal) {
    existingModal.remove();
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'shortcuts-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button onclick="this.closest('.modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="shortcuts-grid">
          <div class="shortcut-group">
            <h3>Navigation</h3>
            <div class="shortcut"><kbd>1</kbd> Signals</div>
            <div class="shortcut"><kbd>2</kbd> History</div>
            <div class="shortcut"><kbd>3</kbd> Volume</div>
            <div class="shortcut"><kbd>4</kbd> RSI</div>
            <div class="shortcut"><kbd>5</kbd> Oversold</div>
            <div class="shortcut"><kbd>6</kbd> Positions</div>
            <div class="shortcut"><kbd>7</kbd> Funding</div>
          </div>
          <div class="shortcut-group">
            <h3>Actions</h3>
            <div class="shortcut"><kbd>R</kbd> Refresh</div>
            <div class="shortcut"><kbd>/</kbd> Search</div>
            <div class="shortcut"><kbd>E</kbd> Export</div>
            <div class="shortcut"><kbd>ESC</kbd> Clear</div>
            <div class="shortcut"><kbd>?</kbd> Help</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <small class="text-muted">Press ? again to close</small>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('show'), 10);
  
  // Close on ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Make functions globally available
window.refreshCurrentSection = refreshCurrentSection;
window.showToast = showToast;
window.showKeyboardShortcutsHelp = showKeyboardShortcutsHelp;
