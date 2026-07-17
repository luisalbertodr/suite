import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentSelectContent } from '@/components/AppointmentSelectContent';
import type { ClinicalHistoryFormValues } from '@/lib/clinicalHistory';
import { formatAgeLabel } from '@/lib/patientAge';
import { cn } from '@/lib/utils';

type Props = {
  values: ClinicalHistoryFormValues;
  onChange: (values: ClinicalHistoryFormValues) => void;
  customerName?: string;
  fechaConsulta?: string;
  onFechaConsultaChange?: (fecha: string) => void;
  showFechaConsulta?: boolean;
  notifyRecipients?: { userId: string; label: string }[];
  defaultNotifyUserId?: string;
  compact?: boolean;
  /** Hint under AP when this is a follow-up visit */
  antecedentesHint?: string | null;
};

export const ClinicalHistoryFormBody: React.FC<Props> = ({
  values,
  onChange,
  customerName,
  fechaConsulta,
  onFechaConsultaChange,
  showFechaConsulta = true,
  notifyRecipients = [],
  defaultNotifyUserId = '',
  compact,
  antecedentesHint,
}) => {
  const set = (patch: Partial<ClinicalHistoryFormValues>) => onChange({ ...values, ...patch });
  const ageLabel = formatAgeLabel(values.birthDate);
  const labelClass = compact ? 'text-[10px]' : 'text-xs';
  const fieldClass = 'h-8 text-xs mt-1';
  const textAreaRows = compact ? 10 : 15;

  return (
    <div className="space-y-4">
      {/* Fila 1: nombre, FN, edad, fecha consulta */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <Label className={labelClass}>Nombre</Label>
          <Input
            className={cn(fieldClass, 'bg-muted/40')}
            value={customerName?.trim() || ''}
            readOnly
            tabIndex={-1}
            placeholder="—"
          />
        </div>
        <div className="min-w-0">
          <Label className={labelClass}>Fecha de nacimiento</Label>
          <Input
            type="date"
            className={fieldClass}
            value={values.birthDate}
            onChange={(e) => set({ birthDate: e.target.value })}
          />
        </div>
        <div className="min-w-0">
          <Label className={labelClass}>Edad</Label>
          <Input
            className={cn(fieldClass, 'bg-muted/40 tabular-nums')}
            value={ageLabel ?? ''}
            readOnly
            tabIndex={-1}
            placeholder="—"
          />
        </div>
        <div className="min-w-0">
          <Label className={labelClass}>Fecha de la consulta</Label>
          {showFechaConsulta && onFechaConsultaChange ? (
            <Input
              type="date"
              className={fieldClass}
              value={fechaConsulta ?? ''}
              onChange={(e) => onFechaConsultaChange(e.target.value)}
            />
          ) : (
            <Input
              type="date"
              className={cn(fieldClass, 'bg-muted/40')}
              value={fechaConsulta ?? ''}
              readOnly
              tabIndex={-1}
            />
          )}
        </div>
      </div>

      {/* Fila 2: AP + motivo */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0 flex flex-col">
          <Label className={labelClass}>AP (antecedentes personales)</Label>
          <Textarea
            rows={textAreaRows}
            className="text-sm mt-1 min-h-[15rem] flex-1"
            value={values.antecedentesPersonales}
            onChange={(e) => set({ antecedentesPersonales: e.target.value })}
            placeholder="Antecedentes médicos relevantes"
          />
          {antecedentesHint && (
            <p className="mt-1 text-[10px] text-muted-foreground">{antecedentesHint}</p>
          )}
        </div>
        <div className="min-w-0 flex flex-col">
          <Label className={labelClass}>Motivo de consulta</Label>
          <Textarea
            rows={textAreaRows}
            className="text-sm mt-1 min-h-[15rem] flex-1"
            value={values.motivoConsulta}
            onChange={(e) => set({ motivoConsulta: e.target.value })}
            placeholder="Motivo de la visita"
          />
        </div>
      </div>

      {/* Fila 3: tratamiento + aviso */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <Label className={labelClass}>Tratamiento</Label>
          <Textarea
            rows={6}
            className="text-sm mt-1 min-h-[8rem]"
            value={values.tratamiento}
            onChange={(e) => set({ tratamiento: e.target.value })}
            placeholder="Tratamiento indicado en esta visita"
          />
        </div>
        <div className="min-w-0 rounded-md border bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-2">
          <Label className={labelClass}>Aviso a recepción</Label>
          {notifyRecipients.length > 0 && (
            <Select
              value={values.avisoNotifyUserId || defaultNotifyUserId}
              onValueChange={(v) => set({ avisoNotifyUserId: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Destinatario" />
              </SelectTrigger>
              <AppointmentSelectContent>
                {notifyRecipients.map((r) => (
                  <SelectItem key={r.userId} value={r.userId}>
                    {r.label}
                  </SelectItem>
                ))}
              </AppointmentSelectContent>
            </Select>
          )}
          <Textarea
            rows={5}
            className="text-sm min-h-[6.5rem]"
            value={values.avisoText}
            onChange={(e) => set({ avisoText: e.target.value })}
            placeholder="Ej.: dar nueva cita en recepción"
          />
          {notifyRecipients.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Si escribes un aviso nuevo y guardas, se enviará una notificación al destinatario.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
