import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInbodyMeasurements } from '@/hooks/useInbodyMeasurements';
import {
  formatInbodyNumber,
  inbodySexLabel,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import { InbodyMetricRow, InbodyRangeBar } from './inbody/InbodyRangeBar';
import { InbodyHistoryChart } from './inbody/InbodyHistoryChart';
import { InbodySegmentalSilhouette } from './inbody/InbodySegmentalSilhouette';
import { InbodyReportExport } from './inbody/InbodyReportExport';
import { InbodyNutritionPanel } from './inbody/InbodyNutritionPanel';
import { InbodyMetricHelp, InbodySectionHelp } from './inbody/InbodyMetricHelp';
import { InbodyCsvImportPanel } from '@/components/InbodyCsvImportPanel';

interface Props {
  customerId: string;
  taxId?: string | null;
  companyId?: string | null;
  customerName?: string | null;
  compact?: boolean;
}

function ImpedanceTable({ measurement }: { measurement: InbodyMeasurement }) {
  const freqs = ['20khz', '100khz'] as const;
  const segments = [
    ['BD', 'right_arm'],
    ['BI', 'left_arm'],
    ['TR', 'trunk'],
    ['PD', 'right_leg'],
    ['PI', 'left_leg'],
  ] as const;

  const hasData = freqs.some((f) => measurement.impedance?.[f]);
  if (!hasData) return null;

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          <InbodySectionHelp metricId="impedance" title="Impedancia (Ω)" />
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1 pr-3">Hz</th>
              {segments.map(([label]) => (
                <th key={label} className="text-right py-1 px-2 tabular-nums">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {freqs.map((freq) => {
              const block = measurement.impedance?.[freq];
              if (!block) return null;
              const label = freq === '20khz' ? '20 kHz' : '100 kHz';
              return (
                <tr key={freq} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{label}</td>
                  {segments.map(([_, key]) => (
                    <td key={key} className="text-right py-1.5 px-2 tabular-nums">
                      {formatInbodyNumber(block[key], 1)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function sessionLabel(m: InbodyMeasurement, index: number, total: number): string {
  const date = format(new Date(m.measured_at), 'dd/MM/yyyy HH:mm', { locale: es });
  const weight = m.weight_kg != null ? formatInbodyNumber(m.weight_kg, 1, ' kg') : 'sin peso';
  const pbf = m.pbf_pct != null ? ` · PGC ${formatInbodyNumber(m.pbf_pct, 1, '%')}` : '';
  return `${total - index}. ${date} · ${weight}${pbf}`;
}

function MeasurementSessionBar({
  measurements,
  selected,
  onSelect,
  compact,
}: {
  measurements: InbodyMeasurement[];
  selected: InbodyMeasurement;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const measuredLabel = format(new Date(selected.measured_at), 'yyyy-MM-dd HH:mm:ss', { locale: es });

  return (
    <div className="space-y-2">
      <Select value={selected.id} onValueChange={onSelect}>
        <SelectTrigger className={compact ? 'h-8 text-xs' : ''}>
          <SelectValue placeholder="Seleccionar medición" />
        </SelectTrigger>
        <SelectContent>
          {measurements.map((m, idx) => (
            <SelectItem key={m.id} value={m.id}>
              {sessionLabel(m, idx, measurements.length)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className={compact ? 'text-xs' : 'text-sm'}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className="font-medium text-foreground">{selected.inbody_user_id}</span>
          {selected.age_years != null && (
            <span>{formatInbodyNumber(selected.age_years, 0)} Edad</span>
          )}
          {selected.height_cm != null && (
            <span>{formatInbodyNumber(selected.height_cm, 1, 'cm')}</span>
          )}
          {selected.sex && <span>{inbodySexLabel(selected.sex)}</span>}
          <span className="ml-auto flex items-center gap-1 tabular-nums">
            <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
            Fecha {measuredLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function MeasurementReport({ measurement, compact }: { measurement: InbodyMeasurement; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            <InbodySectionHelp metricId="weight_kg" title="Composición corporal" />
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Banda verde = rango normal InBody. Pase el cursor sobre cada sigla para ver qué mide y cómo interpretarla.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <InbodyRangeBar metricId="weight_kg" value={measurement.weight_kg} min={measurement.weight_min_kg} max={measurement.weight_max_kg} />
          <InbodyRangeBar metricId="smm_kg" value={measurement.smm_kg} min={measurement.smm_min_kg} max={measurement.smm_max_kg} />
          <InbodyRangeBar metricId="body_fat_kg" value={measurement.body_fat_kg} min={measurement.body_fat_min_kg} max={measurement.body_fat_max_kg} />
          <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-border/40">
            <InbodyRangeBar metricId="tbw_kg" value={measurement.tbw_kg} min={measurement.tbw_min_kg} max={measurement.tbw_max_kg} className="col-span-1" />
            <InbodyRangeBar metricId="ffm_kg" value={measurement.ffm_kg} min={measurement.ffm_min_kg} max={measurement.ffm_max_kg} className="col-span-1" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            <InbodySectionHelp metricId="pbf_pct" title="Diagnóstico de obesidad" />
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Columna «Normal»: intervalo de referencia según sexo, edad y talla registrados en la medición.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1 pr-3">Parámetro</th>
                <th className="text-left py-1 pr-3">Valor</th>
                <th className="text-left py-1 pr-3" title="Rango normal InBody">Normal</th>
                <th className="text-left py-1">
                  <InbodyMetricHelp metricId="inbody_status" label="Estado" labelClassName="text-[11px] font-normal text-muted-foreground" />
                </th>
              </tr>
            </thead>
            <tbody>
              <InbodyMetricRow metricId="bmi" value={measurement.bmi} min={measurement.bmi_min} max={measurement.bmi_max} />
              <InbodyMetricRow metricId="pbf_pct" value={measurement.pbf_pct} min={measurement.pbf_min_pct} max={measurement.pbf_max_pct} unit="%" />
              <InbodyMetricRow metricId="whr" value={measurement.whr} min={measurement.whr_min} max={measurement.whr_max} decimals={2} />
              <InbodyMetricRow metricId="bmr_kcal" label="MB" value={measurement.bmr_kcal} min={measurement.bmr_min_kcal} max={measurement.bmr_max_kcal} unit="kcal" decimals={0} />
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="border-sky-100/50 dark:border-sky-900/20">
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center">
              <InbodyMetricHelp metricId="muscle_control_kg" labelClassName="text-[11px] uppercase text-muted-foreground font-normal" />
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1" title="Kg de MME a ganar (+) o perder (−) según InBody">
              {formatInbodyNumber(measurement.muscle_control_kg, 1, ' kg')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-100/50 dark:border-sky-900/20">
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center">
              <InbodyMetricHelp metricId="fat_control_kg" labelClassName="text-[11px] uppercase text-muted-foreground font-normal" />
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1" title="Kg de grasa a perder (−) o ganar (+) según InBody">
              {formatInbodyNumber(measurement.fat_control_kg, 1, ' kg')}
            </div>
          </CardContent>
        </Card>
      </div>

      <InbodyNutritionPanel measurement={measurement} compact={compact} />

      <ImpedanceTable measurement={measurement} />
    </div>
  );
}

export const ClienteInbodyTab: React.FC<Props> = ({ customerId, taxId, companyId, customerName, compact }) => {
  const { data: measurements, isLoading, error } = useInbodyMeasurements(customerId, taxId, companyId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [customerId]);

  useEffect(() => {
    if (measurements?.length) {
      setSelectedId((prev) => (prev && measurements.some((m) => m.id === prev) ? prev : measurements[0].id));
    }
  }, [measurements]);

  const selected = useMemo(() => {
    if (!measurements?.length) return null;
    if (selectedId) return measurements.find((m) => m.id === selectedId) ?? measurements[0];
    return measurements[0];
  }, [measurements, selectedId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center py-10 text-sm text-destructive">
          No se pudieron cargar las mediciones InBody.
        </div>
        <InbodyCsvImportPanel
          embedded
          customerId={customerId}
          taxId={taxId}
          customerName={customerName}
        />
      </div>
    );
  }

  if (!measurements?.length) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground">Sin mediciones InBody</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            {taxId
              ? 'No hay registros vinculados a este DNI. Importa un CSV de Lookin\'Body abajo.'
              : 'Añade el DNI del cliente para vincular mediciones por ID de Lookin\'Body.'}
          </p>
        </div>
        <InbodyCsvImportPanel
          embedded
          customerId={customerId}
          taxId={taxId}
          customerName={customerName}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected && (
        <MeasurementSessionBar
          measurements={measurements}
          selected={selected}
          onSelect={setSelectedId}
          compact={compact}
        />
      )}

      <InbodyHistoryChart
        measurements={measurements}
        selectedId={selected?.id}
        compact={compact}
        onSelectSession={setSelectedId}
      />

      {selected && (
        <InbodySegmentalSilhouette
          lean={selected.segmental_lean}
          fat={selected.segmental_fat}
          sex={selected.sex}
          measuredAtLabel={format(new Date(selected.measured_at), "EEEE d MMMM yyyy · HH:mm", {
            locale: es,
          })}
          compact={compact}
        />
      )}

      {selected && <MeasurementReport measurement={selected} compact={compact} />}

      {selected && (
        <InbodyReportExport
          key={`inbody-report-${customerId}-${selected.id}`}
          customerId={customerId}
          measurement={selected}
          customerName={customerName ?? undefined}
          compact={compact}
        />
      )}

      <InbodyCsvImportPanel
        embedded
        customerId={customerId}
        taxId={taxId}
        customerName={customerName}
      />

      <p className="text-[10px] text-muted-foreground italic text-center pt-2">
        Utilice sus resultados como referencia cuando consulte a su médico o entrenador personal.
      </p>
    </div>
  );
};
