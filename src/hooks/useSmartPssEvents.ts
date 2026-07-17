import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type SmartPssEvent = {
  person_id: string;
  person_name: string;
  person_card_no: string;
  attendance_datetime: number | null;
  attendance_datetime_iso: string | null;
  attendance_state: number | null;
  attendance_method: number | null;
  device_ip: string;
  device_name: string;
  snapshots_path: string;
  handler: string;
  attendance_utc_time: number | null;
  attendance_utc_iso: string | null;
  remarks: string;
};

export type SmartPssEventsFilters = {
  from: string;
  to: string;
  q?: string;
  device?: string;
  state?: number | null;
  limit?: number;
};

export type SmartPssEventsResult = {
  events: SmartPssEvent[];
  total: number;
  limit: number;
};

async function invokeSmartPss<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('smartpss-events', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function useSmartPssEvents(filters: SmartPssEventsFilters, enabled = true) {
  return useQuery({
    queryKey: ['smartpss-events', filters],
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async () =>
      invokeSmartPss<SmartPssEventsResult>({
        action: 'events.list',
        from: filters.from,
        to: filters.to,
        q: filters.q || undefined,
        device: filters.device || undefined,
        state: filters.state ?? undefined,
        limit: filters.limit ?? 300,
      }),
  });
}

export function useSmartPssPing(enabled = false) {
  return useQuery({
    queryKey: ['smartpss-events-ping'],
    enabled,
    staleTime: 30_000,
    queryFn: async () =>
      invokeSmartPss<{ ok: boolean; database: string; table: string; total: number }>({
        action: 'ping',
      }),
  });
}

/** Estados típicos Dahua / SmartPSS (asistencia). */
export const SMARTPSS_STATE_LABELS: Record<number, string> = {
  0: 'Entrada',
  1: 'Salida',
  2: 'Descanso',
  3: 'Regreso',
};

/** Métodos de verificación habituales. */
export const SMARTPSS_METHOD_LABELS: Record<number, string> = {
  0: 'Contraseña',
  1: 'Tarjeta',
  2: 'Huella',
  3: 'Cara',
  4: 'Huella+contraseña',
  5: 'Tarjeta+contraseña',
  6: 'Tarjeta+huella',
  7: 'Tarjeta+huella+contraseña',
  8: 'Cara+huella',
  9: 'Cara+tarjeta',
  10: 'Cara+contraseña',
  11: 'Cara+tarjeta+huella',
  15: 'Otros',
};

export function smartPssStateLabel(state: number | null | undefined): string {
  if (state === null || state === undefined) return '—';
  return SMARTPSS_STATE_LABELS[state] ?? `Estado ${state}`;
}

export function smartPssMethodLabel(method: number | null | undefined): string {
  if (method === null || method === undefined) return '—';
  return SMARTPSS_METHOD_LABELS[method] ?? `Método ${method}`;
}
