import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppointmentItemDraft, AppointmentItemKind } from '@/types/agenda';

export const appointmentItemsQueryKey = (appointmentId: string) =>
  ['appointment-items', appointmentId] as const;

const isMissingRelation = (error: { code?: string; message?: string } | null) =>
  !!error && (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /Could not find the table/i.test(error.message || '') ||
    /relation .* does not exist/i.test(error.message || '') ||
    /column .* does not exist/i.test(error.message || '')
  );

function mapRowToDraft(row: {
  id: string;
  kind: string;
  label: string;
  duration_minutes: number;
  occupies_time: boolean;
  article_id: string | null;
  customer_voucher_id: string | null;
}): AppointmentItemDraft {
  return {
    clientKey: row.id,
    kind: row.kind as AppointmentItemKind,
    label: row.label,
    duration_minutes: row.duration_minutes,
    occupies_time: row.occupies_time,
    article_id: row.article_id,
    customer_voucher_id: row.customer_voucher_id,
  };
}

export async function fetchAppointmentItems(appointmentId: string): Promise<AppointmentItemDraft[]> {
  const db = supabase as any;
  const { data, error } = await db
    .from('appointment_items')
    .select('id,kind,label,duration_minutes,occupies_time,article_id,customer_voucher_id')
    .eq('appointment_id', appointmentId)
    .order('sort_order', { ascending: true });

  if (isMissingRelation(error)) return [];
  if (error) throw error;
  return (data || []).map((row: any) => mapRowToDraft(row));
}

export async function syncAppointmentItems(appointmentId: string, items: AppointmentItemDraft[]): Promise<void> {
  const db = supabase as any;
  const del = await db.from('appointment_items').delete().eq('appointment_id', appointmentId);
  if (del.error && !isMissingRelation(del.error)) throw del.error;
  if (!items.length || isMissingRelation(del.error)) return;

  const rows = items.map((it, sort_order) => ({
    appointment_id: appointmentId,
    kind: it.kind,
    label: (it.label || '').trim() || 'Sin nombre',
    duration_minutes: Math.max(0, Number(it.duration_minutes) || 0),
    occupies_time: it.occupies_time,
    sort_order,
    article_id: it.article_id ?? null,
    customer_voucher_id: it.customer_voucher_id ?? null,
  }));

  const ins = await db.from('appointment_items').insert(rows);
  if (ins.error && !isMissingRelation(ins.error)) throw ins.error;
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