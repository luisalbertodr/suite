import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppointmentItemDraft, AppointmentItemKind, BonusPaymentMode } from '@/types/agenda';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const appointmentItemsQueryKey = (appointmentId: string) =>
  ['appointment-items', appointmentId] as const;

let appointmentItemsPricingColumnsMissing: boolean | null = null;
const nullIfBlank = (value: unknown) => {
  const s = String(value ?? '').trim();
  return s ? s : null;
};

const extractMissingAppointmentItemsColumn = (
  error: { code?: string; message?: string } | null | undefined
): string | null => {
  if (!error) return null;
  const msg = String(error.message || '');
  const m1 = msg.match(/'([^']+)' column of 'appointment_items'/i);
  if (m1?.[1]) return m1[1];
  const m2 = msg.match(/column\s+appointment_items\.([a-zA-Z0-9_]+)/i);
  if (m2?.[1]) return m2[1];
  return null;
};

function mapRowToDraft(row: {
  id: string;
  kind: string;
  label: string;
  duration_minutes: number;
  occupies_time: boolean;
  quantity: number | null;
  unit_price: number | null;
  bonus_payment_mode: string | null;
  notes?: string | null;
  article_id: string | null;
  customer_voucher_id: string | null;
  articles?: { precio?: number | null } | null;
}): AppointmentItemDraft {
  const fallbackPricing = parsePricingFromNotes(row.notes ?? null);
  const articlePrice = Number(row.articles?.precio ?? 0);
  const resolvedUnitPriceRaw = Number(row.unit_price ?? fallbackPricing.unit_price ?? 0);
  const resolvedUnitPrice =
    resolvedUnitPriceRaw > 0 ? resolvedUnitPriceRaw : (row.article_id ? Math.max(0, articlePrice) : 0);
  return {
    clientKey: row.id,
    kind: row.kind as AppointmentItemKind,
    label: row.label,
    duration_minutes: row.duration_minutes,
    occupies_time: row.occupies_time,
    quantity: Number(row.quantity ?? fallbackPricing.quantity ?? 1),
    unit_price: resolvedUnitPrice,
    bonus_payment_mode:
      (row.bonus_payment_mode as BonusPaymentMode | null) ??
      fallbackPricing.bonus_payment_mode ??
      'none',
    article_id: row.article_id,
    customer_voucher_id: row.customer_voucher_id,
  };
}

type PricingPayload = {
  quantity: number;
  unit_price: number;
  bonus_payment_mode: BonusPaymentMode;
};

function encodePricingInNotes(payload: PricingPayload): string {
  return `__pricing__${JSON.stringify(payload)}`;
}

function parsePricingFromNotes(notes: string | null): Partial<PricingPayload> {
  if (!notes || !notes.startsWith('__pricing__')) return {};
  try {
    const parsed = JSON.parse(notes.slice('__pricing__'.length)) as Partial<PricingPayload>;
    return {
      quantity: Number(parsed.quantity ?? 1),
      unit_price: Number(parsed.unit_price ?? 0),
      bonus_payment_mode: (parsed.bonus_payment_mode ?? 'none') as BonusPaymentMode,
    };
  } catch {
    return {};
  }
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferItemPriceFromLabel(
  label: string | null | undefined,
  byCode: Map<string, number>,
  byDescription: Map<string, number>
): number {
  const raw = String(label || '').trim();
  if (!raw) return 0;
  const codeMatch = raw.match(/^([A-Za-z0-9._-]+)\s*[-:]/);
  if (codeMatch?.[1]) {
    const byCodePrice = byCode.get(codeMatch[1].toLowerCase());
    if (typeof byCodePrice === 'number' && byCodePrice > 0) return byCodePrice;
  }
  const normalized = normalizeText(raw.replace(/^([A-Za-z0-9._-]+)\s*[-:]\s*/, ''));
  return Math.max(0, Number(byDescription.get(normalized) || 0));
}

function isMissingPricingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('appointment_items.quantity') ||
    msg.includes('appointment_items.unit_price') ||
    msg.includes('appointment_items.bonus_payment_mode') ||
    (msg.includes('column') && msg.includes('does not exist') && msg.includes('appointment_items'))
  );
}

