/**
 * Persistent Trade Store — JSON file-backed Map
 *
 * Wraps an in-memory Map with write-through persistence to JSON files.
 * On import, hydrates from disk so trades survive process restarts.
 * Follows the same loadJson/saveJson pattern used in db/index.ts.
 */

import { join } from 'path';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'fs';
import { logger } from '@elizaos/core';

// Resolve data directory relative to working directory (safe for bundled builds + Docker)
const DATA_DIR = join(process.cwd(), 'data', 'trade-store');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Store key constants
// ---------------------------------------------------------------------------

export const KEY_SEEN_SIGNAL_IDS = 'seen-signal-ids';
export const KEY_PENDING_SIGNALS = 'pending-signals';
export const KEY_OPEN_TRADES = 'open-trades';
export const KEY_TRADE_JOURNAL = 'trade-journal';
export const KEY_STRATEGY_CONFIG = 'strategy-config';
export const KEY_COOL_OFF_UNTIL = 'cool-off-until';
export const KEY_PENDING_REVIEW = 'pending-review'; // ephemeral — not persisted

// ---------------------------------------------------------------------------
// Keys that get written to disk (everything except ephemeral flags)
// ---------------------------------------------------------------------------

const PERSISTENT_KEYS: Record<string, string> = {
  [KEY_SEEN_SIGNAL_IDS]: 'seen-signal-ids.json',
  [KEY_PENDING_SIGNALS]: 'pending-signals.json',
  [KEY_OPEN_TRADES]: 'open-trades.json',
  [KEY_TRADE_JOURNAL]: 'trade-journal.json',
  [KEY_STRATEGY_CONFIG]: 'strategy-config.json',
  [KEY_COOL_OFF_UNTIL]: 'cool-off-until.json',
};

// ---------------------------------------------------------------------------
// JSON helpers (atomic write via rename)
// ---------------------------------------------------------------------------

function loadJson<T>(filename: string, defaultValue: T): T {
  const filepath = join(DATA_DIR, filename);
  try {
    if (existsSync(filepath)) {
      return JSON.parse(readFileSync(filepath, 'utf-8'));
    }
  } catch (error) {
    logger.warn({ filename, error }, 'TradeStore: failed to load JSON');
  }
  return defaultValue;
}

function saveJson(filename: string, data: unknown): void {
  const filepath = join(DATA_DIR, filename);
  const tempPath = filepath + '.tmp';
  try {
    writeFileSync(tempPath, JSON.stringify(data, null, 2));
    renameSync(tempPath, filepath);
  } catch (error) {
    logger.warn({ filename, error }, 'TradeStore: failed to save JSON');
  }
}

// ---------------------------------------------------------------------------
// In-memory Map (single source of truth during runtime)
// ---------------------------------------------------------------------------

const store = new Map<string, unknown>();

/**
 * Hydrate the in-memory Map from persisted JSON files.
 * Called once at module load time.
 */
function hydrate(): void {
  for (const [key, filename] of Object.entries(PERSISTENT_KEYS)) {
    const data = loadJson(filename, null);
    if (data !== null) {
      store.set(key, data);
    }
  }
  logger.info(
    { keysLoaded: store.size, dataDir: DATA_DIR },
    'TradeStore: hydrated from disk',
  );
}

hydrate();

// ---------------------------------------------------------------------------
// Public API — drop-in replacement for the old inline store
// ---------------------------------------------------------------------------

export function storeGet<T>(key: string): T | null {
  const value = store.get(key);
  if (value === undefined) return null;
  return value as T;
}

export function storeSet<T>(key: string, value: T): void {
  store.set(key, value);

  const filename = PERSISTENT_KEYS[key];
  if (filename) {
    saveJson(filename, value);
  }
}
