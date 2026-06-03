import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentSelectContent } from '@/components/AppointmentSelectContent';
import type { ClinicalHistoryFormValues } from '@/lib/clinicalHistory';
import { formatAgeLabel } from '@/lib/patientAge';

type Props = {
  values: ClinicalHistoryFormValues;
  onChange: (values: ClinicalHistoryFormValues) => void;
  fechaConsulta?: string;
  onFechaConsultaChange?: (fecha: string) => void;
  showFechaConsulta?: boolean;
  notifyRecipients?: { userId: string; label: string }[];
  defaultNotifyUserId?: string;
  compact?: boolean;
};

export const ClinicalHistoryFormBody: React.FC<Props> = ({
  values,
  onChange,
  fechaConsulta,
  onFechaConsultaChange,
  showFechaConsulta,
  notifyRecipients = [],
  defaultNotifyUserId = '',
  compact,
}) => {
  const set = (patch: Partial<ClinicalHistoryFormValues>) => onChange({ ...values, ...patch });
  const ageLabel = formatAgeLabel(values.birthDate);
  const labelClass = compact ? 'text-[10px]' : 'text-xs';

  return (
    <div className="space-y-3">
      {showFechaConsulta && onFechaConsultaChange && (
        <div>
          <Label className={labelClass}>Fecha de la consulta</Label>
          <Input
            type="date"
            className="h-8 text-xs mt-1"
            value={fechaConsulta ?? ''}
            onChange={(e) => onFechaConsultaChange(e.target.value)}
          />
        </div>
      )}

      <div>
        <Label className={labelClass}>Fecha de nacimiento</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="date"
            className="flex-1 h-8 text-xs"
            value={values.birthDate}
            onChange={(e) => set({ birthDate: e.target.value })}
          />
          {ageLabel && (
            <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
              {ageLabel}
            </span>
          )}
        </div>
      </div>

      <div>
        <Label className={labelClass}>AP (antecedentes personales)</Label>
        <Textarea
          rows={3}
          className="text-sm mt-1"
          value={values.antecedentesPersonales}
          onChange={(e) => set({ antecedentesPersonales: e.target.value })}
          placeholder="Antecedentes médicos relevantes"
        />
      </div>

      <div>
        <Label className={labelClass}>Motivo de consulta</Label>
        <Textarea
          rows={2}
          className="text-sm mt-1"
          value={values.motivoConsulta}
          onChange={(e) => set({ motivoConsulta: e.target.value })}
          placeholder="Motivo de la visita"
        />
      </div>

      <div>
        <Label className={labelClass}>Tratamiento</Label>
        <Textarea
          rows={2}
          className="text-sm mt-1"
          value={values.tratamiento}
          onChange={(e) => set({ tratamiento: e.target.value })}
        />
      </div>

      <div>
        <Label className={labelClass}>Próxima revisión</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          <Input
            type="date"
            className="h-8 text-xs"
            value={values.proximaRevisionFecha}
            onChange={(e) => set({ proximaRevisionFecha: e.target.value })}
          />
          <Input
            className="h-8 text-xs"
            value={values.proximaRevisionDescripcion}
            onChange={(e) => set({ proximaRevisionDescripcion: e.target.value })}
            placeholder="Descripción"
          />
        </div>
      </div>

      <div className="rounded-md border bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-2">
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
          rows={2}
          className="text-sm"
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
  );
};
