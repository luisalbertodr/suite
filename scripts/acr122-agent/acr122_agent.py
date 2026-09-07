#!/usr/bin/env python3
"""
Agente local ACR122U (PC/SC) → Suite nfc-auth.

Dependencias:
  Debian:  sudo apt install pcscd pcsc-tools libpcsclite1 python3-pyscard
  macOS:   brew install pcsc-lite && pip3 install pyscard
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

try:
    from smartcard.System import readers
    from smartcard.Exceptions import CardConnectionException, NoCardException
except ImportError:
    print("Falta pyscard. Instala: pip3 install pyscard  (y pcscd en el sistema)", file=sys.stderr)
    sys.exit(1)


NFC_AUTH_URL = os.environ.get("NFC_AUTH_URL", "https://supabase.lipoout.com/functions/v1/nfc-auth").rstrip("/")
NFC_AGENT_SECRET = os.environ.get("NFC_AGENT_SECRET", "").strip()
NFC_STATION_ID = os.environ.get("NFC_STATION_ID", "default").strip() or "default"
POLL_EMPTY_S = float(os.environ.get("NFC_POLL_EMPTY_S", "0.35"))
DEBOUNCE_S = float(os.environ.get("NFC_DEBOUNCE_S", "2.5"))

# GET UID (PC/SC Get Data)
GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]
GET_UID_7 = [0xFF, 0xCA, 0x00, 0x00, 0x07]


def post_tag(uid: str) -> dict:
    body = json.dumps({"action": "agent.tag", "uid": uid, "station_id": NFC_STATION_ID}).encode("utf-8")
    req = urllib.request.Request(
        NFC_AUTH_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-nfc-agent-secret": NFC_AGENT_SECRET,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {}


def is_plausible_uid(uid: str) -> bool:
    if not uid:
        return False
    # UIDs ISO14443: 4 / 7 / 10 bytes
    if len(uid) not in (8, 14, 20):
        return False
    if set(uid) <= {"0"}:
        return False
    # Lecturas corruptas típicas del ACR122U
    if uid.startswith("0000"):
        return False
    if uid.count("F") >= max(4, len(uid) // 2):
        return False
    if "FFFFFFFF" in uid:
        return False
    return True


def transmit_uid(connection, apdu: list[int]) -> str | None:
    try:
        data, sw1, sw2 = connection.transmit(apdu)
    except CardConnectionException:
        return None
    if (sw1, sw2) != (0x90, 0x00) or not data:
        return None
    return "".join(f"{b:02X}" for b in data)


def read_uid_once(connection) -> str | None:
    uid = transmit_uid(connection, GET_UID)
    if is_plausible_uid(uid or ""):
        return uid
    uid7 = transmit_uid(connection, GET_UID_7)
    if is_plausible_uid(uid7 or ""):
        return uid7
    return None


def read_uid_stable(reader) -> str | None:
    """Lee 2–3 veces y solo acepta si coincide (evita basura del ACR122U)."""
    samples: list[str] = []
    for _ in range(3):
        connection = reader.createConnection()
        try:
            connection.connect()
        except (NoCardException, CardConnectionException):
            return None
        try:
            uid = read_uid_once(connection)
        finally:
            try:
                connection.disconnect()
            except Exception:
                pass
        if not uid:
            time.sleep(0.08)
            continue
        samples.append(uid)
        if len(samples) >= 2 and samples[-1] == samples[-2]:
            return samples[-1]
        time.sleep(0.08)
    return None


def main() -> int:
    if not NFC_AGENT_SECRET:
        print("Define NFC_AGENT_SECRET", file=sys.stderr)
        return 2

    print(f"[acr122] station={NFC_STATION_ID} url={NFC_AUTH_URL}")
    last_uid = ""
    last_ts = 0.0

    while True:
        try:
            rs = readers()
            if not rs:
                print("[acr122] No hay lectores PC/SC. ¿pcscd activo y ACR122U conectado?")
                time.sleep(2)
                continue

            reader = rs[0]
            uid = read_uid_stable(reader)
            if not uid:
                time.sleep(POLL_EMPTY_S)
                continue

            now = time.time()
            if uid == last_uid and (now - last_ts) < DEBOUNCE_S:
                time.sleep(POLL_EMPTY_S)
                continue
            last_uid, last_ts = uid, now
            print(f"[acr122] UID={uid}")

            try:
                result = post_tag(uid)
                print(f"[acr122] → {result}")
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="replace")
                print(f"[acr122] HTTP {e.code}: {err_body}", file=sys.stderr)
            except Exception as e:
                print(f"[acr122] error: {e}", file=sys.stderr)

            time.sleep(DEBOUNCE_S)
        except KeyboardInterrupt:
            print("\n[acr122] stop")
            return 0
        except Exception as e:
            print(f"[acr122] loop error: {e}", file=sys.stderr)
            time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())
