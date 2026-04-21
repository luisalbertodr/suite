import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppointmentItemDraft, AppointmentItemKind, BonusPaymentMode } from '@/types/agenda';

export const appointmentItemsQueryKey = (appointmentId: string) =>
  ['appointment-items', appointmentId] as const;

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
}): AppointmentItemDraft {
  const fallbackPricing = parsePricingFromNotes(row.notes ?? null);
  return {
    clientKey: row.id,
    kind: row.kind as AppointmentItemKind,
    label: row.label,
    duration_minutes: row.duration_minutes,
    occupies_time: row.occupies_time,
    quantity: Number(row.quantity ?? fallbackPricing.quantity ?? 1),
    unit_price: Number(row.unit_price ?? fallbackPricing.unit_price ?? 0),
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

export async function fetchAppointmentItems(
  appointmentId: string
): Promise<AppointmentItemDraft[]> {
  let { data, error } = await supabase
    .from('appointment_items')
    .select('id,kind,label,duration_minutes,occupies_time,quantity,unit_price,bonus_payment_mode,notes,article_id,customer_voucher_id')
    .eq('appointment_id', appointmentId)
    .order('sort_order', { ascending: true });

  if (error?.code === '42703') {
    // Fallback para entornos sin columnas nuevas de pricing.
    ({ data, error } = await supabase
      .from('appointment_items')
      .select('id,kind,label,duration_minutes,occupies_time,notes,article_id,customer_voucher_id')
      .eq('appointment_id', appointmentId)
      .order('sort_order', { ascending: true }));
  }

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }
  return (data || []).map((row) => mapRowToDraft(row));
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
    article_id: it.article_id ?? null,
    customer_voucher_id: it.customer_voucher_id ?? null,
  }));

  let ins = await supabase.from('appointment_items').insert(rows);
  if (ins.error?.code === '42703') {
    // Fallback para entornos sin columnas nuevas.
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
    ins = await supabase.from('appointment_items').insert(fallbackRows);
  }
  if (ins.error) throw ins.error;
}

export function useAppointmentItems(appointmentId: string | undefined) {
  return useQuery({
    queryKey: appointmentItemsQueryKey(appointmentId ?? ''),
    queryFn: () => fetchAppointmentItems(appointmentId!),
    enabled: !!appointmentId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
