"""
Parchea whatsapp-web-js.adapter.js para:
1. sendAudioMessage -> pasa { sendAudioAsVoice: true }
2. sendMediaMessage -> detecta OpusHead en .ogg y fija audio/ogg; codecs=opus
3. Añade protocolTimeout: 120000 a la config de puppeteer

Ejecutar dentro del contenedor OpenWA.
"""
from pathlib import Path

p = Path("/app/dist/engine/adapters/whatsapp-web-js.adapter.js")
src = p.read_text()
changed = False

# 1. Parchear sendAudioMessage: añadir { sendAudioAsVoice: true }
OLD_AUDIO = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }"""
NEW_AUDIO = """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media, { sendAudioAsVoice: true });
    }"""
if OLD_AUDIO in src and "sendAudioAsVoice: true" not in src:
    src = src.replace(OLD_AUDIO, NEW_AUDIO, 1)
    print("patched: sendAudioMessage -> sendAudioAsVoice: true")
    changed = True
elif "sendAudioAsVoice: true" in src:
    print("sendAudioAsVoice: already patched")
else:
    print("WARN: sendAudioMessage pattern not found, trying flexible match")
    import re as re2
    m = re2.search(r'async sendAudioMessage\(chatId,\s*media\)\s*\{[^}]*return this\.sendMediaMessage\(chatId,\s*media\);\s*\}', src)
    if m:
        src = src[:m.start()] + """    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media, { sendAudioAsVoice: true });
    }""" + src[m.end():]
        print("patched: sendAudioMessage (flexible match)")
        changed = True

# 2. Parchear sendMediaMessage: detectar OpusHead y fijar filename/type
MARKER_VOICE = "const isVoice = !!options.sendAudioAsVoice;"
if MARKER_VOICE not in src:
    # Buscar el cuerpo de sendMediaMessage
    import re as re3
    # Encontrar "async sendMediaMessage(chatId, media" hasta "async getContacts"
    m_start = re3.search(r'async sendMediaMessage\(chatId,\s*media', src)
    m_end = re3.search(r'async getContacts\(\)', src)
    if m_start and m_end:
        old_body = src[m_start.start():m_end.start()]
        indent = "    "
        new_body = f'''{indent}async sendMediaMessage(chatId, media, options = {{}}) {{
{indent}    this.ensureReady();
{indent}    const isVoice = !!options.sendAudioAsVoice;
{indent}    let mimetype = media.mimetype;
{indent}    let filename = media.filename;
{indent}    if (isVoice) {{
{indent}        filename = 'voice.ogg';
{indent}        const raw = typeof media.data === 'string' && !media.data.startsWith('http') ? media.data : null;
{indent}        if (raw) {{
{indent}            try {{
{indent}                const buf = Buffer.from(raw, 'base64').subarray(0, 256);
{indent}                if (buf.includes(Buffer.from('OpusHead'))) {{
{indent}                    mimetype = 'audio/ogg; codecs=opus';
{indent}                }}
{indent}            }}
{indent}            catch (_e) {{ /* keep dto mimetype */ }}
{indent}        }}
{indent}    }}
{indent}    let messageMedia;
{indent}    if (typeof media.data === 'string') {{
{indent}        if (media.data.startsWith('http://') || media.data.startsWith('https://')) {{
{indent}            messageMedia = await loadRemoteMedia(media.data);
{indent}            if (isVoice) {{
{indent}                messageMedia.mimetype = mimetype;
{indent}                messageMedia.filename = filename;
{indent}            }}
{indent}        }}
{indent}        else {{
{indent}            messageMedia = new MessageMedia(mimetype, media.data, filename);
{indent}        }}
{indent}    }}
{indent}    else {{
{indent}        messageMedia = new MessageMedia(mimetype, media.data.toString('base64'), filename);
{indent}    }}
{indent}    const msg = await this.client.sendMessage(chatId, messageMedia, {{
{indent}        caption: media.caption,
{indent}        ...options,
{indent}    }});
{indent}    return {{
{indent}        id: msg.id._serialized,
{indent}        timestamp: msg.timestamp,
{indent}    }};
{indent}}}'''
        src = src[:m_start.start()] + new_body + src[m_end.start():]
        print("patched: sendMediaMessage con OpusHead + options")
        changed = True
else:
    print("sendMediaMessage: already patched (voice marker found)")

# 3. Añadir protocolTimeout a la config de puppeteer
OLD_PUPPETEER = """                puppeteer: {
                    headless: this.config.puppeteer?.headless ?? true,
                    args: puppeteerArgs,
                    ...(this.config.puppeteer?.executablePath ? { executablePath: this.config.puppeteer.executablePath } : {}),
                },"""
NEW_PUPPETEER = """                puppeteer: {
                    headless: this.config.puppeteer?.headless ?? true,
                    args: puppeteerArgs,
                    protocolTimeout: 120000,
                    ...(this.config.puppeteer?.executablePath ? { executablePath: this.config.puppeteer.executablePath } : {}),
                },"""
if OLD_PUPPETEER in src and "protocolTimeout" not in src:
    src = src.replace(OLD_PUPPETEER, NEW_PUPPETEER, 1)
    print("patched: protocolTimeout=120000 en config puppeteer")
    changed = True
elif "protocolTimeout" in src:
    print("protocolTimeout: already patched")
else:
    print("WARN: puppeteer config pattern not found")

if changed:
    p.write_text(src)
    print("parches guardados correctamente")
else:
    print("no hubo cambios")