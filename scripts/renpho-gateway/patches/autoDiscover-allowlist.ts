/**
 * Auto-discovery with optional MAC allowlist (Lipoout multi-MorphoScan).
 *
 * Upstream only supports a single `ble.scale_mac`. For two clinic scales on one
 * bridge we leave `scale_mac` empty and filter here via:
 *   SCALE_MACS=AA:BB:CC:DD:EE:FF,11:22:33:44:55:66
 * If SCALE_MACS is unset, any recognized adapter matches (original behavior).
 *
 * Multi-scale fix: BlueZ keeps idle MorphoScan entries in its device cache.
 * Prefer peers that currently advertise (RSSI present and not 127), picking the
 * strongest RSSI so the scale in use wins over a stale sibling.
 *
 * MorphoScan often shows up in BlueZ as MAC-only (empty Name) for the first ads;
 * allowlisted MACs fall back to the Renpho R-MSC04 adapter without waiting for Name.
 */
import type { Adapter, Device } from 'node-ble';
import type { BleDeviceInfo, ScaleAdapter } from '../../interfaces/scale-adapter.js';
import { resolveAdapter } from '../../scales/resolve.js';
import { bleLog } from '../types.js';
import { DISCOVERY_TIMEOUT_MS, DISCOVERY_POLL_MS, sleep, RSSI_UNAVAILABLE } from './constants.js';

function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

/** Parse SCALE_MACS / ALLOWED_SCALE_MACS (comma or whitespace separated). */
export function allowedScaleMacs(): Set<string> | null {
  const raw = (process.env.SCALE_MACS || process.env.ALLOWED_SCALE_MACS || '').trim();
  if (!raw) return null;
  const set = new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => normalizeMac(s))
      .filter((s) => s.length >= 12),
  );
  return set.size > 0 ? set : null;
}

type Candidate = {
  addr: string;
  mac: string;
  name: string;
  device: Device;
  adapter: ScaleAdapter;
  rssi: number;
};

/** Soft skip after empty sessions so the sibling MorphoScan gets a turn. */
const failCooldownUntil = new Map<string, number>();
const FAIL_COOLDOWN_MS = 45_000;
/** MorphoScan advertises briefly — poll faster when an allowlist is set. */
const ALLOWLIST_POLL_MS = 500;

export function noteScaleSessionFailed(mac: string): void {
  const n = normalizeMac(mac);
  if (!n) return;
  failCooldownUntil.set(n, Date.now() + FAIL_COOLDOWN_MS);
  bleLog.info(
    `Auto-discovery: cooling down ${n.match(/.{1,2}/g)?.join(':')} for ${FAIL_COOLDOWN_MS / 1000}s after empty session`,
  );
}

export function noteScaleSessionOk(mac: string): void {
  failCooldownUntil.delete(normalizeMac(mac));
}

async function readRssi(dev: Device): Promise<number | undefined> {
  try {
    // node-ble Device exposes getRSSI(); dbus helper path varies by version.
    const anyDev = dev as unknown as {
      getRSSI?: () => Promise<number>;
      helper?: { prop: (k: string) => Promise<unknown> };
    };
    if (typeof anyDev.getRSSI === 'function') {
      const v = await anyDev.getRSSI();
      return typeof v === 'number' ? v : undefined;
    }
    if (anyDev.helper) {
      const v = await anyDev.helper.prop('RSSI');
      return typeof v === 'number' ? v : undefined;
    }
  } catch {
    /* RSSI optional */
  }
  return undefined;
}

function inFailCooldown(mac: string): boolean {
  const until = failCooldownUntil.get(normalizeMac(mac)) ?? 0;
  return Date.now() < until;
}

function formatMacColons(mac: string): string {
  return mac.match(/.{1,2}/g)?.join(':') ?? mac;
}

export async function autoDiscover(
  btAdapter: Adapter,
  adapters: ScaleAdapter[],
  abortSignal?: AbortSignal,
): Promise<{ device: Device; adapter: ScaleAdapter; mac: string }> {
  const deadline = Date.now() + DISCOVERY_TIMEOUT_MS;
  let heartbeat = 0;
  const allow = allowedScaleMacs();
  const pollMs = allow ? ALLOWLIST_POLL_MS : DISCOVERY_POLL_MS;
  const renphoFallback =
    adapters.find((a) => /r-msc04/i.test(a.name)) ??
    adapters.find((a) => /renpho/i.test(a.name)) ??
    null;
  if (allow) {
    bleLog.info(
      `Auto-discovery allowlist: ${[...allow].map((m) => formatMacColons(m)).join(', ')} ` +
        `(poll ${pollMs}ms)`,
    );
  }

  while (Date.now() < deadline) {
    if (abortSignal?.aborted) {
      throw abortSignal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const addresses: string[] = await btAdapter.devices();
    const fresh: Candidate[] = [];
    const staleAllowlisted: string[] = [];

    for (const addr of addresses) {
      try {
        const mac = normalizeMac(addr);
        // Filter BEFORE getDevice — otherwise node-ble attaches PropertiesChanged
        // listeners to every nearby phone/watch and trips MaxListenersExceeded.
        if (allow && !allow.has(mac)) continue;

        if (inFailCooldown(mac)) {
          bleLog.debug(`Skipping ${addr} (fail cooldown)`);
          continue;
        }

        const dev = await btAdapter.getDevice(addr);
        const name = (await dev.getName().catch(() => '')) || '';

        let matched: ScaleAdapter | null = null;
        if (name) {
          const info: BleDeviceInfo = { localName: name, serviceUuids: [] };
          matched = resolveAdapter(info, adapters);
        }
        // Allowlisted MorphoScan often appears MAC-only before Name is filled.
        if (!matched && allow?.has(mac) && renphoFallback) {
          matched = renphoFallback;
        }
        if (!matched) continue;

        const rssi = await readRssi(dev);
        // Only connect to peers that are advertising now. Cached idle MorphoScan
        // entries often have no RSSI or the 127 "unavailable" sentinel.
        if (rssi === undefined || rssi === RSSI_UNAVAILABLE) {
          staleAllowlisted.push(`${name || matched.name}[${formatMacColons(mac)}]`);
          continue;
        }

        fresh.push({
          addr,
          mac,
          name: name || matched.name,
          device: dev,
          adapter: matched,
          rssi,
        });
      } catch {
        /* device may have gone away */
      }
    }

    if (fresh.length > 0) {
      fresh.sort((a, b) => b.rssi - a.rssi);
      const best = fresh[0];
      const others =
        fresh.length > 1
          ? ` (also ${fresh
              .slice(1)
              .map((c) => `${c.addr} rssi=${c.rssi}`)
              .join(', ')})`
          : '';
      bleLog.info(
        `Auto-discovered: ${best.adapter.name} (${best.name} [${best.addr}] rssi=${best.rssi})${others}`,
      );
      return { device: best.device, adapter: best.adapter, mac: best.addr };
    }

    if (staleAllowlisted.length > 0 && heartbeat % 10 === 0) {
      bleLog.info(
        `Allowlisted scales cached but not advertising: ${staleAllowlisted.join(', ')}`,
      );
    }

    heartbeat++;
    if (heartbeat % 10 === 0) {
      bleLog.info(`Still scanning... (${addresses.length} BLE devices in BlueZ)`);
    }
    await sleep(pollMs);
  }

  throw new Error(`No recognized scale found within ${DISCOVERY_TIMEOUT_MS / 1000}s`);
}
