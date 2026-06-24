#!/usr/bin/env python3
import json
import urllib.request
import base64
import sys

mode = sys.argv[1] if len(sys.argv) > 1 else "base64"
ogg_path = "/tmp/test.ogg"

sid = "80ad9168-a82d-41d0-a75e-9806e850b4fe"
key = "owa_k1_c13e59cd1f7eee1068af57ce8a3d2a213fc191fabf972da49152dd6ac33ce9b4"
chat = "34667435503@c.us"
api = f"http://127.0.0.1:2785/api/sessions/{sid}/messages/send-audio"

if mode == "base64":
    ogg = open(ogg_path, "rb").read()
    raw_b64 = base64.b64encode(ogg).decode()
    payload = {
        "chatId": chat,
        "base64": raw_b64,
        "mimetype": "audio/ogg",
        "filename": "voice.ogg",
    }
elif mode == "dataurl":
    ogg = open(ogg_path, "rb").read()
    raw_b64 = base64.b64encode(ogg).decode()
    payload = {
        "chatId": chat,
        "base64": f"data:audio/ogg;base64,{raw_b64}",
        "mimetype": "audio/ogg",
        "filename": "voice.ogg",
    }
elif mode == "url-internal":
    # upload via storage API would be separate; test internal URL pattern
    payload = {
        "chatId": chat,
        "url": sys.argv[2],
        "mimetype": "audio/ogg",
    }
else:
    ogg_url = "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg"
    payload = {"chatId": chat, "url": ogg_url, "mimetype": "audio/ogg"}

req = urllib.request.Request(
    api,
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json", "X-API-Key": key},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print("OK", r.status, r.read().decode()[:300])
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
