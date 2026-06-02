import React from 'react';
import { cn } from '@/lib/utils';
import {
  formatInbodyNumber,
  inbodyStatusClass,
  inbodyStatusLabel,
  segmentLeanEvalPct,
  segmentStatusFromPct,
  type InbodySegmentalFat,
  type InbodySegmentalLean,
} from '@/lib/inbodyMeasurements';

const SEGMENTS = [
  { key: 'right_arm' as const, label: 'Derecho', short: 'BD' },
  { key: 'left_arm' as const, label: 'Izquierdo', short: 'BI' },
  { key: 'trunk' as const, label: 'Tronco', short: 'TR' },
  { key: 'right_leg' as const, label: 'Derecho', short: 'PD' },
  { key: 'left_leg' as const, label: 'Izquierdo', short: 'PI' },
];

interface Props {
  lean: InbodySegmentalLean;
  fat: InbodySegmentalFat;
  className?: string;
}

function SegmentCell({
  title,
  kg,
  pct,
  pctLabel,
}: {
  title: string;
  kg?: number | null;
  pct?: number | null;
  pctLabel?: string;
}) {
  const status = segmentStatusFromPct(pct);
  return (
    <div className="rounded-md border border-border/50 bg-background/80 p-2 text-center min-w-[72px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{title}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{formatInbodyNumber(kg, 1, ' kg')}</div>
      {pct != null && (
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {pctLabel || `${formatInbodyNumber(pct, 1, '%')}`}
        </div>
      )}
      {pct != null && !pctLabel && (
        <div className={cn('mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', inbodyStatusClass(status))}>
          {inbodyStatusLabel(status)}
        </div>
      )}
    </div>
  );
}

export const InbodySegmentalView: React.FC<Props> = ({ lean, fat, className }) => {
  return (
    <div className={cn('grid md:grid-cols-2 gap-4', className)}>
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Masa magra segmental</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {SEGMENTS.map((seg) => {
            const entry = lean[seg.key];
            return (
              <SegmentCell
                key={`lean-${seg.key}`}
                title={`${seg.label} (${seg.short})`}
                kg={entry?.kg}
                pct={segmentLeanEvalPct(entry)}
              />
            );
          })}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Grasa segmental</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {SEGMENTS.map((seg) => {
            const entry = fat[seg.key];
            return (
              <SegmentCell
                key={`fat-${seg.key}`}
                title={`${seg.label} (${seg.short})`}
                kg={entry?.kg}
                pct={entry?.pct}
                pctLabel={entry?.pct != null ? `${formatInbodyNumber(entry.pct, 1, '%')}` : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
