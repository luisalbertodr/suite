import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Save, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClinicalHistoryFormBody } from '@/components/clinical/ClinicalHistoryFormBody';
import { AGENDA_CLINICAL_HISTORY_OVERLAY_Z } from '@/lib/agendaResourceColors';
import { DOCK_CLEARANCE_BOTTOM } from '@/lib/dialogLayers';
import { PanelAwareBodyPortal } from '@/components/PanelAwareBodyPortal';
import {
  clinicalHistoryToPrefillValues,
  clinicalHistoryToFormValues,
  emptyClinicalHistoryFormValues,
  fetchClinicalHistoryByAppointment,
  fetchCustomerBirthDate,
  fetchLatestClinicalHistory,
  saveClinicalHistory,
  updateCustomerBirthDate,
  type ClinicalHistoryFormValues,
} from '@/lib/clinicalHistory';
import {
  defaultReceptionNotifyUserId,
  sendAppointmentNotification,
} from '@/lib/appointmentNotification';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  appointmentDate: string;
  customerId: string;
  companyId: string;
  customerName: string;
  employeeId?: string | null;
  notifyRecipients?: { userId: string; label: string }[];
  onNotify?: (recipientUserId: string, message: string) => Promise<void> | void;
};

export const AppointmentClinicalHistoryPanel: React.FC<Props> = ({
  open,
  onClose,
  appointmentId,
  appointmentDate,
  customerId,
  companyId,
  customerName,
  employeeId,
  notifyRecipients = [],
  onNotify,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClinicalHistoryFormValues>(emptyClinicalHistoryFormValues());
  const [existingId, setExistingId] = useState<string | null>(null);

  const defaultNotifyUserId = useMemo(
    () => defaultReceptionNotifyUserId(notifyRecipients),
    [notifyRecipients],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['clinical_history_appointment', appointmentId, customerId],
    enabled: open && !!appointmentId && !!customerId,
    queryFn: async () => {
      const [record, birthDate, previousRecord] = await Promise.all([
        fetchClinicalHistoryByAppointment(appointmentId),
        fetchCustomerBirthDate(customerId),
        fetchLatestClinicalHistory(customerId, appointmentId),
      ]);
      return { record, birthDate, previousRecord };
    },
  });

  useEffect(() => {
    if (!open || isLoading || !data) return;
    setExistingId(data.record?.id ?? null);
    const baseValues = data.record
      ? clinicalHistoryToFormValues(data.record, data.birthDate)
      : clinicalHistoryToPrefillValues(data.previousRecord, data.birthDate);
    setForm({
      ...baseValues,
      avisoNotifyUserId: defaultNotifyUserId,
    });
  }, [open, isLoading, data, defaultNotifyUserId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const birthYmd = form.birthDate.trim() || null;
      await updateCustomerBirthDate(customerId, birthYmd);

      const record = await saveClinicalHistory({
        customerId,
        companyId,
        appointmentId,
        appointmentDate,
        employeeId,
        values: form,
        existingId,
      });

      const aviso = form.avisoText.trim();
      const prevAviso = data?.record?.aviso_text?.trim() ?? '';
      const notifyTo = form.avisoNotifyUserId || defaultNotifyUserId;
      if (aviso && aviso !== prevAviso && notifyTo && user?.id) {
        const msg = `${customerName} · ${format(parseISO(`${appointmentDate}T12:00:00`), 'dd/MM/yyyy', { locale: es })}: ${aviso}`;
        if (onNotify) {
          await onNotify(notifyTo, msg);
        } else {
          await sendAppointmentNotification({
            companyId,
            fromUserId: user.id,
            recipientUserId: notifyTo,
            appointmentId,
            appointmentDate,
            clientName: customerName,
            message: msg,
            titlePrefix: `Aviso recepción · ${customerName}`,
          });
        }
      }

      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical_history_appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['clinical_history_list', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_birth_date', customerId] });
      toast({ title: 'Historial clínico guardado' });
      onClose();
    },
    onError: (err: Error) => {
      toast({
        title: 'No se pudo guardar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  if (!open || typeof document === 'undefined') return null;

  return (
    <PanelAwareBodyPortal open={open}>
    <div
      className={cn(
        `fixed inset-x-0 top-0 ${DOCK_CLEARANCE_BOTTOM} flex items-start sm:items-center justify-center px-3 pt-3 pb-24 sm:p-4`,
        AGENDA_CLINICAL_HISTORY_OVERLAY_Z,
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Historial clínico"
    >
      <div className="absolute inset-0 bg-black/55" aria-hidden onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg max-h-[calc(100dvh-7rem)] overflow-y-auto shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-sky-600" />
              Historial clínico
            </CardTitle>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {customerName} · {format(parseISO(`${appointmentDate}T12:00:00`), 'EEEE d MMM yyyy', { locale: es })}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
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
                notifyRecipients={notifyRecipients}
                defaultNotifyUserId={defaultNotifyUserId}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4 mr-1" />
                  {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
    </PanelAwareBodyPortal>
  );
};
