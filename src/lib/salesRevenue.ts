import { supabase } from '@/lib/supabase';
import { isSchemaColumnError } from '@/lib/appointmentSales';

export type RevenueBreakdown = {
  invoices: number;
  salesWithoutInvoice: number;
  total: number;
};

type InvoiceRow = {
  id: string;
  issue_date?: string | null;
  total_amount?: number | null;
  status?: string | null;
  notes?: string | null;
};

type SaleRow = {
  total_amount?: number | null;
  created_at?: string | null;
  ticket_number?: string | null;
  notes?: string | null;
};

/** Ventas TPV legacy sin factura que duplican totfac ya importado desde faccab. */
export function isLegacyOrphanSaleForRevenue(row: {
  ticket_number?: string | null;
  notes?: string | null;
}): boolean {
  const ticket = String(row.ticket_number ?? '').trim();
  if (ticket.startsWith('LEG-') || /^FAC-\d/i.test(ticket)) return true;
  const notes = String(row.notes ?? '');
  if (notes.includes('legacy_revenue') || notes.includes('Legacy FACCAB')) return true;
  if (/legacy/i.test(notes) && notes.includes('appointment_id')) return true;
  return false;
}

const PAGE = 1000;

function invoiceCountsAsBilling(row: { status?: string | null; notes?: string | null }): boolean {
  const status = String(row.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'anulada'].includes(status)) return false;
  // Huérfanas legacy (sin ticket) se eliminan en reset; evitar escanear todas las ventas.
  return true;
}

function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function localDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Clave yyyy-mm desde issue_date (YYYY-MM-DD) o timestamp ISO. */
export function monthKey(value: string): string {
  if (value.length >= 7 && value[4] === '-') return value.slice(0, 7);
  return localMonthKey(new Date(value));
}

