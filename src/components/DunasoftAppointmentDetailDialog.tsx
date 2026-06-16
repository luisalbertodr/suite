import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Appointment, Employee } from '@/types/agenda';
import { AppointmentItemTimeline } from '@/components/AppointmentItemTimeline';
import { ClipboardList, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { AppointmentDocumentationDialog } from '@/components/clinical/AppointmentDocumentationDialog';
import { resolveCustomerIdByLegacyCodcli } from '@/lib/appointmentCustomerResolve';

type Props = {
  appointment: Appointment | null;
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (appointment: Appointment) => void;
  onSelectConsent?: (appointment: Appointment, plantillaId?: string) => void;
  onOpenQuestionnaire?: (appointment: Appointment) => void;
  onRegisterSession?: (
    appointment: Appointment,
    trackingFamily: 'depilacion' | 'aesthetic',
    plantillaCodigo?: string | null,
  ) => void;
  onOpenFreeConsent?: (appointment: Appointment) => void;
  companyId?: string | null;
};

export function DunasoftAppointmentDetailDialog({
  appointment,
  employees,
  open,
  onOpenChange,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onSelectConsent,
  onOpenQuestionnaire,
  onRegisterSession,
  onOpenFreeConsent,
  companyId,
}: Props) {
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);

  useEffect(() => {
    setResolvedCustomerId(appointment?.customerId ?? null);
  }, [appointment?.id, appointment?.customerId]);

  useEffect(() => {
    if (!open || !appointment || appointment.customerId || !companyId) return;
    const legacy = appointment.legacyClientCode?.trim();
    if (!legacy) return;

    let cancelled = false;
    setLinkPending(true);
    void resolveCustomerIdByLegacyCodcli(companyId, legacy)
      .then((id) => {
        if (!cancelled) setResolvedCustomerId(id);
      })
      .finally(() => {
        if (!cancelled) setLinkPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, appointment, companyId]);

  const effectiveCustomerId = appointment?.customerId ?? resolvedCustomerId;

  const appointmentWithCustomer = useMemo(() => {
    if (!appointment || !effectiveCustomerId) return appointment;
    return { ...appointment, customerId: effectiveCustomerId };
  }, [appointment, effectiveCustomerId]);

  if (!appointment) return null;

  const employee = employees.find((e) => e.id === appointment.employeeId);
  const endTime =
    appointment.timeSegments?.length
      ? appointment.timeSegments[appointment.timeSegments.length - 1]!.endTime
      : appointment.occupiedEndTime || appointment.endTime;
  const isPaid = appointment.paymentStatus === 'paid';
  const hasDocActions =
    Boolean(companyId && effectiveCustomerId) &&
    Boolean(onSelectConsent || onOpenQuestionnaire || onRegisterSession);
  const showUnlinkedHint =
    Boolean(appointment.legacyClientCode?.trim()) &&
    !effectiveCustomerId &&
    !linkPending &&
    Boolean(companyId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{appointment.clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Style · dual sync</Badge>
            {isPaid ? <Badge variant="secondary">Facturado en Style</Badge> : null}
            <Badge variant="outline">ID {appointment.id}</Badge>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">Profesional</dt>
            <dd>{employee?.name ?? appointment.legacyEmployeeCode ?? appointment.employeeId}</dd>

            <dt className="text-muted-foreground">Horario</dt>
            <dd className="tabular-nums">
              {appointment.date} · {appointment.startTime} – {endTime}
            </dd>

            {appointment.clientPhone ? (
              <>
                <dt className="text-muted-foreground">Teléfono</dt>
                <dd>{appointment.clientPhone}</dd>
              </>
            ) : null}

            {appointment.legacyClientCode ? (
              <>
                <dt className="text-muted-foreground">Cód. cliente</dt>
                <dd>{appointment.legacyClientCode}</dd>
              </>
            ) : null}

            {appointment.serviceName ? (
              <>
                <dt className="text-muted-foreground">Servicios</dt>
                <dd>{appointment.serviceName}</dd>
              </>
            ) : null}
          </dl>

          {appointment.timeSegments && appointment.timeSegments.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Tramos (planart)</p>
              <AppointmentItemTimeline segments={appointment.timeSegments} compact />
            </div>
          ) : null}

          {appointment.description ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
              <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-2">
                {appointment.description}
              </p>
            </div>
          ) : null}

          {showUnlinkedHint ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Cliente Style sin ficha en Suite (cód. {appointment.legacyClientCode}). Vincule el
              cliente en Clientes con el mismo código legacy para usar cuestionarios y documentación.
            </p>
          ) : null}

          {linkPending ? (
            <p className="text-xs text-muted-foreground">Buscando ficha Suite del cliente…</p>
          ) : null}
        </div>

        {(canEdit || canDelete || hasDocActions) ? (
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            {hasDocActions && appointmentWithCustomer ? (
              <>
                {onOpenQuestionnaire ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => onOpenQuestionnaire(appointmentWithCustomer)}
                  >
                    <ClipboardList className="w-4 h-4 mr-1" /> Cuestionario tablet
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDocPickerOpen(true)}
                >
                  <FolderOpen className="w-4 h-4 mr-1" /> Documentación
                </Button>
              </>
            ) : null}
            {canDelete && onDelete && !isPaid ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(appointment)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            ) : null}
            {canEdit && onEdit && !isPaid ? (
              <Button type="button" size="sm" onClick={() => onEdit(appointment)}>
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>

      {effectiveCustomerId && companyId && appointmentWithCustomer ? (
        <AppointmentDocumentationDialog
          open={docPickerOpen}
          onOpenChange={setDocPickerOpen}
          companyId={companyId}
          clientName={appointment.clientName}
          serviceLabel={appointment.serviceName}
          onSelectConsent={(plantillaId) => onSelectConsent?.(appointmentWithCustomer, plantillaId)}
          onSelectQuestionnaire={() => onOpenQuestionnaire?.(appointmentWithCustomer)}
          onRegisterSession={(family, codigo) =>
            onRegisterSession?.(appointmentWithCustomer, family, codigo)
          }
          onSelectFreeConsent={
            onOpenFreeConsent ? () => onOpenFreeConsent(appointmentWithCustomer) : undefined
          }
        />
      ) : null}
    </Dialog>
  );
}
