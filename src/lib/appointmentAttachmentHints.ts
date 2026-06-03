import { supabase } from '@/lib/supabase';

export type AppointmentAttachmentHints = {
  photos: boolean;
  signedConsents: boolean;
  documents: boolean;
};

export function emptyAttachmentHints(): AppointmentAttachmentHints {
  return { photos: false, signedConsents: false, documents: false };
}

export function hasAttachmentHints(h: AppointmentAttachmentHints): boolean {
  return h.photos || h.signedConsents || h.documents;
}

function mergeHint(
  current: AppointmentAttachmentHints,
  assetKind: string,
): AppointmentAttachmentHints {
  if (assetKind === 'photo_before' || assetKind === 'photo_after') {
    return { ...current, photos: true };
  }
  if (assetKind === 'consent') {
    return { ...current, signedConsents: true };
  }
  if (assetKind === 'document' || assetKind === 'other') {
    return { ...current, documents: true };
  }
  return current;
}

/** Indicadores de adjuntos por cita (fotos, consentimientos, documentos). */
export async function fetchAppointmentAttachmentHintsByIds(
  appointmentIds: string[],
): Promise<Map<string, AppointmentAttachmentHints>> {
  const map = new Map<string, AppointmentAttachmentHints>();
  const ids = [...new Set(appointmentIds.filter(Boolean))];
  if (!ids.length) return map;

  for (const id of ids) {
    map.set(id, emptyAttachmentHints());
  }

  const { data, error } = await supabase
    .from('daily_customer_log_assets')
    .select('ref_id, asset_kind')
    .eq('ref_table', 'agenda_appointments')
    .in('ref_id', ids);

  if (error) throw error;

  for (const row of data ?? []) {
    const refId = row.ref_id as string | null;
    if (!refId || !map.has(refId)) continue;
    map.set(refId, mergeHint(map.get(refId)!, String(row.asset_kind ?? '')));
  }

  return map;
}
