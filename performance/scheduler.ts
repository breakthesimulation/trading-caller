/**
 * Performance Scheduler - Active Signal Monitoring
 * 
 * Runs price checks every 10 minutes for active signals.
 * Uses node-cron for scheduling.
 */

import cron from 'node-cron';
import { performanceTracker } from './tracker.js';

interface SchedulerState {
  running: boolean;
  job: cron.ScheduledTask | null;
  lastRun: Date | null;
  lastResults: {
    checked: number;
    resolved: number;
    expired: number;
    errors: number;
  } | null;
  runCount: number;
}

const state: SchedulerState = {
  running: false,
  job: null,
  lastRun: null,
  lastResults: null,
  runCount: 0,
};

/**
 * Run the price check task
 */
async function runPriceCheck(): Promise<void> {
  console.log('[PerfScheduler] Running scheduled price check...');
  state.lastRun = new Date();
  state.runCount++;
  
  try {
    const results = await performanceTracker.runCheckCycle();
    
    state.lastResults = {
      checked: results.checked,
      resolved: results.resolved,
      expired: results.expired,
      errors: results.errors,
    };
    
    // Log resolved signals
    if (results.resolved > 0) {
      console.log(`[PerfScheduler] ${results.resolved} signals resolved in this cycle`);
    }
    
  } catch (error) {
    console.error('[PerfScheduler] Price check failed:', error);
    state.lastResults = {
      checked: 0,
      resolved: 0,
      expired: 0,
      errors: 1,
    };
  }
}

/**
 * Start the scheduler
 */
export function start(): void {
  if (state.running) {
    console.log('[PerfScheduler] Already running');
    return;
  }
  
  console.log('[PerfScheduler] Starting price check scheduler (every 10 minutes)...');
  
  // Run every 10 minutes: "*/10 * * * *"
  state.job = cron.schedule('*/10 * * * *', runPriceCheck, {
    scheduled: true,
    timezone: 'UTC',
  });
  
  state.running = true;
  
  // Run initial check after 30 seconds (let the server start first)
  setTimeout(async () => {
    console.log('[PerfScheduler] Running initial price check...');
    await runPriceCheck();
  }, 30000);
}

/**
 * Stop the scheduler
 */
export function stop(): void {
  if (!state.running || !state.job) {
    console.log('[PerfScheduler] Not running');
    return;
  }
  
  console.log('[PerfScheduler] Stopping price check scheduler...');
  state.job.stop();
  state.job = null;
  state.running = false;
}

/**
 * Get scheduler status
 */
export function getStatus(): {
  running: boolean;
  schedule: string;
  lastRun: Date | null;
  lastResults: typeof state.lastResults;
  runCount: number;
  nextRun: string;
} {
  return {
    running: state.running,
    schedule: '*/10 * * * * (every 10 minutes)',
    lastRun: state.lastRun,
    lastResults: state.lastResults,
    runCount: state.runCount,
    nextRun: state.running ? 'Within 10 minutes' : 'Not scheduled',
  };
}

/**
 * Manually trigger a price check
 */
export async function trigger(): Promise<typeof state.lastResults> {
  await runPriceCheck();
  return state.lastResults;
}

// ============ Exports ============

export const performanceScheduler = {
  start,
  stop,
  getStatus,
  trigger,
};

export default performanceScheduler;
