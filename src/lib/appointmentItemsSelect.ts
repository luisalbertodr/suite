import { supabase } from '@/lib/supabase';

const DEFAULT_ITEM_COLUMNS = [
  'appointment_id',
  'label',
  'kind',
  'duration_minutes',
  'notes',
  'sort_order',
  'article_id',
] as const;

export function extractMissingAppointmentItemsColumn(
  error: { code?: string; message?: string } | null | undefined,
): string | null {
  if (!error) return null;
  const msg = String(error.message || '');
  const quoted = msg.match(/'([^']+)'\s+column of 'appointment_items'/i);
  if (quoted?.[1]) return quoted[1];
  const dotted = msg.match(/column\s+appointment_items\.([a-zA-Z0-9_]+)/i);
  if (dotted?.[1]) return dotted[1];
  return null;
}

function isMissingTableError(error: { code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205';
}

/** Consulta ítems de cita omitiendo columnas que no existan en el esquema legacy. */
export async function queryAppointmentItemsByAppointmentIds(
  appointmentIds: string[],
  opts?: { order?: boolean },
): Promise<Array<Record<string, unknown>>> {
  if (!appointmentIds.length) return [];

  let enabled = [...DEFAULT_ITEM_COLUMNS];
  const withOrder = opts?.order !== false;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let q = supabase
      .from('appointment_items')
      .select(enabled.join(','))
      .in('appointment_id', appointmentIds);

    if (withOrder && enabled.includes('sort_order')) {
      q = q.order('sort_order', { ascending: true });
    }

    const res = await q;

    if (!res.error) {
      return (res.data || []) as Array<Record<string, unknown>>;
    }

    if (isMissingTableError(res.error)) return [];

    const missing = extractMissingAppointmentItemsColumn(res.error);
    if (missing && enabled.includes(missing)) {
      enabled = enabled.filter((c) => c !== missing);
      continue;
    }

    if (withOrder && String(res.error.message || '').toLowerCase().includes('sort_order')) {
      return queryAppointmentItemsByAppointmentIds(appointmentIds, { order: false });
    }

    console.warn('appointment_items:', res.error.message);
    return [];
  }

  return [];
}

export async function queryAppointmentItemsInChunks(
  appointmentIds: string[],
  chunkSize = 80,
): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  for (let i = 0; i < appointmentIds.length; i += chunkSize) {
    const chunk = appointmentIds.slice(i, i + chunkSize);
    const rows = await queryAppointmentItemsByAppointmentIds(chunk);
    all.push(...rows);
  }
  return all;
}
