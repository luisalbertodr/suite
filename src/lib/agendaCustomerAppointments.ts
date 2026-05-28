import { supabase } from '@/lib/supabase';
import {
  appointmentDisplayTitle,
  appointmentTimeRange,
  appointmentYmd,
  parseDescriptionServiceLines,
} from '@/lib/agendaAppointmentDisplay';
import { queryAppointmentItemsInChunks } from '@/lib/appointmentItemsSelect';
export type CustomerAppointmentItem = {
  label: string;
  kind?: string | null;
  duration_minutes?: number | null;
  quantity?: number | null;
};

export type CustomerAppointmentRow = {
  id: string;
  customer_id?: string | null;
  title: string;
  description?: string | null;
  appointment_date?: string | null;
  start_time: string;
  end_time?: string | null;
  status?: string | null;
  legacy_codcli?: string | null;
  legacy_codemp?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  items: CustomerAppointmentItem[];
  service_lines: string[];
  time_range: string;
  ymd: string | null;
};

function normalizeLegacyCode(code: string): string {
  const c = code.trim();
  return c.replace(/^0+/, '') || c;
}

async function loadEmployeeNameMaps(companyId: string): Promise<{
  byId: Map<string, string>;
  byLegacyCode: Map<string, string>;
}> {
  const byId = new Map<string, string>();
  const byLegacyCode = new Map<string, string>();

  let res = await supabase
    .from('agenda_employees')
    .select('id, name, dunasoft_codemp')
    .eq('company_id', companyId);

  if (res.error && isSchemaColumnError(res.error)) {
    res = await supabase.from('agenda_employees').select('id, name').eq('company_id', companyId);
  }

  if (res.error) {
    console.warn('agenda_employees:', res.error.message);
    return { byId, byLegacyCode };
  }

  for (const row of res.data || []) {
    const name = String(row.name ?? '').trim();
    if (!name) continue;
    byId.set(String(row.id), name);
    const code = String((row as { dunasoft_codemp?: string | null }).dunasoft_codemp ?? '').trim();
    if (code) {
      byLegacyCode.set(code, name);
      byLegacyCode.set(normalizeLegacyCode(code), name);
    }
  }

  return { byId, byLegacyCode };
}

function resolveEmployeeName(
  row: Record<string, unknown>,
  maps: { byId: Map<string, string>; byLegacyCode: Map<string, string> },
): string | undefined {
  const employeeId = String(row.employee_id ?? '').trim();
  if (employeeId) {
    const byUuid = maps.byId.get(employeeId);
    if (byUuid) return byUuid;
    const fromIdAsCode =
      maps.byLegacyCode.get(employeeId) ?? maps.byLegacyCode.get(normalizeLegacyCode(employeeId));
    if (fromIdAsCode) return fromIdAsCode;
  }

  const legacy = String(row.legacy_codemp ?? '').trim();
  if (legacy) {
    const resolved =
      maps.byLegacyCode.get(legacy) ?? maps.byLegacyCode.get(normalizeLegacyCode(legacy));
    if (resolved) return resolved;
  }

  return undefined;
}

function normalizeRow(
  row: Record<string, unknown>,
  fallbackCustomerId: string,
  items: CustomerAppointmentItem[],
  employeeMaps: { byId: Map<string, string>; byLegacyCode: Map<string, string> },
): CustomerAppointmentRow {
  const description = (row.description as string | null | undefined) ?? null;
  const appointment_date = (row.appointment_date as string | null | undefined) ?? null;
  const start_time = String(row.start_time ?? '');
  const end_time = (row.end_time as string | null | undefined) ?? null;
  const itemLabels = items.map((i) => i.label);
  const ymd = appointmentYmd({ appointment_date, start_time });

  return {
    id: String(row.id),
    customer_id: (row.customer_id as string | null | undefined) ?? fallbackCustomerId,
    title: appointmentDisplayTitle(description, itemLabels) || String(row.client_name ?? row.title ?? 'Cita'),
    description,
    appointment_date,
    start_time,
    end_time,
    status: (row.status as string | null | undefined) ?? null,
    legacy_codcli: (row.legacy_codcli as string | null | undefined) ?? null,
    legacy_codemp: (row.legacy_codemp as string | null | undefined) ?? null,
    employee_id: (row.employee_id as string | null | undefined) ?? null,
    employee_name: resolveEmployeeName(row, employeeMaps),
    items,
    service_lines: itemLabels.length ? itemLabels : parseDescriptionServiceLines(description),
    time_range: appointmentTimeRange(start_time, end_time),
    ymd,
  };
}

function isSchemaColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200') return true;
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('relationship') && msg.includes('schema cache')) return true;
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
}

async function loadItemsByAppointment(ids: string[]): Promise<Map<string, CustomerAppointmentItem[]>> {
  const map = new Map<string, CustomerAppointmentItem[]>();
  if (!ids.length) return map;

  const rows = await queryAppointmentItemsInChunks(ids);
  for (const row of rows) {
    const apptId = String(row.appointment_id);
    const list = map.get(apptId) ?? [];
    list.push({
      label: String(row.label ?? '').trim() || 'Servicio',
      kind: row.kind as string | null | undefined,
      duration_minutes: row.duration_minutes as number | null | undefined,
      quantity: row.quantity as number | null | undefined,
    });
    map.set(apptId, list);
  }
  return map;
}

/** Citas del cliente con ítems; compatible esquema legacy (client_name, appointment_date). */
export async function fetchAppointmentsForCustomer(
  customerId: string,
): Promise<CustomerAppointmentRow[]> {
  const { data: customer } = await supabase
    .from('customers')
    .select('legacy_codcli, name, company_id')
    .eq('id', customerId)
    .maybeSingle();

  const legacyCod = String(customer?.legacy_codcli ?? '').trim();
  const customerName = String(customer?.name ?? '').trim();
  const companyId = String(customer?.company_id ?? '').trim();
  const employeeMaps = companyId
    ? await loadEmployeeNameMaps(companyId)
    : { byId: new Map<string, string>(), byLegacyCode: new Map<string, string>() };

  const baseSelect =
    'id, customer_id, client_name, description, appointment_date, start_time, end_time, status, legacy_codcli, legacy_codemp, employee_id';

  const attempts: Array<{
    applyFilter: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>;
  }> = [];

  if (customerId) {
    attempts.push({ applyFilter: (q) => q.eq('customer_id', customerId) });
  }
  if (legacyCod) {
    attempts.push({ applyFilter: (q) => q.eq('legacy_codcli', legacyCod) });
  }
  if (customerName) {
    attempts.push({ applyFilter: (q) => q.eq('client_name', customerName) });
  }

  let rows: Record<string, unknown>[] = [];

  for (const attempt of attempts) {
    let res = await attempt
      .applyFilter(supabase.from('agenda_appointments').select(baseSelect))
      .order('appointment_date', { ascending: false, nullsFirst: false })
      .order('start_time', { ascending: false });
    if (res.error && isSchemaColumnError(res.error)) {
      res = await attempt
        .applyFilter(supabase.from('agenda_appointments').select(baseSelect))
        .order('start_time', { ascending: false });
    }

    if (!res.error) {
      const seen = new Set<string>();
      rows = ((res.data || []) as Record<string, unknown>[]).filter((row) => {
        const id = String(row.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      break;
    }

    console.warn('fetchAppointmentsForCustomer:', res.error.message);
  }

  if (!rows.length) return [];

  const itemsByAppt = await loadItemsByAppointment(rows.map((r) => String(r.id)));
  return rows.map((row) =>
    normalizeRow(row, customerId, itemsByAppt.get(String(row.id)) ?? [], employeeMaps),
  );
}
