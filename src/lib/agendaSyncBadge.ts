import type { DunasoftSyncStatus } from '@/hooks/useDunasoftSyncStatus';
import type { StyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';

export type AgendaSyncBadge = {
  label: string;
  title: string;
  tone: 'ok' | 'pending' | 'error';
};

/** Si el último outbound OK es más antiguo, el badge no debe decir «Sync OK». */
const OUTBOUND_STALE_MS = 15 * 60_000;
/** Lag reportado por el agente a partir del cual se considera atrasado. */
const LAG_STALE_MS = 15 * 60_000;
/** Si el agente no hace tick, también es error. */
const AGENT_TICK_STALE_MS = 5 * 60_000;

function ageMs(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

function formatAge(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** Etiqueta compacta para la barra superior, p. ej. «12/247 Sync». */
export function buildAgendaSyncBadge(
  syncStatus?: DunasoftSyncStatus | null,
  styleSync?: StyleSyncAgentStatus | null,
  nowMs: number = Date.now(),
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

  const outboundAge = ageMs(styleSync?.last_outbound_ok_at, nowMs);
  const tickAge = ageMs(styleSync?.agent_last_tick_at, nowMs);
  const lagMs = styleSync?.last_outbound_lag_ms;
  const outboundStale =
    outboundAge == null ||
    outboundAge > OUTBOUND_STALE_MS ||
    (lagMs != null && lagMs > LAG_STALE_MS);
  const agentStale = tickAge != null && tickAge > AGENT_TICK_STALE_MS;

  const label =
    pending > 0
      ? cursor > 0
        ? `${pending}/${cursor} Sync`
        : `${pending} Sync`
      : outboundStale || agentStale
        ? 'Sync atrasado'
        : 'Sync OK';

  const parts: string[] = [];
  if (pendingDbf > 0) parts.push(`${pendingDbf} pendiente(s) DBF/cola`);
  if (pendingInbound > 0) parts.push(`${pendingInbound} inbound Style`);
  if (errors > 0) parts.push(`${errors} error(es)`);
  if (styleSync?.inbound_worker_status) {
    parts.push(`worker ${styleSync.inbound_worker_status}`);
  }
  if (cursor > 0) parts.push(`cursor cola ${cursor}`);
  if (outboundAge != null) {
    parts.push(`último outbound hace ${formatAge(outboundAge)}`);
  } else if (styleSync) {
    parts.push('sin outbound registrado');
  }
  if (lagMs != null && lagMs > LAG_STALE_MS) {
    parts.push(`lag ${formatAge(lagMs)}`);
  }
  if (agentStale && tickAge != null) {
    parts.push(`agente sin tick (${formatAge(tickAge)})`);
  }
  // La grid lee dunasoft.plan2009 en Postgres; el DBF Style puede ir segundos detrás (Suite→Style).
  const title =
    parts.length > 0
      ? `${parts.join(' · ')} · Vista Suite = Postgres (no DBF en vivo)`
      : 'Sincronización al día · Vista Suite = Postgres (DBF Style puede ir segundos detrás)';

  const tone: AgendaSyncBadge['tone'] =
    errors > 0 || styleSync?.inbound_worker_status === 'stopped' || agentStale
      ? 'error'
      : pending > 0 || outboundStale
        ? 'pending'
        : 'ok';

  return { label, title, tone };
}
