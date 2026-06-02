import React from 'react';
import { cn } from '@/lib/utils';
import type { InbodyMetricId } from '@/lib/inbodyGlossary';
import {
  formatInbodyNumber,
  inbodyBarScale,
  inbodyRangeStatus,
  inbodyStatusClass,
  inbodyStatusLabel,
  type InbodyRangeStatus,
} from '@/lib/inbodyMeasurements';
import { InbodyMetricHelp } from './InbodyMetricHelp';

interface Props {
  metricId: InbodyMetricId;
  label?: string;
  value: number | null | undefined;
  min: number | null | undefined;
  max: number | null | undefined;
  unit?: string;
  className?: string;
}

export const InbodyRangeBar: React.FC<Props> = ({
  metricId,
  label,
  value,
  min,
  max,
  unit = 'kg',
  className,
}) => {
  const status: InbodyRangeStatus = inbodyRangeStatus(value, min, max);
  const hasBar = value != null && min != null && max != null;
  const scale = hasBar ? inbodyBarScale(value, min, max) : null;

  return (
    <div
      className={cn('grid grid-cols-[minmax(96px,1fr)_2fr_72px_64px] gap-2 items-center text-xs', className)}
      aria-label={`${label ?? metricId}: ${formatInbodyNumber(value, 1, unit === '%' ? '%' : ` ${unit}`)}, ${inbodyStatusLabel(status)}`}
    >
      <InbodyMetricHelp metricId={metricId} label={label} labelClassName="text-xs" />
      <div
        className="relative h-5 rounded-sm bg-muted/40 overflow-hidden border border-border/40"
        role="img"
        aria-hidden
        title="Banda verde: rango normal InBody. Línea azul: valor medido."
      >
        {scale && (
          <>
            <div
              className="absolute inset-y-0 bg-emerald-100/80 dark:bg-emerald-950/50"
              style={{ left: `${scale.normalStartPct}%`, width: `${scale.normalEndPct - scale.normalStartPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-sky-600 dark:bg-sky-400 z-10"
              style={{ left: `${scale.markerPct}%` }}
            />
          </>
        )}
      </div>
      <span className="text-right font-semibold tabular-nums">
        {formatInbodyNumber(value, 1, unit === '%' ? '%' : ` ${unit}`)}
      </span>
      <span
        className={cn('text-center rounded px-1 py-0.5 text-[10px] font-medium', inbodyStatusClass(status))}
        aria-label={inbodyStatusLabel(status)}
        title={inbodyStatusLabel(status)}
      >
        {inbodyStatusLabel(status)}
      </span>
    </div>
  );
};

interface MetricRowProps {
  metricId: InbodyMetricId;
  label?: string;
  value: number | null | undefined;
  min?: number | null;
  max?: number | null;
  unit?: string;
  decimals?: number;
}

export const InbodyMetricRow: React.FC<MetricRowProps> = ({
  metricId,
  label,
  value,
  min,
  max,
  unit = '',
  decimals = 1,
}) => {
  const status = inbodyRangeStatus(value, min ?? null, max ?? null);
  const range =
    min != null && max != null
      ? `${formatInbodyNumber(min, decimals)} ~ ${formatInbodyNumber(max, decimals)}${unit ? ` ${unit}` : ''}`
      : '—';

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-2 pr-3">
        <InbodyMetricHelp metricId={metricId} label={label} labelClassName="text-xs" />
      </td>
      <td className="py-2 pr-3 tabular-nums">{formatInbodyNumber(value, decimals, unit ? ` ${unit}` : '')}</td>
      <td className="py-2 pr-3 text-muted-foreground tabular-nums" title="Rango normal InBody para su perfil">
        {range}
      </td>
      <td className="py-2">
        <span
          className={cn('rounded px-2 py-0.5 text-[11px] font-medium', inbodyStatusClass(status))}
          aria-label={inbodyStatusLabel(status)}
          title={inbodyStatusLabel(status)}
        >
          {inbodyStatusLabel(status)}
        </span>
      </td>
    </tr>
  );
};
