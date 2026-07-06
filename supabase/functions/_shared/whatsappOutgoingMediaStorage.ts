import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const WA_OUTGOING_MEDIA_BUCKET = 'whatsapp-media';

export function buildDefaultStoragePublicUrl(bucket: string, objectPath: string): string {
  const keys = [
    'SUPABASE_WEBHOOK_PUBLIC_URL',
    'SUPABASE_PUBLIC_URL',
    'API_EXTERNAL_URL',
    'SUPABASE_URL',
  ];
  let base = 'https://supabase.lipoout.com';
  for (const key of keys) {
    const raw = Deno.env.get(key)?.trim();
    if (!raw) continue;
    try {
      const u = new URL(raw.replace(/\/+$/, ''));
      const h = u.hostname.toLowerCase();
      if (h !== 'localhost' && h !== 'kong' && h !== '127.0.0.1') {
        base = u.origin;
        break;
      }
    } catch {
      continue;
    }
  }
  return `${base}/storage/v1/object/public/${bucket}/${objectPath.replace(/^\/+/, '')}`;
}

export function stripMediaBase64(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
}

function base64ToBytes(b64: string): Uint8Array {
  const cleaned = stripMediaBase64(b64);
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** WhatsApp PTT exige OGG/Opus (OpusHead). OGG/Vorbis se envía como adjunto. */
const OPUS_HEAD_SCAN_BYTES = 4096;

export function isOggOpusBase64(b64: string): boolean {
  try {
    const bytes = base64ToBytes(b64).slice(0, OPUS_HEAD_SCAN_BYTES);
    for (let i = 0; i <= bytes.length - 8; i++) {
      if (
        bytes[i] === 0x4f &&
        bytes[i + 1] === 0x70 &&
        bytes[i + 2] === 0x75 &&
        bytes[i + 3] === 0x73 &&
        bytes[i + 4] === 0x48 &&
        bytes[i + 5] === 0x65 &&
        bytes[i + 6] === 0x61 &&
        bytes[i + 7] === 0x64
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function openwaVoiceNoteFormatError(): string {
  return (
    'Para nota de voz nativa el archivo debe ser OGG con códec Opus (como las notas de WhatsApp). ' +
    'Muchos .ogg usan Vorbis y llegan como adjunto. ' +
    'Prueba reenviando una nota de voz de WhatsApp o convierte con: ' +
    'ffmpeg -i entrada.ogg -c:a libopus -ar 48000 -ac 1 -application voip salida.ogg'
  );
}

function mimeToExt(mime: string, filename?: string): string {
  const extFromName = filename?.split('.').pop()?.toLowerCase();
  if (extFromName && extFromName.length <= 6 && /^[a-z0-9]+$/.test(extFromName)) {
    return extFromName;
  }
  const m = mime.toLowerCase();
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('opus')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4') && m.startsWith('audio/')) return 'm4a';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('jpeg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('video')) return 'mp4';
  return 'bin';
}

/** OpenWA send-audio acepta base64 plano; vídeo/documento necesitan URL pública. */
export function openwaMediaRequiresPublicUrl(
  type: 'image' | 'video' | 'audio' | 'document' | 'voice',
): boolean {
  return type === 'video' || type === 'document';
}

/** WAHA entrega notas de voz de forma fiable vía URL + convert; base64 del navegador suele quedar PENDING. */
export function wahaVoiceRequiresPublicUrl(
  provider: string | null | undefined,
  type: 'image' | 'video' | 'audio' | 'document' | 'voice',
): boolean {
  if ((provider ?? '').toLowerCase() !== 'waha') return false;
  return type === 'voice';
}

export function normalizeOutgoingStorageMime(mime: string): string {
  const m = (mime ?? '').trim().toLowerCase();
  if (m.includes('ogg') || m.includes('opus') || m === 'application/ogg') return 'audio/ogg';
  return mime;
}

export async function uploadWhatsappOutgoingMedia(
  admin: SupabaseClient,
  companyId: string,
  base64: string,
  mime: string,
  buildPublicUrl: (bucket: string, path: string) => string,
  filename?: string,
): Promise<string> {
  const bytes = base64ToBytes(base64);
  if (!bytes.length) throw new Error('Archivo vacío');
  const storageMime = normalizeOutgoingStorageMime(mime);
  const ext = mimeToExt(storageMime, filename);
  const path = `${companyId}/outgoing/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(WA_OUTGOING_MEDIA_BUCKET).upload(path, bytes, {
    contentType: storageMime,
    upsert: true,
  });
  if (error) throw new Error(`No se pudo preparar el archivo: ${error.message}`);
  return buildPublicUrl(WA_OUTGOING_MEDIA_BUCKET, path);
}
