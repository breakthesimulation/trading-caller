/**
 * Scheduler Module - Cron Jobs
 * 
 * Schedules periodic tasks:
 * - Heartbeat: every 30 min
 * - Outcome check: every 4 hours
 * - Forum engagement: every 2 hours  
 * - Market scan: every hour
 * - Learning cycle: every 6 hours
 */

import cron from 'node-cron';
import heartbeat from './heartbeat.js';
import forum from './forum.js';
import { tracker, learner } from '../learning/index.js';
import { TradingCallerEngine } from '../research-engine/src/index.js';
import { performanceTracker } from '../performance/index.js';

interface SchedulerState {
  started: boolean;
  jobs: Map<string, cron.ScheduledTask>;
  lastRuns: Map<string, Date>;
}

const state: SchedulerState = {
  started: false,
  jobs: new Map(),
  lastRuns: new Map(),
};

// Engine instance for market scans
let engine: TradingCallerEngine | null = null;

/**
 * Initialize the engine for market scans
 */
export function setEngine(e: TradingCallerEngine): void {
  engine = e;
}

/**
 * Run heartbeat task
 */
async function runHeartbeatTask(): Promise<void> {
  console.log('[Scheduler] Running heartbeat task...');
  state.lastRuns.set('heartbeat', new Date());
  
  try {
    await heartbeat.runHeartbeat();
  } catch (error) {
    console.error('[Scheduler] Heartbeat task failed:', error);
  }
}

/**
 * Run outcome check task
 */
async function runOutcomeCheckTask(): Promise<void> {
  console.log('[Scheduler] Running outcome check task...');
  state.lastRuns.set('outcomeCheck', new Date());
  
  try {
    await tracker.runOutcomeCheck();
  } catch (error) {
    console.error('[Scheduler] Outcome check task failed:', error);
  }
}

/**
 * Run forum engagement task
 */
async function runForumEngagementTask(): Promise<void> {
  console.log('[Scheduler] Running forum engagement task...');
  state.lastRuns.set('forumEngagement', new Date());
  
  try {
    await forum.engageWithForum();
  } catch (error) {
    console.error('[Scheduler] Forum engagement task failed:', error);
  }
}

/**
 * Run market scan task
 */
async function runMarketScanTask(): Promise<void> {
  if (!engine) {
    console.log('[Scheduler] Engine not initialized, skipping market scan');
    return;
  }
  
  console.log('[Scheduler] Running market scan task...');
  state.lastRuns.set('marketScan', new Date());
  
  try {
    const signals = await engine.scan();
    
    // Record all generated signals for outcome tracking
    for (const signal of signals) {
      // Skip HOLD/AVOID signals - only track actionable ones
      if (signal.action === 'HOLD' || signal.action === 'AVOID') {
        continue;
      }
      
      // Track with legacy tracker (for backward compatibility)
      tracker.recordSignal({
        id: signal.id,
        token: signal.token,
        action: signal.action as 'LONG' | 'SHORT',
        entry: signal.entry,
        targets: signal.targets,
        stopLoss: signal.stopLoss,
        confidence: signal.confidence,
        timeframe: signal.timeframe,
        reasoning: signal.reasoning?.technical,
        indicators: signal.indicators || {},
      });
      
      // Track with new performance tracker (for detailed tracking)
      const trackedSignal = performanceTracker.trackSignal({
        id: signal.id,
        token: signal.token,
        action: signal.action as 'LONG' | 'SHORT',
        entry: signal.entry,
        targets: signal.targets,
        stopLoss: signal.stopLoss,
        confidence: signal.confidence,
        timeframe: signal.timeframe,
        reasoning: signal.reasoning?.technical,
        indicators: signal.indicators || {},
      });
      
      if (!trackedSignal) {
        console.log(`[Scheduler] Signal ${signal.id} for ${signal.token.symbol} was rejected (invalid data)`);
      }
    }
    
    const actionableSignals = signals.filter(s => s.action !== 'HOLD' && s.action !== 'AVOID');
    console.log(`[Scheduler] Market scan complete: ${signals.length} signals generated, ${actionableSignals.length} actionable`);
  } catch (error) {
    console.error('[Scheduler] Market scan task failed:', error);
  }
}

/**
 * Run learning cycle task
 */