async function fetchAllPages<T>(
  build: (from: number, to: number) => ReturnType<typeof supabase.from>,
  selectFallback?: () => ReturnType<typeof supabase.from>,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;

  while (true) {
    let res = await build(offset, offset + PAGE - 1);
    if (res.error && selectFallback) {
      res = await selectFallback();
      if (!res.error && res.data) {
        return res.data as T[];
      }
    }
    if (res.error) throw res.error;

    const rows = (res.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}

async function loadInvoices(companyId: string, fromDate: string, toDate: string): Promise<InvoiceRow[]> {
  return fetchAllPages<InvoiceRow>(
    (from, to) =>
      supabase
        .from('invoices')
        .select('id, issue_date, total_amount, status, notes')
        .eq('company_id', companyId)
        .gte('issue_date', fromDate)
        .lte('issue_date', toDate)
        .order('issue_date')
        .range(from, to),
    () =>
      supabase
        .from('invoices')
        .select('id, issue_date, total_amount, status')
        .eq('company_id', companyId)
        .gte('issue_date', fromDate)
        .lte('issue_date', toDate),
  );
}

async function loadSalesWithoutInvoice(
  companyId: string,
  fromIso: string,
  toIso: string,
): Promise<SaleRow[]> {
  try {
    const rows = await fetchAllPages<SaleRow>((from, to) =>
      supabase
        .from('sales')
        .select('total_amount, created_at, ticket_number, notes')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .is('invoice_id', null)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at')
        .range(from, to),
    );
    return rows.filter((row) => !isLegacyOrphanSaleForRevenue(row));
  } catch (err) {
    if (!isSchemaColumnError(err as { code?: string; message?: string })) throw err;
    return [];
  }
}

function sumInvoices(rows: InvoiceRow[]): number {
  return rows.reduce((sum, inv) => {
    if (!invoiceCountsAsBilling(inv)) return sum;
    return sum + Number(inv.total_amount ?? 0);
  }, 0);
}

function sumSales(rows: SaleRow[]): number {
  return rows.reduce((s, row) => s + Number(row.total_amount ?? 0), 0);
}

/** Facturación alineada con Dunasoft (totfac / devengo): solo facturas emitidas. */
function billingTotalFromInvoices(invoiceTotal: number): number {
  return invoiceTotal;
}

function bucketInvoices(rows: InvoiceRow[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const inv of rows) {
    if (!invoiceCountsAsBilling(inv) || !inv.issue_date) continue;
    const key = monthKey(inv.issue_date);
    buckets.set(key, (buckets.get(key) ?? 0) + Number(inv.total_amount ?? 0));
  }
  return buckets;
}

function bucketSales(rows: SaleRow[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const created = row.created_at;
    if (!created) continue;
    const key = monthKey(created);
    buckets.set(key, (buckets.get(key) ?? 0) + Number(row.total_amount ?? 0));
  }
  return buckets;
}

export type DashboardBilling = {
  currentMonth: RevenueBreakdown;
  series: Array<{ monthStart: Date; monthEnd: Date; total: number }>;
};

/** Una sola carga para tarjeta + gráfico del dashboard (evita N consultas repetidas). */
export async function fetchDashboardBilling(
  companyId: string,
  monthsBack: number,
): Promise<DashboardBilling> {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoices, salesNoInv] = await Promise.all([
    loadInvoices(companyId, localDateOnly(rangeStart), localDateOnly(rangeEnd)),
    loadSalesWithoutInvoice(companyId, rangeStart.toISOString(), rangeEnd.toISOString()),
  ]);

  const invBuckets = bucketInvoices(invoices);
  const saleBuckets = bucketSales(salesNoInv);

  const series: DashboardBilling['series'] = [];
  for (let i = monthsBack; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const key = localMonthKey(monthStart);
    const total = invBuckets.get(key) ?? 0;
    series.push({ monthStart, monthEnd, total });
  }

  const cmKey = localMonthKey(currentMonthStart);
  const currentInvoices = invoices.filter(
    (inv) => inv.issue_date && monthKey(inv.issue_date) === cmKey,
  );
  const currentSales = salesNoInv.filter(
    (s) => s.created_at && monthKey(s.created_at) === cmKey,
  );

  const invTotal = sumInvoices(currentInvoices);
  const salesTotal = sumSales(currentSales);

  return {
    currentMonth: {
      invoices: invTotal,
      salesWithoutInvoice: salesTotal,
      total: billingTotalFromInvoices(invTotal),
    },
    series,
  };
}

/** Facturación de un periodo concreto. */
export async function fetchPeriodRevenue(
  companyId: string,
  fromIso: string,
  toIso: string,
): Promise<RevenueBreakdown> {
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const [invoices, salesNoInv] = await Promise.all([
    loadInvoices(companyId, fromDate, toDate),
    loadSalesWithoutInvoice(companyId, fromIso, toIso),
  ]);

  const invTotal = sumInvoices(invoices);
  const salesTotal = sumSales(salesNoInv);

  return {
    invoices: invTotal,
    salesWithoutInvoice: salesTotal,
    total: billingTotalFromInvoices(invTotal),
  };
}

type SaleRevenueRow = {
  total_amount: number | null;
  created_at: string;
  invoice_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  ticket_number?: string | null;
};

/** Tickets TPV completados sin factura (para reportes). */
export async function fetchSalesWithoutInvoiceRows(
  companyId: string,
  fromIso?: string,
  toIso?: string,
  customerId?: string,
): Promise<SaleRevenueRow[]> {
  let query = supabase
    .from('sales')
    .select('total_amount, created_at, invoice_id, customer_id, customer_name, ticket_number')
    .eq('company_id', companyId)
    .eq('status', 'completed');

  if (fromIso) query = query.gte('created_at', fromIso);
  if (toIso) query = query.lte('created_at', toIso);
  if (customerId) query = query.eq('customer_id', customerId);

  let res = await query;
  if (res.error && isSchemaColumnError(res.error)) {
    query = supabase
      .from('sales')
      .select('total_amount, created_at, customer_name, ticket_number')
      .eq('company_id', companyId)
      .eq('status', 'completed');
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);
    res = await query;
  }

  if (res.error) throw res.error;

  return (res.data ?? [])
    .filter((row) => !(row as SaleRevenueRow).invoice_id)
    .filter((row) => !isLegacyOrphanSaleForRevenue(row as SaleRevenueRow)) as SaleRevenueRow[];
}

/** Serie mensual de facturación (preferir fetchDashboardBilling en el dashboard). */
export async function fetchMonthlyRevenueSeries(
  companyId: string,
  monthsBack: number,
): Promise<Array<{ monthStart: Date; monthEnd: Date; total: number }>> {
  const { series } = await fetchDashboardBilling(companyId, monthsBack);
  return series;
}
