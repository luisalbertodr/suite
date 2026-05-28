import { supabase } from '@/lib/supabase';
import type { AppointmentItemDraft } from '@/types/agenda';
import { appointmentItemLineTotal } from '@/lib/agendaAppointmentPricing';

export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled';

export type AgendaSaleNotes = {
  source: 'agenda_appointment';
  appointment_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  appointment_date?: string | null;
  appointment_status?: AppointmentStatus | null;
  items?: Array<{
    name: string;
    total: number;
    source_kind?: string | null;
    source_bonus_mode?: string | null;
  }>;
};

export type AppointmentSaleInfo = {
  id: string;
  ticket_number: string;
  total_amount: number;
  status: string | null;
  created_at: string;
  customer_id: string | null;
  appointment_id: string | null;
  invoice_id: string | null;
  notes: string | null;
  company_id?: string | null;
  sale_group_id?: string | null;
};

export type AppointmentChargeState = {
  sales: AppointmentSaleInfo[];
  completedTotal: number;
  allCompleted: boolean;
  anyInvoiced: boolean;
  allInvoiced: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return UUID_RE.test(String(value || '').trim());
}

export function parseAgendaSaleNotes(notes: string | null | undefined): Partial<AgendaSaleNotes> | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as Partial<AgendaSaleNotes>;
    if (parsed?.source === 'agenda_appointment' && parsed.appointment_id) return parsed;
    if (parsed?.appointment_id) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function buildAgendaSaleNotes(payload: AgendaSaleNotes): string {
  return JSON.stringify(payload);
}

export function appointmentChargeableTotal(items: AppointmentItemDraft[]): number {
  return items.reduce((sum, it) => sum + appointmentItemLineTotal(it), 0);
}

export function summarizeAppointmentChargeState(
  sales: AppointmentSaleInfo[],
  chargeableTotal: number,
): AppointmentChargeState {
  const completed = sales.filter((s) => s.status === 'completed');
  const completedTotal = completed.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const anyInvoiced = completed.some((s) => !!s.invoice_id);
  const allInvoiced = completed.length > 0 && completed.every((s) => !!s.invoice_id);
  const allCompleted =
    chargeableTotal <= 0
      ? completed.length > 0
      : completedTotal >= chargeableTotal - 0.01;
  return {
    sales: completed,
    completedTotal,
    allCompleted,
    anyInvoiced,
    allInvoiced,
  };
}

export function canChargeAppointment(opts: {
  status: AppointmentStatus;
  chargeableTotal: number;
  existingSale?: AppointmentSaleInfo | null | undefined;
  existingSales?: AppointmentSaleInfo[];
}): { allowed: boolean; reason?: string; partial?: boolean } {
  if (opts.status === 'cancelled') {
    return { allowed: false, reason: 'La cita está cancelada' };
  }

  const sales =
    opts.existingSales ??
    (opts.existingSale ? [opts.existingSale] : []);
  const chargeState = summarizeAppointmentChargeState(sales, opts.chargeableTotal);

  if (chargeState.allCompleted) {
    return { allowed: false, reason: 'Esta cita ya está cobrada por completo' };
  }
  if (opts.chargeableTotal <= 0 && sales.length === 0) {
    return { allowed: false, reason: 'No hay importe pendiente de cobro (bonos/servicios a 0 €)' };
  }
  if (opts.chargeableTotal <= 0 && chargeState.completedTotal <= 0) {
    return { allowed: false, reason: 'No hay importe pendiente de cobro (bonos/servicios a 0 €)' };
  }
  if (chargeState.completedTotal > 0 && !chargeState.allCompleted) {
    return { allowed: true, partial: true };
  }
  return { allowed: true };
}

export function isSchemaColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200') return true;
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('relationship') && msg.includes('schema cache')) return true;
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
}

/** Prod (lipoout): suele tener appointment_id/notes pero no customer_id. */
const SALES_APPOINTMENT_SELECT_VARIANTS = [
  'id,ticket_number,total_amount,status,created_at,appointment_id,invoice_id,notes,company_id,sale_group_id',
  'id,ticket_number,total_amount,status,created_at,appointment_id,invoice_id,notes,company_id',
  'id,ticket_number,total_amount,status,created_at,appointment_id,invoice_id,notes',
  'id,ticket_number,total_amount,status,created_at,appointment_id,notes',
  'id,ticket_number,total_amount,status,created_at,appointment_id',
  'id,ticket_number,total_amount,status,created_at,customer_id,appointment_id,invoice_id,notes,company_id,sale_group_id',
  'id,ticket_number,total_amount,status,created_at,customer_id,appointment_id,notes',
] as const;

const SALES_SCAN_SELECT_VARIANTS = [
  'id,ticket_number,total_amount,status,created_at,appointment_id,invoice_id,notes',
  'id,ticket_number,total_amount,status,created_at,appointment_id,notes',
  'id,ticket_number,total_amount,status,created_at,notes',
  'id,ticket_number,total_amount,status,created_at,customer_name',
  'id,ticket_number,total_amount,status,created_at,customer_id,notes',
  'id,ticket_number,total_amount,status,created_at,customer_id',
  'id,ticket_number,total_amount,status,created_at',
] as const;

