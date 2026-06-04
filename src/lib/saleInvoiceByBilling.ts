import { supabase } from '@/lib/supabase';
import { buildFamilyBillingMap, resolveBillingCompanyId } from '@/lib/billingCompany';
import type { SaleItemRow, SaleTicketDetail } from '@/lib/tpvSaleOperations';

const IVA = 0.21;

export type SaleLineWithBilling = SaleItemRow & { billingCompanyId: string };

export type CreatedSplitInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  companyId: string;
  companyLabel: string;
  totalAmount: number;
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

function calcTax(total: number): { subtotal: number; taxAmount: number } {
  const subtotal = Number((total / (1 + IVA)).toFixed(2));
  const taxAmount = Number((total - subtotal).toFixed(2));
  return { subtotal, taxAmount };
}

function mergeSaleNotesWithSplit(
  notes: string | null | undefined,
  splitMeta: CreatedSplitInvoice[],
): string {
  let parsed: Record<string, unknown> = {};
  if (notes) {
    try {
      const p = JSON.parse(notes) as Record<string, unknown>;
      parsed = typeof p === 'object' && p ? p : { _text: notes };
    } catch {
      parsed = { _text: notes };
    }
  }
  parsed.split_invoices = splitMeta.map((m) => ({
    company_id: m.companyId,
    company_label: m.companyLabel,
    invoice_id: m.invoiceId,
    number: m.invoiceNumber,
    total_amount: m.totalAmount,
  }));
  return JSON.stringify(parsed);
}

export async function resolveSaleItemsWithBilling(
  items: SaleItemRow[],
  catalogCompanyId: string,
): Promise<SaleLineWithBilling[]> {
  const articleIds = items.map((it) => it.article_id).filter(Boolean) as string[];
  const { data: families } = await supabase
    .from('article_families')
    .select('name, billing_company_id')
    .eq('company_id', catalogCompanyId);
  const familyBillingMap = buildFamilyBillingMap(families ?? []);

  let articlesMap = new Map<string, { familia: string; billing_company_id?: string | null; company_id?: string | null }>();
  if (articleIds.length) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, familia, billing_company_id, company_id')
      .in('id', articleIds);
    articlesMap = new Map(
      (articles ?? []).map((a) => [
        a.id,
        {
          familia: a.familia ?? 'Varios',
          billing_company_id: a.billing_company_id,
          company_id: a.company_id,
        },
      ]),
    );
  }

  return items.map((it) => {
    const article = it.article_id ? articlesMap.get(it.article_id) : null;
    const billingCompanyId = article
      ? resolveBillingCompanyId(
          {
            billing_company_id: article.billing_company_id,
            familia: article.familia,
            company_id: article.company_id,
          },
          familyBillingMap,
          catalogCompanyId,
        )
      : catalogCompanyId;
    return { ...it, billingCompanyId };
  });
}

export async function createInvoicesForSale(
  detail: SaleTicketDetail,
  catalogCompanyId: string,
  customerId: string,
): Promise<CreatedSplitInvoice[]> {
  const { sale, items } = detail;
  const lines = await resolveSaleItemsWithBilling(items, catalogCompanyId);

  const byCompany = new Map<string, SaleLineWithBilling[]>();
  for (const line of lines) {
    const list = byCompany.get(line.billingCompanyId) ?? [];
    list.push(line);
    byCompany.set(line.billingCompanyId, list);
  }

  const companyIds = [...byCompany.keys()];
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, short_name')
    .in('id', companyIds);
  const labelById = new Map(
    (companies ?? []).map((c) => [c.id, (c.short_name || c.name || '').trim() || c.id.slice(0, 8)]),
  );

  const issueDate =
    sale.created_at?.slice(0, 10) ?? new Date().toISOString().split('T')[0];
  const ticketLabel = sale.ticket_number || sale.id.slice(0, 8);
  const created: CreatedSplitInvoice[] = [];

  for (const companyId of companyIds.sort()) {
    const companyLines = byCompany.get(companyId) ?? [];
    const total = companyLines.reduce((s, it) => s + Number(it.total_price ?? 0), 0);
    const { subtotal, taxAmount } = calcTax(total);
    const companyLabel = labelById.get(companyId) ?? companyId.slice(0, 8);
    const number = await generateInvoiceNumber(companyId);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        customer_id: customerId,
        number,
        issue_date: issueDate,
        due_date: issueDate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        re_total: 0,
        status: 'paid',
        paid_status: true,
        paid_date: new Date().toISOString(),
        currency: 'EUR',
        notes: `Factura del ticket ${ticketLabel} (${companyLabel})`,
        is_intracomunitario: false,
      })
      .select('id, number')
      .single();

    if (invError || !invoice) throw invError ?? new Error('No se creó la factura');

    const invoiceItems = companyLines.map((it) => {
      const lineTotal = Number(it.total_price ?? 0);
      const lineBase = Number((lineTotal / (1 + IVA)).toFixed(2));
      const iva = Number((lineTotal - lineBase).toFixed(2));
      return {
        invoice_id: invoice.id,
        description: it.description,
        quantity: Number(it.quantity ?? 1),
        unit_price: Number((Number(it.unit_price ?? 0) / (1 + IVA)).toFixed(2)),
        discount_percentage: 0,
        iva_percentage: 21,
        re_percentage: 0,
        subtotal_after_discount: lineBase,
        iva_amount: iva,
        re_amount: 0,
        total_price: lineTotal,
        article_id: it.article_id ?? null,
        variation_id: it.variation_id ?? null,
      };
    });

    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
    if (itemsError) {
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw itemsError;
    }

    created.push({
      invoiceId: String(invoice.id),
      invoiceNumber: String(invoice.number),
      companyId,
      companyLabel,
      totalAmount: total,
    });
  }

  const primary = created.reduce((best, cur) =>
    cur.totalAmount > best.totalAmount ? cur : best,
  );

  const { error: linkError } = await supabase
    .from('sales')
    .update({
      invoice_id: primary.invoiceId,
      company_id: primary.companyId,
      notes: mergeSaleNotesWithSplit(sale.notes, created),
    })
    .eq('id', sale.id);

  if (linkError) throw linkError;

  return created;
}
