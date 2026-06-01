import { supabase } from '@/lib/supabase';
import type { MarketingLead } from '@/hooks/useMarketingLeads';

const INVOICE_CHUNK = 150;

export type CustomerInvoiceRow = {
  customer_id: string;
  issue_date: string;
  total_amount: number;
};

/** Fecha desde la que contar facturación para un lead (día del alta en CRM/Meta). */
export const leadInvoicingSinceDate = (
  lead: Pick<MarketingLead, 'external_created_at' | 'created_at'>,
): string => {
  const raw = lead.external_created_at ?? lead.created_at;
  if (!raw) return new Date().toISOString().slice(0, 10);
  return raw.slice(0, 10);
};

/** Facturas no canceladas de los clientes indicados (con fecha de emisión). */
export async function fetchCustomerInvoices(
  companyId: string,
  customerIds: string[],
): Promise<CustomerInvoiceRow[]> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (!unique.length) return [];

  const rows: CustomerInvoiceRow[] = [];
  for (let i = 0; i < unique.length; i += INVOICE_CHUNK) {
    const slice = unique.slice(i, i + INVOICE_CHUNK);
    const { data, error } = await supabase
      .from('invoices')
      .select('customer_id, issue_date, total_amount, status')
      .eq('company_id', companyId)
      .in('customer_id', slice)
      .neq('status', 'cancelled');
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.customer_id || !row.issue_date) continue;
      const amt = Number(row.total_amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      rows.push({
        customer_id: row.customer_id,
        issue_date: row.issue_date,
        total_amount: amt,
      });
    }
  }
  return rows;
}

/** Suma facturación del cliente desde sinceDate (inclusive), p. ej. fecha de creación del lead. */
export const sumInvoicedSince = (
  invoices: CustomerInvoiceRow[],
  customerId: string,
  sinceDate: string,
): number => {
  let sum = 0;
  for (const inv of invoices) {
    if (inv.customer_id !== customerId) continue;
    if (inv.issue_date < sinceDate) continue;
    sum += inv.total_amount;
  }
  return Math.round(sum * 100) / 100;
};

export const invoicedValueDiffers = (
  current: number | null | undefined,
  next: number,
): boolean => Math.abs(Number(current ?? 0) - next) >= 0.01;
