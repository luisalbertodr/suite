import React from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  useWhatsappGroupJoinRequests,
  type WhatsappGroupJoinRequest,
} from '@/hooks/useWhatsappGroupJoinRequests';
import { jidToDisplay } from './whatsappUtils';

interface Props {
  chatId: string;
  className?: string;
}

function requestLabel(req: WhatsappGroupJoinRequest): string {
  const pn = req.requesterPn?.trim();
  if (pn) return jidToDisplay(pn) || pn;
  const id = req.requesterId?.trim();
  if (id) return jidToDisplay(id) || id;
  return 'Solicitante desconocido';
}

export const WhatsappGroupJoinRequestsPanel: React.FC<Props> = ({
  chatId,
  className = '',
}) => {
  const { toast } = useToast();
  const {
    requests,
    isLoading,
    isError,
    approvalRequired,
    approvalLoading,
    approve,
    reject,
    setApprovalRequired,
    participantIdForAction,
  } = useWhatsappGroupJoinRequests(chatId, true);

  const busy = approve.isPending || reject.isPending || setApprovalRequired.isPending;

  const handleApprove = async (req: WhatsappGroupJoinRequest) => {
    const id = participantIdForAction(req);
    if (!id) {
      toast({
        title: 'No se puede aprobar',
        description: 'Falta el identificador del solicitante.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await approve.mutateAsync([id]);
      toast({ title: 'Solicitud aprobada' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo aprobar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleReject = async (req: WhatsappGroupJoinRequest) => {
    const id = participantIdForAction(req);
    if (!id) {
      toast({
        title: 'No se puede rechazar',
        description: 'Falta el identificador del solicitante.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await reject.mutateAsync([id]);
      toast({ title: 'Solicitud rechazada' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo rechazar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleToggleApproval = async (checked: boolean) => {
    try {
      await setApprovalRequired.mutateAsync(checked);
      toast({
        title: checked
          ? 'Aprobación de miembros activada'
          : 'Aprobación de miembros desactivada',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo cambiar el ajuste';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  // Si no hay solicitudes y aún carga el ajuste, no ocupar espacio.
  // Tampoco molestar si la API falla (p. ej. no somos admin del grupo).
  if (isError) {
    return null;
  }
  if (!isLoading && requests.length === 0 && !approvalLoading && !approvalRequired) {
    return null;
  }

  return (
    <div
      className={`shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40 ${className}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>
            {requests.length > 0
              ? `Solicitudes de entrada (${requests.length})`
              : 'Aprobación de miembros'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor={`wa-group-approval-${chatId}`}
            className="text-[11px] text-amber-800 dark:text-amber-200"
          >
            Requiere aprobación
          </Label>
          <Switch
            id={`wa-group-approval-${chatId}`}
            checked={approvalRequired}
            disabled={busy || approvalLoading}
            onCheckedChange={(v) => void handleToggleApproval(v)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando solicitudes…
        </p>
      ) : requests.length === 0 ? (
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
          No hay solicitudes pendientes.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {requests.map((req, idx) => {
            const key =
              req.requesterPn ||
              req.requesterId ||
              `${req.timestamp ?? 't'}-${idx}`;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5 text-sm dark:bg-zinc-900/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {requestLabel(req)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {req.requestMethod === 'invite_link'
                      ? 'Vía enlace de invitación'
                      : req.requestMethod || 'Solicitud de entrada'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-emerald-700"
                    disabled={busy}
                    onClick={() => void handleApprove(req)}
                    title="Aprobar"
                  >
                    {approve.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-red-700"
                    disabled={busy}
                    onClick={() => void handleReject(req)}
                    title="Rechazar"
                  >
                    {reject.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
