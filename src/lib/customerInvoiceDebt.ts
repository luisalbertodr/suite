import { supabase } from '@/lib/supabase';

const CLOSED_STATUSES = new Set(['cancelled', 'void', 'anulada', 'paid']);

export type InvoiceDebtRow = {
  total_amount: number | null;
  amount_paid?: number | null;
  paid_status?: boolean | null;
  status: string | null;
  notes?: string | null;
  issue_date?: string | null;
};

/** Evita doble conteo: tickets automáticos si ya existe rebuild FACCAB el mismo día. */
export function filterInvoicesForDebtCalculation<T extends InvoiceDebtRow>(
  rows: T[],
): T[] {
  const rebuildDates = new Set(
    rows
      .filter((r) => (r.notes || '').includes('Legacy FACCAB rebuild'))
      .map((r) => r.issue_date)
      .filter(Boolean),
  );
  return rows.filter((r) => {
    const notes = r.notes || '';
    if (!notes.includes('Factura legacy automática')) return true;
    if (!r.issue_date || rebuildDates.size === 0) return true;
    return !rebuildDates.has(r.issue_date);
  });
}

/** Importe pendiente de una factura (0 si está cerrada o pagada). */
export function computeInvoicePendingAmount(row: InvoiceDebtRow): number {
  const status = String(row.status ?? '').toLowerCase();
  if (CLOSED_STATUSES.has(status)) return 0;

  const total = Number(row.total_amount ?? 0);
  if (total <= 0) return 0;

  const paid = Number(row.amount_paid ?? 0);
  if (row.paid_status === true && paid <= 0.005) {
    return 0;
  }

  const pending = total - paid;
  return pending > 0.005 ? Math.round(pending * 100) / 100 : 0;
}

export function sumCustomerInvoicePendingDebt(rows: InvoiceDebtRow[]): number {
  return Math.round(rows.reduce((sum, row) => sum + computeInvoicePendingAmount(row), 0) * 100) / 100;
}

const DEBT_INVOICE_SELECT = 'total_amount, amount_paid, paid_status, status, notes, issue_date';

/**
 * Facturas con saldo pendiente del cliente en la empresa activa.
 * Incluye `sent` (cobro parcial legacy) además de `issued`.
 */
export async function fetchCustomerPendingInvoiceDebt(
  companyId: string,
  customerId: string,
): Promise<number> {
  const { data: rpcDebt, error: rpcError } = await supabase.rpc('customer_pending_invoice_debt', {
    p_company_id: companyId,
    p_customer_id: customerId,
  });
  if (!rpcError && rpcDebt != null && !Number.isNaN(Number(rpcDebt))) {
    return Math.round(Number(rpcDebt) * 100) / 100;
  }

  const { data, error } = await supabase
    .from('invoices')
    .select(DEBT_INVOICE_SELECT)
    .eq('company_id', companyId)
    .eq('customer_id', customerId);

  if (error) {
    if ((error as { code?: string }).code === '42703') {
      const { data: fallback, error: fallbackError } = await supabase
        .from('invoices')
        .select('total_amount, paid_status, status')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .in('status', ['issued', 'sent'])
        .or('paid_status.is.null,paid_status.eq.false');
      if (fallbackError) throw fallbackError;
      return sumCustomerInvoicePendingDebt(
        (fallback ?? []).map((r) => ({ ...r, amount_paid: r.paid_status ? r.total_amount : 0 })),
      );
    }
    throw error;
  }

  const rows = filterInvoicesForDebtCalculation((data ?? []) as InvoiceDebtRow[]);
  return sumCustomerInvoicePendingDebt(
    rows.filter((r) => computeInvoicePendingAmount(r) > 0),
  );
}
