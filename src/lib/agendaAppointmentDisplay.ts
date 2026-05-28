/** Utilidades de presentación para citas legacy (appointment_date + HH:mm). */

export function normalizeHm(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (s.includes('T')) {
    const part = s.split('T')[1]?.slice(0, 5);
    return part && /^\d{2}:\d{2}$/.test(part) ? part : null;
  }
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function appointmentYmd(row: {
  appointment_date?: string | null;
  start_time?: string | null;
}): string | null {
  const rawDate = row.appointment_date;
  if (rawDate) {
    const s = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  const st = String(row.start_time ?? '');
  if (st.includes('T')) {
    const ymd = st.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  }
  return null;
}

export function appointmentTimeRange(
  startTime: string | null | undefined,
  endTime?: string | null,
): string {
  const a = normalizeHm(startTime);
  const b = normalizeHm(endTime);
  if (a && b) return `${a} – ${b}`;
  return a || b || '';
}

/** Título legible desde descripción Dunasoft o ítems. */
export function appointmentDisplayTitle(
  description?: string | null,
  itemLabels?: string[],
): string {
  const desc = String(description ?? '').trim();
  if (desc && desc.toLowerCase() !== 'cita importada') {
    const firstLine = desc.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (firstLine) {
      const cleaned = firstLine
        .replace(/^\[\d{1,2}:\d{2}(?:\s*-\s*\d+)?\]\s*/i, '')
        .replace(/^\d+\s*[-–]\s*/, '')
        .trim();
      const title = cleaned || firstLine;
      return title.length > 90 ? `${title.slice(0, 87)}…` : title;
    }
  }
  const fromItem = (itemLabels ?? []).map((l) => l.trim()).find(Boolean);
  if (fromItem) {
    return fromItem.length > 90 ? `${fromItem.slice(0, 87)}…` : fromItem;
  }
  return desc || 'Cita';
}

export function parseDescriptionServiceLines(description?: string | null): string[] {
  const desc = String(description ?? '').trim();
  if (!desc) return [];
  return desc
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^\[\d{1,2}:\d{2}(?:\s*-\s*\d+)?\]\s*/i, '')
        .replace(/^\d+\s*[-–]\s*/, '')
        .trim() || line,
    );
}

export function legacyEmployeeLabel(code?: string | null, name?: string | null): string | undefined {
  const n = String(name ?? '').trim();
  if (n) return n;
  const c = String(code ?? '').trim();
  if (!c) return undefined;
  const num = c.replace(/^0+/, '') || c;
  return `Empleado ${num}`;
}

export function appointmentStatusLabel(status?: string | null): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmada';
    case 'pending':
      return 'Pendiente';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status ? String(status) : '—';
  }
}
