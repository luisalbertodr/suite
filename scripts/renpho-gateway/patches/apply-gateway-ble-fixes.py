"""
Patch ble-scale-sync on the MorphoScan gateway:
  - autoDiscover: prefer allowlisted peers with live RSSI (strongest wins)
  - shared.ts: flush early body-comp reading after onConnected
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path("/root/renpho-gateway/ble-scale-sync")
DISCOVERY = ROOT / "src/ble/handler-node-ble/discovery.ts"
SHARED = ROOT / "src/ble/shared.ts"

AUTO_DISCOVER_FN = r'''
function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

/** SCALE_MACS=aa:bb:...,cc:dd:... — if set, only these MorphoScan/units are accepted. */
function allowedScaleMacs(): Set<string> | null {
  const raw = (process.env.SCALE_MACS || process.env.ALLOWED_SCALE_MACS || '').trim();
  if (!raw) return null;
  const set = new Set(
    raw
      .split(/[,;\\s]+/)
      .map((s) => normalizeMac(s))
      .filter((s) => s.length >= 12),
  );
  return set.size > 0 ? set : null;
}

type DiscoverCandidate = {
  addr: string;
  name: string;
  device: Device;
  adapter: ScaleAdapter;
  rssi: number;
};

/** MorphoScan advertises briefly — poll faster when an allowlist is set. */
const ALLOWLIST_POLL_MS = 500;

async function readDeviceRssi(dev: Device): Promise<number | undefined> {
  try {
    const rssi = await helperOf(dev).prop('RSSI');
    return typeof rssi === 'number' ? rssi : undefined;
  } catch {
    return undefined;
  }
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
      `Auto-discovery allowlist: ${[...allow].map((m) => m.match(/.{1,2}/g)?.join(':') ?? m).join(', ')} ` +
        `(poll ${pollMs}ms)`,
    );
  }

  while (Date.now() < deadline) {
    if (abortSignal?.aborted) {
      throw abortSignal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const addresses: string[] = await btAdapter.devices();
    const fresh: DiscoverCandidate[] = [];
    const staleAllowlisted: string[] = [];

    // Drop LE noise so MorphoScan public MACs are not starved on CSR dongles.
    if (allow && heartbeat > 0 && heartbeat % 20 === 0) {
      let pruned = 0;
      for (const addr of addresses) {
        const mac = normalizeMac(addr);
        if (allow.has(mac)) continue;
        if (pruned >= 25) break;
        try {
          await removeDevice(btAdapter, addr);
          pruned += 1;
        } catch {
          /* ignore */
        }
      }
      if (pruned > 0) {
        bleLog.info(`Auto-discovery: pruned ${pruned} non-allowlisted BLE device(s)`);
      }
    }

    for (const addr of addresses) {
      try {
        const mac = normalizeMac(addr);
        // Filter BEFORE getDevice — otherwise node-ble attaches PropertiesChanged
        // listeners to every nearby phone/watch and trips MaxListenersExceeded.
        if (allow && !allow.has(mac)) {
          continue;
        }

        const dev = await btAdapter.getDevice(addr);
        const name = (await dev.getName().catch(() => '')) || '';

        let matched: ScaleAdapter | null = null;
        if (name) {
          const info: BleDeviceInfo = { localName: name, serviceUuids: [] };
          matched = resolveAdapter(info, adapters);
        }
        // MorphoScan often appears MAC-only (empty Name) for the first ads.
        if (!matched && allow?.has(mac) && renphoFallback) {
          matched = renphoFallback;
        }
        if (!matched) continue;

        // Idle MorphoScan siblings stay in BlueZ cache without a live RSSI.
        // Only connect to peers that are advertising now (person on the scale).
        const rssi = await readDeviceRssi(dev);
        if (rssi === undefined || rssi === RSSI_UNAVAILABLE) {
          staleAllowlisted.push(`${name || matched.name}[${addr}]`);
          continue;
        }

        fresh.push({ addr, name: name || matched.name, device: dev, adapter: matched, rssi });
      } catch {
        /* device may have gone away */
      }
    }

    if (fresh.length > 0) {
      fresh.sort((a, b) => b.rssi - a.rssi);
      const best = fresh[0];
      const also =
        fresh.length > 1
          ? ` (also ${fresh
              .slice(1)
              .map((c) => `${c.addr} rssi=${c.rssi}`)
              .join(', ')})`
          : '';
      bleLog.info(
        `Auto-discovered: ${best.adapter.name} (${best.name} [${best.addr}] rssi=${best.rssi})${also}`,
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
'''


def patch_discovery() -> None:
    text = DISCOVERY.read_text(encoding="utf-8")
    if "RSSI_UNAVAILABLE" not in text.split("autoDiscover")[0]:
        text = text.replace(
            "  POST_DISCOVERY_QUIESCE_MS,\n} from '../types.js';",
            "  POST_DISCOVERY_QUIESCE_MS,\n  RSSI_UNAVAILABLE,\n} from '../types.js';",
        )
    # Always rewrite autoDiscover so allowlist is checked BEFORE getDevice.
    pattern = re.compile(
        r"\nfunction normalizeMac\(mac: string\): string \{.*?"
        r"throw new Error\(`No recognized scale found within \$\{DISCOVERY_TIMEOUT_MS / 1000\}s`\);\n\}\n",
        re.S,
    )
    new_text, n = pattern.subn("\n" + AUTO_DISCOVER_FN.strip() + "\n", text, count=1)
    if n != 1:
        raise SystemExit(f"discovery.ts: failed to replace autoDiscover (n={n})")
    DISCOVERY.write_text(new_text, encoding="utf-8")
    print("discovery.ts: patched autoDiscover (RSSI + allowlist-before-getDevice)")


def patch_shared() -> None:
    text = SHARED.read_text(encoding="utf-8")
    if "takePostHandshakeReading" in text or "post-handshake flush" in text:
        print("shared.ts: already has post-handshake flush")
        return
    old = (
        "      bleLog.debug('Calling adapter.onConnected()');\n"
        "      await adapter.onConnected(ctx);\n"
        "      bleLog.debug('adapter.onConnected() completed');\n"
    )
    new = (
        "      bleLog.debug('Calling adapter.onConnected()');\n"
        "      await adapter.onConnected(ctx);\n"
        "      bleLog.debug('adapter.onConnected() completed');\n"
        "      // Renpho R-MSC04: body-comp often arrives before handshake finishes.\n"
        "      const takeEarly = (\n"
        "        adapter as { takePostHandshakeReading?: () => import('../interfaces/scale-adapter.js').ScaleReading | null }\n"
        "      ).takePostHandshakeReading;\n"
        "      if (typeof takeEarly === 'function' && takeEarly.call(adapter)) {\n"
        "        // Reading is stashed on the adapter; synthetic notify delivers it.\n"
        "        onNotification('post-handshake-flush', Buffer.from([0xff, 0xfe]));\n"
        "      }\n"
    )
    if old not in text:
        raise SystemExit("shared.ts: onConnected block not found")
    SHARED.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("shared.ts: patched post-handshake flush")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"missing {ROOT}")
    patch_discovery()
    patch_shared()
    print("OK")


if __name__ == "__main__":
    main()
