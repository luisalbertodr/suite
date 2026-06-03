import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClinicalHistoryFormBody } from '@/components/clinical/ClinicalHistoryFormBody';
import {
  clinicalHistoryToFormValues,
  saveClinicalHistory,
  updateCustomerBirthDate,
  type ClinicalHistoryFormValues,
  type ClinicalHistoryRecord,
} from '@/lib/clinicalHistory';
import { defaultReceptionNotifyUserId, sendAppointmentNotification } from '@/lib/appointmentNotification';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const emptyForm = (): ClinicalHistoryFormValues => ({
  birthDate: '',
  antecedentesPersonales: '',
  motivoConsulta: '',
  tratamiento: '',
  proximaRevisionFecha: '',
  proximaRevisionDescripcion: '',
  avisoText: '',
  avisoNotifyUserId: '',
});

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
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!record?.id;

  const defaultNotifyUserId = useMemo(
    () => defaultReceptionNotifyUserId(notifyRecipients),
    [notifyRecipients],
  );

  const [form, setForm] = useState<ClinicalHistoryFormValues>(emptyForm());
  const [fechaConsulta, setFechaConsulta] = useState(
    () => defaultFecha ?? format(new Date(), 'yyyy-MM-dd'),
  );

  useEffect(() => {
    if (!open) return;
    setFechaConsulta(record?.fecha ?? defaultFecha ?? format(new Date(), 'yyyy-MM-dd'));
    setForm({
      ...clinicalHistoryToFormValues(record, birthDateProp),
      avisoNotifyUserId: defaultNotifyUserId,
    });
  }, [open, record, birthDateProp, defaultFecha, defaultNotifyUserId]);

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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" overlayClassName={overlayClassName}>
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEdit ? 'Editar historial clínico' : 'Nuevo registro clínico'}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <ClinicalHistoryFormBody
            values={form}
            onChange={setForm}
            showFechaConsulta={!appointmentId}
            fechaConsulta={fechaConsulta}
            onFechaConsultaChange={setFechaConsulta}
            notifyRecipients={notifyRecipients}
            defaultNotifyUserId={defaultNotifyUserId}
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
