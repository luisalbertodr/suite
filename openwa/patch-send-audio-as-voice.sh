#!/usr/bin/env bash
# Parchea el contenedor OpenWA para que send-audio use sendAudioAsVoice (burbuja PTT).
# Ejecutar en el host donde corre el contenedor `openwa` tras cada recreación de imagen.
set -euo pipefail
ADAPTER="/app/dist/engine/adapters/whatsapp-web-js.adapter.js"
docker exec openwa test -f "$ADAPTER"
docker exec openwa python3 - <<'PY'
from pathlib import Path
p = Path("/app/dist/engine/adapters/whatsapp-web-js.adapter.js")
src = p.read_text()
old_audio = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }"""
new_audio = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media, { sendAudioAsVoice: true });
    }"""
if old_audio not in src and "sendAudioAsVoice: true" in src:
    print("already patched")
elif old_audio not in src:
    raise SystemExit("sendAudioMessage block not found; image may have changed")
else:
    src = src.replace(old_audio, new_audio, 1)
old_send = """    async sendMediaMessage(chatId, media) {
        this.ensureReady();"""
new_send = """    async sendMediaMessage(chatId, media, options = {}) {
        this.ensureReady();"""
if "async sendMediaMessage(chatId, media, options = {})" not in src:
    if old_send not in src:
        raise SystemExit("sendMediaMessage signature not found")
    src = src.replace(old_send, new_send, 1)
old_opts = """        const msg = await this.client.sendMessage(chatId, messageMedia, {
            caption: media.caption,
        });"""
new_opts = """        const msg = await this.client.sendMessage(chatId, messageMedia, {
            caption: media.caption,
            ...options,
        });"""
if "...options," not in src:
    if old_opts not in src:
        raise SystemExit("sendMessage options block not found")
    src = src.replace(old_opts, new_opts, 1)
p.write_text(src)
print("patched ok")
PY
docker restart openwa
echo "OpenWA reiniciado con sendAudioAsVoice"
