import { supabase } from '@/lib/supabase';
import { repairStyleText, normalizeAgendaAppointmentTextRow } from '@/lib/styleTextEncoding';

export interface AgendaAppointmentDayRow {
  id: string;
  employee_id: string | null;
  customer_id: string | null;
  title?: string;
  description: string | null;
  start_time: string;
  end_time: string;
  color: string | null;
  status: string;
  company_id: string;
  created_at?: string;
  updated_at: string;
  legacy_planinc_id?: number | null;
  legacy_idplan?: string | null;
  client_name?: string | null;
  appointment_date?: string | null;
  legacy_codemp?: string | null;
  legacy_codcli?: string | null;
}

/** Citas recientes usan start_time; el modo legacy solo aplica a fechas antiguas. */
const LEGACY_APPOINTMENT_CUTOFF_YMD = '2024-01-01';

export const AGENDA_APPOINTMENT_DAY_SELECT =
  'id,employee_id,customer_id,client_name,description,start_time,end_time,color,status,appointment_date,legacy_codemp,legacy_codcli,legacy_planinc_id,legacy_idplan,updated_at,company_id';

function nextCalendarDay(ymd: string): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function dedupeByLegacyIdPlan<T extends AgendaAppointmentDayRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const p = r.legacy_idplan != null ? String(r.legacy_idplan).trim() : '';
    if (!p) continue;
    const cur = best.get(p);
    if (!cur) {
      best.set(p, r);
      continue;
    }
    const tNew = new Date(r.updated_at || 0).getTime();
    const tOld = new Date(cur.updated_at || 0).getTime();
    if (tNew >= tOld) best.set(p, r);
  }
  return rows.filter((r) => {
    const p = r.legacy_idplan != null ? String(r.legacy_idplan).trim() : '';
    if (!p) return true;
    return best.get(p)?.id === r.id;
  });
}

function dedupeByLegacyPlanincId<T extends AgendaAppointmentDayRow>(rows: T[]): T[] {
  const best = new Map<number, T>();
  for (const r of rows) {
    const lid = r.legacy_planinc_id;
    if (lid == null || lid === undefined) continue;
    const n = typeof lid === 'number' ? lid : Number(lid);
    if (!Number.isFinite(n)) continue;
    const cur = best.get(n);
    if (!cur) {
      best.set(n, r);
      continue;
    }
    const tNew = new Date(r.updated_at || 0).getTime();
    const tOld = new Date(cur.updated_at || 0).getTime();
    if (tNew >= tOld) best.set(n, r);
  }
  return rows.filter((r) => {
    const lid = r.legacy_planinc_id;
    if (lid == null || lid === undefined) return true;
    const n = typeof lid === 'number' ? lid : Number(lid);
    if (!Number.isFinite(n)) return true;
    return best.get(n)?.id === r.id;
  });
}

function mergeAppointmentRows(legacyRows: AgendaAppointmentDayRow[], modernRows: AgendaAppointmentDayRow[]) {
  const mergedById = new Map<string, AgendaAppointmentDayRow>();
  for (const row of [...legacyRows, ...modernRows]) {
    if (row?.id) mergedById.set(row.id, row);
  }
  const merged = mergedById.size > 0 ? Array.from(mergedById.values()) : modernRows;
  return dedupeByLegacyPlanincId(dedupeByLegacyIdPlan(merged));
}

function normalizeFetchedRows<T extends AgendaAppointmentDayRow>(rows: T[]): T[] {
  return rows.map((row) => normalizeAgendaAppointmentTextRow(row));
}

async function fetchLegacyDayRows(
  scopeCompanyId: string,
  date: string,
): Promise<AgendaAppointmentDayRow[]> {
  const legacyResult = await supabase
    .from('agenda_appointments')
    .select(AGENDA_APPOINTMENT_DAY_SELECT)
    .eq('company_id', scopeCompanyId)
    .eq('appointment_date', date)
    .order('start_time');

  if (!legacyResult.error) {
    return normalizeFetchedRows((legacyResult.data || []) as AgendaAppointmentDayRow[]);
  }
  if (legacyResult.error.code === '42703') return [];
  throw legacyResult.error;
}

async function fetchModernDayRows(
  scopeCompanyId: string,
  date?: string,
): Promise<AgendaAppointmentDayRow[]> {
  let modernQuery = supabase
    .from('agenda_appointments')
    .select(AGENDA_APPOINTMENT_DAY_SELECT)
    .eq('company_id', scopeCompanyId)
    .order('start_time');

  if (date) {
    modernQuery = modernQuery.eq('appointment_date', date);
  }

  const modernResult = await modernQuery;
  if (modernResult.error) throw modernResult.error;
  return normalizeFetchedRows((modernResult.data || []) as AgendaAppointmentDayRow[]);
}

/** Citas de un día (o todas si date omitido). Optimizado: 1 consulta en fechas recientes. */
export async function fetchAgendaAppointmentsForDay(
  scopeCompanyId: string,
  date?: string,
): Promise<AgendaAppointmentDayRow[]> {
  if (!scopeCompanyId) return [];

  if (!date) {
    return mergeAppointmentRows([], await fetchModernDayRows(scopeCompanyId));
  }

  if (date >= LEGACY_APPOINTMENT_CUTOFF_YMD) {
    const modernRows = await fetchModernDayRows(scopeCompanyId, date);
    if (modernRows.length > 0) {
      return mergeAppointmentRows([], modernRows);
    }
    const legacyRows = await fetchLegacyDayRows(scopeCompanyId, date);
    return mergeAppointmentRows(legacyRows, modernRows);
  }

  const [legacyRows, modernRows] = await Promise.all([
    fetchLegacyDayRows(scopeCompanyId, date),
    fetchModernDayRows(scopeCompanyId, date),
  ]);
  return mergeAppointmentRows(legacyRows, modernRows);
}
