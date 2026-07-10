import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';

type SyncEventLogRow = {
  entity?: string;
  payload?: { fecha?: string | null };
};

/**
 * Refresca la agenda cuando Style confirma un cambio inbound.
 * Prioridad: Realtime en sync_event_log; fallback poll del agente (30 s).
 */
export function useAgendaInboundSyncRefetch(
  companyId: string | null | undefined,
  refetch: () => void | Promise<unknown>,
  /** Si se indica, solo refetch cuando el evento afecta a este día (YYYY-MM-DD). */
  dateYmd?: string,
) {
  const { data: styleSync } = useStyleSyncAgentStatus(companyId, 30_000);
  const lastTsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

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
          if (dateYmd && eventDate) {
            const ymd = String(eventDate).slice(0, 10);
            if (ymd !== dateYmd) return;
          }
          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, dateYmd, refetch]);

  useEffect(() => {
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
  }, [styleSync?.last_outbound_ok_at, refetch]);
}
