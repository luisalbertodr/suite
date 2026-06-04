import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const setReview = (
    index: number,
    patch: Partial<ClinicalHistoryFormValues['revisiones'][number]>,
  ) => {
    const revisiones = values.revisiones.map((revision, i) =>
      i === index ? { ...revision, ...patch } : revision,
    );
    set({
      revisiones,
      proximaRevisionFecha: revisiones[0]?.fecha ?? '',
      proximaRevisionDescripcion: revisiones[0]?.descripcion ?? '',
    });
  };
  const addReview = () => {
    set({ revisiones: [...values.revisiones, { fecha: '', descripcion: '', appointmentId: null }] });
  };
  const removeReview = (index: number) => {
    const revisiones = values.revisiones.filter((_, i) => i !== index);
    set({
      revisiones,
      proximaRevisionFecha: revisiones[0]?.fecha ?? '',
      proximaRevisionDescripcion: revisiones[0]?.descripcion ?? '',
    });
  };
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className={labelClass}>Revisiones</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1" onClick={addReview}>
            <Plus className="h-3.5 w-3.5" />
            Añadir
          </Button>
        </div>
        {values.revisiones.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Añade aquí las revisiones del tratamiento. Se guardarán como líneas dentro del
            registro clínico.
          </p>
        ) : (
          <div className="space-y-2">
            {values.revisiones.map((revision, index) => (
              <div key={revision.id ?? index} className="rounded-md border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="h-8 w-36 text-xs"
                    value={revision.fecha}
                    onChange={(e) => setReview(index, { fecha: e.target.value })}
                  />
                  <span className="flex-1 text-xs text-muted-foreground">
                    {revision.appointmentId ? 'Vinculada a cita' : 'Sin cita vinculada'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => removeReview(index)}
                    aria-label="Eliminar revisión"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  className="text-sm"
                  value={revision.descripcion}
                  onChange={(e) => setReview(index, { descripcion: e.target.value })}
                  placeholder="Notas de la revisión"
                />
              </div>
            ))}
          </div>
        )}
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