export async function fetchAppointmentItems(
  appointmentId: string,
  companyId?: string
): Promise<AppointmentItemDraft[]> {
  const columns = [
    'id',
    'kind',
    'label',
    'duration_minutes',
    'occupies_time',
    'notes',
    'article_id',
    'customer_voucher_id',
    'sort_order',
    'articles(precio)',
  ];
  let enabledColumns = [...columns];
  let data: any[] | null = null;
  let error: any = null;

  for (let i = 0; i < 8; i += 1) {
    ({ data, error } = await supabase
      .from('appointment_items')
      .select(enabledColumns.join(','))
      .eq('appointment_id', appointmentId)
      .order('sort_order', { ascending: true }));
    if (!error) break;
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    const missing = extractMissingAppointmentItemsColumn(error);
    if (!missing || !enabledColumns.includes(missing)) break;
    enabledColumns = enabledColumns.filter((c) => c !== missing);
  }

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }

  const rows = (data || []) as Array<{
    id: string;
    kind: string;
    label: string;
    duration_minutes?: number;
    occupies_time?: boolean;
    quantity: number | null;
    unit_price: number | null;
    bonus_payment_mode: string | null;
    notes?: string | null;
    article_id: string | null;
    customer_voucher_id: string | null;
    articles?: { precio?: number | null } | null;
  }>;

  const needsCatalog = rows.some((r) => {
    const fallback = parsePricingFromNotes(r.notes ?? null);
    const unit = Number(r.unit_price ?? fallback.unit_price ?? 0);
    return (!r.article_id && unit <= 0 && !!r.label);
  });

  const byCode = new Map<string, number>();
  const byDescription = new Map<string, number>();
  if (companyId && needsCatalog) {
    const { data: articleRows } = await supabase
      .from('articles')
      .select('codigo, descripcion, precio')
      .eq('company_id', companyId);
    for (const a of articleRows || []) {
      const price = Math.max(0, Number(a.precio || 0));
      if (price <= 0) continue;
      if (a.codigo) byCode.set(String(a.codigo).toLowerCase(), price);
      if (a.descripcion) byDescription.set(normalizeText(a.descripcion), price);
    }
  }

  return rows.map((row) => {
    const draft = mapRowToDraft(row);
    if (row.occupies_time == null) draft.occupies_time = true;
    if (row.duration_minutes == null) draft.duration_minutes = Math.max(0, Number(draft.duration_minutes || 0));
    if ((draft.unit_price ?? 0) > 0) return draft;
    if (row.article_id) return draft;
    const inferred = inferItemPriceFromLabel(row.label, byCode, byDescription);
    return inferred > 0 ? { ...draft, unit_price: inferred } : draft;
  });
}

export async function syncAppointmentItems(
  appointmentId: string,
  items: AppointmentItemDraft[]
): Promise<void> {
  const del = await supabase.from('appointment_items').delete().eq('appointment_id', appointmentId);
  if (del.error && del.error.code !== '42P01' && del.error.code !== 'PGRST205') {
    throw del.error;
  }
  if (!items.length) return;

  const rows = items.map((it, sort_order) => ({
    appointment_id: appointmentId,
    kind: it.kind,
    label: (it.label || '').trim() || 'Sin nombre',
    duration_minutes: Math.max(0, Number(it.duration_minutes) || 0),
    occupies_time: it.occupies_time,
    quantity: Math.max(0, Number(it.quantity ?? 1)),
    unit_price: Math.max(0, Number(it.unit_price ?? 0)),
    bonus_payment_mode: it.bonus_payment_mode ?? 'none',
    notes: encodePricingInNotes({
      quantity: Math.max(0, Number(it.quantity ?? 1)),
      unit_price: Math.max(0, Number(it.unit_price ?? 0)),
      bonus_payment_mode: it.bonus_payment_mode ?? 'none',
    }),
    sort_order,
    article_id: nullIfBlank(it.article_id),
    customer_voucher_id: nullIfBlank(it.customer_voucher_id),
  }));

  const fallbackRows = rows.map(
    ({
      appointment_id,
      kind,
      label,
      duration_minutes,
      occupies_time,
      notes,
      sort_order,
      article_id,
      customer_voucher_id,
    }) => ({
      appointment_id,
      kind,
      label,
      duration_minutes,
      occupies_time,
      notes,
      sort_order,
      article_id,
      customer_voucher_id,
    })
  );

  const rowsBase = appointmentItemsPricingColumnsMissing === true ? fallbackRows : rows;
  let candidateRows = rowsBase as Array<Record<string, unknown>>;

  for (let i = 0; i < 10; i += 1) {
    const ins = await supabase.from('appointment_items').insert(candidateRows);
    if (!ins.error) {
      if (candidateRows === rows) appointmentItemsPricingColumnsMissing = false;
      return;
    }
    const missing = extractMissingAppointmentItemsColumn(ins.error);
    if (!missing) throw ins.error;
    const hasMissing = candidateRows.some((r) => Object.prototype.hasOwnProperty.call(r, missing));
    if (!hasMissing) throw ins.error;
    candidateRows = candidateRows.map((r) => {
      const { [missing]: _drop, ...rest } = r;
      return rest;
    });
    if (isMissingPricingColumnError(ins.error)) appointmentItemsPricingColumnsMissing = true;
  }
  throw new Error('No se pudo guardar appointment_items por incompatibilidad de columnas.');
}

export function useAppointmentItems(appointmentId: string | undefined) {
  const { companyId } = useCompanyFilter();
  return useQuery({
    queryKey: [...appointmentItemsQueryKey(appointmentId ?? ''), companyId ?? 'no-company'] as const,
    queryFn: () => fetchAppointmentItems(appointmentId!, companyId || undefined),
    enabled: !!appointmentId && !!companyId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
