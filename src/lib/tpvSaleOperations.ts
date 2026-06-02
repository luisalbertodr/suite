import { supabase } from '@/lib/supabase';
import {
  buildInvoicePrefillFromSale,
  isSchemaColumnError,
  parseAgendaSaleNotes,
  type AppointmentSaleInfo,
} from '@/lib/appointmentSales';
import { runMarketingPresentadaInvoicedSyncForCompany } from '@/lib/marketingPresentadaSync';

export type SaleItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  article_id?: string | null;
  variation_id?: string | null;
};

export type SaleTicketDetail = {
  sale: AppointmentSaleInfo & {
    payment_method?: string | null;
    customer_name?: string | null;
    subtotal?: number | null;
    tax_amount?: number | null;
  };
  items: SaleItemRow[];
};

export type UpdateSaleTicketInput = {
  payment_method?: 'cash' | 'card';
  customer_name?: string | null;
  notes?: string | null;
};

async function generateInvoiceNumber(companyId: string): Promise<string> {
  const tryNew = async () => {
    const { data, error } = await supabase.rpc('generate_invoice_number', {
      p_company_id: companyId,
      p_is_corrective: false,
    });
    if (error) throw error;
    return String(data);
  };
  const tryLegacy = async () => {
    const { data, error } = await supabase.rpc('generate_invoice_number', {
      company_id: companyId,
      prefix: 'FAC',
    });
    if (error) throw error;
    return String(data);
  };
  try {
    return await tryNew();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err?.code === 'PGRST202' || String(err?.message || '').includes('Could not find the function')) {
      return tryLegacy();
    }
    throw e;
  }
}

export async function fetchSaleTicketDetail(saleId: string): Promise<SaleTicketDetail | null> {
  const saleRes = await supabase
    .from('sales')
    .select(
      'id,ticket_number,total_amount,subtotal,tax_amount,status,created_at,customer_name,customer_id,appointment_id,invoice_id,notes,payment_method,company_id',
    )
    .eq('id', saleId)
    .maybeSingle();

  if (saleRes.error && !isSchemaColumnError(saleRes.error)) throw saleRes.error;
  if (!saleRes.data) return null;

  const itemsRes = await supabase
    .from('sale_items')
    .select('id,description,quantity,unit_price,total_price,article_id,variation_id')
    .eq('sale_id', saleId)
    .order('id');

  if (itemsRes.error) throw itemsRes.error;

  const row = saleRes.data;
  return {
    sale: {
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
      payment_method: row.payment_method ?? null,
      customer_name: row.customer_name ?? null,
      subtotal: row.subtotal != null ? Number(row.subtotal) : null,
      tax_amount: row.tax_amount != null ? Number(row.tax_amount) : null,
    },
    items: (itemsRes.data ?? []).map((it) => ({
      id: String(it.id),
      description: String(it.description ?? ''),
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      total_price: Number(it.total_price ?? 0),
      article_id: it.article_id,
      variation_id: it.variation_id,
    })),
  };
}

export async function updateSaleTicket(saleId: string, input: UpdateSaleTicketInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.payment_method != null) patch.payment_method = input.payment_method;
  if (input.customer_name !== undefined) patch.customer_name = input.customer_name?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (!Object.keys(patch).length) return;

  const { error } = await supabase.from('sales').update(patch).eq('id', saleId);
  if (error) throw error;
}

export async function cancelSaleTicket(saleId: string, reason?: string): Promise<void> {
  const detail = await fetchSaleTicketDetail(saleId);
  if (!detail) throw new Error('Ticket no encontrado');
  if (detail.sale.invoice_id) {
    throw new Error('No se puede anular un ticket ya facturado. Emite una factura rectificativa.');
  }
  if (detail.sale.status === 'cancelled') return;

  let notes = detail.sale.notes;
  if (reason?.trim()) {
    const stamp = { cancelled_reason: reason.trim(), cancelled_at: new Date().toISOString() };
    try {
      const parsed = notes ? JSON.parse(notes) : {};
      notes = JSON.stringify({ ...parsed, ...stamp });
    } catch {
      notes = JSON.stringify(stamp);
    }
  }

  const { error } = await supabase
    .from('sales')
    .update({ status: 'cancelled', notes })
    .eq('id', saleId);
  if (error) throw error;
}

export async function deleteSaleTicket(saleId: string): Promise<void> {
  const detail = await fetchSaleTicketDetail(saleId);
  if (!detail) throw new Error('Ticket no encontrado');
  if (detail.sale.invoice_id) {
    throw new Error('No se puede eliminar un ticket vinculado a una factura.');
  }

  const { error } = await supabase.from('sales').delete().eq('id', saleId);
  if (error) throw error;
}

