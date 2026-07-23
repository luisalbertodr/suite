import type { RawReading } from '../ble/shared.js';
import { abortableSleep } from '../ble/types.js';
import { bleFailureKind } from '../ble/failure-kind.js';
import { createLogger } from '../logger.js';
import { errMsg } from '../utils/error.js';

const log = createLogger('Sync');

/** MorphoScan only advertises while in use — keep scanning nearly always on idle. */
const IDLE_RETRY_MS = 500;
/** Short backoff after GATT/disconnect storms (avoids BlueZ "In Progress"). */
const CONN_BACKOFF_INITIAL_MS = 2_000;
const CONN_BACKOFF_MAX_MS = 5_000;

export interface ReadingSource {
  start?(): Promise<void>;
  stop?(): Promise<void>;
  nextReading(signal: AbortSignal): Promise<RawReading>;
}

export interface RuntimeLoopDeps {
  source: ReadingSource;
  processReading: (raw: RawReading) => Promise<boolean>;
  signal: AbortSignal;
  touchHeartbeat: () => void;
  isReloadRequested: () => boolean;
  clearReloadRequest: () => void;
  onReload?: () => Promise<void>;
  onSourceReload?: () => void;
  onSuccess?: () => Promise<void> | void;
  onFailure?: (err: unknown) => void;
  failureLogPrefix?: string;
}

function isIdleFailure(err: unknown): boolean {
  if (bleFailureKind(err) === 'idle') return true;
  const msg = errMsg(err).toLowerCase();
  return (
    msg.includes('timed out') ||
    msg.includes('device not found') ||
    msg.includes('no device') ||
    msg.includes('not found') ||
    // BlueZ stack busy after a previous connect — treat as soft failure, not crash.
    msg.includes('in progress') ||
    msg.includes('le-connection-abort') ||
    msg.includes('max_match_rules') ||
    msg.includes('limitsexceeded') ||
    msg.includes('add more match rules')
  );
}

/**
 * Continuous loop with MorphoScan-friendly retry:
 *  - Idle (scale not advertising / scan timeout): retry in ~0.5s (BLE stays hot).
 *  - Connection errors: short exponential backoff 2s → 5s (protect BlueZ).
 *
 * Upstream default was 5→10→20→40→60s on every error, which missed MorphoScan
 * advertisements during the sleep window.
 */
export async function runContinuousLoop(deps: RuntimeLoopDeps): Promise<void> {
  const {
    source,
    processReading,
    signal,
    touchHeartbeat,
    isReloadRequested,
    clearReloadRequest,
    onReload,
    onSourceReload,
    onSuccess,
    onFailure,
    failureLogPrefix = 'Error processing reading',
  } = deps;

  let connBackoffMs = 0;

  try {
    while (!signal.aborted) {
      try {
        touchHeartbeat();

        // Start hook is idempotent in every concrete source: ReadingWatcher
        // (mqtt-proxy, esphome-proxy) early-returns when `this.started === true`,
        // and PollReadingSource has no `start` at all. Calling on every iteration
        // costs one branch and lets the loop handle late-init sources uniformly.
        await source.start?.();

        if (isReloadRequested()) {
          await onReload?.();
          clearReloadRequest();
          onSourceReload?.();
        }

        const raw = await source.nextReading(signal);
        await processReading(raw);

        connBackoffMs = 0;

        if (signal.aborted) break;
        await onSuccess?.();
      } catch (err) {
        if (signal.aborted) break;
        onFailure?.(err);

        if (isIdleFailure(err)) {
          connBackoffMs = 0;
          // Quiet: idle timeouts are the normal "nobody on the scale" state.
          log.debug(`${failureLogPrefix} (idle), rescanning in ${IDLE_RETRY_MS}ms... (${errMsg(err)})`);
          await abortableSleep(IDLE_RETRY_MS, signal).catch(() => {});
          continue;
        }

        connBackoffMs =
          connBackoffMs === 0
            ? CONN_BACKOFF_INITIAL_MS
            : Math.min(connBackoffMs * 2, CONN_BACKOFF_MAX_MS);
        log.info(`${failureLogPrefix}, retrying in ${connBackoffMs / 1000}s... (${errMsg(err)})`);
        await abortableSleep(connBackoffMs, signal).catch(() => {});
      }
    }
  } finally {
    await source.stop?.();
  }
}
