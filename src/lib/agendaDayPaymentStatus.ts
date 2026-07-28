import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import { fetchAppointmentSalesMap } from '@/lib/appointmentSales';
import type { Appointment } from '@/types/agenda';

type DayPaymentRow = {
  id: string;
  legacy_idplan?: string | null;
  status?: string | null;
};

/**
 * Citas cobradas en Style (plan2009.facturado) enlazadas por legacy_idplan.
 * Lectura solo; no escribe ni altera el dual-sync.
 */
async function fetchFacturadoAppointmentIds(
  rows: DayPaymentRow[],
  dateYmd: string,
): Promise<Set<string>> {
  const chargedIds = new Set<string>();
  const idplanToAppointmentId = new Map<string, string>();

  for (const row of rows) {
    const idplan = row.legacy_idplan != null ? String(row.legacy_idplan).trim() : '';
    if (idplan) idplanToAppointmentId.set(idplan, row.id);
  }
  if (idplanToAppointmentId.size === 0) return chargedIds;

  const idplans = [...idplanToAppointmentId.keys()]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (idplans.length === 0) return chargedIds;

  const chunkSize = 150;
  for (let i = 0; i < idplans.length; i += chunkSize) {
    const chunk = idplans.slice(i, i + chunkSize);
    // Schema tipado de plan2009 puede estar incompleto en el cliente; lectura defensiva.
    const { data, error } = await (dunasoftSupabase as any)
      .from('plan2009')
      .select('idplan')
      .eq('fecha', dateYmd)
      .eq('facturado', true)
      .in('idplan', chunk);
    if (error) {
      console.warn('fetchFacturadoAppointmentIds:', error);
      break;
    }
    for (const planRow of (data ?? []) as Array<{ idplan?: unknown }>) {
      const aptId = idplanToAppointmentId.get(String(planRow.idplan));
      if (aptId) chargedIds.add(aptId);
    }
  }

  return chargedIds;
}

/**
 * Estado de cobro del día para bloquear arrastre/edición en la grilla.
 * Combina tickets TPV Suite + flag facturado Style; no bloquea el pintado inicial.
 */
export async function fetchAgendaDayPaymentStatusMap(
  rows: DayPaymentRow[],
  dateYmd: string,
): Promise<Map<string, NonNullable<Appointment['paymentStatus']>>> {
  const result = new Map<string, NonNullable<Appointment['paymentStatus']>>();
  if (!rows.length || !dateYmd) return result;

  const [facturadoIds, salesMap] = await Promise.all([
    fetchFacturadoAppointmentIds(rows, dateYmd),
    fetchAppointmentSalesMap(rows.map((r) => r.id)),
  ]);

  for (const row of rows) {
    if (row.status === 'cancelled') {
      result.set(row.id, 'none');
      continue;
    }
    const sales = salesMap.get(row.id) ?? [];
    const completed = sales.filter((s) => s.status === 'completed');
    if (completed.some((s) => !!s.invoice_id)) {
      result.set(row.id, 'invoiced');
      continue;
    }
    if (completed.length > 0 || facturadoIds.has(row.id)) {
      result.set(row.id, 'paid');
      continue;
    }
    result.set(row.id, 'none');
  }

  return result;
}
