/**
 * Volume Watcher Service
 *
 * Polls the Trading Caller volume scanner for HIGH/EXTREME spikes every
 * 2 minutes. When a new spike is detected, requests a full token analysis
 * and — if a tradeable signal is returned — queues it into the same
 * pending-signals pipeline consumed by the executeTrade action.
 */

import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import type { TradingSignal } from './types.ts';
import {
  storeGet,
  storeSet,
  KEY_PENDING_SIGNALS,
  KEY_SEEN_SIGNAL_IDS,
} from './trade-store.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOLUME_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const SEEN_SIGNALS_MAX = 500;

/** Only react to these severity levels — ignore LOW and MEDIUM noise */
const ACTIONABLE_SEVERITIES = new Set(['HIGH', 'EXTREME']);

const DEFAULT_API_URL =
  process.env.TRADING_CALLER_API_URL ||
  'https://trading-caller-production-d7d3.up.railway.app';

// ---------------------------------------------------------------------------
// API response shapes (mirrors volume-scanner route output)
// ---------------------------------------------------------------------------

interface VolumeSpikeResponse {
  success: boolean;
  count: number;
  spikes: VolumeSpike[];
}

interface VolumeSpike {
  id: string;
  token: {
    symbol: string;
    name: string;
    address: string;
  };
  volumeSpikeMultiple: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  priceChange1h: number;
  detectedAt: string;
}

interface TokenAnalysisResponse {
  success: boolean;
  signal?: TradingSignal | null;
}

// ---------------------------------------------------------------------------
// VolumeWatcherService
// ---------------------------------------------------------------------------

export class VolumeWatcherService extends Service {
  static serviceType = 'volume-watcher';
  capabilityDescription =
    'Watches for HIGH/EXTREME volume spikes every 2 minutes and triggers signal analysis for qualifying tokens.';

  private apiUrl: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Local set of spike IDs already processed this session */
  private seenSpikeIds = new Set<string>();

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    const setting = runtime.getSetting('TRADING_CALLER_API_URL');
    this.apiUrl =
      typeof setting === 'string' && setting.length > 0
        ? setting
        : DEFAULT_API_URL;
  }

  // ---- lifecycle ----------------------------------------------------------

  static async start(
    runtime: IAgentRuntime,
  ): Promise<VolumeWatcherService> {
    logger.info('Starting VolumeWatcherService');
    const service = new VolumeWatcherService(runtime);
    service.beginPolling();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping VolumeWatcherService (static)');
    const service = runtime.getService<VolumeWatcherService>(
      VolumeWatcherService.serviceType,
    );
    if (service) {
      await service.stop();
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('VolumeWatcherService stopped');
  }

  // ---- polling loop -------------------------------------------------------

  private beginPolling(): void {
    logger.info(
      { url: `${this.apiUrl}/volume/spikes`, intervalMs: VOLUME_CHECK_INTERVAL_MS },
      'VolumeWatcherService: polling started',
    );
    void this.pollSpikes();
    this.intervalId = setInterval(
      () => void this.pollSpikes(),
      VOLUME_CHECK_INTERVAL_MS,
    );
  }

  private async pollSpikes(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/volume/spikes`);
      if (!response.ok) {
        logger.warn(
          { status: response.status },
          'VolumeWatcher: spikes endpoint returned non-OK status',
        );
        return;
      }

      const data: VolumeSpikeResponse = await response.json();
      if (!data.success || !data.spikes?.length) return;

      // Keep only HIGH and EXTREME spikes that we haven't seen yet
      const newSpikes = data.spikes.filter(
        (sp) =>
          ACTIONABLE_SEVERITIES.has(sp.severity) &&
          !this.seenSpikeIds.has(sp.id),
      );

      if (newSpikes.length === 0) return;

      logger.info(
        { count: newSpikes.length },
        'VolumeWatcher: new actionable spikes detected',
      );

      for (const spike of newSpikes) {
        this.seenSpikeIds.add(spike.id);

        logger.info(
          `VolumeWatcher: ${spike.severity} spike on ${spike.token.symbol}, ${spike.volumeSpikeMultiple.toFixed(1)}x volume`,
        );

        await this.analyzeAndQueue(spike);
      }
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        'VolumeWatcher: poll error',
      );
    }
  }

  // ---- analysis + queue ---------------------------------------------------

  private async analyzeAndQueue(spike: VolumeSpike): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiUrl}/tokens/${encodeURIComponent(spike.token.symbol)}/analysis`,
      );

      if (!response.ok) {
        logger.warn(
          { symbol: spike.token.symbol, status: response.status },
          'VolumeWatcher: analysis request failed',
        );
        return;
      }

      const data: TokenAnalysisResponse = await response.json();
      if (!data.success || !data.signal) return;

      const signal = data.signal;

      // Deduplicate against the shared seen-signal-ids store
      const seenIds = new Set<string>(
        storeGet<string[]>(KEY_SEEN_SIGNAL_IDS) ?? [],
      );
      if (seenIds.has(signal.id)) return;

      seenIds.add(signal.id);
      const seenArray = [...seenIds].slice(-SEEN_SIGNALS_MAX);
      storeSet(KEY_SEEN_SIGNAL_IDS, seenArray);

      // Append to pending signals queue
      const pending: TradingSignal[] =
        storeGet<TradingSignal[]>(KEY_PENDING_SIGNALS) ?? [];
      pending.push(signal);
      storeSet(KEY_PENDING_SIGNALS, pending);

      logger.info(
        {
          signalId: signal.id,
          token: signal.token.symbol,
          action: signal.action,
          confidence: signal.confidence,
          spikeMultiple: spike.volumeSpikeMultiple,
        },
        'VolumeWatcher: signal queued from volume spike',
      );
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err), symbol: spike.token.symbol },
        'VolumeWatcher: analysis/queue error',
      );
    }
  }
}
