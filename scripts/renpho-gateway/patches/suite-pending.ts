/**
 * Estado compartido de «Pesar ahora» desde scale-ingest ?pending=1.
 * Usado por loop (idle/active), autoDiscover (MAC fija) y renpho-msc04 (handshake).
 */
import { bleLog, abortableSleep } from './ble/types.js';

export type PendingScaleProfile = {
  height: number;
  age: number;
  gender: 'male' | 'female';
  name: string;
};

export type PendingWeighState = {
  pending: boolean;
  ready: boolean;
  targetScaleMac: string | null;
  profile: PendingScaleProfile | null;
};

/** Caché corta cuando hay pending: evita pending fantasma tras cancel/expire. */
const PENDING_CACHE_MS = 8_000;
const PENDING_NEGATIVE_CACHE_MS = 1_500;
/** Poll mientras no hay petición abierta (modo idle). */
export const PENDING_IDLE_POLL_MS = 3_000;
/** Tras fallos de edge, no martillar cada 3 s. */
const PENDING_FAIL_POLL_MS = 6_000;
/** Timeout HTTP más generoso: edge frío / reinicio no debe parecer «sin Pesar». */
const PENDING_FETCH_TIMEOUT_MS = 12_000;
/** Tras N fallos seguidos, log warn (visible en journal). */
const FAIL_WARN_THRESHOLD = 3;

let cache: { at: number; data: PendingWeighState } | null = null;
let consecutiveFailures = 0;
let lastFailLogAt = 0;

function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

function cacheTtl(data: PendingWeighState): number {
  return data.pending && data.ready ? PENDING_CACHE_MS : PENDING_NEGATIVE_CACHE_MS;
}

function emptyState(): PendingWeighState {
  return { pending: false, ready: false, targetScaleMac: null, profile: null };
}

function noteFailure(reason: string): void {
  consecutiveFailures += 1;
  const now = Date.now();
  const isDown =
    consecutiveFailures >= FAIL_WARN_THRESHOLD && now - lastFailLogAt > 30_000;
  if (isDown) lastFailLogAt = now;
  bleLog.info(
    isDown
      ? `Suite pending DOWN (#${consecutiveFailures}): ${reason} — edge/bridge unreachable; weigh requests will not fulfill`
      : `Suite pending fetch failed (#${consecutiveFailures}): ${reason}`,
  );
}

function noteSuccess(): void {
  if (consecutiveFailures >= FAIL_WARN_THRESHOLD) {
    bleLog.info(`Suite pending recovered after ${consecutiveFailures} failure(s)`);
  }
  consecutiveFailures = 0;
}

export function getTargetScaleMac(): string | null {
  return cache?.data.targetScaleMac ?? null;
}

export function isWeighPendingReady(): boolean {
  return Boolean(cache?.data.pending && cache?.data.ready);
}

export function getPendingConsecutiveFailures(): number {
  return consecutiveFailures;
}

export async function fetchPendingWeigh(force = false): Promise<PendingWeighState> {
  const now = Date.now();
  if (!force && cache && now - cache.at < cacheTtl(cache.data)) {
    return cache.data;
  }

  const secret = (process.env.SCALE_INGEST_SECRET || '').trim().replace(/\r/g, '');
  const companyId = (process.env.SUITE_COMPANY_ID || '').trim().replace(/\r/g, '');
  if (!secret || !companyId) {
    noteFailure('SCALE_INGEST_SECRET or SUITE_COMPANY_ID missing');
    const data = emptyState();
    cache = { at: now, data };
    return data;
  }

  const base =
    (process.env.SCALE_INGEST_URL || 'https://supabase.lipoout.com/functions/v1/scale-ingest')
      .trim()
      .replace(/\r/g, '')
      .replace(/\/$/, '');
  const url = `${base}?pending=1`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Scale-Ingest-Secret': secret,
        'X-Suite-Company-Id': companyId,
      },
      signal: AbortSignal.timeout(PENDING_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      noteFailure(`HTTP ${res.status}`);
      // 5xx: no reutilizar pending en caché (perfil fantasma). 4xx: conservar último estado conocido.
      if (res.status >= 500) return emptyState();
      return cache?.data ?? emptyState();
    }

    const body = (await res.json()) as {
      pending?: boolean;
      ready?: boolean;
      height_cm?: number;
      age_years?: number;
      gender?: string;
      name?: string;
      target_scale_mac?: string;
    };

    noteSuccess();

    if (!body.pending || !body.ready) {
      const data = emptyState();
      cache = { at: Date.now(), data };
      return data;
    }

    const height = Number(body.height_cm);
    const age = Number(body.age_years);
    const gender = body.gender === 'female' ? 'female' : body.gender === 'male' ? 'male' : null;
    const targetRaw = asString(body.target_scale_mac);
    const targetScaleMac = targetRaw ? normalizeMac(targetRaw) : null;

    if (!(height > 0) || !(age > 0) || !gender) {
      const data: PendingWeighState = {
        pending: true,
        ready: false,
        targetScaleMac,
        profile: null,
      };
      cache = { at: Date.now(), data };
      bleLog.info(
        `Suite pending: incomplete profile (h=${body.height_cm} age=${body.age_years} gender=${body.gender})`,
      );
      return data;
    }

    const profile: PendingScaleProfile = {
      height,
      age,
      gender,
      name: (body.name || 'Suite').slice(0, 8),
    };

    const data: PendingWeighState = {
      pending: true,
      ready: true,
      targetScaleMac,
      profile,
    };
    cache = { at: Date.now(), data };

    const macLabel = targetScaleMac
      ? targetScaleMac.match(/.{1,2}/g)?.join(':') ?? targetScaleMac
      : 'any';
    bleLog.info(
      `Suite pending: ${profile.gender}/${profile.age}y/${profile.height}cm (${profile.name}) → scale ${macLabel}`,
    );
    return data;
  } catch (e) {
    noteFailure(e instanceof Error ? e.message : String(e));
    return cache?.data ?? emptyState();
  }
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Espera hasta que haya una petición «Pesar» abierta y lista (modo idle). */
export async function waitUntilWeighPending(signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    const state = await fetchPendingWeigh(true);
    if (state.pending && state.ready) return;
    bleLog.debug('Idle: no open weigh request — skipping BLE scan');
    const delay =
      consecutiveFailures >= FAIL_WARN_THRESHOLD ? PENDING_FAIL_POLL_MS : PENDING_IDLE_POLL_MS;
    await abortableSleep(delay, signal).catch(() => {});
  }
}

/** Prefetch ligero para calentar caché (handshake + idle gate). */
export function startPendingPrefetch(intervalMs = 4_000): void {
  setInterval(() => {
    void fetchPendingWeigh();
  }, intervalMs).unref?.();
}
