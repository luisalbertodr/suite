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
import { Pencil, Trash2 } from 'lucide-react';

type Props = {
  appointment: Appointment | null;
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (appointment: Appointment) => void;
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
}: Props) {
  if (!appointment) return null;

  const employee = employees.find((e) => e.id === appointment.employeeId);
  const endTime =
    appointment.timeSegments?.length
      ? appointment.timeSegments[appointment.timeSegments.length - 1]!.endTime
      : appointment.occupiedEndTime || appointment.endTime;
  const isPaid = appointment.paymentStatus === 'paid';

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
        </div>

        {(canEdit || canDelete) && !isPaid ? (
          <DialogFooter className="gap-2 sm:gap-0">
            {canDelete && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(appointment)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            ) : null}
            {canEdit && onEdit ? (
              <Button type="button" size="sm" onClick={() => onEdit(appointment)}>
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
