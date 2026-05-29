import { supabase } from '@/lib/supabase';
import { isSchemaColumnError } from '@/lib/appointmentSales';

export type RevenueBreakdown = {
  invoices: number;
  salesWithoutInvoice: number;
  total: number;
};

function sumAmount(rows: Array<{ total_amount?: number | null }> | null | undefined): number {
  return (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Ingresos cobrados del periodo: facturas pagadas (issue_date) + tickets TPV no facturados completados. */
export async function fetchPeriodRevenue(
  companyId: string,
  fromIso: string,
  toIso: string,
): Promise<RevenueBreakdown> {
  const fromDate = toDateOnly(fromIso);
  const toDate = toDateOnly(toIso);

  let invRes = await supabase
    .from('invoices')
    .select('total_amount, status, paid_status')
    .eq('company_id', companyId)
    .gte('issue_date', fromDate)
    .lte('issue_date', toDate);

  if (invRes.error && isSchemaColumnError(invRes.error)) {
    invRes = await supabase
      .from('invoices')
      .select('total_amount, status')
      .eq('company_id', companyId)
      .gte('issue_date', fromDate)
      .lte('issue_date', toDate);
  }

  if (invRes.error) throw invRes.error;

  const invoiceRows = (invRes.data ?? []).filter((row) => {
    const status = String(row.status ?? '').toLowerCase();
    if (['cancelled', 'void', 'anulada', 'pending'].includes(status)) return false;
    const paid = (row as { paid_status?: boolean | null }).paid_status;
    if (paid === false) return false;
    return status === 'paid' || paid === true || status === '';
  });

  let salesRes = await supabase
    .from('sales')
    .select('total_amount, invoice_id')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  if (salesRes.error && isSchemaColumnError(salesRes.error)) {
    salesRes = await supabase
      .from('sales')
      .select('total_amount')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
  }

  if (salesRes.error) throw salesRes.error;

  const invoices = sumAmount(invoiceRows);
  const salesWithoutInvoice = (salesRes.data ?? []).reduce((s, row) => {
    const linked = (row as { invoice_id?: string | null }).invoice_id;
    if (linked) return s;
    return s + Number(row.total_amount ?? 0);
  }, 0);

  return {
    invoices,
    salesWithoutInvoice,
    total: invoices + salesWithoutInvoice,
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

  return (res.data ?? []).filter((row) => !(row as SaleRevenueRow).invoice_id) as SaleRevenueRow[];
}

/** Serie mensual de ingresos (facturas + TPV sin factura). */
export async function fetchMonthlyRevenueSeries(
  companyId: string,
  monthsBack: number,
): Promise<Array<{ monthStart: Date; monthEnd: Date; total: number }>> {
  const out: Array<{ monthStart: Date; monthEnd: Date; total: number }> = [];
  const now = new Date();

  for (let i = monthsBack; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const rev = await fetchPeriodRevenue(companyId, monthStart.toISOString(), monthEnd.toISOString());
    out.push({ monthStart, monthEnd, total: rev.total });
  }

  return out;
}
