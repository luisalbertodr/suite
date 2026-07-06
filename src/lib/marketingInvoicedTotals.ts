import { supabase } from '@/lib/supabase';
import { isSchemaColumnError } from '@/lib/appointmentSales';
import type { MarketingLead } from '@/hooks/useMarketingLeads';

const INVOICE_CHUNK = 150;

export type CustomerInvoiceRow = {
  customer_id: string;
  invoice_id: string;
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
      .select('id, customer_id, issue_date, total_amount, status')
      .eq('company_id', companyId)
      .in('customer_id', slice)
      .neq('status', 'cancelled');
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.customer_id || !row.issue_date || !row.id) continue;
      const amt = Number(row.total_amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      rows.push({
        customer_id: row.customer_id,
        invoice_id: row.id,
        issue_date: row.issue_date,
        total_amount: amt,
      });
    }
  }
  return rows;
}

/** Facturas de citas cobradas (venta TPV con appointment_id + invoice_id). */
export async function fetchCustomerAppointmentInvoiceIds(
  companyId: string,
  customerIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (!unique.length) return new Set();

  const invoiceIds = new Set<string>();
  const saleSelects = ['invoice_id, customer_id', 'invoice_id'] as const;

  for (let i = 0; i < unique.length; i += INVOICE_CHUNK) {
    const customerSlice = unique.slice(i, i + INVOICE_CHUNK);

    for (const select of saleSelects) {
      const res = await supabase
        .from('sales')
        .select(select)
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .not('appointment_id', 'is', null)
        .not('invoice_id', 'is', null)
        .in('customer_id', customerSlice);

      if (res.error && isSchemaColumnError(res.error)) continue;
      if (res.error) throw res.error;

      for (const row of res.data ?? []) {
        const invoiceId = (row as { invoice_id?: string | null }).invoice_id;
        if (invoiceId) invoiceIds.add(invoiceId);
      }
      break;
    }

    // Ventas legacy sin customer_id: enlazar por cita del cliente.
    const { data: appts, error: aptErr } = await supabase
      .from('agenda_appointments')
      .select('id')
      .eq('company_id', companyId)
      .in('customer_id', customerSlice);
    if (aptErr) throw aptErr;

    const appointmentIds = (appts ?? []).map((r) => r.id).filter(Boolean);
    for (let j = 0; j < appointmentIds.length; j += INVOICE_CHUNK) {
      const aptSlice = appointmentIds.slice(j, j + INVOICE_CHUNK);
      for (const select of saleSelects) {
        const aptRes = await supabase
          .from('sales')
          .select(`${select}, appointment_id`)
          .eq('company_id', companyId)
          .eq('status', 'completed')
          .not('invoice_id', 'is', null)
          .in('appointment_id', aptSlice)
          .is('customer_id', null);

        if (aptRes.error && isSchemaColumnError(aptRes.error)) continue;
        if (aptRes.error) throw aptRes.error;

        for (const row of aptRes.data ?? []) {
          const invoiceId = (row as { invoice_id?: string | null }).invoice_id;
          if (invoiceId) invoiceIds.add(invoiceId);
        }
        break;
      }
    }
  }

  return invoiceIds;
}

/** ¿Hay factura de cita del cliente desde sinceDate (inclusive)? */
export const hasAppointmentInvoiceSince = (
  invoices: CustomerInvoiceRow[],
  appointmentInvoiceIds: Set<string>,
  customerId: string,
  sinceDate: string,
): boolean => {
  for (const inv of invoices) {
    if (inv.customer_id !== customerId) continue;
    if (inv.issue_date < sinceDate) continue;
    if (appointmentInvoiceIds.has(inv.invoice_id)) return true;
  }
  return false;
};

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
