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

const PENDING_CACHE_MS = 45_000;
const PENDING_NEGATIVE_CACHE_MS = 1_500;
/** Poll mientras no hay petición abierta (modo idle). */
export const PENDING_IDLE_POLL_MS = 3_000;

let cache: { at: number; data: PendingWeighState } | null = null;

function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

function cacheTtl(data: PendingWeighState): number {
  return data.pending && data.ready ? PENDING_CACHE_MS : PENDING_NEGATIVE_CACHE_MS;
}

function emptyState(): PendingWeighState {
  return { pending: false, ready: false, targetScaleMac: null, profile: null };
}

export function getTargetScaleMac(): string | null {
  return cache?.data.targetScaleMac ?? null;
}

export function isWeighPendingReady(): boolean {
  return Boolean(cache?.data.pending && cache?.data.ready);
}

export async function fetchPendingWeigh(force = false): Promise<PendingWeighState> {
  const now = Date.now();
  if (!force && cache && now - cache.at < cacheTtl(cache.data)) {
    return cache.data;
  }

  const secret = (process.env.SCALE_INGEST_SECRET || '').trim().replace(/\r/g, '');
  const companyId = (process.env.SUITE_COMPANY_ID || '').trim().replace(/\r/g, '');
  if (!secret || !companyId) {
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
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      bleLog.info(`Suite pending: HTTP ${res.status}`);
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
    bleLog.info(
      `Suite pending fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
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
    await abortableSleep(PENDING_IDLE_POLL_MS, signal).catch(() => {});
  }
}

/** Prefetch ligero para calentar caché (handshake + idle gate). */
export function startPendingPrefetch(intervalMs = 4_000): void {
  setInterval(() => {
    void fetchPendingWeigh();
  }, intervalMs).unref?.();
}
