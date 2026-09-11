#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Agente ACR122U para macOS 10.11 (PC/SC via ctypes, Python 2.7).

Problemas tipicos en El Capitan:
- OpenSSL 0.9.8 sin TLS1.2 -> HTTPS con /usr/bin/curl (-k)
- SCARD_READERSTATE con ctypes suele fallar por alineacion -> sondeo SCardConnect
"""
from __future__ import print_function

import json
import os
import subprocess
import sys
import time
import ctypes
from ctypes import Structure, byref, c_ulong, create_string_buffer

NFC_AUTH_URL = os.environ.get(
    "NFC_AUTH_URL", "https://supabase.lipoout.com/functions/v1/nfc-auth"
).rstrip("/")
NFC_AGENT_SECRET = os.environ.get("NFC_AGENT_SECRET", "").strip()
NFC_STATION_ID = os.environ.get("NFC_STATION_ID", "default").strip() or "default"
DEBOUNCE_S = float(os.environ.get("NFC_DEBOUNCE_S", "2.5"))
POLL_S = float(os.environ.get("NFC_POLL_S", "0.35"))
CURL_INSECURE = os.environ.get("NFC_CURL_INSECURE", "1").strip().lower() not in (
    "0",
    "false",
    "no",
)

SCARD_SCOPE_SYSTEM = 2
SCARD_SHARE_SHARED = 2
SCARD_PROTOCOL_T0 = 0x0001
SCARD_PROTOCOL_T1 = 0x0002
SCARD_LEAVE_CARD = 0
SCARD_S_SUCCESS = 0
MAX_BUFFER_SIZE = 264


class SCARD_IO_REQUEST(Structure):
    _fields_ = [("dwProtocol", c_ulong), ("cbPciLength", c_ulong)]


def log(msg):
    print(msg)
    sys.stdout.flush()


def logerr(msg):
    print(msg, file=sys.stderr)
    sys.stderr.flush()


def load_pcsc():
    return ctypes.CDLL("/System/Library/Frameworks/PCSC.framework/PCSC")


def list_readers(lib, ctx):
    n = c_ulong(0)
    rv = lib.SCardListReaders(ctx, None, None, byref(n))
    if rv != SCARD_S_SUCCESS or n.value <= 1:
        return []
    buf = create_string_buffer(n.value)
    rv = lib.SCardListReaders(ctx, None, buf, byref(n))
    if rv != SCARD_S_SUCCESS:
        return []
    raw = buf.raw
    if not isinstance(raw, (bytes, bytearray)):
        raw = bytes(bytearray(raw))
    return [p for p in raw.split(b"\x00") if p]


def is_plausible_uid(uid):
    if not uid:
        return False
    if len(uid) not in (8, 14, 20):
        return False
    if set(uid) <= set("0"):
        return False
    if uid.startswith("0000"):
        return False
    if uid.count("F") >= max(4, len(uid) // 2):
        return False
    if "FFFFFFFF" in uid:
        return False
    return True


def transmit(lib, card, protocol, apdu):
    send_pci = SCARD_IO_REQUEST(protocol, ctypes.sizeof(SCARD_IO_REQUEST))
    send = (ctypes.c_ubyte * len(apdu))(*apdu)
    recv = (ctypes.c_ubyte * MAX_BUFFER_SIZE)()
    recv_len = c_ulong(MAX_BUFFER_SIZE)
    rv = lib.SCardTransmit(
        card, byref(send_pci), send, len(apdu), None, recv, byref(recv_len)
    )
    if rv != SCARD_S_SUCCESS or recv_len.value < 2:
        return None, None, None
    data = [recv[i] for i in range(recv_len.value)]
    return data[:-2], data[-2], data[-1]


def transmit_uid(lib, card, protocol, apdu):
    payload, sw1, sw2 = transmit(lib, card, protocol, apdu)
    if payload is None or (sw1, sw2) != (0x90, 0x00) or not payload:
        return None
    return "".join("%02X" % b for b in payload)


def buzz_ok(lib, card, protocol):
    # ACS ACR122U: LED verde + beep corto (mejor esfuerzo; ignora fallo)
    try:
        transmit(lib, card, protocol, [0xFF, 0x00, 0x40, 0xA2, 0x04, 0x01, 0x01, 0x02, 0x02])
    except Exception:
        pass


def read_uid(lib, card, protocol):
    samples = []
    for _ in range(6):
        uid = transmit_uid(lib, card, protocol, [0xFF, 0xCA, 0x00, 0x00, 0x00])
        if not is_plausible_uid(uid or ""):
            uid = transmit_uid(lib, card, protocol, [0xFF, 0xCA, 0x00, 0x00, 0x07])
        if uid and is_plausible_uid(uid):
            samples.append(uid)
            if len(samples) >= 2 and samples[-1] == samples[-2]:
                buzz_ok(lib, card, protocol)
                return samples[-1]
        time.sleep(0.03)
    if not samples:
        return None
    best = max(set(samples), key=samples.count)
    if is_plausible_uid(best):
        buzz_ok(lib, card, protocol)
        log("[acr122] UID aceptado: %s (%s)" % (best, samples))
        return best
    return None


def poll_uid_once(lib, ctx, readers):
    """Intenta SCardConnect en cada lector; si hay tarjeta, lee UID."""
    for name in readers:
        hcard = c_ulong()
        proto = c_ulong()
        crv = lib.SCardConnect(
            ctx,
            name,
            SCARD_SHARE_SHARED,
            SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
            byref(hcard),
            byref(proto),
        )
        if crv != SCARD_S_SUCCESS:
            continue
        try:
            uid = read_uid(lib, hcard.value, proto.value)
            if uid:
                return uid
        finally:
            lib.SCardDisconnect(hcard.value, SCARD_LEAVE_CARD)
    return None


def post_tag(uid):
    body = json.dumps(
        {"action": "agent.tag", "uid": uid, "station_id": NFC_STATION_ID}
    )
    cmd = [
        "/usr/bin/curl",
        "-sS",
        "--max-time",
        "20",
        "-X",
        "POST",
        NFC_AUTH_URL,
        "-H",
        "Content-Type: application/json",
        "-H",
        "x-nfc-agent-secret: %s" % NFC_AGENT_SECRET,
        "--data-binary",
        body,
    ]
    if CURL_INSECURE:
        cmd.insert(1, "-k")

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = proc.communicate()
    except OSError as e:
        raise RuntimeError("No se pudo ejecutar curl: %s" % e)

    if isinstance(out, bytes):
        out = out.decode("utf-8", "replace")
    if isinstance(err, bytes):
        err = err.decode("utf-8", "replace")

    if proc.returncode != 0:
        raise RuntimeError(
            "curl exit=%s err=%s out=%s" % (proc.returncode, err.strip(), out[:300])
        )

    raw = (out or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except ValueError:
        raise RuntimeError("Respuesta no JSON de nfc-auth: %s" % raw[:300])


def main():
    if not NFC_AGENT_SECRET:
        logerr("Define NFC_AGENT_SECRET")
        return 2

    lib = load_pcsc()
    log(
        "[acr122] station=%s url=%s curl_insecure=%s poll=%.2fs"
        % (NFC_STATION_ID, NFC_AUTH_URL, CURL_INSECURE, POLL_S)
    )
    last_uid = ""
    last_ts = 0.0
    no_reader_logged = False

    while True:
        try:
            ctx = c_ulong()
            rv = lib.SCardEstablishContext(SCARD_SCOPE_SYSTEM, None, None, byref(ctx))
            if rv != SCARD_S_SUCCESS:
                log("[acr122] SCardEstablishContext=%s" % rv)
                time.sleep(2)
                continue
            try:
                readers = list_readers(lib, ctx.value)
                if not readers:
                    if not no_reader_logged:
                        log(
                            "[acr122] No hay lectores PC/SC. "
                            "Desenchufa/enchufa el ACR122U y no redirijas USB por RDP."
                        )
                        no_reader_logged = True
                    time.sleep(2)
                    continue
                if no_reader_logged:
                    log("[acr122] Lectores: %s" % readers)
                no_reader_logged = False
                uid = poll_uid_once(lib, ctx.value, readers)
            finally:
                lib.SCardReleaseContext(ctx.value)

            if not uid:
                time.sleep(POLL_S)
                continue

            now = time.time()
            if uid == last_uid and (now - last_ts) < DEBOUNCE_S:
                time.sleep(POLL_S)
                continue
            last_uid, last_ts = uid, now
            log("[acr122] UID=%s" % uid)
            try:
                result = post_tag(uid)
                log("[acr122] -> %s" % result)
                if result.get("error"):
                    logerr("[acr122] nfc-auth error: %s" % result.get("error"))
                else:
                    log(
                        "[acr122] OK — la sesion la recoge Chrome en la VM "
                        "(station=%s)" % NFC_STATION_ID
                    )
            except Exception as e:
                logerr("[acr122] post error: %s" % e)
            time.sleep(DEBOUNCE_S)
        except KeyboardInterrupt:
            log("\n[acr122] stop")
            return 0
        except Exception as e:
            logerr("[acr122] loop error: %s" % e)
            time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())