export async function resolveSaleCustomerId(
  sale: Pick<AppointmentSaleInfo, 'customer_id' | 'notes' | 'customer_name'>,
  catalogCompanyId: string,
): Promise<string | null> {
  const fromNotes = parseAgendaSaleNotes(sale.notes)?.customer_id;
  if (fromNotes) return String(fromNotes);
  if (sale.customer_id) return String(sale.customer_id);
  const name = (sale as { customer_name?: string | null }).customer_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', catalogCompanyId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export type IssueInvoiceResult =
  | { mode: 'created'; invoiceId: string; invoiceNumber: string }
  | { mode: 'manual_required'; reason: string; prefill: ReturnType<typeof buildInvoicePrefillFromSale> };

/** Emite factura automática si hay cliente identificado; si no, devuelve prefill para el formulario. */
export async function issueInvoiceFromSale(
  saleId: string,
  catalogCompanyId?: string | null,
): Promise<IssueInvoiceResult> {
  const detail = await fetchSaleTicketDetail(saleId);
  if (!detail) throw new Error('Ticket no encontrado');
  const { sale, items } = detail;

  const billingCompanyId = sale.company_id ?? catalogCompanyId;
  if (!billingCompanyId) throw new Error('No se pudo determinar la empresa emisora del ticket');

  const customerCatalogId = catalogCompanyId ?? billingCompanyId;

  if (sale.invoice_id) {
    return { mode: 'created', invoiceId: sale.invoice_id, invoiceNumber: '' };
  }
  if (sale.status !== 'completed') {
    throw new Error('Solo se pueden facturar tickets completados');
  }
  if (!items.length) {
    throw new Error('El ticket no tiene líneas de venta');
  }

  const customerId = await resolveSaleCustomerId(sale, customerCatalogId);
  if (!customerId) {
    return {
      mode: 'manual_required',
      reason: 'Asigna un cliente al ticket antes de facturar.',
      prefill: buildInvoicePrefillFromSale(sale, items, null, sale.appointment_id),
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const number = await generateInvoiceNumber(billingCompanyId);

  const subtotal =
    sale.subtotal != null && sale.subtotal > 0
      ? Number(sale.subtotal)
      : Number((sale.total_amount / 1.21).toFixed(2));
  const taxAmount =
    sale.tax_amount != null && sale.tax_amount > 0
      ? Number(sale.tax_amount)
      : Number((sale.total_amount - subtotal).toFixed(2));

  const invoiceNotes =
    `Factura del ticket ${sale.ticket_number}` +
    (sale.appointment_id ? ` · Cita ${sale.appointment_id.slice(0, 8)}` : '');

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      company_id: billingCompanyId,
      customer_id: customerId,
      number,
      issue_date: today,
      due_date: today,
      subtotal,
      tax_amount: taxAmount,
      total_amount: Number(sale.total_amount),
      re_total: 0,
      status: 'paid',
      paid_status: true,
      paid_date: new Date().toISOString(),
      currency: 'EUR',
      notes: invoiceNotes,
      is_intracomunitario: false,
    })
    .select('id, number')
    .single();

  if (invError) throw invError;

  const invoiceItems = items.map((it) => {
    const lineTotal = Number(it.total_price ?? 0);
    const lineBase = Number((lineTotal / 1.21).toFixed(2));
    const iva = Number((lineTotal - lineBase).toFixed(2));
    return {
      invoice_id: invoice.id,
      description: it.description,
      quantity: Number(it.quantity ?? 1),
      unit_price: Number((Number(it.unit_price ?? 0) / 1.21).toFixed(2)),
      discount_percentage: 0,
      iva_percentage: 21,
      re_percentage: 0,
      subtotal_after_discount: lineBase,
      iva_amount: iva,
      re_amount: 0,
      total_price: lineTotal,
      variation_id: it.variation_id ?? null,
    };
  });

  const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
  if (itemsError) {
    await supabase.from('invoices').delete().eq('id', invoice.id);
    throw itemsError;
  }

  const { error: linkError } = await supabase
    .from('sales')
    .update({ invoice_id: invoice.id })
    .eq('id', saleId);

  if (linkError) throw linkError;

  if (sale.appointment_id && customerId) {
    void runMarketingPresentadaInvoicedSyncForCompany(billingCompanyId, {
      customerIds: [customerId],
    }).catch((e) => console.warn('Marketing sync tras factura cita:', e));
  }

  return { mode: 'created', invoiceId: String(invoice.id), invoiceNumber: String(invoice.number) };
}
