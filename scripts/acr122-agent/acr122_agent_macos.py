#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Agente ACR122U para macOS 10.11 (PC/SC via ctypes, Python 2.7)."""
from __future__ import print_function

import json
import os
import sys
import time
import ctypes
from ctypes import Structure, byref, c_char_p, c_ulong, c_void_p, create_string_buffer

try:
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError
except ImportError:
    from urllib2 import Request, urlopen, HTTPError

NFC_AUTH_URL = os.environ.get(
    "NFC_AUTH_URL", "https://supabase.lipoout.com/functions/v1/nfc-auth"
).rstrip("/")
NFC_AGENT_SECRET = os.environ.get("NFC_AGENT_SECRET", "").strip()
NFC_STATION_ID = os.environ.get("NFC_STATION_ID", "default").strip() or "default"
DEBOUNCE_S = float(os.environ.get("NFC_DEBOUNCE_S", "2.5"))

SCARD_SCOPE_SYSTEM = 2
SCARD_SHARE_SHARED = 2
SCARD_PROTOCOL_T0 = 0x0001
SCARD_PROTOCOL_T1 = 0x0002
SCARD_LEAVE_CARD = 0
SCARD_S_SUCCESS = 0
SCARD_STATE_UNAWARE = 0x0000
SCARD_STATE_PRESENT = 0x0020
MAX_ATR_SIZE = 33
MAX_BUFFER_SIZE = 264


class SCARD_IO_REQUEST(Structure):
    _fields_ = [("dwProtocol", c_ulong), ("cbPciLength", c_ulong)]


class SCARD_READERSTATE(Structure):
    _fields_ = [
        ("szReader", c_char_p),
        ("pvUserData", c_void_p),
        ("dwCurrentState", c_ulong),
        ("dwEventState", c_ulong),
        ("cbAtr", c_ulong),
        ("rgbAtr", ctypes.c_ubyte * MAX_ATR_SIZE),
    ]


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


def transmit_uid(lib, card, protocol, apdu):
    send_pci = SCARD_IO_REQUEST(protocol, ctypes.sizeof(SCARD_IO_REQUEST))
    send = (ctypes.c_ubyte * len(apdu))(*apdu)
    recv = (ctypes.c_ubyte * MAX_BUFFER_SIZE)()
    recv_len = c_ulong(MAX_BUFFER_SIZE)
    rv = lib.SCardTransmit(
        card, byref(send_pci), send, len(apdu), None, recv, byref(recv_len)
    )
    if rv != SCARD_S_SUCCESS or recv_len.value < 2:
        return None
    data = [recv[i] for i in range(recv_len.value)]
    sw1, sw2 = data[-2], data[-1]
    payload = data[:-2]
    if (sw1, sw2) != (0x90, 0x00) or not payload:
        return None
    return "".join("%02X" % b for b in payload)


def read_uid(lib, card, protocol):
    samples = []
    for _ in range(8):
        uid = transmit_uid(lib, card, protocol, [0xFF, 0xCA, 0x00, 0x00, 0x00])
        if not is_plausible_uid(uid or ""):
            uid = transmit_uid(lib, card, protocol, [0xFF, 0xCA, 0x00, 0x00, 0x07])
        if uid and is_plausible_uid(uid):
            samples.append(uid)
            if len(samples) >= 2 and samples[-1] == samples[-2]:
                return samples[-1]
        time.sleep(0.04)
    if not samples:
        return None
    best = max(set(samples), key=samples.count)
    if is_plausible_uid(best):
        log("[acr122] UID aceptado: %s (%s)" % (best, samples))
        return best
    return None


def wait_card_and_read(lib, ctx, readers):
    states = (SCARD_READERSTATE * len(readers))()
    for i, name in enumerate(readers):
        states[i].szReader = name
        states[i].dwCurrentState = SCARD_STATE_UNAWARE
    lib.SCardGetStatusChange(ctx, 0, states, len(readers))
    for i in range(len(readers)):
        states[i].dwCurrentState = states[i].dwEventState

    rv = lib.SCardGetStatusChange(ctx, 1500, states, len(readers))
    if rv != SCARD_S_SUCCESS:
        return None

    for i, name in enumerate(readers):
        if not (states[i].dwEventState & SCARD_STATE_PRESENT):
            continue
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
            return read_uid(lib, hcard.value, proto.value)
        finally:
            lib.SCardDisconnect(hcard.value, SCARD_LEAVE_CARD)
    return None


def post_tag(uid):
    body = json.dumps(
        {"action": "agent.tag", "uid": uid, "station_id": NFC_STATION_ID}
    ).encode("utf-8")
    req = Request(NFC_AUTH_URL, data=body)
    req.add_header("Content-Type", "application/json")
    req.add_header("x-nfc-agent-secret", NFC_AGENT_SECRET)
    resp = urlopen(req, timeout=20)
    raw = resp.read()
    if not raw:
        return {}
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    return json.loads(raw)


def main():
    if not NFC_AGENT_SECRET:
        logerr("Define NFC_AGENT_SECRET")
        return 2

    lib = load_pcsc()
    log("[acr122] station=%s url=%s" % (NFC_STATION_ID, NFC_AUTH_URL))
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
                uid = wait_card_and_read(lib, ctx.value, readers)
            finally:
                lib.SCardReleaseContext(ctx.value)

            if not uid:
                continue

            now = time.time()
            if uid == last_uid and (now - last_ts) < DEBOUNCE_S:
                time.sleep(0.2)
                continue
            last_uid, last_ts = uid, now
            log("[acr122] UID=%s" % uid)
            try:
                result = post_tag(uid)
                log("[acr122] -> %s" % result)
                if result.get("ignored"):
                    log(
                        "[acr122] Aviso: no hay login esperando "
                        "(Chrome ?nfc_station=%s)" % NFC_STATION_ID
                    )
            except HTTPError as e:
                try:
                    body = e.read()
                except Exception:
                    body = b""
                logerr("[acr122] HTTP %s: %s" % (e.code, body))
            except Exception as e:
                logerr("[acr122] error: %s" % e)
            time.sleep(DEBOUNCE_S)
        except KeyboardInterrupt:
            log("\n[acr122] stop")
            return 0
        except Exception as e:
            logerr("[acr122] loop error: %s" % e)
            time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())
