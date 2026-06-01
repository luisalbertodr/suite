/** Columnas que no existen en agenda legacy (Dunasoft) o son de solo lectura en PATCH. */
const AGENDA_WRITE_STRIP_KEYS = new Set([
  'title',
  'id',
  'company_id',
  'created_at',
  'updated_at',
  'legacy_planinc_id',
  'legacy_idplan',
  'legacy_codemp',
  'legacy_codcli',
]);

const toHhMm = (value: unknown): string => {
  const s = String(value ?? '').trim();
  if (!s) return s;
  if (s.includes('T')) {
    const part = s.split('T')[1] || '';
    return part.slice(0, 5);
  }
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return s.slice(0, 5);
};

const ymdFromValue = (value: unknown): string | null => {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (s.includes('T')) {
    const ymd = s.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/**
 * Normaliza payload de escritura para agenda_appointments legacy:
 * - Sin `title` (solo `client_name`)
 * - start_time/end_time en HH:mm si venían en ISO
 * - appointment_date cuando aplica
 */
export function sanitizeAgendaAppointmentWritePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (AGENDA_WRITE_STRIP_KEYS.has(key)) continue;
    out[key] = value;
  }

  const titleFallback = String(payload.title ?? '').trim();
  const clientName = String(out.client_name ?? titleFallback).trim();
  if (clientName) out.client_name = clientName;

  const startRaw = payload.start_time ?? out.start_time;
  const endRaw = payload.end_time ?? out.end_time;
  const dateFromPayload = ymdFromValue(payload.appointment_date ?? out.appointment_date);
  const dateFromStart = ymdFromValue(startRaw);

  if (startRaw != null && String(startRaw).includes('T')) {
    out.start_time = toHhMm(startRaw);
    if (endRaw != null) out.end_time = toHhMm(endRaw);
    const ymd = dateFromStart || dateFromPayload;
    if (ymd) out.appointment_date = ymd;
  }

  return out;
}

export function parseMissingTableColumn(
  error: { code?: string; message?: string } | null | undefined,
  table: string
): string | null {
  if (!error) return null;
  const msg = String(error.message || '');
  const quoted = msg.match(new RegExp(`'([^']+)' column of '${table}'`, 'i'));
  if (quoted?.[1]) return quoted[1];
  const dotted = msg.match(new RegExp(`column\\s+${table}\\.([a-zA-Z0-9_]+)`, 'i'));
  return dotted?.[1] ?? null;
}
