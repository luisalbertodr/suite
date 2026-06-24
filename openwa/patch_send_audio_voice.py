from pathlib import Path

p = Path("/app/dist/engine/adapters/whatsapp-web-js.adapter.js")
src = p.read_text()

# 1) sendAudioMessage → sendAudioAsVoice
old_audio = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }"""
new_audio = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media, { sendAudioAsVoice: true });
    }"""
if "sendAudioAsVoice: true" not in src and old_audio in src:
    src = src.replace(old_audio, new_audio, 1)

# 2) sendMediaMessage signature + voice mimetype
old_send = """    async sendMediaMessage(chatId, media) {
        this.ensureReady();
        let messageMedia;
        if (typeof media.data === 'string') {
            if (media.data.startsWith('http://') || media.data.startsWith('https://')) {
                messageMedia = await loadRemoteMedia(media.data);
            }
            else {
                messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data, media.filename);
            }
        }
        else {
            messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data.toString('base64'), media.filename);
        }
        const msg = await this.client.sendMessage(chatId, messageMedia, {
            caption: media.caption,
        });"""

new_send = """    async sendMediaMessage(chatId, media, options = {}) {
        this.ensureReady();
        const isVoice = !!options.sendAudioAsVoice;
        const mimetype = isVoice ? 'audio/ogg; codecs=opus' : media.mimetype;
        const filename = isVoice ? undefined : media.filename;
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
        });"""

if "audio/ogg; codecs=opus" in src:
    print("already patched voice mimetype")
elif old_send in src:
    src = src.replace(old_send, new_send, 1)
else:
    # partial patch from previous run — upgrade sendMediaMessage body only
    partial_old = """    async sendMediaMessage(chatId, media, options = {}) {
        this.ensureReady();
        let messageMedia;
        if (typeof media.data === 'string') {
            if (media.data.startsWith('http://') || media.data.startsWith('https://')) {
                messageMedia = await loadRemoteMedia(media.data);
            }
            else {
                messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data, media.filename);
            }
        }
        else {
            messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data.toString('base64'), media.filename);
        }
        const msg = await this.client.sendMessage(chatId, messageMedia, {
            caption: media.caption,
            ...options,
        });"""
    partial_new = new_send
    if partial_old in src:
        src = src.replace(partial_old, partial_new, 1)
    else:
        raise SystemExit("sendMediaMessage block not found; manual patch required")

p.write_text(src)
print("patched ok")
