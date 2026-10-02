/**
 * Estado compartido de «Pesar ahora» desde scale-ingest ?pending=1.
 * Usado por loop (idle/active), autoDiscover (MAC fija) y renpho-msc04 (handshake).
 * También persiste expectKg por MAC para flush weight-only al TTL / fin de «Pesar».
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
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
  /** Epoch ms when the open weigh request expires (null if none). */
  expiresAtMs: number | null;
};

/** Per-MAC weight lock waiting for BIA (or weight-only flush). */
export type MacExpectState = {
  expectKg: number;
  expectAtMs: number;
  sessionsSinceExpect: number;
  weightOnlyFallback: boolean;
  profile: PendingScaleProfile | null;
};

type ExpectStoreFile = {
  byMac: Record<string, MacExpectState>;
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

/** Persiste expectKg entre reinicios del proceso (no perder BIA mid-weigh). */
export const EXPECT_STATE_PATH = '/tmp/ble-msc04-expect.json';
/** Expect más viejo que esto se descarta (persona / sesión abandonada). */
const EXPECT_MAX_AGE_MS = 15 * 60_000;
/**
 * Últimos N ms del TTL de «Pesar»: permitir export weight-only
 * (antes se prioriza BIA en reconexiones).
 */
export const WEIGHT_ONLY_NEAR_TTL_MS = 45_000;
/** Mínimo de reconexiones con expect antes de flush cerca del TTL. */
export const WEIGHT_ONLY_MIN_SESSIONS = 1;
/** Tope duro de reconexiones sin BIA → weight-only aunque quede TTL. */
export const WEIGHT_ONLY_HARD_SESSIONS = 4;

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
  return {
    pending: false,
    ready: false,
    targetScaleMac: null,
    profile: null,
    expiresAtMs: null,
  };
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
  const pendingMac = cache?.data.targetScaleMac ?? null;
  if (pendingMac) return pendingMac;
  return getFlushTargetMac();
}

export function getPendingExpiresAtMs(): number | null {
  return cache?.data.expiresAtMs ?? null;
}

export function isWeighPendingReady(): boolean {
  return Boolean(cache?.data.pending && cache?.data.ready);
}

export function getPendingConsecutiveFailures(): number {
  return consecutiveFailures;
}

export function msUntilPendingExpiry(): number | null {
  const exp = cache?.data.expiresAtMs;
  if (exp == null) return null;
  return exp - Date.now();
}

/** ¿Política two-phase permite exportar solo peso para este expect? */
export function allowWeightOnlyExport(
  expect: Pick<MacExpectState, 'sessionsSinceExpect'>,
  opts?: { pendingActive?: boolean; expiresAtMs?: number | null },
): boolean {
  const pendingActive = opts?.pendingActive ?? isWeighPendingReady();
  const expiresAtMs =
    opts?.expiresAtMs !== undefined ? opts.expiresAtMs : getPendingExpiresAtMs();
  const sessions = expect.sessionsSinceExpect ?? 0;

  if (!pendingActive) return true;
  if (sessions >= WEIGHT_ONLY_HARD_SESSIONS) return true;
  if (expiresAtMs != null) {
    const remaining = expiresAtMs - Date.now();
    if (remaining <= WEIGHT_ONLY_NEAR_TTL_MS && sessions >= WEIGHT_ONLY_MIN_SESSIONS) {
      return true;
    }
  }
  return false;
}

function pruneExpectStore(store: ExpectStoreFile): ExpectStoreFile {
  const now = Date.now();
  const byMac: Record<string, MacExpectState> = {};
  for (const [mac, st] of Object.entries(store.byMac || {})) {
    if (!st || !(st.expectKg > 0) || !(st.expectAtMs > 0)) continue;
    if (now - st.expectAtMs > EXPECT_MAX_AGE_MS) continue;
    byMac[normalizeMac(mac)] = st;
  }
  return { byMac };
}

function readExpectStore(): ExpectStoreFile {
  try {
    const raw = readFileSync(EXPECT_STATE_PATH, 'utf8');
    const data = JSON.parse(raw) as ExpectStoreFile & MacExpectState & { mac?: string };
    // Legacy flat file → migrate to byMac.
    if (!data.byMac && (data as MacExpectState).expectKg > 0) {
      const legacy = data as MacExpectState & { mac?: string };
      const mac = legacy.mac ? normalizeMac(legacy.mac) : '';
      if (!mac) return { byMac: {} };
      return pruneExpectStore({
        byMac: {
          [mac]: {
            expectKg: legacy.expectKg,
            expectAtMs: legacy.expectAtMs,
            sessionsSinceExpect: legacy.sessionsSinceExpect ?? 0,
            weightOnlyFallback: Boolean(legacy.weightOnlyFallback),
            profile: legacy.profile ?? null,
          },
        },
      });
    }
    return pruneExpectStore({ byMac: data.byMac || {} });
  } catch {
    return { byMac: {} };
  }
}

