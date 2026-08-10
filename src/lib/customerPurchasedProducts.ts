import { supabase } from '@/lib/supabase';
import { parseAgendaSaleNotes } from '@/lib/appointmentSales';

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

function ymdFromUnknown(raw: unknown): string | null {
  const ymd = raw ? String(raw).slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** Resuelve cita de venta: sale.appointment_id → notas → misma fecha + artículo en agenda. */
async function resolveMissingAppointmentLinks(
  customerId: string,
  companyId: string,
  rows: CustomerPurchasedProduct[],
): Promise<void> {
  const missing = rows.filter((r) => !r.appointmentId && r.articleId);
  if (!missing.length) return;

  const dates = [...new Set(missing.map((r) => r.purchasedAt.slice(0, 10)).filter(Boolean))];
  if (!dates.length) return;

  const { data: appts, error } = await supabase
    .from('agenda_appointments')
    .select('id, appointment_date, start_time')
    .eq('customer_id', customerId)
    .eq('company_id', companyId)
    .in('appointment_date', dates);

  if (error || !appts?.length) return;

  const apptIds = appts.map((a) => String((a as { id: string }).id));
  const dateByAppt = new Map<string, string>();
  for (const a of appts) {
    const id = String((a as { id: string }).id);
    const ymd =
      ymdFromUnknown((a as { appointment_date?: string }).appointment_date) ||
      ymdFromUnknown((a as { start_time?: string }).start_time);
    if (ymd) dateByAppt.set(id, ymd);
  }

  const { data: items, error: itemsErr } = await supabase
    .from('appointment_items')
    .select('appointment_id, article_id')
    .in('appointment_id', apptIds)
    .not('article_id', 'is', null);

  if (itemsErr || !items?.length) return;

  const articleToAppts = new Map<string, string[]>();
  for (const it of items) {
    const articleId = (it as { article_id?: string | null }).article_id;
    const appointmentId = (it as { appointment_id?: string | null }).appointment_id;
    if (!articleId || !appointmentId) continue;
    const list = articleToAppts.get(String(articleId)) ?? [];
    list.push(String(appointmentId));
    articleToAppts.set(String(articleId), list);
  }

  for (const row of missing) {
    if (!row.articleId) continue;
    const saleYmd = row.purchasedAt.slice(0, 10);
    const candidates = articleToAppts.get(row.articleId) ?? [];
    const match = candidates.find((apptId) => dateByAppt.get(apptId) === saleYmd);
    if (match) {
      row.appointmentId = match;
      row.appointmentDateYmd = saleYmd;
    }
  }
}

export async function fetchCustomerPurchasedProducts(
  customerId: string,
  companyId: string,
): Promise<CustomerPurchasedProduct[]> {
  let salesRes = await supabase
    .from('sales')
    .select(
      `
      id, created_at, ticket_number, appointment_id, notes,
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
        id, created_at, ticket_number, notes,
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
    const notes = (sale as { notes?: string | null }).notes;
    let appointmentId = (sale as { appointment_id?: string | null }).appointment_id
      ? String((sale as { appointment_id?: string | null }).appointment_id)
      : null;
    if (!appointmentId) {
      appointmentId = parseAgendaSaleNotes(notes)?.appointment_id ?? null;
    }

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
      // Incluir productos y servicios vendidos (excluir solo bonos de catálogo).
      const kind = String(article?.article_kind || '').toLowerCase();
      if (kind === 'bono' || kind.includes('bono')) continue;

      const label =
        article?.descripcion?.trim() ||
        String(item.description || '').trim() ||
        'Artículo';
      if (!article && !item.article_id) {
        const desc = label.toLowerCase();
        if (desc.includes('sesión') || desc.includes('sesion')) continue;
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
        const ymd =
          ymdFromUnknown((a as { appointment_date?: string | null }).appointment_date) ||
          ymdFromUnknown((a as { start_time?: string | null }).start_time);
        if (ymd) appointmentDateById.set(id, ymd);
      }
    }
  }

  for (const row of rows) {
    if (row.appointmentId) {
      row.appointmentDateYmd = appointmentDateById.get(row.appointmentId) ?? row.purchasedAt.slice(0, 10);
    }
  }

  await resolveMissingAppointmentLinks(customerId, companyId, rows);

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
