/**
 * Database Module - JSON File Storage (Railway-compatible, no native modules)
 * 
 * Stores data in JSON files instead of SQLite for maximum portability.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// ============ JSON Storage Helper ============

function loadJson<T>(filename: string, defaultValue: T): T {
  const filepath = join(dataDir, filename);
  try {
    if (existsSync(filepath)) {
      return JSON.parse(readFileSync(filepath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`Failed to load ${filename}:`, e);
  }
  return defaultValue;
}

function saveJson(filename: string, data: any): void {
  const filepath = join(dataDir, filename);
  try {
    writeFileSync(filepath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn(`Failed to save ${filename}:`, e);
  }
}

// ============ Data Stores ============

interface Call {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  action: string;
  entryPrice: number;
  targetPrices: number[];
  stopLoss: number;
  confidence: number;
  timeframe: string;
  reasoning?: string;
  indicators?: Record<string, number>;
  outcome: string;
  exitPrice?: number;
  exitTime?: string;
  pnlPercent?: number;
  createdAt: string;
}

interface LearningWeight {
  id: string;
  category: string;
  baseWeight: number;
  adjustedWeight: number;
  winCount: number;
  lossCount: number;
  totalPnl: number;
  lastUpdated: string;
}

// In-memory stores (loaded from JSON on startup)
let calls: Call[] = loadJson('calls.json', []);
let forumPosts: any[] = loadJson('forum_posts.json', []);
let config: Record<string, string> = loadJson('config.json', {});
let learningWeights: LearningWeight[] = loadJson('learning_weights.json', []);
let projectVotes: number[] = loadJson('project_votes.json', []);

// ============ CALLS ============

export function saveCall(call: Omit<Call, 'outcome' | 'createdAt'>): void {
  const newCall: Call = {
    ...call,
    outcome: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  
  // Update or insert
  const idx = calls.findIndex(c => c.id === call.id);
  if (idx >= 0) {
    calls[idx] = { ...calls[idx], ...newCall };
  } else {
    calls.push(newCall);
  }
  
  saveJson('calls.json', calls);
}

export function updateCallOutcome(
  callId: string,
  outcome: 'WIN' | 'LOSS' | 'NEUTRAL',
  exitPrice: number,
  pnlPercent: number
): void {
  const call = calls.find(c => c.id === callId);
  if (call) {
    call.outcome = outcome;
    call.exitPrice = exitPrice;
    call.exitTime = new Date().toISOString();
    call.pnlPercent = pnlPercent;
    saveJson('calls.json', calls);
  }
}

export function getPendingCalls(): Call[] {
  return calls.filter(c => c.outcome === 'PENDING');
}

export function getCallsForOutcomeCheck(hours: 24 | 48 | 168): Call[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return calls.filter(c => 
    c.outcome === 'PENDING' && 
    c.createdAt <= cutoff
  ).slice(0, 50);
}

export function markCallChecked(callId: string, hours: 24 | 48 | 168): void {
  // For JSON storage, we just rely on outcome tracking
}

export function getCallsByToken(tokenSymbol: string, limit: number = 100): Call[] {
  return calls
    .filter(c => c.tokenSymbol === tokenSymbol)
    .slice(0, limit);
}

export function getCallsByOutcome(outcome: string, limit: number = 100): Call[] {
  return calls
    .filter(c => c.outcome === outcome)
    .slice(0, limit);
}

export function getCallStats(): {
  total: number;
  wins: number;
  losses: number;
  neutral: number;
  pending: number;
  winRate: number;
  avgPnl: number;
} {
  const wins = calls.filter(c => c.outcome === 'WIN').length;
  const losses = calls.filter(c => c.outcome === 'LOSS').length;
  const neutral = calls.filter(c => c.outcome === 'NEUTRAL').length;
  const pending = calls.filter(c => c.outcome === 'PENDING').length;
  
  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;
  
  const pnls = calls.filter(c => c.pnlPercent !== undefined).map(c => c.pnlPercent!);
  const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;

  return {
    total: calls.length,
    wins,
    losses,
    neutral,
    pending,
    winRate,
    avgPnl,
  };
}

export function getRecentCalls(limit: number = 20): Call[] {
  return [...calls]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

// ============ FORUM POSTS ============

export function saveForumPost(post: { id: number; type: string; title?: string; body?: string }): void {
  forumPosts.push({
    ...post,
    createdAt: new Date().toISOString(),
  });
  saveJson('forum_posts.json', forumPosts);
}

export function getForumPosts(): any[] {
  return forumPosts;
}

// ============ CONFIG ============

export function getConfig(key: string): string | null {
  return config[key] || null;
}

export function setConfig(key: string, value: string): void {
  config[key] = value;
  saveJson('config.json', config);
}

// ============ LEARNING WEIGHTS ============

export function getWeight(id: string): LearningWeight | null {
  return learningWeights.find(w => w.id === id) || null;
}

export function updateWeight(
  id: string,
  category: string,
  outcome: 'WIN' | 'LOSS',
  pnl: number
): void {
  let weight = learningWeights.find(w => w.id === id);
  
  if (!weight) {
    weight = {
      id,
      category,
      baseWeight: 1.0,
      adjustedWeight: 1.0,
      winCount: 0,
      lossCount: 0,
      totalPnl: 0,
      lastUpdated: new Date().toISOString(),
    };
    learningWeights.push(weight);
  }

  if (outcome === 'WIN') {
    weight.winCount++;
    weight.adjustedWeight = Math.min(2.0, weight.adjustedWeight * 1.05);
  } else {
    weight.lossCount++;
    weight.adjustedWeight = Math.max(0.5, weight.adjustedWeight * 0.95);
  }
  
  weight.totalPnl += pnl;
  weight.lastUpdated = new Date().toISOString();
  
  saveJson('learning_weights.json', learningWeights);
}

export function getAllWeights(): LearningWeight[] {
  return learningWeights;
}

// ============ PROJECT VOTES ============

export function hasVotedForProject(projectId: number): boolean {
  return projectVotes.includes(projectId);
}

export function recordProjectVote(projectId: number): void {
  if (!projectVotes.includes(projectId)) {
    projectVotes.push(projectId);
    saveJson('project_votes.json', projectVotes);
  }
}

// ============ EXPORT DB INTERFACE ============

export const db = {
  saveCall,
  updateCallOutcome,
  getPendingCalls,
  getCallsForOutcomeCheck,
  markCallChecked,
  getCallsByToken,
  getCallsByOutcome,
  getCallStats,
  getRecentCalls,
  saveForumPost,
  getForumPosts,
  getConfig,
  setConfig,
  getWeight,
  updateWeight,
  getAllWeights,
  hasVotedForProject,
  recordProjectVote,
};

export default db;
