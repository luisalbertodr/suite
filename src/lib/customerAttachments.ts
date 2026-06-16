import { supabase } from '@/lib/supabase';
import { appointmentAssetPublicUrl } from '@/lib/appointmentAssets';

export type CustomerAttachmentKind = 'photo' | 'document' | 'consent' | 'other';

export type CustomerAttachmentSource =
  | 'daily_log'
  | 'historial'
  | 'consentimiento'
  | 'cita';

export type CustomerAttachment = {
  id: string;
  date: string;
  createdAt: string;
  url: string;
  title: string;
  kind: CustomerAttachmentKind;
  source: CustomerAttachmentSource;
  sourceLabel: string;
  isImage: boolean;
  refTable?: string | null;
  refId?: string | null;
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(\?|$)/i;

function toYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function resolveUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return appointmentAssetPublicUrl(raw) ?? raw;
}

export function isCustomerAttachmentImage(
  url: string,
  kind: CustomerAttachmentKind,
): boolean {
  if (kind === 'photo' || kind === 'consent') return true;
  return IMAGE_EXT.test(url);
}

/** ID de fila en daily_customer_log_assets si el adjunto se puede borrar desde Suite. */
export function deletableCustomerAttachmentAssetId(item: CustomerAttachment): string | null {
  if (!item.id.startsWith('log-asset:')) return null;
  return item.id.slice('log-asset:'.length) || null;
}

function assetKindToAttachmentKind(assetKind: string): CustomerAttachmentKind {
  if (assetKind === 'photo_before' || assetKind === 'photo_after') return 'photo';
  if (assetKind === 'consent') return 'consent';
  if (assetKind === 'document') return 'document';
  return 'other';
}

function assetKindLabel(assetKind: string): string {
  switch (assetKind) {
    case 'photo_before':
      return 'Foto antes';
    case 'photo_after':
      return 'Foto después';
    case 'consent':
      return 'Consentimiento';
    case 'document':
      return 'Documento';
    default:
      return 'Adjunto';
  }
}

export async function fetchCustomerAttachments(customerId: string): Promise<CustomerAttachment[]> {
  const [logsRes, historialRes, consentRes] = await Promise.all([
    supabase
      .from('daily_customer_log')
      .select(
        'log_date, created_at, daily_customer_log_assets(id, asset_kind, title, storage_path, created_at, ref_table, ref_id)',
      )
      .eq('customer_id', customerId)
      .order('log_date', { ascending: false }),
    supabase
      .from('historial_clinico')
      .select('id, titulo, fecha, fotos_antes, fotos_despues, created_at')
      .eq('customer_id', customerId)
      .order('fecha', { ascending: false }),
    supabase
      .from('consentimientos')
      .select('id, titulo, firma_url, documento_pdf_url, fecha_firma, created_at, firmado')
      .eq('customer_id', customerId)
      .or('firma_url.not.is.null,documento_pdf_url.not.is.null'),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (historialRes.error) throw historialRes.error;
  if (consentRes.error) throw consentRes.error;

  const items: CustomerAttachment[] = [];

  for (const log of logsRes.data ?? []) {
    const logDate = toYmd(log.log_date) ?? toYmd(log.created_at) ?? '1970-01-01';
    for (const asset of log.daily_customer_log_assets ?? []) {
      if (!asset) continue;
      const url = resolveUrl(asset.storage_path);
      if (!url) continue;
      const kind = assetKindToAttachmentKind(asset.asset_kind);
      items.push({
        id: `log-asset:${asset.id}`,
        date: logDate,
        createdAt: asset.created_at ?? log.created_at ?? logDate,
        url,
        title: asset.title?.trim() || assetKindLabel(asset.asset_kind),
        kind,
        source: asset.ref_table === 'agenda_appointments' ? 'cita' : 'daily_log',
        sourceLabel:
          asset.ref_table === 'agenda_appointments'
            ? 'Cita'
            : asset.ref_table === 'customers'
              ? 'Immich'
              : 'Registro diario',
        isImage: isCustomerAttachmentImage(url, kind),
        refTable: asset.ref_table,
        refId: asset.ref_id,
      });
    }
  }

  for (const h of historialRes.data ?? []) {
    const date = toYmd(h.fecha) ?? toYmd(h.created_at) ?? '1970-01-01';
    const baseTitle = h.titulo?.trim() || 'Historial clínico';
    const antes = Array.isArray(h.fotos_antes) ? h.fotos_antes.filter(Boolean) : [];
    const despues = Array.isArray(h.fotos_despues) ? h.fotos_despues.filter(Boolean) : [];
    antes.forEach((raw, i) => {
      const url = resolveUrl(String(raw));
      if (!url) return;
      items.push({
        id: `hc:${h.id}:antes:${i}`,
        date,
        createdAt: h.created_at ?? date,
        url,
        title: `${baseTitle} · Antes`,
        kind: 'photo',
        source: 'historial',
        sourceLabel: 'Historial clínico',
        isImage: true,
        refTable: 'historial_clinico',
        refId: h.id,
      });
    });
    despues.forEach((raw, i) => {
      const url = resolveUrl(String(raw));
      if (!url) return;
      items.push({
        id: `hc:${h.id}:despues:${i}`,
        date,
        createdAt: h.created_at ?? date,
        url,
        title: `${baseTitle} · Después`,
        kind: 'photo',
        source: 'historial',
        sourceLabel: 'Historial clínico',
        isImage: true,
        refTable: 'historial_clinico',
        refId: h.id,
      });
    });
  }

  for (const c of consentRes.data ?? []) {
    const rawPath = c.documento_pdf_url || c.firma_url;
    const url = resolveUrl(rawPath);
    if (!url) continue;
    const date = toYmd(c.fecha_firma) ?? toYmd(c.created_at) ?? '1970-01-01';
    const isPdf = /\.pdf(\?|$)/i.test(rawPath ?? '') || (c.documento_pdf_url && !c.firma_url);
    items.push({
      id: `consent:${c.id}`,
      date,
      createdAt: c.created_at ?? date,
      url,
      title: c.titulo?.trim() || 'Consentimiento firmado',
      kind: 'consent',
      source: 'consentimiento',
      sourceLabel: 'Consentimiento',
      isImage: isPdf ? false : isCustomerAttachmentImage(url, 'consent'),
      refTable: 'consentimientos',
      refId: c.id,
    });
  }

  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.url}|${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return unique;
}

export function groupCustomerAttachmentsByDate(
  items: CustomerAttachment[],
): Array<{ date: string; items: CustomerAttachment[] }> {
  const map = new Map<string, CustomerAttachment[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, groupItems]) => ({ date, items: groupItems }));
}
