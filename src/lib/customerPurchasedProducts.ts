import { supabase } from '@/lib/supabase';

export type CustomerPurchasedProduct = {
  id: string;
  articleId: string | null;
  label: string;
  codigo: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchasedAt: string;
  ticketNumber: string | null;
  saleId: string;
  appointmentId: string | null;
  /** Fecha de la cita (yyyy-MM-dd) si está vinculada. */
  appointmentDateYmd: string | null;
};

export function isProductArticleKind(kind: string | null | undefined): boolean {
  const k = String(kind || '').toLowerCase();
  if (k === 'servicio' || k === 'bono' || k.includes('serv')) return false;
  return (
    k === 'producto' ||
    k === 'product' ||
    k.includes('prod') ||
    k.includes('standard') ||
    k.includes('textil') ||
    k.includes('calzado')
  );
}

export async function fetchCustomerPurchasedProducts(
  customerId: string,
  companyId: string,
): Promise<CustomerPurchasedProduct[]> {
  let salesRes = await supabase
    .from('sales')
    .select(
      `
      id, created_at, ticket_number, appointment_id,
      sale_items (
        id, description, quantity, unit_price, total_price, article_id,
        articles:article_id (codigo, descripcion, article_kind)
      )
    `,
    )
    .eq('customer_id', customerId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (salesRes.error) {
    salesRes = await supabase
      .from('sales')
      .select(
        `
        id, created_at, ticket_number,
        sale_items (
          id, description, quantity, unit_price, total_price, article_id,
          articles:article_id (codigo, descripcion, article_kind)
        )
      `,
      )
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
  }

  if (salesRes.error) throw salesRes.error;

  const rows: CustomerPurchasedProduct[] = [];

  for (const sale of salesRes.data ?? []) {
    const purchasedAt = String(sale.created_at || '');
    const saleId = String(sale.id);
    const ticketNumber = sale.ticket_number ? String(sale.ticket_number) : null;
    const appointmentId = (sale as { appointment_id?: string | null }).appointment_id
      ? String((sale as { appointment_id?: string | null }).appointment_id)
      : null;

    for (const raw of (sale as { sale_items?: unknown[] }).sale_items ?? []) {
      const item = raw as {
        id: string;
        description?: string | null;
        quantity?: number | null;
        unit_price?: number | null;
        total_price?: number | null;
        article_id?: string | null;
        articles?: {
          codigo?: string | null;
          descripcion?: string | null;
          article_kind?: string | null;
        } | null;
      };

      const article = item.articles;
      if (article && !isProductArticleKind(article.article_kind)) continue;

      const label =
        article?.descripcion?.trim() ||
        String(item.description || '').trim() ||
        'Producto';
      if (!article && !item.article_id) {
        const desc = label.toLowerCase();
        if (desc.includes('sesión') || desc.includes('sesion') || desc.includes('servicio')) continue;
      }

      rows.push({
        id: String(item.id),
        articleId: item.article_id ? String(item.article_id) : null,
        label,
        codigo: article?.codigo ? String(article.codigo) : null,
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unit_price ?? 0),
        totalPrice: Number(item.total_price ?? 0),
        purchasedAt,
        ticketNumber,
        saleId,
        appointmentId,
        appointmentDateYmd: null,
      });
    }
  }

  const appointmentIds = [...new Set(rows.map((r) => r.appointmentId).filter(Boolean))] as string[];
  const appointmentDateById = new Map<string, string>();

  if (appointmentIds.length) {
    const { data: appts, error: apptErr } = await supabase
      .from('agenda_appointments')
      .select('id, start_time, appointment_date')
      .in('id', appointmentIds);
    if (!apptErr) {
      for (const a of appts ?? []) {
        const id = String((a as { id: string }).id);
        const raw =
          (a as { appointment_date?: string | null }).appointment_date ??
          (a as { start_time?: string | null }).start_time;
        const ymd = raw ? String(raw).slice(0, 10) : '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) appointmentDateById.set(id, ymd);
      }
    }
  }

  for (const row of rows) {
    if (row.appointmentId) {
      row.appointmentDateYmd = appointmentDateById.get(row.appointmentId) ?? row.purchasedAt.slice(0, 10);
    }
  }

  rows.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  return rows;
}

export function groupProductsByDate(products: CustomerPurchasedProduct[]): Map<string, CustomerPurchasedProduct[]> {
  const map = new Map<string, CustomerPurchasedProduct[]>();
  for (const p of products) {
    const ymd = p.purchasedAt.slice(0, 10);
    const list = map.get(ymd) ?? [];
    list.push(p);
    map.set(ymd, list);
  }
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}
