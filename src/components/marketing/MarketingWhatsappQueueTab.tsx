import React, { useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock,
  ListOrdered,
  Loader2,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useMarketingWhatsappQueue,
  type MarketingWhatsappQueueRow,
} from '@/hooks/useMarketingWhatsappQueue';

function leadLabel(row: MarketingWhatsappQueueRow): string {
  const lead = row.marketing_leads;
  if (!lead) return 'Lead desconocido';
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return name || lead.phone || 'Sin nombre';
}

function leadDate(row: MarketingWhatsappQueueRow): string {
  const lead = row.marketing_leads;
  if (!lead) return '';
  const iso = lead.external_created_at ?? lead.created_at;
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: es });
  } catch {
    return '';
  }
}

export const MarketingWhatsappQueueTab: React.FC<{
  companyId: string;
  canWrite: boolean;
}> = ({ companyId, canWrite }) => {
  const { toast } = useToast();
  const {
    stats,
    statsLoading,
    queueRows,
    queueLoading,
    enqueueAll,
    cancelPending,
    refetch,
  } = useMarketingWhatsappQueue(companyId);

  const pendingRows = useMemo(
    () => queueRows.filter((r) => r.status === 'pending'),
    [queueRows],
  );
  const recentRows = useMemo(
    () =>
      queueRows
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => (b.sent_at ?? b.queued_at).localeCompare(a.sent_at ?? a.queued_at))
        .slice(0, 40),
    [queueRows],
  );

  const handleEnqueueAll = async () => {
    try {
      const res = await enqueueAll.mutateAsync();
      toast({
        title: 'Cola actualizada',
        description: `${res.enqueued} lead(s) encolados. Pendientes en cola: ${res.stats.pending}.`,
      });
    } catch (e) {
      toast({
        title: 'No se pudo encolar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelPending.mutateAsync([id]);
      toast({ title: 'Eliminado de la cola' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo cancelar',
        variant: 'destructive',
      });
    }
  };

  if (statsLoading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Pendientes en cola</p>
          <p className="text-2xl font-semibold">{stats?.pending ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Enviados hoy</p>
          <p className="text-2xl font-semibold">
            {stats?.sent_today ?? 0}
            <span className="text-sm font-normal text-muted-foreground">
              {' '}
              / {stats?.daily_limit ?? 50}
            </span>
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Sin encolar (pendientes WA)</p>
          <p className="text-2xl font-semibold">{stats?.eligible_not_queued ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Horario activo</p>
          <p className="text-sm font-medium mt-1">
            {stats?.hour_start ?? 10}:00 – {stats?.hour_end ?? 20}:00 (Madrid)
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {stats?.within_hours ? (
              <>
                <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400">Enviando ahora</span>
              </>
            ) : (
              <>
                <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-700 dark:text-amber-400">Fuera de horario</span>
              </>
            )}
          </div>
          {stats?.next_send_at ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              Próximo envío:{' '}
              {formatDistanceToNow(new Date(stats.next_send_at), { addSuffix: true, locale: es })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canWrite ? (
          <Button
            size="sm"
            onClick={handleEnqueueAll}
            disabled={enqueueAll.isPending || (stats?.eligible_not_queued ?? 0) === 0}
          >
            {enqueueAll.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
            )}
            Encolar pendientes ({stats?.eligible_not_queued ?? 0})
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Actualizar
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Máx. {stats?.daily_limit ?? 50}/día · pausas aleatorias 3–15 min · orden: leads más
          antiguos primero. Horario configurable en Configuración → Marketing → WhatsApp (citas y
          alertas). Tras el mensaje inicial, el recordatorio a 3 h sigue automático.
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <MessageSquare className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Cola pendiente ({pendingRows.length})</h3>
        </div>
        <ScrollArea className="h-[min(420px,50vh)]">
          {queueLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pendingRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay leads en cola. Usa «Encolar pendientes» para añadir leads sin WhatsApp inicial.
            </p>
          ) : (
            <ul className="divide-y">
              {pendingRows.map((row, index) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">#{index + 1}</span>
                      <span className="font-medium truncate">{leadLabel(row)}</span>
                      {row.marketing_leads?.form_name ? (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {row.marketing_leads.form_name}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.marketing_leads?.phone ?? ''}
                      {leadDate(row) ? ` · Lead ${leadDate(row)}` : ''}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Quitar de la cola"
                      onClick={() => handleCancel(row.id)}
                      disabled={cancelPending.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {recentRows.length > 0 ? (
        <div className="rounded-xl border bg-muted/20">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Recientes (enviados / fallidos)</h3>
          </div>
          <ScrollArea className="h-[200px]">
            <ul className="divide-y">
              {recentRows.map((row) => (
                <li key={row.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{leadLabel(row)}</span>
                    <Badge
                      variant={
                        row.status === 'sent' ? 'default' : row.status === 'failed' ? 'destructive' : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {row.status}
                    </Badge>
                  </div>
                  {row.error ? (
                    <p className="text-[10px] text-rose-600 mt-0.5">{row.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
};
