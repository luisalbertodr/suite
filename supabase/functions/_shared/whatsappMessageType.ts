/** Normaliza tipo de mensaje WA; evita "undefined"/"null" en UI y webhook. */
export function sanitizeWhatsappMessageType(
  raw: unknown,
  hints?: { mime?: string | null; filename?: string | null },
): string {
  let t = String(raw ?? '').trim().toLowerCase();
  if (!t || t === 'undefined' || t === 'null') t = '';

  const mime = (hints?.mime ?? '').toLowerCase();
  const name = hints?.filename ?? '';

  if (!t || t === 'unknown') {
    if (mime.includes('ogg') || mime.includes('opus') || mime.startsWith('audio/')) {
      return mime.includes('ogg') || mime.includes('opus') ? 'voice' : 'audio';
    }
    if (/\.(ogg|opus)$/i.test(name)) return 'voice';
    if (/\.(mp3|m4a|wav|webm)$/i.test(name)) return 'audio';
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
