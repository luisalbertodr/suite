import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';
import { cn } from '@/lib/utils';

type Props = {
  companyId?: string | null;
  className?: string;
};

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return '—';
  }
}

export const StyleSyncStatusPanel: React.FC<Props> = ({ companyId, className }) => {
  const { data, isLoading, isError } = useStyleSyncAgentStatus(companyId, 25_000);

  if (!companyId) return null;

  if (isLoading && !data) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Sync Style…
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-destructive', className)}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Sin estado del agente Style
      </div>
    );
  }

  const workerOk = data.inbound_worker_status === 'ok';
  const workerStopped = data.inbound_worker_status === 'stopped';
  const hasErrors = data.outbound_errors > 0 || data.inbound_errors > 0;
  const lagHigh =
    (data.last_outbound_lag_ms != null && data.last_outbound_lag_ms > 30_000) ||
    (data.last_inbound_lag_ms != null && data.last_inbound_lag_ms > 30_000);

  const tone = workerStopped || hasErrors
    ? 'text-destructive'
    : lagHigh || data.pending_inbound_queue > 0
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-emerald-700 dark:text-emerald-400';

  const Icon = workerStopped || hasErrors ? AlertTriangle : workerOk ? CheckCircle2 : Radio;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px]',
        className,
      )}
      title={data.inbound_worker_alert_message ?? undefined}
    >
      <span className={cn('inline-flex items-center gap-1 font-medium', tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        Sync Style v2
      </span>
      <span className="text-muted-foreground">
        cola cursor {data.last_cola_id}
      </span>
      <span className="text-muted-foreground">
        out {fmtAgo(data.last_outbound_ok_at)}
      </span>
      <span className="text-muted-foreground">
        in {fmtAgo(data.last_inbound_ok_at)}
      </span>
      <span className={cn(workerStopped ? 'text-destructive' : 'text-muted-foreground')}>
        worker {data.inbound_worker_status}
      </span>
      {data.pending_inbound_queue > 0 ? (
        <span className="text-amber-700 dark:text-amber-400">
          {data.pending_inbound_queue} inbound pend.
        </span>
      ) : null}
      {(data.outbound_errors > 0 || data.inbound_errors > 0) && (
        <span className="text-destructive">
          err {data.outbound_errors}/{data.inbound_errors}
        </span>
      )}
      {data.agent_version ? (
        <span className="text-muted-foreground">ag {data.agent_version}</span>
      ) : null}
    </div>
  );
};
