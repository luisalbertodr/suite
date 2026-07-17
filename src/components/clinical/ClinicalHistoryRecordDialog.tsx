import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClinicalHistoryFormBody } from '@/components/clinical/ClinicalHistoryFormBody';
import { ClinicalHistoryVisitTimeline } from '@/components/clinical/ClinicalHistoryVisitTimeline';
import {
  emptyClinicalHistoryFormValues,
  clinicalHistoryToFormValues,
  saveClinicalHistory,
  updateCustomerBirthDate,
  type ClinicalHistoryFormValues,
  type ClinicalHistoryRecord,
} from '@/lib/clinicalHistory';
import { defaultReceptionNotifyUserId, sendAppointmentNotification } from '@/lib/appointmentNotification';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  companyId: string;
  customerName: string;
  birthDate?: string | null;
  record?: ClinicalHistoryRecord | null;
  appointmentId?: string | null;
  defaultFecha?: string;
  employeeId?: string | null;
  notifyRecipients?: { userId: string; label: string }[];
  onNotify?: (recipientUserId: string, message: string) => Promise<void> | void;
  overlayClassName?: string;
  initialValues?: ClinicalHistoryFormValues | null;
  /** Consultas anteriores a mostrar como contexto (todas menos la que se edita). */
  previousRecords?: ClinicalHistoryRecord[];
};

export const ClinicalHistoryRecordDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  customerId,
  companyId,
  customerName,
  birthDate: birthDateProp = null,
  record = null,
  appointmentId = null,
  defaultFecha,
  employeeId,
  notifyRecipients = [],
  onNotify,
  overlayClassName = 'z-[110]',
  initialValues = null,
  previousRecords = [],
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!record?.id;

  const defaultNotifyUserId = useMemo(
    () => defaultReceptionNotifyUserId(notifyRecipients),
    [notifyRecipients],
  );

  const [form, setForm] = useState<ClinicalHistoryFormValues>(emptyClinicalHistoryFormValues());
  const [fechaConsulta, setFechaConsulta] = useState(
    () => defaultFecha ?? format(new Date(), 'yyyy-MM-dd'),
  );

  const contextRecords = useMemo(() => {
    if (!record?.id) return previousRecords;
    return previousRecords.filter((r) => r.id !== record.id);
  }, [previousRecords, record?.id]);

  useEffect(() => {
    if (!open) return;
    setFechaConsulta(record?.fecha ?? defaultFecha ?? format(new Date(), 'yyyy-MM-dd'));
    const baseValues = record
      ? clinicalHistoryToFormValues(record, birthDateProp)
      : initialValues ?? emptyClinicalHistoryFormValues();
    setForm({
      ...baseValues,
      avisoNotifyUserId: defaultNotifyUserId,
    });
  }, [open, record, birthDateProp, defaultFecha, defaultNotifyUserId, initialValues]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const birthYmd = form.birthDate.trim() || null;
      await updateCustomerBirthDate(customerId, birthYmd);

      const saved = await saveClinicalHistory({
        customerId,
        companyId,
        appointmentDate: fechaConsulta,
        appointmentId: appointmentId ?? record?.appointment_id ?? null,
        employeeId,
        values: form,
        existingId: record?.id ?? null,
      });

      const aviso = form.avisoText.trim();
      const prevAviso = record?.aviso_text?.trim() ?? '';
      const notifyTo = form.avisoNotifyUserId || defaultNotifyUserId;
      const aptId = appointmentId ?? record?.appointment_id;
      if (aviso && aviso !== prevAviso && notifyTo && user?.id && aptId) {
        const msg = `${customerName} · ${format(parseISO(`${fechaConsulta}T12:00:00`), 'dd/MM/yyyy', { locale: es })}: ${aviso}`;
        if (onNotify) {
          await onNotify(notifyTo, msg);
        } else {
          await sendAppointmentNotification({
            companyId,
            fromUserId: user.id,
            recipientUserId: notifyTo,
            appointmentId: aptId,
            appointmentDate: fechaConsulta,
            clientName: customerName,
            message: msg,
            titlePrefix: `Aviso recepción · ${customerName}`,
          });
        }
      }

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical_history_list', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_birth_date', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_detail', customerId] });
      if (appointmentId) {
        queryClient.invalidateQueries({ queryKey: ['clinical_history_appointment', appointmentId] });
      }
      toast({ title: isEdit ? 'Registro actualizado' : 'Registro creado' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: 'No se pudo guardar', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(100%,72rem)] max-w-6xl max-h-[90vh] overflow-y-auto"
        overlayClassName={overlayClassName}
      >
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEdit ? 'Editar historial clínico' : 'Nuevo registro clínico'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? 'Formulario para editar un registro del historial clínico del cliente.'
              : 'Formulario para crear un nuevo registro en el historial clínico del cliente.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          {contextRecords.length > 0 && (
            <ClinicalHistoryVisitTimeline
              records={contextRecords}
              order="asc"
              compact
              maxHeightClassName="max-h-56"
              title={`Historial previo (${contextRecords.length} consulta${contextRecords.length === 1 ? '' : 's'})`}
            />
          )}

          {contextRecords.length > 0 && (
            <p className="text-xs font-medium text-foreground border-t pt-3">Esta visita</p>
          )}

          <ClinicalHistoryFormBody
            values={form}
            onChange={setForm}
            customerName={customerName}
            showFechaConsulta
            fechaConsulta={fechaConsulta}
            onFechaConsultaChange={setFechaConsulta}
            notifyRecipients={notifyRecipients}
            defaultNotifyUserId={defaultNotifyUserId}
            antecedentesHint={
              contextRecords.length > 0
                ? 'Se precargan los antecedentes de la última consulta; añade o corrige solo si hay novedades.'
                : null
            }
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-1" />
              {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
