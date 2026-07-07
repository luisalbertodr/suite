import { useEffect, useRef } from 'react';
import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';

/**
 * Refresca la agenda cuando el agente Style confirma un cambio inbound
 * (cola_sincro o poll DBF). Evita depender de F5 tras editar en Style.
 */
export function useAgendaInboundSyncRefetch(
  companyId: string | null | undefined,
  refetch: () => void | Promise<unknown>,
) {
  const { data: styleSync } = useStyleSyncAgentStatus(companyId, 4_000);
  const lastTsRef = useRef<string | null>(null);

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
