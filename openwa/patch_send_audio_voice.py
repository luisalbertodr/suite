from pathlib import Path

p = Path("/app/dist/engine/adapters/whatsapp-web-js.adapter.js")
src = p.read_text()

VOICE_SEND_AUDIO = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media, { sendAudioAsVoice: true });
    }"""

if "sendAudioAsVoice: true" not in src:
    src = src.replace(
        """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }""",
        VOICE_SEND_AUDIO,
        1,
    )

# Replace any existing sendMediaMessage voice block with fixed filename (never undefined).
MARKER = "const isVoice = !!options.sendAudioAsVoice;"
if MARKER not in src:
    raise SystemExit("sendMediaMessage voice marker not found")

start = src.index("    async sendMediaMessage(chatId, media")
end = src.index("    async getContacts()", start)
new_send_media = """    async sendMediaMessage(chatId, media, options = {}) {
        this.ensureReady();
        const isVoice = !!options.sendAudioAsVoice;
        let mimetype = media.mimetype;
        let filename = media.filename;
        if (isVoice) {
            filename = 'voice.ogg';
            const raw = typeof media.data === 'string' && !media.data.startsWith('http') ? media.data : null;
            if (raw) {
                try {
                    const buf = Buffer.from(raw, 'base64').subarray(0, 256);
                    if (buf.includes(Buffer.from('OpusHead'))) {
                        mimetype = 'audio/ogg; codecs=opus';
                    }
                }
                catch (_e) { /* keep dto mimetype */ }
            }
        }
        let messageMedia;
        if (typeof media.data === 'string') {
            if (media.data.startsWith('http://') || media.data.startsWith('https://')) {
                messageMedia = await loadRemoteMedia(media.data);
                if (isVoice) {
                    messageMedia.mimetype = mimetype;
                    messageMedia.filename = filename;
                }
            }
            else {
                messageMedia = new whatsapp_web_js_1.MessageMedia(mimetype, media.data, filename);
            }
        }
        else {
            messageMedia = new whatsapp_web_js_1.MessageMedia(mimetype, media.data.toString('base64'), filename);
        }
        const msg = await this.client.sendMessage(chatId, messageMedia, {
            caption: media.caption,
            ...options,
        });
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
"""

src = src[:start] + new_send_media + src[end:]
p.write_text(src)
print("patched ok")
