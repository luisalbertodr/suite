"""
Patch ble-scale-sync on the MorphoScan gateway:
  - suite-pending.ts + renpho-msc04.ts (Pesar / Pesar+ con MAC fija)
  - loop.ts: idle hasta petición «Pesar» abierta
  - autoDiscover: MAC objetivo de Suite + allowlist RSSI
  - shared.ts: flush early body-comp reading after onConnected
"""
from __future__ import annotations

import pathlib
import re
import shutil

ROOT = pathlib.Path("/root/renpho-gateway/ble-scale-sync")
PATCHES = pathlib.Path(__file__).resolve().parent
DISCOVERY = ROOT / "src/ble/handler-node-ble/discovery.ts"
SHARED = ROOT / "src/ble/shared.ts"
LOOP_CANDIDATES = [
    ROOT / "src/runtime/loop.ts",
    ROOT / "src/sync/loop.ts",
    ROOT / "src/loop.ts",
]

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
  const pending = await fetchPendingWeigh(true);
  if (!pending.pending || !pending.ready) {
    bleLog.debug('Auto-discovery idle: no pending weigh request');
    throw new Error('No pending weigh request');
  }
  const targetMac = getTargetScaleMac();
  const pollMs = allow || targetMac ? ALLOWLIST_POLL_MS : DISCOVERY_POLL_MS;
  const renphoFallback =
    adapters.find((a) => /r-msc04/i.test(a.name)) ??
    adapters.find((a) => /renpho/i.test(a.name)) ??
    null;
  if (targetMac) {
    const label = targetMac.match(/.{1,2}/g)?.join(':') ?? targetMac;
    bleLog.info(`Auto-discovery target scale: ${label} (poll ${pollMs}ms)`);
  } else if (allow) {
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

    for (const addr of addresses) {
      try {
        const mac = normalizeMac(addr);
        // Filter BEFORE getDevice — otherwise node-ble attaches PropertiesChanged
        // listeners to every nearby phone/watch and trips MaxListenersExceeded.
        if (targetMac && mac !== targetMac) continue;
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
        if (!matched && (allow?.has(mac) || mac === targetMac) && renphoFallback) {
          matched = renphoFallback;
        }
        if (!matched) continue;

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
      if (!targetMac) fresh.sort((a, b) => b.rssi - a.rssi);
      const best = fresh[0];
      const also =
        !targetMac && fresh.length > 1
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


def copy_static_patches() -> None:
    shutil.copy2(PATCHES / "suite-pending.ts", ROOT / "src/suite-pending.ts")
    shutil.copy2(PATCHES / "renpho-msc04.ts", ROOT / "src/scales/renpho-msc04.ts")
    print("suite-pending.ts + renpho-msc04.ts copied")


def find_loop_file() -> pathlib.Path:
    for path in LOOP_CANDIDATES:
        if path.is_file():
            return path
    raise SystemExit(f"loop.ts not found under {ROOT}")


def patch_loop() -> None:
    loop_path = find_loop_file()
    text = loop_path.read_text(encoding="utf-8")
    if "waitUntilWeighPending" in text:
        print(f"{loop_path.name}: already has idle gate")
        return

    import_line = "import { waitUntilWeighPending } from '../suite-pending.js';\n"
    anchor = "import { errMsg } from '../utils/error.js';\n"
    if anchor not in text:
        raise SystemExit(f"{loop_path}: errMsg import not found")
    text = text.replace(anchor, anchor + import_line, 1)

    idle_block = (
        "        // Sin petición «Pesar» abierta: no escanear BLE (modo idle).\n"
        "        await waitUntilWeighPending(signal);\n"
        "        if (signal.aborted) break;\n\n"
    )
    text, n = re.subn(
        r"(        touchHeartbeat\(\);\n)(\n        // Start hook is idempotent)",
        r"\1\n" + idle_block + r"\2",
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"{loop_path}: could not inject idle gate")
    loop_path.write_text(text, encoding="utf-8")
    print(f"{loop_path.relative_to(ROOT)}: idle gate patched")


def patch_discovery() -> None:
    text = DISCOVERY.read_text(encoding="utf-8")
    # discovery.ts vive en src/ble/handler-node-ble/, así que para llegar a src/suite-pending.ts
    # hay que subir 2 niveles: ../../suite-pending.js (subir 3 lleva fuera de /src).
    import_line = "import { fetchPendingWeigh, getTargetScaleMac } from '../../suite-pending.js';\n"
    if "fetchPendingWeigh" not in text:
        anchor = "import { resolveAdapter } from '../../scales/resolve.js';\n"
        if anchor not in text:
            raise SystemExit("discovery.ts: resolveAdapter import not found")
        text = text.replace(anchor, anchor + import_line, 1)

    if "RSSI_UNAVAILABLE" not in text.split("autoDiscover")[0]:
        text = text.replace(
            "  POST_DISCOVERY_QUIESCE_MS,\n} from '../types.js';",
            "  POST_DISCOVERY_QUIESCE_MS,\n  RSSI_UNAVAILABLE,\n} from '../types.js';",
        )
    pattern = re.compile(
        r"\nfunction normalizeMac\(mac: string\): string \{.*?"
        r"throw new Error\(`No recognized scale found within \$\{DISCOVERY_TIMEOUT_MS / 1000\}s`\);\n\}\n",
        re.S,
    )
    new_text, n = pattern.subn("\n" + AUTO_DISCOVER_FN.strip() + "\n", text, count=1)
    if n != 1:
        raise SystemExit(f"discovery.ts: failed to replace autoDiscover (n={n})")
    DISCOVERY.write_text(new_text, encoding="utf-8")
    print("discovery.ts: patched autoDiscover (target MAC + allowlist-before-getDevice)")


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
    copy_static_patches()
    patch_loop()
    patch_discovery()
    patch_shared()
    print("OK")


if __name__ == "__main__":
    main()
