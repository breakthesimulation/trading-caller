/**
 * Database Module - SQLite Storage
 * 
 * Tables:
 * - calls: All trading signals with outcomes
 * - forum_posts: Our forum posts and their IDs
 * - config: Agent settings, API keys (encrypted)
 * - learning_weights: Adjusted confidence multipliers
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'trading-caller.db');
const database = new Database(dbPath);

// Enable WAL mode for better performance
database.pragma('journal_mode = WAL');

// Initialize tables
database.exec(`
  -- Trading signals/calls with outcomes
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    token_symbol TEXT NOT NULL,
    token_address TEXT NOT NULL,
    action TEXT NOT NULL,
    entry_price REAL NOT NULL,
    target_prices TEXT NOT NULL,  -- JSON array
    stop_loss REAL NOT NULL,
    confidence INTEGER NOT NULL,
    timeframe TEXT NOT NULL,
    reasoning TEXT,
    indicators TEXT,  -- JSON object
    
    -- Outcome tracking
    outcome TEXT DEFAULT 'PENDING',  -- PENDING, WIN, LOSS, NEUTRAL
    exit_price REAL,
    exit_time TEXT,
    pnl_percent REAL,
    
    -- Metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    checked_24h INTEGER DEFAULT 0,
    checked_48h INTEGER DEFAULT 0,
    checked_7d INTEGER DEFAULT 0
  );

  -- Forum posts we've created
  CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,  -- 'post' or 'comment'
    title TEXT,
    body TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    comment_count INTEGER DEFAULT 0
  );

  -- Config storage
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Learning weights for indicators/patterns
  CREATE TABLE IF NOT EXISTS learning_weights (
    id TEXT PRIMARY KEY,  -- e.g., 'RSI_oversold', 'MACD_bullish'
    category TEXT NOT NULL,  -- e.g., 'indicator', 'pattern', 'token'
    base_weight REAL DEFAULT 1.0,
    adjusted_weight REAL DEFAULT 1.0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Project votes tracking
  CREATE TABLE IF NOT EXISTS project_votes (
    project_id INTEGER PRIMARY KEY,
    voted_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Post replies tracking
  CREATE TABLE IF NOT EXISTS post_replies (
    post_id INTEGER PRIMARY KEY,
    replied_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_calls_token ON calls(token_symbol);
  CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
  CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
  CREATE INDEX IF NOT EXISTS idx_learning_category ON learning_weights(category);
`);

// ============ CALLS ============

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

export function saveCall(call: Omit<Call, 'outcome' | 'createdAt'>): void {
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO calls (
      id, token_symbol, token_address, action, entry_price, target_prices,
      stop_loss, confidence, timeframe, reasoning, indicators
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    call.id,
    call.tokenSymbol,
    call.tokenAddress,
    call.action,
    call.entryPrice,
    JSON.stringify(call.targetPrices),
    call.stopLoss,
    call.confidence,
    call.timeframe,
    call.reasoning || null,
    call.indicators ? JSON.stringify(call.indicators) : null
  );
}

export function updateCallOutcome(
  callId: string,
  outcome: 'WIN' | 'LOSS' | 'NEUTRAL',
  exitPrice: number,
  pnlPercent: number
): void {
  const stmt = database.prepare(`
    UPDATE calls SET
      outcome = ?,
      exit_price = ?,
      exit_time = CURRENT_TIMESTAMP,
      pnl_percent = ?
    WHERE id = ?
  `);

  stmt.run(outcome, exitPrice, pnlPercent, callId);
}

export function getPendingCalls(): Call[] {
  const stmt = database.prepare(`
    SELECT * FROM calls WHERE outcome = 'PENDING' ORDER BY created_at DESC
  `);

  return stmt.all().map(row => rowToCall(row));
}

export function getCallsForOutcomeCheck(hours: 24 | 48 | 168): Call[] {
  const checkColumn = hours === 24 ? 'checked_24h' : hours === 48 ? 'checked_48h' : 'checked_7d';
  const minAge = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const stmt = database.prepare(`
    SELECT * FROM calls 
    WHERE outcome = 'PENDING' 
    AND ${checkColumn} = 0 
    AND created_at <= ?
    ORDER BY created_at ASC
    LIMIT 50
  `);

  return stmt.all(minAge).map(row => rowToCall(row));
}

export function markCallChecked(callId: string, hours: 24 | 48 | 168): void {
  const checkColumn = hours === 24 ? 'checked_24h' : hours === 48 ? 'checked_48h' : 'checked_7d';
  
  const stmt = database.prepare(`UPDATE calls SET ${checkColumn} = 1 WHERE id = ?`);
  stmt.run(callId);
}

export function getCallsByToken(tokenSymbol: string, limit: number = 100): Call[] {
  const stmt = database.prepare(`
    SELECT * FROM calls WHERE token_symbol = ? ORDER BY created_at DESC LIMIT ?
  `);

  return stmt.all(tokenSymbol, limit).map(row => rowToCall(row));
}

export function getCallsByOutcome(outcome: string, limit: number = 100): Call[] {
  const stmt = database.prepare(`
    SELECT * FROM calls WHERE outcome = ? ORDER BY created_at DESC LIMIT ?
  `);

  return stmt.all(outcome, limit).map(row => rowToCall(row));
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
  const stats = database.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN outcome = 'NEUTRAL' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN outcome = 'PENDING' THEN 1 ELSE 0 END) as pending,
      AVG(CASE WHEN outcome != 'PENDING' THEN pnl_percent END) as avg_pnl
    FROM calls
  `).get() as { total: number; wins: number; losses: number; neutral: number; pending: number; avg_pnl: number | null };

  const decided = stats.wins + stats.losses;
  const winRate = decided > 0 ? (stats.wins / decided) * 100 : 0;

  return {
    total: stats.total,
    wins: stats.wins,
    losses: stats.losses,
    neutral: stats.neutral,
    pending: stats.pending,
    winRate,
    avgPnl: stats.avg_pnl || 0,
  };
}

interface TokenStatsRow {
  token_symbol: string;
  total: number;
  wins: number;
  losses: number;
  avg_pnl: number | null;
}

export function getTokenStats(): Array<{
  token: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}> {
  const stmt = database.prepare(`
    SELECT 
      token_symbol,
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
      AVG(CASE WHEN outcome != 'PENDING' THEN pnl_percent END) as avg_pnl
    FROM calls
    GROUP BY token_symbol
    HAVING total >= 3
    ORDER BY total DESC
  `);

  return (stmt.all() as TokenStatsRow[]).map((row) => {
    const decided = row.wins + row.losses;
    return {
      token: row.token_symbol,
      total: row.total,
      wins: row.wins,
      losses: row.losses,
      winRate: decided > 0 ? (row.wins / decided) * 100 : 0,
      avgPnl: row.avg_pnl || 0,
    };
  });
}

interface CallRow {
  id: string;
  token_symbol: string;
  token_address: string;
  action: string;
  entry_price: number;
  target_prices: string;
  stop_loss: number;
  confidence: number;
  timeframe: string;
  reasoning: string | null;
  indicators: string | null;
  outcome: string;
  exit_price: number | null;
  exit_time: string | null;
  pnl_percent: number | null;
  created_at: string;
}

function rowToCall(row: CallRow): Call {
  return {
    id: row.id,
    tokenSymbol: row.token_symbol,
    tokenAddress: row.token_address,
    action: row.action,
    entryPrice: row.entry_price,
    targetPrices: JSON.parse(row.target_prices),
    stopLoss: row.stop_loss,
    confidence: row.confidence,
    timeframe: row.timeframe,
    reasoning: row.reasoning || undefined,
    indicators: row.indicators ? JSON.parse(row.indicators) : undefined,
    outcome: row.outcome,
    exitPrice: row.exit_price || undefined,
    exitTime: row.exit_time || undefined,
    pnlPercent: row.pnl_percent || undefined,
    createdAt: row.created_at,
  };
}

// ============ FORUM POSTS ============

export function trackForumPost(id: number, type: 'post' | 'comment', title: string, body: string): void {
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO forum_posts (id, type, title, body) VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, type, title, body);
}

export function isOurForumPost(postId: number): boolean {
  const stmt = database.prepare(`SELECT id FROM forum_posts WHERE id = ? AND type = 'post'`);
  return !!stmt.get(postId);
}

export function getForumPostCommentCount(postId: number): number {
  const stmt = database.prepare(`SELECT comment_count FROM forum_posts WHERE id = ?`);
  const row = stmt.get(postId) as { comment_count: number } | undefined;
  return row?.comment_count || 0;
}

export function updateForumPostCommentCount(postId: number, count: number): void {
  const stmt = database.prepare(`UPDATE forum_posts SET comment_count = ? WHERE id = ?`);
  stmt.run(count, postId);
}

// ============ CONFIG ============

export function getConfig(key: string): string | null {
  const stmt = database.prepare(`SELECT value FROM config WHERE key = ?`);
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value || null;
}

export function setConfig(key: string, value: string): void {
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(key, value);
}

// ============ LEARNING WEIGHTS ============

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

interface LearningWeightRow {
  id: string;
  category: string;
  base_weight: number;
  adjusted_weight: number;
  win_count: number;
  loss_count: number;
  total_pnl: number;
  last_updated: string;
}

export function getLearningWeight(id: string): LearningWeight | null {
  const stmt = database.prepare(`SELECT * FROM learning_weights WHERE id = ?`);
  const row = stmt.get(id) as LearningWeightRow | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id,
    category: row.category,
    baseWeight: row.base_weight,
    adjustedWeight: row.adjusted_weight,
    winCount: row.win_count,
    lossCount: row.loss_count,
    totalPnl: row.total_pnl,
    lastUpdated: row.last_updated,
  };
}

export function updateLearningWeight(
  id: string,
  category: string,
  isWin: boolean,
  pnl: number
): void {
  // Get existing or create new
  let weight = getLearningWeight(id);
  
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
  }

  // Update stats
  if (isWin) {
    weight.winCount++;
  } else {
    weight.lossCount++;
  }
  weight.totalPnl += pnl;

  // Calculate new adjusted weight
  const totalTrades = weight.winCount + weight.lossCount;
  if (totalTrades >= 5) {
    const winRate = weight.winCount / totalTrades;
    // Adjust weight based on win rate (0.5 = neutral)
    // Win rate > 0.5 increases weight, < 0.5 decreases it
    weight.adjustedWeight = weight.baseWeight * (0.5 + winRate);
  }

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO learning_weights (
      id, category, base_weight, adjusted_weight, win_count, loss_count, total_pnl, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    weight.id,
    weight.category,
    weight.baseWeight,
    weight.adjustedWeight,
    weight.winCount,
    weight.lossCount,
    weight.totalPnl
  );
}

export function getAllLearningWeights(): LearningWeight[] {
  const stmt = database.prepare(`SELECT * FROM learning_weights ORDER BY adjusted_weight DESC`);
  
  return (stmt.all() as LearningWeightRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    baseWeight: row.base_weight,
    adjustedWeight: row.adjusted_weight,
    winCount: row.win_count,
    lossCount: row.loss_count,
    totalPnl: row.total_pnl,
    lastUpdated: row.last_updated,
  }));
}

// ============ PROJECT VOTES ============

export function hasVotedOnProject(projectId: number): boolean {
  const stmt = database.prepare(`SELECT project_id FROM project_votes WHERE project_id = ?`);
  return !!stmt.get(projectId);
}

export function recordProjectVote(projectId: number): void {
  const stmt = database.prepare(`INSERT OR IGNORE INTO project_votes (project_id) VALUES (?)`);
  stmt.run(projectId);
}

// ============ POST REPLIES ============

export function hasRepliedToPost(postId: number): boolean {
  const stmt = database.prepare(`SELECT post_id FROM post_replies WHERE post_id = ?`);
  return !!stmt.get(postId);
}

export function recordPostReply(postId: number): void {
  const stmt = database.prepare(`INSERT OR IGNORE INTO post_replies (post_id) VALUES (?)`);
  stmt.run(postId);
}

// Export db object with all methods
export const db = {
  // Raw database for advanced queries
  raw: database,
  
  // Calls
  saveCall,
  updateCallOutcome,
  getPendingCalls,
  getCallsForOutcomeCheck,
  markCallChecked,
  getCallsByToken,
  getCallsByOutcome,
  getCallStats,
  getTokenStats,
  
  // Forum
  trackForumPost,
  isOurForumPost,
  getForumPostCommentCount,
  updateForumPostCommentCount,
  
  // Config
  getConfig,
  setConfig,
  
  // Learning
  getLearningWeight,
  updateLearningWeight,
  getAllLearningWeights,
  
  // Votes
  hasVotedOnProject,
  recordProjectVote,
  hasRepliedToPost,
  recordPostReply,
};

export default db;
