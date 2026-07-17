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
  hasMorphoScanExtras,
  inbodySexLabel,
  scaleDeviceFromMeasurement,
  scaleDeviceLabel,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import { resolveInbodyDataQuality } from '@/lib/inbodyQuality';
import { InbodyQualityAlert } from './inbody/InbodyQualityAlert';
import { InbodyMetricRow, InbodyRangeBar } from './inbody/InbodyRangeBar';
import { InbodyCompositionRangeGroup } from './inbody/InbodyCompositionRangeGroup';
import { InbodyHistoryChart } from './inbody/InbodyHistoryChart';
import { InbodyCompositionEvolutionChart } from './inbody/InbodyCompositionEvolutionChart';
import { InbodySegmentalSilhouette } from './inbody/InbodySegmentalSilhouette';
import { InbodyReportExport } from './inbody/InbodyReportExport';
import { InbodyNutritionPanel } from './inbody/InbodyNutritionPanel';
import { InbodyMetricHelp, InbodySectionHelp } from './inbody/InbodyMetricHelp';
import { InbodyCsvImportPanel } from '@/components/InbodyCsvImportPanel';
import { Badge } from '@/components/ui/badge';

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

function sessionLabel(m: InbodyMeasurement, index: number, total: number, all: InbodyMeasurement[]): string {
  const device = scaleDeviceLabel(scaleDeviceFromMeasurement(m));
  const date = format(new Date(m.measured_at), 'dd/MM/yyyy HH:mm', { locale: es });
  const weight = m.weight_kg != null ? formatInbodyNumber(m.weight_kg, 1, ' kg') : 'sin peso';
  const pbf = m.pbf_pct != null ? ` · PGC ${formatInbodyNumber(m.pbf_pct, 1, '%')}` : '';
  const q = resolveInbodyDataQuality(m, all);
  const warn = q.needs_repeat ? ' ⚠' : '';
  return `${total - index}. [${device}] ${date} · ${weight}${pbf}${warn}`;
}

function MorphoScanExtrasCard({ measurement }: { measurement: InbodyMeasurement }) {
  if (!hasMorphoScanExtras(measurement)) return null;

  const rows: { label: string; value: string }[] = [];
  if (measurement.bone_mass_kg != null) {
    rows.push({ label: 'Masa ósea', value: formatInbodyNumber(measurement.bone_mass_kg, 1, ' kg') });
  }
  if (measurement.protein_mass_kg != null) {
    rows.push({ label: 'Proteína', value: formatInbodyNumber(measurement.protein_mass_kg, 1, ' kg') });
  }
  if (measurement.protein_pct != null) {
    rows.push({ label: 'Proteína %', value: formatInbodyNumber(measurement.protein_pct, 1, '%') });
  }
  if (measurement.body_water_pct != null) {
    rows.push({ label: 'Agua %', value: formatInbodyNumber(measurement.body_water_pct, 1, '%') });
  }
  if (measurement.visceral_fat_index != null) {
    rows.push({
      label: 'Grasa visceral',
      value: formatInbodyNumber(measurement.visceral_fat_index, 0),
    });
  }
  if (measurement.subcutaneous_fat_pct != null) {
    rows.push({
      label: 'Grasa subcutánea',
      value: formatInbodyNumber(measurement.subcutaneous_fat_pct, 1, '%'),
    });
  }
  if (measurement.metabolic_age != null) {
    rows.push({ label: 'Edad metabólica', value: formatInbodyNumber(measurement.metabolic_age, 0) });
  }
  if (measurement.smi != null) {
    rows.push({ label: 'SMI', value: formatInbodyNumber(measurement.smi, 1) });
  }
  if (measurement.heart_rate != null) {
    rows.push({ label: 'FC', value: formatInbodyNumber(measurement.heart_rate, 0, ' lpm') });
  }
  if (measurement.target_weight_kg != null) {
    rows.push({ label: 'Peso objetivo', value: formatInbodyNumber(measurement.target_weight_kg, 1, ' kg') });
  }
  if (measurement.weight_control_kg != null) {
    rows.push({ label: 'Control peso', value: formatInbodyNumber(measurement.weight_control_kg, 1, ' kg') });
  }
  if (measurement.body_type) {
    rows.push({ label: 'Tipo corporal', value: measurement.body_type });
  }
  if (!rows.length) return null;

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          MorphoScan — datos adicionales
          <Badge variant="secondary" className="text-[10px] font-normal">
            MorphoScan
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-xs">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
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
  const deviceLabel = scaleDeviceLabel(scaleDeviceFromMeasurement(selected));

  return (
    <div className="space-y-2">
      <Select value={selected.id} onValueChange={onSelect}>
        <SelectTrigger className={compact ? 'h-8 text-xs' : ''}>
          <SelectValue placeholder="Seleccionar medición" />
        </SelectTrigger>
        <SelectContent>
          {measurements.map((m, idx) => (
            <SelectItem key={m.id} value={m.id}>
              {sessionLabel(m, idx, measurements.length, measurements)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className={compact ? 'text-xs' : 'text-sm'}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <Badge variant="outline" className="text-[10px] font-medium">
            {deviceLabel}
          </Badge>
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

function MeasurementReport({
  measurement,
  siblings,
  onSelectReference,
  compact,
}: {
  measurement: InbodyMeasurement;
  siblings: InbodyMeasurement[];
  onSelectReference?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <InbodyQualityAlert
        measurement={measurement}
        siblings={siblings}
        onSelectReference={onSelectReference}
        compact={compact}
      />
      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            <InbodySectionHelp metricId="weight_kg" title="Composición corporal" />
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Banda verde = rango normal InBody. Línea azul = valor medido; la curva une peso, MME y masa grasa.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <InbodyCompositionRangeGroup measurement={measurement} />
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

      <MorphoScanExtrasCard measurement={measurement} />

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
          No se pudieron cargar las mediciones de báscula.
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
          <p className="font-medium text-foreground">Sin mediciones de báscula</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            {taxId
              ? 'No hay registros vinculados a este DNI. Importa un CSV de Lookin\'Body o captura MorphoScan vía el puente BLE.'
              : 'Añade el DNI del cliente para vincular mediciones InBody o MorphoScan.'}
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

      <InbodyCompositionEvolutionChart
        measurements={measurements}
        selectedId={selected?.id}
        compact={compact}
        onSelectSession={setSelectedId}
      />

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

      {selected && (
        <MeasurementReport
          measurement={selected}
          siblings={measurements}
          onSelectReference={setSelectedId}
          compact={compact}
        />
      )}

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
