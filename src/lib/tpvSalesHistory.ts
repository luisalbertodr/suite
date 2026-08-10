import { supabase } from '@/lib/supabase';
import { isSchemaColumnError, parseAgendaSaleNotes } from '@/lib/appointmentSales';

export type TpvHistorySource = 'suite_sale' | 'style_invoice';

export type TpvHistoryRow = {
  id: string;
  ticket_number: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  customer_name?: string;
  customer_id?: string | null;
  appointment_id?: string | null;
  invoice_id?: string | null;
  notes?: string | null;
  company_id?: string | null;
  host_company_id?: string | null;
  sale_group_id?: string | null;
  source: TpvHistorySource;
};

export type TpvInvoiceFilter = 'all' | 'invoiced' | 'pending';
export type TpvPaymentFilter = 'all' | 'cash' | 'card';

const SALES_SELECT = `
  id, ticket_number, total_amount, payment_method, status, created_at,
  customer_name, customer_id, appointment_id, invoice_id, notes,
  company_id, host_company_id, sale_group_id
`;

const SALES_SELECT_FALLBACK = `
  id, ticket_number, total_amount, payment_method, status, created_at,
  customer_name, notes
`;

function issueDateToIso(issueDate: string | null | undefined, createdAt?: string | null): string {
  const ymd = String(issueDate || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return `${ymd}T12:00:00.000Z`;
  if (createdAt) return String(createdAt);
  return new Date().toISOString();
}

function normalizePayment(raw: string | null | undefined): string {
  const p = String(raw || '').toLowerCase();
  if (!p) return 'card';
  if (p.includes('cash') || p.includes('efectivo') || p === 'metalico' || p === 'metálico') return 'cash';
  if (p.includes('card') || p.includes('tarjeta') || p.includes('bizum') || p.includes('redsys')) return 'card';
  return p;
}

function matchesSearch(row: TpvHistoryRow, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    row.ticket_number.toLowerCase().includes(q) ||
    String(row.customer_name || '')
      .toLowerCase()
      .includes(q)
  );
}

function matchesInvoiceFilter(row: TpvHistoryRow, filter: TpvInvoiceFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'invoiced') return Boolean(row.invoice_id) || row.source === 'style_invoice';
  return !row.invoice_id && row.source === 'suite_sale';
}

function matchesPaymentFilter(row: TpvHistoryRow, filter: TpvPaymentFilter): boolean {
  if (filter === 'all') return true;
  return normalizePayment(row.payment_method) === filter;
}

