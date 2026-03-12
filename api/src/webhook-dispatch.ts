/**
 * Webhook Dispatch Module
 *
 * Persists subscriber URLs to disk and dispatches signals
 * to all registered webhooks when new signals are generated.
 * Fire-and-forget delivery with no retry logic (v1).
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { TradingSignal } from '../../research-engine/src/signals/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUBSCRIBERS_FILE = join(__dirname, '..', '..', 'data', 'webhook-subscribers.json');

// -- Types --

export interface WebhookSubscriber {
  url: string;
  events: string[];
  createdAt: string;
}

interface WebhookPayload {
  type: string;
  data: TradingSignal;
  timestamp: string;
}

// -- Persistence --

function ensureDataDirectory(): void {
  const dataDir = dirname(SUBSCRIBERS_FILE);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function loadSubscribers(): WebhookSubscriber[] {
  try {
    if (existsSync(SUBSCRIBERS_FILE)) {
      return JSON.parse(readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.warn('[Webhook] Failed to load subscribers:', error);
  }
  return [];
}

function persistSubscribers(subscribers: WebhookSubscriber[]): void {
  ensureDataDirectory();
  try {
    writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
  } catch (error) {
    console.warn('[Webhook] Failed to persist subscribers:', error);
  }
}

// -- Subscriber Management --

export function saveSubscriber(url: string, events: string[] = ['signal']): WebhookSubscriber {
  const subscribers = loadSubscribers();

  const existing = subscribers.find((sub) => sub.url === url);
  if (existing) {
    existing.events = events;
    persistSubscribers(subscribers);
    console.log(`[Webhook] Updated subscriber: ${url}`);
    return existing;
  }

  const subscriber: WebhookSubscriber = {
    url,
    events,
    createdAt: new Date().toISOString(),
  };
  subscribers.push(subscriber);
  persistSubscribers(subscribers);
  console.log(`[Webhook] Added subscriber: ${url}`);
  return subscriber;
}

export function removeSubscriber(url: string): boolean {
  const subscribers = loadSubscribers();
  const initialLength = subscribers.length;
  const filtered = subscribers.filter((sub) => sub.url !== url);

  if (filtered.length === initialLength) {
    return false;
  }

  persistSubscribers(filtered);
  console.log(`[Webhook] Removed subscriber: ${url}`);
  return true;
}

// -- Dispatch --

/**
 * POST each signal to all subscribers listening for 'signal' events.
 * Async, non-blocking: errors are logged but never thrown.
 */
export async function dispatchSignals(signals: TradingSignal[]): Promise<void> {
  const subscribers = loadSubscribers();
  const signalSubscribers = subscribers.filter((sub) => sub.events.includes('signal'));

  if (signalSubscribers.length === 0 || signals.length === 0) {
    return;
  }

  console.log(
    `[Webhook] Dispatching ${signals.length} signal(s) to ${signalSubscribers.length} subscriber(s)`,
  );

  for (const signal of signals) {
    const payload: WebhookPayload = {
      type: 'signal',
      data: signal,
      timestamp: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);

    for (const subscriber of signalSubscribers) {
      // Fire-and-forget per subscriber
      fetch(subscriber.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
        .then((response) => {
          console.log(
            `[Webhook] ${subscriber.url} => ${response.status} (${signal.token.symbol})`,
          );
        })
        .catch((error) => {
          console.warn(
            `[Webhook] ${subscriber.url} failed (${signal.token.symbol}):`,
            error.message,
          );
        });
    }
  }
}
