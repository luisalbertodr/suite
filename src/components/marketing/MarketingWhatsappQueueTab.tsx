import React, { useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock,
  ListOrdered,
  Loader2,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Send,
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
import { useMarketingStages } from '@/hooks/useMarketingStages';
import { findMarketingIntakeStage } from '@/lib/marketingIntakeStage';
import { MarketingWhatsappEnqueueDialog } from './MarketingWhatsappEnqueueDialog';

function leadName(row: MarketingWhatsappQueueRow): string {
  const lead = row.marketing_leads;
  if (!lead) return 'Lead desconocido';
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return name || 'Sin nombre';
}

function leadPhone(row: MarketingWhatsappQueueRow): string | null {
  const phone = row.marketing_leads?.phone?.trim();
  return phone || null;
}

function LeadNameWithPhone({ row }: { row: MarketingWhatsappQueueRow }) {
  const name = leadName(row);
  const phone = leadPhone(row);
  const showName = name !== 'Sin nombre' && name !== 'Lead desconocido';
  return (
    <span className="truncate font-medium">
      {showName ? name : phone ?? name}
      {showName && phone ? (
        <span className="font-normal text-muted-foreground"> · {phone}</span>
      ) : null}
    </span>
  );
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
  const [enqueueOpen, setEnqueueOpen] = useState(false);
  const [sendingQueueId, setSendingQueueId] = useState<string | null>(null);
  const {
    stats,
    statsLoading,
    queueRows,
    queueLoading,
    cancelPending,
    sendNow,
    refetch,
  } = useMarketingWhatsappQueue(companyId);
  const { stages } = useMarketingStages(companyId);
  const intakeStageId = useMemo(
    () => findMarketingIntakeStage(stages ?? [])?.id ?? null,
    [stages],
  );

  const pendingRows = useMemo(
    () =>
      queueRows
        .filter(
          (r) =>
            r.status === 'pending' &&
            intakeStageId &&
            r.marketing_leads?.stage_id === intakeStageId,
        )
        .sort((a, b) => {
          const ka =
            a.marketing_leads?.external_created_at ??
            a.marketing_leads?.created_at ??
            a.queued_at;
          const kb =
            b.marketing_leads?.external_created_at ??
            b.marketing_leads?.created_at ??
            b.queued_at;
          return kb.localeCompare(ka);
        }),
    [queueRows, intakeStageId],
  );
  const recentRows = useMemo(
    () =>
      queueRows
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => (b.sent_at ?? b.queued_at).localeCompare(a.sent_at ?? a.queued_at))
        .slice(0, 40),
    [queueRows],
  );

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

  const handleSendNow = async (id: string) => {
    setSendingQueueId(id);
    try {
      await sendNow.mutateAsync(id);
      toast({ title: 'WhatsApp enviado' });
    } catch (e) {
      toast({
        title: 'Error al enviar',
        description: e instanceof Error ? e.message : 'No se pudo enviar',
        variant: 'destructive',
      });
    } finally {
      setSendingQueueId(null);
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
              / {stats?.daily_limit ?? 100}
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
            onClick={() => setEnqueueOpen(true)}
            disabled={(stats?.eligible_not_queued ?? 0) === 0}
          >
            <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
            Encolar
            {(stats?.eligible_not_queued ?? 0) > 0
              ? ` (${stats?.eligible_not_queued})`
              : ''}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Actualizar
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Máx. {stats?.daily_limit ?? 100}/día · pausas aleatorias 3–15 min · solo etapa{' '}
          <strong>Nuevo lead</strong> · orden: más recientes primero. Horario en Configuración →
          Marketing → WhatsApp (citas y alertas). El recordatorio (mensaje 2) depende de la
          configuración de cada formulario Meta.
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
              No hay leads en cola. Pulsa «Encolar» para elegir leads sin WhatsApp inicial.
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
                      <LeadNameWithPhone row={row} />
                      {row.marketing_leads?.form_name ? (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {row.marketing_leads.form_name}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {leadDate(row) ? `Lead ${leadDate(row)}` : ''}
                    </p>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        title="Enviar WhatsApp ahora (sin esperar al cron)"
                        onClick={() => handleSendNow(row.id)}
                        disabled={
                          sendNow.isPending ||
                          cancelPending.isPending ||
                          sendingQueueId === row.id
                        }
                      >
                        {sendingQueueId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Send className="mr-1 h-3 w-3" />
                            Enviar ahora
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Quitar de la cola"
                        onClick={() => handleCancel(row.id)}
                        disabled={cancelPending.isPending || sendNow.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <LeadNameWithPhone row={row} />
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

      {canWrite ? (
        <MarketingWhatsappEnqueueDialog
          open={enqueueOpen}
          onOpenChange={setEnqueueOpen}
          companyId={companyId}
        />
      ) : null}
    </div>
  );
};