async function runLearningTask(): Promise<void> {
  console.log('[Scheduler] Running learning cycle task...');
  state.lastRuns.set('learning', new Date());
  
  try {
    const result = await learner.runLearningCycle();
    console.log(`[Scheduler] Learning complete: ${result.insights.length} insights`);
  } catch (error) {
    console.error('[Scheduler] Learning task failed:', error);
  }
}

/**
 * Start all scheduled jobs
 */
export function start(): void {
  if (state.started) {
    console.log('[Scheduler] Already started');
    return;
  }

  console.log('[Scheduler] Starting scheduled jobs...');

  // Heartbeat: every 30 minutes
  // "*/30 * * * *" = at minute 0 and 30 of every hour
  const heartbeatJob = cron.schedule('*/30 * * * *', runHeartbeatTask, {
    scheduled: true,
    timezone: 'UTC',
  });
  state.jobs.set('heartbeat', heartbeatJob);

  // Outcome check: every 4 hours
  // "0 */4 * * *" = at minute 0 every 4 hours
  const outcomeJob = cron.schedule('0 */4 * * *', runOutcomeCheckTask, {
    scheduled: true,
    timezone: 'UTC',
  });
  state.jobs.set('outcomeCheck', outcomeJob);

  // Forum engagement: every 2 hours
  // "0 */2 * * *" = at minute 0 every 2 hours
  const forumJob = cron.schedule('0 */2 * * *', runForumEngagementTask, {
    scheduled: true,
    timezone: 'UTC',
  });
  state.jobs.set('forumEngagement', forumJob);

  // Market scan: every hour
  // "0 * * * *" = at minute 0 of every hour
  const marketJob = cron.schedule('0 * * * *', runMarketScanTask, {
    scheduled: true,
    timezone: 'UTC',
  });
  state.jobs.set('marketScan', marketJob);

  // Learning cycle: every 6 hours
  // "0 */6 * * *" = at minute 0 every 6 hours
  const learningJob = cron.schedule('0 */6 * * *', runLearningTask, {
    scheduled: true,
    timezone: 'UTC',
  });
  state.jobs.set('learning', learningJob);

  state.started = true;
  console.log('[Scheduler] All jobs scheduled');

  // Run initial tasks after a short delay
  setTimeout(async () => {
    console.log('[Scheduler] Running initial tasks...');
    await runHeartbeatTask();
    
    // Also run an initial market scan after startup
    console.log('[Scheduler] Running initial market scan...');
    await runMarketScanTask();
  }, 5000);
}

/**
 * Stop all scheduled jobs
 */
export function stop(): void {
  if (!state.started) {
    console.log('[Scheduler] Not running');
    return;
  }

  console.log('[Scheduler] Stopping scheduled jobs...');
  
  for (const [name, job] of state.jobs) {
    job.stop();
    console.log(`[Scheduler] Stopped: ${name}`);
  }
  
  state.jobs.clear();
  state.started = false;
}

/**
 * Get scheduler status
 */
export function getStatus(): {
  running: boolean;
  jobs: Array<{
    name: string;
    lastRun: Date | null;
    nextRun: string;
  }>;
} {
  const jobs: Array<{
    name: string;
    lastRun: Date | null;
    nextRun: string;
  }> = [];

  const schedules: Record<string, string> = {
    heartbeat: '*/30 * * * *',
    outcomeCheck: '0 */4 * * *',
    forumEngagement: '0 */2 * * *',
    marketScan: '0 * * * *',
    learning: '0 */6 * * *',
  };

  for (const [name, schedule] of Object.entries(schedules)) {
    jobs.push({
      name,
      lastRun: state.lastRuns.get(name) || null,
      nextRun: schedule,
    });
  }

  return {
    running: state.started,
    jobs,
  };
}

/**
 * Manually trigger a specific task
 */
export async function triggerTask(
  taskName: 'heartbeat' | 'outcomeCheck' | 'forumEngagement' | 'marketScan' | 'learning'
): Promise<void> {
  switch (taskName) {
    case 'heartbeat':
      await runHeartbeatTask();
      break;
    case 'outcomeCheck':
      await runOutcomeCheckTask();
      break;
    case 'forumEngagement':
      await runForumEngagementTask();
      break;
    case 'marketScan':
      await runMarketScanTask();
      break;
    case 'learning':
      await runLearningTask();
      break;
    default:
      throw new Error(`Unknown task: ${taskName}`);
  }
}

export default {
  start,
  stop,
  getStatus,
  triggerTask,
  setEngine,
};