async function querySalesWithColumnFallback(
  variants: readonly string[],
  buildQuery: (select: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
) {
  for (const select of variants) {
    const res = await buildQuery(select);
    if (!res.error) return res;
    if (!isSchemaColumnError(res.error)) return res;
  }
  return { data: [] as Record<string, unknown>[], error: null };
}

export async function fetchAppointmentSales(
  appointmentId: string,
): Promise<AppointmentSaleInfo[]> {
  if (!appointmentId || appointmentId.startsWith('draft-')) return [];

  for (const select of SALES_APPOINTMENT_SELECT_VARIANTS) {
    const res = await supabase
      .from('sales')
      .select(select)
      .eq('appointment_id', appointmentId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (!res.error) return (res.data || []).map(mapSaleRow);
    if (!isSchemaColumnError(res.error)) throw res.error;
  }

  const res = await querySalesWithColumnFallback(SALES_SCAN_SELECT_VARIANTS, (select) =>
    supabase
      .from('sales')
      .select(select)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(500),
  );
  if (res.error) throw res.error;
  return (res.data || [])
    .filter(
      (s) =>
        parseAgendaSaleNotes((s as { notes?: string | null }).notes)?.appointment_id ===
        appointmentId,
    )
    .map(mapSaleRow);
}

export async function fetchAppointmentSale(
  appointmentId: string,
): Promise<AppointmentSaleInfo | null> {
  const sales = await fetchAppointmentSales(appointmentId);
  return sales[0] ?? null;
}

export async function fetchAppointmentSalesMap(
  appointmentIds: string[],
): Promise<Map<string, AppointmentSaleInfo[]>> {
  const map = new Map<string, AppointmentSaleInfo[]>();
  if (!appointmentIds.length) return map;

  const ids = appointmentIds.filter((id) => id && !id.startsWith('draft-'));
  if (!ids.length) return map;

  const pushSale = (aptId: string, row: unknown) => {
    const key = String(aptId);
    const list = map.get(key) ?? [];
    list.push(mapSaleRow(row));
    map.set(key, list);
  };

  for (const select of SALES_APPOINTMENT_SELECT_VARIANTS) {
    const res = await supabase
      .from('sales')
      .select(select)
      .in('appointment_id', ids)
      .neq('status', 'cancelled');
    if (!res.error) {
      for (const row of res.data || []) {
        const aptId =
          (row as { appointment_id?: string | null }).appointment_id ??
          parseAgendaSaleNotes((row as { notes?: string | null }).notes)?.appointment_id;
        if (aptId) pushSale(String(aptId), row);
      }
      return map;
    }
    if (!isSchemaColumnError(res.error)) throw res.error;
  }

  const res = await querySalesWithColumnFallback(SALES_SCAN_SELECT_VARIANTS, (select) =>
    supabase
      .from('sales')
      .select(select)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(8000),
  );
  if (res.error) throw res.error;
  for (const row of res.data || []) {
    const aptId = parseAgendaSaleNotes((row as { notes?: string | null }).notes)?.appointment_id;
    if (aptId && ids.includes(String(aptId))) {
      pushSale(String(aptId), row);
    }
  }
  return map;
}

function mapSaleRow(row: any): AppointmentSaleInfo {
  return {
    id: String(row.id),
    ticket_number: String(row.ticket_number || ''),
    total_amount: Number(row.total_amount ?? 0),
    status: row.status ?? null,
    created_at: String(row.created_at || ''),
    customer_id: row.customer_id ? String(row.customer_id) : null,
    appointment_id: row.appointment_id ? String(row.appointment_id) : null,
    invoice_id: row.invoice_id ? String(row.invoice_id) : null,
    notes: row.notes ?? null,
    company_id: row.company_id ? String(row.company_id) : null,
    sale_group_id: row.sale_group_id ? String(row.sale_group_id) : null,
  };
}

export async function persistSaleAppointmentLink(
  saleId: string,
  ctx: {
    appointmentId: string;
    customerId?: string | null;
    appointmentStatus?: AppointmentStatus | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    appointment_id: ctx.appointmentId,
    customer_id: ctx.customerId ?? null,
  };

  let res = await supabase.from('sales').update(patch).eq('id', saleId);
  if (res.error && isSchemaColumnError(res.error)) {
    return;
  }
  if (res.error) throw res.error;

  if (ctx.appointmentStatus === 'pending') {
    await supabase
      .from('agenda_appointments')
      .update({ status: 'confirmed' })
      .eq('id', ctx.appointmentId)
      .eq('status', 'pending');
  }
}

export function buildInvoicePrefillFromSale(
  sale: AppointmentSaleInfo,
  saleItems: Array<{ description: string; quantity: number; unit_price: number; total_price: number }>,
  customerId: string | null,
  appointmentId?: string | null,
) {
  const parsed = parseAgendaSaleNotes(sale.notes);
  return {
    source: 'tpv_sale' as const,
    sale_id: sale.id,
    appointment_id: appointmentId ?? parsed?.appointment_id ?? sale.appointment_id ?? null,
    customer_id: customerId ?? sale.customer_id ?? parsed?.customer_id ?? '',
    notes: `Factura del ticket ${sale.ticket_number}${appointmentId ? ` · Cita ${appointmentId.slice(0, 8)}` : ''}`,
    items: saleItems.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      total_price: Number(it.total_price ?? 0),
    })),
  };
}

export const TPV_SALE_INVOICE_PREFILL_KEY = 'tpv_sale_invoice_prefill';
