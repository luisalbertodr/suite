import type { DunasoftSyncStatus } from '@/hooks/useDunasoftSyncStatus';
import type { StyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';

export type AgendaSyncBadge = {
  label: string;
  title: string;
  tone: 'ok' | 'pending' | 'error';
};

/** Etiqueta compacta para la barra superior, p. ej. «12/247 Sync». */
export function buildAgendaSyncBadge(
  syncStatus?: DunasoftSyncStatus | null,
  styleSync?: StyleSyncAgentStatus | null,
): AgendaSyncBadge {
  const pendingDbf =
    (syncStatus?.pending_dbf ?? 0) + (syncStatus?.pending_outbox ?? 0);
  const pendingInbound = styleSync?.pending_inbound_queue ?? 0;
  const pending = pendingDbf + pendingInbound;
  const cursor = styleSync?.last_cola_id ?? 0;
  const errors =
    (syncStatus?.error_dbf ?? 0) +
    (styleSync?.outbound_errors ?? 0) +
    (styleSync?.inbound_errors ?? 0);

  const label =
    pending > 0
      ? cursor > 0
        ? `${pending}/${cursor} Sync`
        : `${pending} Sync`
      : 'Sync OK';

  const parts: string[] = [];
  if (pendingDbf > 0) parts.push(`${pendingDbf} pendiente(s) DBF/cola`);
  if (pendingInbound > 0) parts.push(`${pendingInbound} inbound Style`);
  if (errors > 0) parts.push(`${errors} error(es)`);
  if (styleSync?.inbound_worker_status) {
    parts.push(`worker ${styleSync.inbound_worker_status}`);
  }
  if (cursor > 0) parts.push(`cursor cola ${cursor}`);
  const title =
    parts.length > 0 ? parts.join(' · ') : 'Sincronización al día con Style / DBF';

  const tone: AgendaSyncBadge['tone'] =
    errors > 0 || styleSync?.inbound_worker_status === 'stopped'
      ? 'error'
      : pending > 0
        ? 'pending'
        : 'ok';

  return { label, title, tone };
}
