#!/usr/bin/env python3
"""
Agente local ACR122U (PC/SC) → Suite nfc-auth.

Funciona en Debian/Ubuntu y macOS con el lector USB enchufado en la máquina
donde corre este proceso (thin client con Chrome local, o host RDP con USB
redirigido).

Dependencias:
  Debian:  sudo apt install pcscd pcsc-tools libpcsclite-dev python3-pyscard
  macOS:   brew install pcsc-lite && pip3 install pyscard

Uso:
  export NFC_AGENT_SECRET='...'
  export NFC_STATION_ID='station-recepcion'   # mismo id que en el navegador (localStorage)
  export NFC_AUTH_URL='https://supabase.lipoout.com/functions/v1/nfc-auth'
  python3 acr122_agent.py
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
    from smartcard.util import toHexString
    from smartcard.Exceptions import CardConnectionException, NoCardException
except ImportError:
    print("Falta pyscard. Instala: pip3 install pyscard  (y pcscd en el sistema)", file=sys.stderr)
    sys.exit(1)


NFC_AUTH_URL = os.environ.get("NFC_AUTH_URL", "https://supabase.lipoout.com/functions/v1/nfc-auth").rstrip("/")
NFC_AGENT_SECRET = os.environ.get("NFC_AGENT_SECRET", "").strip()
NFC_STATION_ID = os.environ.get("NFC_STATION_ID", "default").strip() or "default"
POLL_EMPTY_S = float(os.environ.get("NFC_POLL_EMPTY_S", "0.4"))
DEBOUNCE_S = float(os.environ.get("NFC_DEBOUNCE_S", "2.5"))

# GET UID (ACR122U / PN532 compatible)
GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]


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


def read_uid(connection) -> str | None:
    try:
        data, sw1, sw2 = connection.transmit(GET_UID)
    except CardConnectionException:
        return None
    if (sw1, sw2) != (0x90, 0x00):
        return None
    return "".join(f"{b:02X}" for b in data)


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
            connection = reader.createConnection()
            try:
                connection.connect()
            except (NoCardException, CardConnectionException):
                time.sleep(POLL_EMPTY_S)
                continue

            uid = read_uid(connection)
            try:
                connection.disconnect()
            except Exception:
                pass

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
