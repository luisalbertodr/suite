import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import { formatInbodyNumber } from '@/lib/inbodyMeasurements';
import {
  buildMorphoScanReport,
  formatMorphoMetric,
  formatMorphoRange,
  morphoEvalLabel,
  type MorphoEval,
  type MorphoMetricRow,
} from '@/lib/morphoscanReport';
import {
  MORPHOSCAN_GLOSSARY,
  morphoScanMetricTitle,
  type MorphoScanMetricId,
} from '@/lib/morphoscanGlossary';
import { enrichMorphoScanSegmentals } from '@/lib/morphoscanSegmentals';
import { cn } from '@/lib/utils';

interface Props {
  measurement: InbodyMeasurement;
  compact?: boolean;
}

function EvalBadge({ eval: e }: { eval: MorphoEval }) {
  if (e === 'unknown') return <span className="text-muted-foreground">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-normal',
        e === 'standard' && 'border-emerald-400/60 text-emerald-800 dark:text-emerald-200',
        e === 'low' && 'border-sky-400/60 text-sky-800 dark:text-sky-200',
        e === 'high' && 'border-amber-400/60 text-amber-900 dark:text-amber-100',
      )}
    >
      {morphoEvalLabel(e)}
    </Badge>
  );
}

function MetricLabel({ row }: { row: MorphoMetricRow }) {
  const id = row.id as MorphoScanMetricId;
  const entry = MORPHOSCAN_GLOSSARY[id];
  if (!entry) return <>{row.label}</>;
  return (
    <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50" title={morphoScanMetricTitle(id)}>
      {row.label}
    </span>
  );
}

function MetricTable({ rows }: { rows: MorphoMetricRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1.5 pr-3 font-medium">Parámetro</th>
            <th className="text-left py-1.5 pr-3 font-medium">Valor</th>
            <th className="text-left py-1.5 pr-3 font-medium">Rango</th>
            <th className="text-left py-1.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 last:border-0">
              <td className="py-1.5 pr-3 text-muted-foreground">
                <MetricLabel row={r} />
              </td>
              <td className="py-1.5 pr-3 font-medium tabular-nums">{formatMorphoMetric(r)}</td>
              <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                {formatMorphoRange(r)}
              </td>
              <td className="py-1.5">
                <EvalBadge eval={r.eval} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MuscleFatBars({
  weight,
  smm,
  fat,
}: {
  weight: number | null;
  smm: number | null;
  fat: number | null;
}) {
  const max = Math.max(weight ?? 0, smm ?? 0, fat ?? 0, 1);
  const bars: { label: string; value: number | null; className: string }[] = [
    { label: 'Peso', value: weight, className: 'bg-sky-500/80' },
    { label: 'Masa muscular esquelética', value: smm, className: 'bg-teal-500/80' },
    { label: 'Masa grasa corporal', value: fat, className: 'bg-amber-500/80' },
  ];
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.label}>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-muted-foreground">{b.label}</span>
            <span className="font-medium tabular-nums">
              {formatInbodyNumber(b.value, 1, ' kg')}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', b.className)}
              style={{ width: `${Math.min(100, ((b.value ?? 0) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ImpedanceBlock({ measurement }: { measurement: InbodyMeasurement }) {
  const freqs = ['20khz', '100khz'] as const;
  const cols = [
    { key: 'right_arm' as const, label: 'BD' },
    { key: 'left_arm' as const, label: 'BI' },
    { key: 'trunk' as const, label: 'TR' },
    { key: 'right_leg' as const, label: 'PD' },
    { key: 'left_leg' as const, label: 'PI' },
  ];
  const hasData = freqs.some((f) => {
    const row = measurement.impedance?.[f];
    return row && cols.some((c) => row[c.key] != null);
  });
  if (!hasData) return null;

  return (
    <Card className="border-violet-100/50 dark:border-violet-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Impedancia bioeléctrica (Ω)</CardTitle>
        <p className="text-[10px] text-muted-foreground mt-1">
          DF-BIA MorphoScan — 20 kHz y 100 kHz por segmento.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1 pr-2">Freq</th>
              {cols.map((c) => (
                <th key={c.key} className="text-center py-1 px-1">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {freqs.map((f) => {
              const row = measurement.impedance?.[f];
              return (
                <tr key={f} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-2 text-muted-foreground">
                    {f === '20khz' ? '20 kHz' : '100 kHz'}
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className="text-center py-1 px-1 tabular-nums font-medium">
                      {formatInbodyNumber(row?.[c.key], 1)}
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

export function MorphoScanMeasurementReport({ measurement, compact }: Props) {
  const enriched = useMemo(() => enrichMorphoScanSegmentals(measurement), [measurement]);
  const report = useMemo(() => buildMorphoScanReport(enriched), [enriched]);

  return (
    <div className="space-y-4">
      <Card className="border-violet-100/50 dark:border-violet-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Análisis de composición corporal
            <Badge variant="secondary" className="text-[10px] font-normal">
              MorphoScan
            </Badge>
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Valores de la medición MorphoScan. Rangos orientativos estilo Renpho (no clínicos).
          </p>
        </CardHeader>
        <CardContent>
          <MetricTable rows={report.compositionRows} />
        </CardContent>
      </Card>

      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        <Card className="border-violet-100/50 dark:border-violet-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Análisis de músculo y grasa</CardTitle>
          </CardHeader>
          <CardContent>
            <MuscleFatBars
              weight={report.weight_kg}
              smm={report.smm_kg}
              fat={report.body_fat_kg}
            />
          </CardContent>
        </Card>

        <Card className="border-violet-100/50 dark:border-violet-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Análisis de obesidad</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricTable rows={report.obesityRows} />
            {report.body_type ? (
              <p className="text-xs mt-3">
                <span className="text-muted-foreground">Tipo corporal: </span>
                <span className="font-medium">{report.body_type}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        <Card className="border-violet-100/50 dark:border-violet-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Puntuación corporal</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-4">
            <div className="text-3xl font-bold tabular-nums">
              {report.body_score != null ? report.body_score : '—'}
              <span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-100/50 dark:border-violet-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Objetivo: peso óptimo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Peso óptimo</dt>
                <dd className="font-medium tabular-nums">
                  {formatInbodyNumber(report.target_weight_kg, 1, ' kg')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Objetivo peso</dt>
                <dd className="font-medium tabular-nums">
                  {formatInbodyNumber(report.weight_control_kg, 1, ' kg')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Objetivo masa grasa</dt>
                <dd className="font-medium tabular-nums">
                  {formatInbodyNumber(report.fat_control_kg, 1, ' kg')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Objetivo masa muscular</dt>
                <dd className="font-medium tabular-nums">
                  {formatInbodyNumber(report.muscle_control_kg, 1, ' kg')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {report.otherRows.length > 0 ? (
        <Card className="border-violet-100/50 dark:border-violet-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Otros indicadores</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-xs">
              {report.otherRows.map((r) => (
                <div key={r.id}>
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="font-medium tabular-nums">{formatMorphoMetric(r)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <ImpedanceBlock measurement={enriched} />
    </div>
  );
}
