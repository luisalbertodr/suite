#!/usr/bin/env python3
"""Patch discovery.ts autoDiscover to honor SCALE_MACS allowlist."""
from pathlib import Path

path = Path("/root/renpho-gateway/ble-scale-sync/src/ble/handler-node-ble/discovery.ts")
text = path.read_text()

helper = """
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

"""

if "allowedScaleMacs" not in text:
    marker = "export async function autoDiscover("
    if marker not in text:
        raise SystemExit("autoDiscover not found")
    text = text.replace(marker, helper + marker)

old_loop_start = """  const deadline = Date.now() + DISCOVERY_TIMEOUT_MS;
  const checked = new Set<string>();
  let heartbeat = 0;

  while (Date.now() < deadline) {"""

new_loop_start = """  const deadline = Date.now() + DISCOVERY_TIMEOUT_MS;
  const checked = new Set<string>();
  let heartbeat = 0;
  const allow = allowedScaleMacs();
  if (allow) {
    bleLog.info(
      `Auto-discovery allowlist: ${[...allow].map((m) => m.match(/.{1,2}/g)?.join(':') ?? m).join(', ')}`,
    );
  }

  while (Date.now() < deadline) {"""

if "const allow = allowedScaleMacs()" not in text:
    if old_loop_start not in text:
        raise SystemExit("loop start not found")
    text = text.replace(old_loop_start, new_loop_start)

skip_block = """        bleLog.debug(`Discovered: ${name} [${addr}]`);

        // Try matching with name only"""

skip_block_new = """        bleLog.debug(`Discovered: ${name} [${addr}]`);

        if (allow && !allow.has(normalizeMac(addr))) {
          bleLog.debug(`Skipping ${addr} (not in SCALE_MACS allowlist)`);
          continue;
        }

        // Try matching with name only"""

if "not in SCALE_MACS allowlist" not in text:
    if skip_block not in text:
        raise SystemExit("discover log block not found")
    text = text.replace(skip_block, skip_block_new)

path.write_text(text)
print("discovery.ts patched OK")