function writeExpectStore(store: ExpectStoreFile): void {
  try {
    const pruned = pruneExpectStore(store);
    if (Object.keys(pruned.byMac).length === 0) {
      try {
        unlinkSync(EXPECT_STATE_PATH);
      } catch {
        /* ignore */
      }
      return;
    }
    writeFileSync(EXPECT_STATE_PATH, JSON.stringify(pruned), 'utf8');
  } catch {
    /* best-effort */
  }
}

export function loadMacExpect(mac: string): MacExpectState | null {
  const key = normalizeMac(mac);
  if (!key) return null;
  return readExpectStore().byMac[key] ?? null;
}

export function saveMacExpect(mac: string, state: MacExpectState | null): void {
  const key = normalizeMac(mac);
  if (!key) return;
  const store = readExpectStore();
  if (!state || !(state.expectKg > 0)) {
    delete store.byMac[key];
  } else {
    store.byMac[key] = {
      expectKg: state.expectKg,
      expectAtMs: state.expectAtMs,
      sessionsSinceExpect: state.sessionsSinceExpect ?? 0,
      weightOnlyFallback: Boolean(state.weightOnlyFallback),
      profile: state.profile ?? null,
    };
  }
  writeExpectStore(store);
}

export function clearMacExpect(mac: string): void {
  saveMacExpect(mac, null);
}

/** MAC con peso stashed listo para flush weight-only (fin de Pesar o borde TTL). */
export function getFlushTargetMac(): string | null {
  const store = readExpectStore();
  const pendingActive = isWeighPendingReady();
  const expiresAtMs = getPendingExpiresAtMs();
  for (const [mac, st] of Object.entries(store.byMac)) {
    if (allowWeightOnlyExport(st, { pendingActive, expiresAtMs })) {
      return mac;
    }
  }
  return null;
}

export function hasWeightOnlyFlushPending(): boolean {
  return getFlushTargetMac() != null;
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
      expires_at?: string;
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
    const expiresAtMs = body.expires_at ? Date.parse(body.expires_at) : Number.NaN;
    const expiresOk = Number.isFinite(expiresAtMs) ? expiresAtMs : null;

    if (!(height > 0) || !(age > 0) || !gender) {
      const data: PendingWeighState = {
        pending: true,
        ready: false,
        targetScaleMac,
        profile: null,
        expiresAtMs: expiresOk,
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
      expiresAtMs: expiresOk,
    };
    cache = { at: Date.now(), data };

    const macLabel = targetScaleMac
      ? targetScaleMac.match(/.{1,2}/g)?.join(':') ?? targetScaleMac
      : 'any';
    const ttlLabel =
      expiresOk != null ? `; ttl ${Math.max(0, Math.round((expiresOk - Date.now()) / 1000))}s` : '';
    bleLog.info(
      `Suite pending: ${profile.gender}/${profile.age}y/${profile.height}cm (${profile.name}) → scale ${macLabel}${ttlLabel}`,
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

/** Espera hasta que haya «Pesar» abierto o un flush weight-only pendiente. */
export async function waitUntilWeighPending(signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    const state = await fetchPendingWeigh(true);
    if (state.pending && state.ready) return;
    if (hasWeightOnlyFlushPending()) {
      bleLog.info(
        `Idle: pending closed — flushing weight-only for ${formatMac(getFlushTargetMac()!)}`,
      );
      return;
    }
    bleLog.debug('Idle: no open weigh request — skipping BLE scan');
    const delay =
      consecutiveFailures >= FAIL_WARN_THRESHOLD ? PENDING_FAIL_POLL_MS : PENDING_IDLE_POLL_MS;
    await abortableSleep(delay, signal).catch(() => {});
  }
}

function formatMac(mac: string): string {
  return mac.match(/.{1,2}/g)?.join(':') ?? mac;
}

/** Prefetch ligero para calentar caché (handshake + idle gate). */
export function startPendingPrefetch(intervalMs = 4_000): void {
  setInterval(() => {
    void fetchPendingWeigh();
  }, intervalMs).unref?.();
}
