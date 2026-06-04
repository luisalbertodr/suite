import { supabase } from '@/lib/supabase';
import type { AppointmentSaleInfo } from '@/lib/appointmentSales';

export const CORRECTIVE_INVOICE_PREFILL_KEY = 'corrective_invoice_prefill';

export type CorrectiveInvoicePrefillItem = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  iva_percentage: number;
  re_percentage: number;
  subtotal_after_discount: number;
  iva_amount: number;
  re_amount: number;
  total_price: number;
  variation_id?: string | null;
  article_id?: string | null;
};

export type CorrectiveInvoicePrefillPending = {
  original_invoice_id: string;
  original_invoice_number: string;
  company_id: string;
};

export type CorrectiveInvoicePrefill = {
  source: 'agenda_appointment_cancel';
  appointment_id: string;
  customer_id: string;
  company_id: string;
  original_invoice_id: string;
  original_invoice_number: string;
  corrective_reason: string;
  notes: string;
  is_corrective: true;
  items: CorrectiveInvoicePrefillItem[];
  pending_originals?: CorrectiveInvoicePrefillPending[];
};

export function collectInvoicedIdsFromSales(sales: AppointmentSaleInfo[]): string[] {
  const ids = new Set<string>();
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    if (sale.invoice_id) ids.add(String(sale.invoice_id));
    if (!sale.notes) continue;
    try {
      const parsed = JSON.parse(sale.notes) as {
        split_invoices?: Array<{ invoice_id?: string }>;
      };
      for (const split of parsed.split_invoices ?? []) {
        if (split.invoice_id) ids.add(String(split.invoice_id));
      }
    } catch {
      /* ignore */
    }
  }
  return [...ids];
}

function mapInvoiceItemRow(row: Record<string, unknown>): CorrectiveInvoicePrefillItem {
  return {
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price: Number(row.unit_price ?? 0),
    discount_percentage: Number(row.discount_percentage ?? 0),
    iva_percentage: Number(row.iva_percentage ?? 21),
    re_percentage: Number(row.re_percentage ?? 0),
    subtotal_after_discount: Math.abs(Number(row.subtotal_after_discount ?? 0)),
    iva_amount: Math.abs(Number(row.iva_amount ?? 0)),
    re_amount: Math.abs(Number(row.re_amount ?? 0)),
    total_price: Math.abs(Number(row.total_price ?? 0)),
    variation_id: (row.variation_id as string | null) ?? null,
    article_id: (row.article_id as string | null) ?? null,
  };
}

export async function buildCorrectivePrefillForInvoice(
  originalInvoiceId: string,
  context: { appointmentId: string; reason?: string },
): Promise<CorrectiveInvoicePrefill | null> {
  const { data: inv, error } = await supabase
    .from('invoices')
    .select('id, number, customer_id, company_id, notes, is_corrective')
    .eq('id', originalInvoiceId)
    .maybeSingle();

  if (error || !inv?.id || inv.is_corrective) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', originalInvoiceId);

  if (itemsError) throw itemsError;
  if (!itemRows?.length) return null;

  const aptShort = context.appointmentId.slice(0, 8);
  const reason = context.reason ?? `Cancelación de cita (${aptShort})`;
  const originalNumber = String(inv.number ?? '');

  return {
    source: 'agenda_appointment_cancel',
    appointment_id: context.appointmentId,
    customer_id: String(inv.customer_id),
    company_id: String(inv.company_id),
    original_invoice_id: String(inv.id),
    original_invoice_number: originalNumber,
    corrective_reason: reason,
    notes: `Rectificativa por cancelación de cita. Factura original ${originalNumber}.${inv.notes ? ` ${inv.notes}` : ''}`.trim(),
    is_corrective: true,
    items: itemRows.map((row) => mapInvoiceItemRow(row as Record<string, unknown>)),
  };
}

export async function prepareCorrectivePrefillsForAppointment(
  appointmentId: string,
  sales: AppointmentSaleInfo[],
): Promise<CorrectiveInvoicePrefill[]> {
  const ids = collectInvoicedIdsFromSales(sales);
  const prefills: CorrectiveInvoicePrefill[] = [];
  for (const invoiceId of ids) {
    const prefill = await buildCorrectivePrefillForInvoice(invoiceId, { appointmentId });
    if (prefill) prefills.push(prefill);
  }
  return prefills;
}

export function storeCorrectiveInvoicePrefill(prefill: CorrectiveInvoicePrefill): void {
  sessionStorage.setItem(CORRECTIVE_INVOICE_PREFILL_KEY, JSON.stringify(prefill));
}

export function attachPendingCorrectives(
  prefills: CorrectiveInvoicePrefill[],
): CorrectiveInvoicePrefill | null {
  if (!prefills.length) return null;
  const [first, ...rest] = prefills;
  return {
    ...first,
    pending_originals: rest.map((p) => ({
      original_invoice_id: p.original_invoice_id,
      original_invoice_number: p.original_invoice_number,
      company_id: p.company_id,
    })),
  };
}
