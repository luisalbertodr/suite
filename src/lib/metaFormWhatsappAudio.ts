import { supabase } from '@/lib/supabase';
import { assertWhatsappVoiceNoteFile } from '@/components/whatsapp/whatsappUtils';

export const META_WA_AUDIO_BUCKET = 'documents';

const AUDIO_EXT_TO_MIME: Record<string, string> = {
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  aac: 'audio/aac',
};

/** MIME aceptado por storage.documents para audios WA (OGG/Opus por defecto en WhatsApp). */
export function resolveWhatsappAudioMimeType(fileName: string, blobType?: string): string {
  const raw = (blobType ?? '').trim().toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (raw.includes('ogg') || raw.includes('opus')) return 'audio/ogg';
  if (raw === 'application/ogg') return 'audio/ogg';
  if (raw && raw !== 'application/octet-stream' && raw.startsWith('audio/')) return raw;

  return AUDIO_EXT_TO_MIME[ext] ?? 'audio/ogg';
}

export function isAcceptedWhatsappAudioFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (
    mime.includes('ogg') ||
    mime.includes('opus') ||
    mime === 'application/ogg'
  ) {
    return true;
  }
  return /\.(ogg|opus)$/i.test(file.name);
}

export function metaFormWhatsappAudioStoragePath(
  companyId: string,
  formId: string,
  filename: string,
): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'audio';
  return `${companyId}/meta-wa-audio/${formId}/initial.${ext}`;
}

export async function uploadMetaFormWhatsappAudio(
  companyId: string,
  formId: string,
  file: File,
): Promise<{ path: string; filename: string; mime: string }> {
  if (!isAcceptedWhatsappAudioFile(file)) {
    throw new Error('Formato no soportado. Usa OGG/Opus (nota de voz de WhatsApp).');
  }
  await assertWhatsappVoiceNoteFile(file);
  const path = metaFormWhatsappAudioStoragePath(companyId, formId, file.name);
  const mime = resolveWhatsappAudioMimeType(file.name, file.type);
  const { error } = await supabase.storage.from(META_WA_AUDIO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: mime,
  });
  if (error) throw new Error(error.message);
  return {
    path,
    filename: file.name,
    mime,
  };
}

export async function removeMetaFormWhatsappAudio(path: string): Promise<void> {
  const { error } = await supabase.storage.from(META_WA_AUDIO_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/** Bienvenida automática: solo texto. El audio de campaña se envía manualmente desde el chat. */
export function resolveFormInitialSendKind(form: {
  whatsapp_automation_enabled?: boolean | null;
  whatsapp_initial_audio_enabled?: boolean | null;
  whatsapp_initial_audio_path?: string | null;
  whatsapp_initial_message?: string | null;
}): 'audio' | 'text' | null {
  if (!form.whatsapp_automation_enabled) return null;
  if (form.whatsapp_initial_message?.trim()) return 'text';
  return null;
}

export function formHasCampaignAudioConfigured(form: {
  whatsapp_initial_audio_enabled?: boolean | null;
  whatsapp_initial_audio_path?: string | null;
}): boolean {
  return !!(
    form.whatsapp_initial_audio_enabled &&
    form.whatsapp_initial_audio_path?.trim()
  );
}

export function sendKindLabel(kind: 'audio' | 'audio_link' | 'text' | 'voice' | null | undefined): string {
  if (kind === 'voice' || kind === 'audio') return 'Audio';
  if (kind === 'audio_link') return 'Audio (enlace)';
  if (kind === 'text') return 'Texto';
  return '—';
}
