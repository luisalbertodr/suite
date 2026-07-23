import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type DunasoftSyncStatus = {
  pending_dbf: number;
  error_dbf: number;
  pending_outbox: number;
};

export function useDunasoftSyncStatus(pollMs = 30_000, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: ['dunasoft-sync-status'],
    enabled,
    queryFn: async (): Promise<DunasoftSyncStatus> => {
      const { data, error } = await supabase.rpc('agenda_dunasoft_sync_status');
      if (error) throw error;
      const row = (data ?? {}) as Record<string, number>;
      return {
        pending_dbf: Number(row.pending_dbf ?? 0),
        error_dbf: Number(row.error_dbf ?? 0),
        pending_outbox: Number(row.pending_outbox ?? 0),
      };
    },
    refetchInterval: enabled ? pollMs : false,
    staleTime: 10_000,
  });
}
