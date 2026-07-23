import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';

type SyncEventLogRow = {
  entity?: string;
  payload?: { fecha?: string | null };
};

/**
 * Refresca la agenda cuando Style (o Suite dual-write) confirma un cambio en plan2009.
 * Prioridad: Realtime en sync_event_log; fallback poll del agente (30 s).
 * La grid lee dunasoft.plan2009 en PG; el DBF Style puede ir segundos detrás en Suite→Style.
 */
export function useAgendaInboundSyncRefetch(
  companyId: string | null | undefined,
  refetch: () => void | Promise<unknown>,
  /** Si se indica, solo refetch cuando el evento afecta a este día (YYYY-MM-DD). */
  dateYmd?: string,
  opts?: { enabled?: boolean },
) {
  const enabled = opts?.enabled ?? true;
  const queryClient = useQueryClient();
  const { data: styleSync } = useStyleSyncAgentStatus(companyId, 30_000, { enabled });
  const lastTsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !companyId) return;

    const channel = supabase
      .channel(`sync-event-log-agenda-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'dunasoft',
          table: 'sync_event_log',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as SyncEventLogRow;
          if (row.entity !== 'plan2009') return;
          const eventDate = row.payload?.fecha;
          const ymd = eventDate ? String(eventDate).slice(0, 10) : null;

          if (ymd && dateYmd && ymd !== dateYmd) {
            // Invalidar caché del otro día para no servir stale al navegar.
            void queryClient.invalidateQueries({
              queryKey: ['dunasoft-agenda-day', ymd, companyId],
            });
            return;
          }

          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, dateYmd, enabled, queryClient, refetch]);

  useEffect(() => {
    if (!enabled) return;
    const ts = styleSync?.last_outbound_ok_at;
    if (!ts) return;
    if (lastTsRef.current === null) {
      lastTsRef.current = ts;
      return;
    }
    if (ts !== lastTsRef.current) {
      lastTsRef.current = ts;
      void refetch();
    }
  }, [enabled, styleSync?.last_outbound_ok_at, refetch]);
}
