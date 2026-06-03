import { supabase } from '@/lib/supabase';

export type BonoAppointmentLink = {
  appointmentId: string;
  dateYmd: string;
};

function isBonoArticleKind(kind: string | null | undefined): boolean {
  const k = String(kind || '').toLowerCase();
  return k === 'bono' || k.includes('bono');
}

/** Cita donde se compró/cobró el bono (venta TPV vinculada a agenda). */
export async function fetchBonoPurchaseAppointmentMap(
  customerId: string,
  companyId: string,
  bonos: Array<{ id: string; nombre: string; fecha_compra: string | null }>,
): Promise<Map<string, BonoAppointmentLink>> {
  const map = new Map<string, BonoAppointmentLink>();
  if (!bonos.length) return map;

  let salesRes = await supabase
    .from('sales')
    .select(
      `
      id, appointment_id, created_at,
      sale_items (
        description,
        articles:article_id ( article_kind, descripcion )
      )
    `,
    )
    .eq('customer_id', customerId)
    .eq('company_id', companyId)
    .not('appointment_id', 'is', null)
    .order('created_at', { ascending: false });

  if (salesRes.error) {
    salesRes = await supabase
      .from('sales')
      .select('id, appointment_id, created_at, sale_items ( description )')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .not('appointment_id', 'is', null)
      .order('created_at', { ascending: false });
  }

  if (salesRes.error) throw salesRes.error;

  for (const bono of bonos) {
    const purchaseYmd = bono.fecha_compra?.slice(0, 10);
    if (!purchaseYmd) continue;
    const nameNorm = bono.nombre.trim().toLowerCase();

    for (const sale of salesRes.data ?? []) {
      const appointmentId = (sale as { appointment_id?: string | null }).appointment_id;
      if (!appointmentId) continue;
      const saleYmd = String((sale as { created_at?: string }).created_at ?? '').slice(0, 10);
      if (saleYmd !== purchaseYmd) continue;

      const items = (sale as { sale_items?: unknown[] }).sale_items ?? [];
      const matches = items.some((raw) => {
        const item = raw as {
          description?: string | null;
          articles?: { article_kind?: string | null; descripcion?: string | null } | null;
        };
        if (item.articles && isBonoArticleKind(item.articles.article_kind)) return true;
        const desc = String(item.description ?? item.articles?.descripcion ?? '').toLowerCase();
        return nameNorm.length > 2 && desc.includes(nameNorm);
      });

      if (matches) {
        map.set(bono.id, { appointmentId: String(appointmentId), dateYmd: saleYmd });
        break;
      }
    }
  }

  return map;
}
