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
    from smartcard.CardRequest import CardRequest
    from smartcard.CardType import AnyCardType
    from smartcard.Exceptions import CardConnectionException, CardRequestTimeoutException, NoCardException
except ImportError:
    print("Falta pyscard. Instala: pip3 install pyscard  (y pcscd en el sistema)", file=sys.stderr)
    sys.exit(1)


NFC_AUTH_URL = os.environ.get("NFC_AUTH_URL", "https://supabase.lipoout.com/functions/v1/nfc-auth").rstrip("/")
NFC_AGENT_SECRET = os.environ.get("NFC_AGENT_SECRET", "").strip()
NFC_STATION_ID = os.environ.get("NFC_STATION_ID", "default").strip() or "default"
DEBOUNCE_S = float(os.environ.get("NFC_DEBOUNCE_S", "2.5"))
CARD_WAIT_S = float(os.environ.get("NFC_CARD_WAIT_S", "1.5"))

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
    if len(uid) not in (8, 14, 20):
        return False
    if set(uid) <= {"0"}:
        return False
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
    raw = transmit_uid(connection, GET_UID) or transmit_uid(connection, GET_UID_7)
    if raw:
        print(f"[acr122] UID descartado (formato): {raw}", flush=True)
    return None


def read_uid_from_connection(connection) -> str | None:
    samples: list[str] = []
    for _ in range(8):
        uid = read_uid_once(connection)
        if not uid:
            time.sleep(0.05)
            continue
        samples.append(uid)
        if len(samples) >= 2 and samples[-1] == samples[-2]:
            return samples[-1]
        time.sleep(0.04)
    if not samples:
        return None
    # ACR122U a menudo solo entrega 1 lectura buena antes de fallar el canal.
    best = max(set(samples), key=samples.count)
    if is_plausible_uid(best):
        if len(samples) == 1:
            print(f"[acr122] UID aceptado (1 lectura): {best}", flush=True)
        else:
            print(f"[acr122] UID por mayoría {samples} → {best}", flush=True)
        return best
    print(f"[acr122] UID inestable/inválido: {samples}", flush=True)
    return None


def wait_and_read_uid() -> str | None:
    """Espera presencia de tarjeta (PC/SC) y lee UID estable."""
    rs = readers()
    if not rs:
        print("[acr122] No hay lectores PC/SC. ¿pcscd activo y ACR122U conectado?", flush=True)
        time.sleep(2)
        return None

    try:
        req = CardRequest(timeout=CARD_WAIT_S, cardType=AnyCardType(), readers=rs)
        service = req.waitforcard()
    except CardRequestTimeoutException:
        return None
    except Exception as e:
        print(f"[acr122] waitforcard: {e}", file=sys.stderr, flush=True)
        time.sleep(0.5)
        return None

    connection = service.connection
    try:
        connection.connect()
    except (NoCardException, CardConnectionException) as e:
        print(f"[acr122] connect tras presencia: {e}", flush=True)
        return None

    try:
        uid = read_uid_from_connection(connection)
        if not uid:
            print("[acr122] Tarjeta presente pero sin UID válido", flush=True)
        return uid
    finally:
        try:
            connection.disconnect()
        except Exception:
            pass


def main() -> int:
    if not NFC_AGENT_SECRET:
        print("Define NFC_AGENT_SECRET", file=sys.stderr)
        return 2

    print(f"[acr122] station={NFC_STATION_ID} url={NFC_AUTH_URL}", flush=True)
    last_uid = ""
    last_ts = 0.0

    while True:
        try:
            uid = wait_and_read_uid()
            if not uid:
                continue

            now = time.time()
            if uid == last_uid and (now - last_ts) < DEBOUNCE_S:
                time.sleep(0.2)
                continue
            last_uid, last_ts = uid, now
            print(f"[acr122] UID={uid}", flush=True)

            try:
                result = post_tag(uid)
                print(f"[acr122] → {result}", flush=True)
                if result.get("ignored"):
                    print(
                        "[acr122] Aviso: no hay login esperando en esta estación "
                        f"(Chrome localStorage suite_nfc_station_id={NFC_STATION_ID})",
                        flush=True,
                    )
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="replace")
                print(f"[acr122] HTTP {e.code}: {err_body}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"[acr122] error: {e}", file=sys.stderr, flush=True)

            time.sleep(DEBOUNCE_S)
        except KeyboardInterrupt:
            print("\n[acr122] stop", flush=True)
            return 0
        except Exception as e:
            print(f"[acr122] loop error: {e}", file=sys.stderr, flush=True)
            time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())
