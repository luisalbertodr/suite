import { supabase } from '@/lib/supabase';
import { isSchemaColumnError } from '@/lib/appointmentSales';
import type { MarketingLead } from '@/hooks/useMarketingLeads';

const INVOICE_CHUNK = 150;

export type CustomerInvoiceRow = {
  customer_id: string;
  invoice_id: string;
  issue_date: string;
  total_amount: number;
  number?: string | null;
  notes?: string | null;
};

export type CustomerAppointmentChargeRow = {
  customer_id: string;
  charged_on: string;
  appointment_id: string;
  invoice_id: string | null;
};

type InvoiceSource = 'fac' | 'leg' | 'style' | 'other';

const EXCLUDED_INVOICE_STATUSES = new Set(['cancelled', 'void', 'anulada']);

const SOURCE_PRIORITY: Record<InvoiceSource, number> = {
  fac: 0,
  other: 1,
  leg: 2,
  style: 3,
};

const isExcludedInvoiceStatus = (status: string | null | undefined): boolean =>
  EXCLUDED_INVOICE_STATUSES.has(String(status ?? '').toLowerCase());

const saleChargedOn = (createdAt: string | null | undefined): string | null => {
  if (!createdAt) return null;
  const d = String(createdAt).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const uniqueCompanyIds = (companyIds: readonly string[]): string[] =>
  [...new Set(companyIds.filter(Boolean))];

/** Clasifica origen de factura para deduplicar Style / legacy / FAC. */
export function marketingInvoiceSource(
  row: Pick<CustomerInvoiceRow, 'number' | 'notes'>,
): InvoiceSource {
  const num = String(row.number ?? '').trim();
  if (/^FAC-\d/i.test(num)) return 'fac';
  if (num.startsWith('LEG-')) return 'leg';
  if (/^A-\d{4}-/i.test(num)) return 'style';
  const notes = String(row.notes ?? '');
  if (notes.includes('Factura Style sync')) return 'style';
  if (notes.includes('Legacy FACCAB')) return 'leg';
  return 'other';
}

/** Misma operación con importes cercanos (p. ej. 800 € FAC vs 808 € Style). */
export function marketingInvoiceAmountsMatch(a: number, b: number): boolean {
  const max = Math.max(a, b);
  if (max <= 0) return a === b;
  return Math.abs(a - b) <= Math.max(10, max * 0.02);
}

function pickBestMarketingInvoice(
  cluster: CustomerInvoiceRow[],
  appointmentInvoiceIds?: Set<string>,
): CustomerInvoiceRow {
  return [...cluster].sort((a, b) => {
    const pa = SOURCE_PRIORITY[marketingInvoiceSource(a)];
    const pb = SOURCE_PRIORITY[marketingInvoiceSource(b)];
    if (pa !== pb) return pa - pb;
    const aa = appointmentInvoiceIds?.has(a.invoice_id) ? 0 : 1;
    const ab = appointmentInvoiceIds?.has(b.invoice_id) ? 0 : 1;
    if (aa !== ab) return aa - ab;
    return a.invoice_id.localeCompare(b.invoice_id);
  })[0];
}

/**
 * Elimina triplicados del mismo cobro (FAC + LEG + Style sync en el mismo día).
 * Facturas con importes distintos el mismo día se conservan todas.
 */
export function dedupeMarketingInvoices(
  invoices: CustomerInvoiceRow[],
  appointmentInvoiceIds?: Set<string>,
): CustomerInvoiceRow[] {
  const byDay = new Map<string, CustomerInvoiceRow[]>();

  for (const inv of invoices) {
    const key = `${inv.customer_id}|${inv.issue_date}`;
    const list = byDay.get(key) ?? [];
    list.push(inv);
    byDay.set(key, list);
  }

  const kept: CustomerInvoiceRow[] = [];
  for (const dayCluster of byDay.values()) {
    if (dayCluster.length === 1) {
      kept.push(dayCluster[0]);
      continue;
    }

    const amountGroups: CustomerInvoiceRow[][] = [];
    for (const inv of dayCluster) {
      let placed = false;
      for (const group of amountGroups) {
        if (marketingInvoiceAmountsMatch(group[0].total_amount, inv.total_amount)) {
          group.push(inv);
          placed = true;
          break;
        }
      }
      if (!placed) amountGroups.push([inv]);
    }

    for (const group of amountGroups) {
      kept.push(
        group.length === 1
          ? group[0]
          : pickBestMarketingInvoice(group, appointmentInvoiceIds),
      );
    }
  }

  return kept;
}

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
  companyIds: string | readonly string[],
  customerIds: string[],
): Promise<CustomerInvoiceRow[]> {
  const companies = uniqueCompanyIds(companyIds);
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (!companies.length || !unique.length) return [];

  const rows: CustomerInvoiceRow[] = [];
  const invoiceSelects = [
    'id, customer_id, issue_date, total_amount, status, number, notes',
    'id, customer_id, issue_date, total_amount, status',
  ] as const;

  for (const companyId of companies) {
    for (let i = 0; i < unique.length; i += INVOICE_CHUNK) {
      const slice = unique.slice(i, i + INVOICE_CHUNK);
      let data: Array<{
        id: string;
        customer_id: string | null;
        issue_date: string | null;
        total_amount: number | null;
        status?: string | null;
        number?: string | null;
        notes?: string | null;
      }> | null = null;

      for (const select of invoiceSelects) {
        const res = await supabase
          .from('invoices')
          .select(select)
          .eq('company_id', companyId)
          .in('customer_id', slice)
          .neq('status', 'cancelled');
        if (res.error && isSchemaColumnError(res.error)) continue;
        if (res.error) throw res.error;
        data = res.data;
        break;
      }

      for (const row of data ?? []) {
        if (!row.customer_id || !row.issue_date || !row.id) continue;
        if (isExcludedInvoiceStatus(row.status)) continue;
        const amt = Number(row.total_amount ?? 0);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        rows.push({
          customer_id: row.customer_id,
          invoice_id: row.id,
          issue_date: row.issue_date,
          total_amount: amt,
          number: row.number ?? null,
          notes: row.notes ?? null,
        });
      }
    }
  }
  return rows;
}