async function fetchSuiteSales(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<TpvHistoryRow[]> {
  for (const select of [SALES_SELECT, SALES_SELECT_FALLBACK] as const) {
    let q = supabase
      .from('sales')
      .select(select)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`);

    const res = await q;
    if (!res.error) {
      return ((res.data ?? []) as Array<Record<string, unknown>>).map((sale) => ({
        id: String(sale.id),
        ticket_number: String(sale.ticket_number ?? ''),
        total_amount: Number(sale.total_amount ?? 0),
        payment_method: normalizePayment(sale.payment_method as string | null),
        status: String(sale.status ?? 'completed'),
        created_at: String(sale.created_at ?? ''),
        customer_name: sale.customer_name ? String(sale.customer_name) : undefined,
        customer_id: sale.customer_id ? String(sale.customer_id) : null,
        appointment_id: sale.appointment_id ? String(sale.appointment_id) : null,
        invoice_id: sale.invoice_id ? String(sale.invoice_id) : null,
        notes: sale.notes ? String(sale.notes) : null,
        company_id: sale.company_id ? String(sale.company_id) : null,
        host_company_id: sale.host_company_id ? String(sale.host_company_id) : null,
        sale_group_id: sale.sale_group_id ? String(sale.sale_group_id) : null,
        source: 'suite_sale' as const,
      }));
    }
    if (!isSchemaColumnError(res.error)) throw res.error;
  }
  return [];
}

async function fetchStyleInvoices(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<TpvHistoryRow[]> {
  const run = async (withPaymentMethod: boolean) => {
    const select = withPaymentMethod
      ? `
      id, number, issue_date, created_at, total_amount, status, notes, payment_method, customer_id,
      customers:customer_id ( name )
    `
      : `
      id, number, issue_date, created_at, total_amount, status, notes, customer_id,
      customers:customer_id ( name )
    `;
    let q = supabase
      .from('invoices')
      .select(select)
      .eq('company_id', companyId)
      .ilike('notes', '%Factura Style sync%')
      .neq('status', 'cancelled')
      .neq('status', 'void')
      .neq('status', 'anulada')
      .order('issue_date', { ascending: false })
      .limit(5000);
    if (dateFrom) q = q.gte('issue_date', dateFrom);
    if (dateTo) q = q.lte('issue_date', dateTo);
    return q;
  };

  let res = await run(true);
  if (res.error && isSchemaColumnError(res.error)) {
    res = await run(false);
  }

  if (res.error) throw res.error;

  return ((res.data ?? []) as Array<Record<string, unknown>>).map((inv) => {
    const customer = inv.customers as { name?: string | null } | null;
    const statusRaw = String(inv.status || 'paid').toLowerCase();
    const status =
      statusRaw === 'paid' || statusRaw === 'completed' ? 'completed' : String(inv.status || 'completed');
    return {
      id: `style-inv:${String(inv.id)}`,
      ticket_number: String(inv.number ?? ''),
      total_amount: Number(inv.total_amount ?? 0),
      payment_method: normalizePayment(inv.payment_method as string | null),
      status,
      created_at: issueDateToIso(inv.issue_date as string | null, inv.created_at as string | null),
      customer_name: customer?.name ? String(customer.name) : undefined,
      customer_id: inv.customer_id ? String(inv.customer_id) : null,
      appointment_id: null,
      invoice_id: String(inv.id),
      notes: inv.notes ? String(inv.notes) : 'Factura Style sync',
      company_id: companyId,
      source: 'style_invoice' as const,
    };
  });
}

/**
 * Historial TPV unificado: tickets Suite (`sales`) + facturas Style sincronizadas (`invoices`),
 * sin duplicar cuando un sale ya apunta al mismo invoice_id.
 */
export async function fetchTpvUnifiedHistory(params: {
  companyId: string;
  dateFrom: string;
  dateTo: string;
  search?: string;
  invoiceFilter?: TpvInvoiceFilter;
  paymentFilter?: TpvPaymentFilter;
  page: number;
  pageSize: number;
}): Promise<{ rows: TpvHistoryRow[]; total: number; pageTotal: number }> {
  const {
    companyId,
    dateFrom,
    dateTo,
    search = '',
    invoiceFilter = 'all',
    paymentFilter = 'all',
    page,
    pageSize,
  } = params;

  const [sales, styleInvoices] = await Promise.all([
    fetchSuiteSales(companyId, dateFrom, dateTo),
    fetchStyleInvoices(companyId, dateFrom, dateTo),
  ]);

  const saleInvoiceIds = new Set(
    sales.map((s) => s.invoice_id).filter((id): id is string => Boolean(id)),
  );

  const merged: TpvHistoryRow[] = [
    ...sales,
    ...styleInvoices.filter((inv) => !saleInvoiceIds.has(String(inv.invoice_id))),
  ];

  const filtered = merged
    .filter((row) => matchesSearch(row, search.trim()))
    .filter((row) => matchesInvoiceFilter(row, invoiceFilter))
    .filter((row) => matchesPaymentFilter(row, paymentFilter))
    .filter((row) => row.status !== 'cancelled' && row.status !== 'void')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = filtered.length;
  const from = page * pageSize;
  const rows = filtered.slice(from, from + pageSize);
  const pageTotal = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  return { rows, total, pageTotal };
}

export function tpvHistoryItemSummary(row: TpvHistoryRow): string {
  if (row.source === 'style_invoice') return 'Style';
  const parsed = parseAgendaSaleNotes(row.notes);
  const items = parsed?.items;
  if (!items?.length) return '—';
  if (items.length === 1) return items[0]?.name || '1 ítem';
  return `${items.length} ítems`;
}

export function resolveTpvHistoryAppointmentId(row: TpvHistoryRow): string | null {
  if (row.appointment_id) return row.appointment_id;
  return parseAgendaSaleNotes(row.notes)?.appointment_id ?? null;
}
