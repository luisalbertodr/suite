import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type StyleSyncAgentStatus = {
  ok: boolean;
  company_id?: string;
  last_cola_id: number;
  updated_at: string | null;
  last_outbound_ok_at: string | null;
  last_inbound_ok_at: string | null;
  outbound_errors: number;
  inbound_errors: number;
  last_outbound_lag_ms: number | null;
  last_inbound_lag_ms: number | null;
  inbound_worker_status: string;
  inbound_worker_last_seen_at: string | null;
  inbound_worker_alert_message: string | null;
  agent_last_tick_at: string | null;
  agent_version: string | null;
  worker_version: string | null;
  last_error: string | null;
  last_error_at: string | null;
  pending_inbound_queue: number;
};

export function useStyleSyncAgentStatus(companyId?: string | null, pollMs = 30_000) {
  return useQuery({
    queryKey: ['style-sync-agent-status', companyId ?? 'default'],
    enabled: !!companyId,
    queryFn: async (): Promise<StyleSyncAgentStatus | null> => {
      const { data, error } = await supabase.rpc('style_sync_agent_status', {
        p_company_id: companyId ?? undefined,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') return null;
      const row = data as Record<string, unknown>;
      return {
        ok: !!row.ok,
        company_id: typeof row.company_id === 'string' ? row.company_id : undefined,
        last_cola_id: Number(row.last_cola_id ?? 0),
        updated_at: (row.updated_at as string | null) ?? null,
        last_outbound_ok_at: (row.last_outbound_ok_at as string | null) ?? null,
        last_inbound_ok_at: (row.last_inbound_ok_at as string | null) ?? null,
        outbound_errors: Number(row.outbound_errors ?? 0),
        inbound_errors: Number(row.inbound_errors ?? 0),
        last_outbound_lag_ms:
          row.last_outbound_lag_ms != null ? Number(row.last_outbound_lag_ms) : null,
        last_inbound_lag_ms:
          row.last_inbound_lag_ms != null ? Number(row.last_inbound_lag_ms) : null,
        inbound_worker_status: String(row.inbound_worker_status ?? 'unknown'),
        inbound_worker_last_seen_at: (row.inbound_worker_last_seen_at as string | null) ?? null,
        inbound_worker_alert_message: (row.inbound_worker_alert_message as string | null) ?? null,
        agent_last_tick_at: (row.agent_last_tick_at as string | null) ?? null,
        agent_version: (row.agent_version as string | null) ?? null,
        worker_version: (row.worker_version as string | null) ?? null,
        last_error: (row.last_error as string | null) ?? null,
        last_error_at: (row.last_error_at as string | null) ?? null,
        pending_inbound_queue: Number(row.pending_inbound_queue ?? 0),
      };
    },
    refetchInterval: pollMs,
    staleTime: 10_000,
  });
}
