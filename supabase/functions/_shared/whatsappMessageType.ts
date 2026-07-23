/** Normaliza tipo de mensaje WA; evita "undefined"/"null" en UI y webhook. */

const BAILEYS_WRAP_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'documentWithCaptionMessage',
  'editedMessage',
] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function httpMediaUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u.trim()) return null;
  const s = u.trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return null;
}

export function unwrapBaileysInnerMessage(
  msg: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 8) return msg;
  for (const key of BAILEYS_WRAP_KEYS) {
    const wrap = asRecord(msg[key]);
    const inner = asRecord(wrap?.message);
    if (inner) return unwrapBaileysInnerMessage(inner, depth + 1);
  }
  return msg;
}

/** Nodo Baileys `message` dentro de payloads OpenWA/WAHA/webhook. */
export function extractBaileysMessageNode(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  const top = asRecord(root.message);
  if (top) return unwrapBaileysInnerMessage(top);
  const data = asRecord(root._data);
  const fromData = asRecord(data?.message);
  if (fromData) return unwrapBaileysInnerMessage(fromData);
  return null;
}

export type InferredWhatsappMedia = {
  type: string;
  caption: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
  body: string | null;
};

/** Infierte image/video/audio/sticker/document desde el JSON Baileys embebido. */
export function inferWhatsappMediaFromRaw(raw: unknown): InferredWhatsappMedia | null {
  const node = extractBaileysMessageNode(raw);
  if (!node) return null;

  const get = (path: string): unknown => {
    const parts = path.split('.');
    let cur: unknown = node;
    for (const p of parts) {
      const rec = asRecord(cur);
      if (!rec) return undefined;
      cur = rec[p];
    }
    return cur;
  };

  if (node.imageMessage) {
    return {
      type: 'image',
      caption: (get('imageMessage.caption') as string) ?? null,
      mediaUrl: httpMediaUrl(get('imageMessage.url')),
      mediaMime: (get('imageMessage.mimetype') as string) ?? 'image/jpeg',
      mediaFilename: null,
      mediaSize: Number(get('imageMessage.fileLength') ?? 0) || null,
      body: null,
    };
  }
  if (node.videoMessage) {
    return {
      type: 'video',
      caption: (get('videoMessage.caption') as string) ?? null,
      mediaUrl: httpMediaUrl(get('videoMessage.url')),
      mediaMime: (get('videoMessage.mimetype') as string) ?? 'video/mp4',
      mediaFilename: null,
      mediaSize: Number(get('videoMessage.fileLength') ?? 0) || null,
      body: null,
    };
  }
  if (node.audioMessage) {
    return {
      type: get('audioMessage.ptt') ? 'voice' : 'audio',
      caption: null,
      mediaUrl: httpMediaUrl(get('audioMessage.url')),
      mediaMime: (get('audioMessage.mimetype') as string) ?? 'audio/ogg',
      mediaFilename: null,
      mediaSize: Number(get('audioMessage.fileLength') ?? 0) || null,
      body: null,
    };
  }
  if (node.stickerMessage) {
    const url = httpMediaUrl(get('stickerMessage.url'));
    return {
      type: 'sticker',
      caption: null,
      mediaUrl: url,
      mediaMime: (get('stickerMessage.mimetype') as string) ?? 'image/webp',
      mediaFilename: null,
      mediaSize: Number(get('stickerMessage.fileLength') ?? 0) || null,
      body: url ? null : '[sticker]',
    };
  }
  if (node.documentMessage) {
    return {
      type: 'document',
      caption: (get('documentMessage.caption') as string) ?? null,
      mediaUrl: httpMediaUrl(get('documentMessage.url')),
      mediaMime: (get('documentMessage.mimetype') as string) ?? 'application/octet-stream',
      mediaFilename: (get('documentMessage.fileName') as string) ?? null,
      mediaSize: Number(get('documentMessage.fileLength') ?? 0) || null,
      body: null,
    };
  }
  return null;
}

export function isWeakWhatsappMessageType(type: unknown): boolean {
  const t = String(type ?? '').trim().toLowerCase();
  return !t || t === 'text' || t === 'chat' || t === 'unknown' || t === 'undefined' || t === 'null';
}

export function sanitizeWhatsappMessageType(
  raw: unknown,
  hints?: { mime?: string | null; filename?: string | null },
): string {
  let t = String(raw ?? '').trim().toLowerCase();
  if (!t || t === 'undefined' || t === 'null') t = '';

  const mime = (hints?.mime ?? '').toLowerCase();
  const name = hints?.filename ?? '';

  if (!t || t === 'unknown') {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.includes('webp') && /sticker/i.test(name)) return 'sticker';
    if (mime.includes('ogg') || mime.includes('opus') || mime.startsWith('audio/')) {
      return mime.includes('ogg') || mime.includes('opus') ? 'voice' : 'audio';
    }
    if (/\.(ogg|opus)$/i.test(name)) return 'voice';
    if (/\.(mp3|m4a|wav|webm)$/i.test(name)) return 'audio';
    if (/\.(jpe?g|png|gif|webp)$/i.test(name)) return 'image';
    if (/\.(mp4|mov|webm)$/i.test(name)) return 'video';
    if (mime && mime !== 'application/octet-stream') return 'document';
    return 'text';
  }

  if (t === 'ptt') return 'voice';
  if (t === 'document' && (/\.(ogg|opus)$/i.test(name) || mime.includes('ogg') || mime.includes('opus'))) {
    return 'voice';
  }
  return t;
}

export function whatsappMediaPreviewLabel(type: string): string {
  const t = sanitizeWhatsappMessageType(type);
  if (t === 'image') return '📷 Imagen';
  if (t === 'video') return '🎬 Vídeo';
  if (t === 'audio' || t === 'voice' || t === 'ptt') return '🎤 Audio';
  if (t === 'sticker') return '🎭 Sticker';
  if (t === 'document') return '📎 Documento';
  if (t === 'text' || t === 'chat') return 'Mensaje';
  return `[${t}]`;
}
