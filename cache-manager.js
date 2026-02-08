/**
 * Cache Manager for Trading Caller
 * 
 * Implements intelligent caching to reduce API calls and improve performance
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheDurations = {
      // Fast-changing data (1 minute)
      'signals': 60 * 1000,
      'volume': 60 * 1000,
      'rsi': 60 * 1000,
      'oversold': 60 * 1000,
      'positions-open': 30 * 1000,
      
      // Medium-changing data (5 minutes)
      'funding': 5 * 60 * 1000,
      'positions-closed': 5 * 60 * 1000,
      'positions-stats': 5 * 60 * 1000,
      
      // Slow-changing data (15 minutes)
      'unlocks': 15 * 60 * 1000,
      'leaderboard': 15 * 60 * 1000,
      
      // Performance data (2 minutes)
      'performance': 2 * 60 * 1000,
    };
  }
  
  /**
   * Get cached data if available and not expired
   */
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    const age = now - cached.timestamp;
    const maxAge = this.cacheDurations[key] || 60 * 1000;
    
    if (age > maxAge) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Set cache with current timestamp
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Check if cache has fresh data
   */
  has(key) {
    return this.get(key) !== null;
  }
  
  /**
   * Clear specific cache entry
   */
  clear(key) {
    this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clearAll() {
    this.cache.clear();
  }
  
  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      const maxAge = this.cacheDurations[key] || 60 * 1000;
      
      if (age > maxAge) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get cache stats
   */
  getStats() {
    const stats = {
      totalEntries: this.cache.size,
      entries: {},
    };
    
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      const maxAge = this.cacheDurations[key] || 60 * 1000;
      const remaining = maxAge - age;
      
      stats.entries[key] = {
        age: Math.floor(age / 1000),
        remaining: Math.floor(remaining / 1000),
        expired: remaining <= 0,
      };
    }
    
    return stats;
  }
  
  /**
   * Preload cache for common data
   */
  async preload() {
    console.log('[Cache] Preloading common data...');
    
    try {
      // Preload signals
      const signalsRes = await fetch(`${API_BASE}/signals/latest`);
      const signalsData = await signalsRes.json();
      if (signalsData.success) {
        this.set('signals', signalsData);
      }
      
      // Preload performance
      const perfRes = await fetch(`${API_BASE}/signals/performance`);
      const perfData = await perfRes.json();
      if (perfData.success) {
        this.set('performance', perfData);
      }
      
      console.log('[Cache] Preload complete');
    } catch (error) {
      console.error('[Cache] Preload failed:', error);
    }
  }
}

// Create global cache instance
const cacheManager = new CacheManager();

// Cleanup expired cache every 5 minutes
setInterval(() => {
  cacheManager.cleanup();
}, 5 * 60 * 1000);

// Enhanced fetch with caching
async function cachedFetch(url, cacheKey, options = {}) {
  // Check cache first
  if (!options.skipCache) {
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      console.log(`[Cache] HIT for ${cacheKey}`);
      return cached;
    }
  }
  
  console.log(`[Cache] MISS for ${cacheKey} - fetching...`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      cacheManager.set(cacheKey, data);
    }
    
    return data;
  } catch (error) {
    console.error(`[Cache] Fetch failed for ${cacheKey}:`, error);
    
    // Return cached data even if expired, as fallback
    const staleCache = cacheManager.cache.get(cacheKey);
    if (staleCache) {
      console.log(`[Cache] Using stale cache for ${cacheKey}`);
      return staleCache.data;
    }
    
    throw error;
  }
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLoadTime: 0,
      loadTimes: [],
    };
  }
  
  trackAPICall() {
    this.metrics.apiCalls++;
  }
  
  trackCacheHit() {
    this.metrics.cacheHits++;
  }
  
  trackCacheMiss() {
    this.metrics.cacheMisses++;
  }
  
  trackLoadTime(duration) {
    this.metrics.loadTimes.push(duration);
    if (this.metrics.loadTimes.length > 100) {
      this.metrics.loadTimes.shift();
    }
    this.metrics.averageLoadTime = 
      this.metrics.loadTimes.reduce((a, b) => a + b, 0) / this.metrics.loadTimes.length;
  }
  
  getCacheHitRate() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }
  
  getStats() {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate().toFixed(1) + '%',
      averageLoadTime: this.metrics.averageLoadTime.toFixed(0) + 'ms',
    };
  }
  
  logStats() {
    console.log('[Performance]', this.getStats());
  }
}

const perfMonitor = new PerformanceMonitor();

// Log performance stats every minute
setInterval(() => {
  if (perfMonitor.metrics.apiCalls > 0) {
    perfMonitor.logStats();
  }
}, 60 * 1000);

// Debounce function for search/filter
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for scroll/resize
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Lazy loading for images/heavy content
function lazyLoad(selector, callback) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '50px',
  });
  
  document.querySelectorAll(selector).forEach(el => {
    observer.observe(el);
  });
}

// Make available globally
window.cacheManager = cacheManager;
window.cachedFetch = cachedFetch;
window.perfMonitor = perfMonitor;
window.debounce = debounce;
window.throttle = throttle;
window.lazyLoad = lazyLoad;
