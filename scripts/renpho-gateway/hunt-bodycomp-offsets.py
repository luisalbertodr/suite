#!/usr/bin/env python3
"""Hunt 2-byte fields in a MorphoScan / R-MSC04 0x25|0x26 frame hex.

Usage:
  python scripts/renpho-gateway/hunt-bodycomp-offsets.py \\
    --hex 55aa25... \\
    --weight 70.85 --fat 16.8 \\
    --protein 16.6 --water 61.0 --bone 3.90 --muscle 54.98 \\
    --subq 12.0 --visceral 3

Paste the hex from journal (`body-comp hex ...`) or from
inbody_measurements.raw_payload.body_comp_hex after a weigh-in.
"""

from __future__ import annotations

import argparse
from typing import Iterable


def be_u16(b: bytes, i: int) -> int:
    return (b[i] << 8) | b[i + 1]


def le_u16(b: bytes, i: int) -> int:
    return b[i] | (b[i + 1] << 8)


def candidates(payload: bytes, target: float, scales: Iterable[float]) -> list[str]:
    out: list[str] = []
    for i in range(0, len(payload) - 1):
        for endian, reader in (("BE", be_u16), ("LE", le_u16)):
            raw = reader(payload, i)
            for div in scales:
                val = raw / div
                if abs(val - target) <= max(0.05, target * 0.002):
                    out.append(f"  payload[{i}:{i+2}] {endian} /{div:g} = {val:.4g} (raw={raw})")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hex", required=True, help="Full 55AA frame hex (with or without spaces)")
    p.add_argument("--weight", type=float)
    p.add_argument("--fat", type=float, help="Body fat percent")
    p.add_argument("--protein", type=float)
    p.add_argument("--water", type=float)
    p.add_argument("--bone", type=float, help="Bone mass kg")
    p.add_argument("--muscle", type=float, help="Muscle mass kg")
    p.add_argument("--subq", type=float, help="Subcutaneous fat percent")
    p.add_argument("--visceral", type=float)
    p.add_argument("--bmr", type=float)
    args = p.parse_args()

    hx = args.hex.replace(" ", "").replace(":", "").lower()
    frame = bytes.fromhex(hx)
    if len(frame) < 8 or frame[0] != 0x55 or frame[1] != 0xAA:
        raise SystemExit("Expected 55 AA framed hex")
    plen = (frame[3] << 8) | frame[4]
    payload = frame[5 : 5 + plen]
    print(f"cmd=0x{frame[2]:02x} payload_len={plen} checksum=0x{frame[-1]:02x}")
    print(f"payload hex: {payload.hex()}")

    targets = [
        ("weight kg", args.weight, (100.0, 10.0, 1.0)),
        ("fat %", args.fat, (10.0, 100.0, 1.0)),
        ("protein %", args.protein, (10.0, 100.0, 1.0)),
        ("water %", args.water, (10.0, 100.0, 1.0)),
        ("bone kg", args.bone, (100.0, 10.0, 1.0)),
        ("muscle kg", args.muscle, (100.0, 10.0, 1.0)),
        ("subq %", args.subq, (10.0, 100.0, 1.0)),
        ("visceral", args.visceral, (1.0, 10.0)),
        ("bmr", args.bmr, (1.0, 10.0)),
    ]
    for label, target, scales in targets:
        if target is None:
            continue
        hits = candidates(payload, target, scales)
        print(f"\n# {label} = {target}")
        print("\n".join(hits) if hits else "  (no hit)")


if __name__ == "__main__":
    main()
