import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { InbodyMetricId } from '@/lib/inbodyGlossary';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import {
  buildInbodyCompositionMarkerCurve,
  formatInbodyNumber,
  inbodyBarScale,
  inbodyRangeStatus,
  inbodyStatusClass,
  inbodyStatusLabel,
} from '@/lib/inbodyMeasurements';
import { InbodyMetricHelp } from './InbodyMetricHelp';

type RowDef = {
  metricId: InbodyMetricId;
  value: number | null | undefined;
  min: number | null | undefined;
  max: number | null | undefined;
};

interface Props {
  measurement: InbodyMeasurement;
  className?: string;
}

function CompositionBarTrack({
  scale,
}: {
  scale: ReturnType<typeof inbodyBarScale> | null;
}) {
  return (
    <div
      className="relative h-5 rounded-sm bg-muted/40 overflow-hidden border border-border/40"
      role="img"
      aria-hidden
    >
      {scale && (
        <div
          className="absolute inset-y-0 bg-emerald-100/80 dark:bg-emerald-950/50"
          style={{
            left: `${scale.normalStartPct}%`,
            width: `${scale.normalEndPct - scale.normalStartPct}%`,
          }}
        />
      )}
    </div>
  );
}

function CompositionBarMarker({
  scale,
}: {
  scale: ReturnType<typeof inbodyBarScale> | null;
}) {
  if (!scale) return null;
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-sky-600 dark:bg-sky-400 z-10 pointer-events-none"
      style={{ left: `${scale.markerPct}%` }}
    />
  );
}

/** Peso, MME y masa grasa con barras de rango y curva azul tipo informe InBody. */
export const InbodyCompositionRangeGroup: React.FC<Props> = ({ measurement, className }) => {
  const rows: RowDef[] = useMemo(
    () => [
      {
        metricId: 'weight_kg',
        value: measurement.weight_kg,
        min: measurement.weight_min_kg,
        max: measurement.weight_max_kg,
      },
      {
        metricId: 'smm_kg',
        value: measurement.smm_kg,
        min: measurement.smm_min_kg,
        max: measurement.smm_max_kg,
      },
      {
        metricId: 'body_fat_kg',
        value: measurement.body_fat_kg,
        min: measurement.body_fat_min_kg,
        max: measurement.body_fat_max_kg,
      },
    ],
    [measurement],
  );

  const scales = useMemo(
    () =>
      rows.map((row) =>
        row.value != null && row.min != null && row.max != null
          ? inbodyBarScale(row.value, row.min, row.max)
          : null,
      ),
    [rows],
  );

  const curvePath = useMemo(() => buildInbodyCompositionMarkerCurve(scales), [scales]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-[minmax(96px,1fr)_2fr_72px_64px] grid-rows-3 gap-x-2 gap-y-2 items-center">
        {rows.map((row, index) => {
          const status = inbodyRangeStatus(row.value, row.min, row.max);
          return (
            <React.Fragment key={row.metricId}>
              <div className={cn('text-xs', index === 0 ? 'row-start-1' : index === 1 ? 'row-start-2' : 'row-start-3', 'col-start-1')}>
                <InbodyMetricHelp metricId={row.metricId} labelClassName="text-xs" />
              </div>
              <span
                className={cn(
                  'text-right font-semibold tabular-nums text-xs',
                  index === 0 ? 'row-start-1' : index === 1 ? 'row-start-2' : 'row-start-3',
                  'col-start-3',
                )}
              >
                {formatInbodyNumber(row.value, 1, ' kg')}
              </span>
              <span
                className={cn(
                  'text-center rounded px-1 py-0.5 text-[10px] font-medium',
                  inbodyStatusClass(status),
                  index === 0 ? 'row-start-1' : index === 1 ? 'row-start-2' : 'row-start-3',
                  'col-start-4',
                )}
                title={inbodyStatusLabel(status)}
              >
                {inbodyStatusLabel(status)}
              </span>
            </React.Fragment>
          );
        })}

        <div className="row-start-1 row-span-3 col-start-2 relative flex flex-col gap-2">
          {curvePath && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d={curvePath}
                fill="none"
                stroke="currentColor"
                className="text-sky-600 dark:text-sky-400"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {scales.map((scale, index) => (
            <div key={rows[index].metricId} className="relative h-5">
              <CompositionBarTrack scale={scale} />
              <CompositionBarMarker scale={scale} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