/** Facturas de citas cobradas (venta TPV con appointment_id + invoice_id). */
export async function fetchCustomerAppointmentInvoiceIds(
  companyIds: string | readonly string[],
  customerIds: string[],
): Promise<Set<string>> {
  const companies = uniqueCompanyIds(companyIds);
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (!companies.length || !unique.length) return new Set();

  const invoiceIds = new Set<string>();
  const saleSelects = ['invoice_id, customer_id', 'invoice_id'] as const;

  for (const companyId of companies) {
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
  }

  return invoiceIds;
}

/** Cobros de cita en TPV (venta completada con appointment_id), en cualquier empresa emisora. */
export async function fetchCustomerAppointmentCharges(
  companyIds: string | readonly string[],
  customerIds: string[],
): Promise<CustomerAppointmentChargeRow[]> {
  const companies = uniqueCompanyIds(companyIds);
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (!companies.length || !unique.length) return [];

  const charges: CustomerAppointmentChargeRow[] = [];
  const saleSelects = [
    'customer_id, appointment_id, invoice_id, created_at',
    'appointment_id, invoice_id, created_at',
  ] as const;

  const pushCharge = (row: {
    customer_id?: string | null;
    appointment_id?: string | null;
    invoice_id?: string | null;
    created_at?: string | null;
  }) => {
    const customerId = row.customer_id;
    const appointmentId = row.appointment_id;
    const chargedOn = saleChargedOn(row.created_at);
    if (!customerId || !appointmentId || !chargedOn) return;
    charges.push({
      customer_id: customerId,
      appointment_id: appointmentId,
      invoice_id: row.invoice_id ?? null,
      charged_on: chargedOn,
    });
  };

  for (const companyId of companies) {
    for (let i = 0; i < unique.length; i += INVOICE_CHUNK) {
      const customerSlice = unique.slice(i, i + INVOICE_CHUNK);

      for (const select of saleSelects) {
        const res = await supabase
          .from('sales')
          .select(select)
          .eq('company_id', companyId)
          .eq('status', 'completed')
          .not('appointment_id', 'is', null)
          .in('customer_id', customerSlice);

        if (res.error && isSchemaColumnError(res.error)) continue;
        if (res.error) throw res.error;

        for (const row of res.data ?? []) pushCharge(row as typeof row);
        break;
      }

      const { data: appts, error: aptErr } = await supabase
        .from('agenda_appointments')
        .select('id, customer_id')
        .eq('company_id', companyId)
        .in('customer_id', customerSlice);
      if (aptErr) throw aptErr;

      const appointmentCustomer = new Map(
        (appts ?? [])
          .filter((a) => a.id && a.customer_id)
          .map((a) => [a.id, a.customer_id as string]),
      );
      const appointmentIds = [...appointmentCustomer.keys()];
      for (let j = 0; j < appointmentIds.length; j += INVOICE_CHUNK) {
        const aptSlice = appointmentIds.slice(j, j + INVOICE_CHUNK);
        for (const select of saleSelects) {
          const aptRes = await supabase
            .from('sales')
            .select(`${select}, appointment_id`)
            .eq('company_id', companyId)
            .eq('status', 'completed')
            .not('appointment_id', 'is', null)
            .in('appointment_id', aptSlice)
            .is('customer_id', null);

          if (aptRes.error && isSchemaColumnError(aptRes.error)) continue;
          if (aptRes.error) throw aptRes.error;

          for (const row of aptRes.data ?? []) {
            const aptId = (row as { appointment_id?: string | null }).appointment_id;
            const customerId = aptId ? appointmentCustomer.get(aptId) : null;
            if (!customerId) continue;
            pushCharge({ ...row, customer_id: customerId } as typeof row);
          }
          break;
        }
      }
    }
  }

  return charges;
}

/** ¿Hay cita cobrada en agenda/TPV desde sinceDate (inclusive)? */
export const hasChargedAppointmentSince = (
  charges: CustomerAppointmentChargeRow[],
  customerId: string,
  sinceDate: string,
): boolean =>
  charges.some((c) => c.customer_id === customerId && c.charged_on >= sinceDate);

/** Factura importada desde Style (cobro en agenda legacy) desde sinceDate. */
export const hasStyleSyncedInvoiceSince = (
  invoices: CustomerInvoiceRow[],
  customerId: string,
  sinceDate: string,
): boolean =>
  invoices.some(
    (inv) =>
      inv.customer_id === customerId &&
      inv.issue_date >= sinceDate &&
      String(inv.notes ?? '').includes('Factura Style sync'),
  );

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
  opts?: { appointmentInvoiceIds?: Set<string> },
): number => {
  const scoped = invoices.filter(
    (inv) => inv.customer_id === customerId && inv.issue_date >= sinceDate,
  );
  const deduped = dedupeMarketingInvoices(scoped, opts?.appointmentInvoiceIds);
  const sum = deduped.reduce((acc, inv) => acc + inv.total_amount, 0);
  return Math.round(sum * 100) / 100;
};

export const invoicedValueDiffers = (
  current: number | null | undefined,
  next: number,
): boolean => Math.abs(Number(current ?? 0) - next) >= 0.01;
