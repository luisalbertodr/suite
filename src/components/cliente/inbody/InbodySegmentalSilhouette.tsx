import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  inbodyStatusClass,
  inbodyStatusLabel,
  segmentStatusFromPct,
  type InbodySegmentalFat,
  type InbodySegmentalLean,
} from '@/lib/inbodyMeasurements';

type SegmentKey = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';

const SEGMENT_META: Record<
  SegmentKey,
  { side: 'Derecho' | 'Izquierdo' | 'Tronco'; short: string }
> = {
  right_arm: { side: 'Derecho', short: 'BD' },
  left_arm: { side: 'Izquierdo', short: 'BI' },
  trunk: { side: 'Tronco', short: 'TR' },
  right_leg: { side: 'Derecho', short: 'PD' },
  left_leg: { side: 'Izquierdo', short: 'PI' },
};

/** Posiciones de las etiquetas (% del contenedor). Vista frontal: derecho del paciente = izquierda de pantalla. */
const CALLOUT_LAYOUT: Record<SegmentKey, { className: string; align: 'left' | 'center' | 'right' }> = {
  right_arm: { className: 'left-0 top-[14%] max-w-[38%]', align: 'right' },
  left_arm: { className: 'right-0 top-[14%] max-w-[38%]', align: 'left' },
  trunk: { className: 'left-1/2 -translate-x-1/2 top-[30%] max-w-[44%]', align: 'center' },
  right_leg: { className: 'left-[4%] bottom-[8%] max-w-[36%]', align: 'right' },
  left_leg: { className: 'right-[4%] bottom-[8%] max-w-[36%]', align: 'left' },
};

function formatEs(value: number | null | undefined, decimals = 1, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '—';
  const n = value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return suffix ? `${n}${suffix}` : n;
}

function StatusBadge({ pct }: { pct?: number | null }) {
  const status = segmentStatusFromPct(pct);
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight',
        inbodyStatusClass(status),
      )}
    >
      {inbodyStatusLabel(status)}
    </span>
  );
}

function BodySilhouetteSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 240"
      className={cn('h-full w-auto drop-shadow-sm', className)}
      aria-hidden
    >
      <g
        fill="hsl(var(--card))"
        stroke="hsl(var(--foreground) / 0.12)"
        strokeWidth="0.6"
        className="dark:fill-white dark:stroke-white/20"
      >
        <ellipse cx="50" cy="17" rx="13" ry="15" />
        <path d="M34 32 Q50 28 66 32 L64 98 Q50 102 36 98 Z" />
        <path d="M10 36 L32 34 L30 86 L12 84 Z" />
        <path d="M68 34 L90 36 L88 84 L70 86 Z" />
        <path d="M36 100 L48 98 L46 228 L34 230 Z" />
        <path d="M52 98 L64 100 L66 228 L54 230 Z" />
      </g>
    </svg>
  );
}

function LeanCallout({
  segment,
  kg,
  pct,
}: {
  segment: SegmentKey;
  kg?: number | null;
  pct?: number | null;
}) {
  const layout = CALLOUT_LAYOUT[segment];
  const meta = SEGMENT_META[segment];
  return (
    <div
      className={cn(
        'absolute z-10 text-[11px] leading-tight',
        layout.className,
        layout.align === 'right' && 'text-right',
        layout.align === 'left' && 'text-left',
        layout.align === 'center' && 'text-center',
      )}
    >
      {segment !== 'trunk' && (
        <div className="text-[9px] text-foreground/70 font-medium mb-0.5">{meta.side}</div>
      )}
      <div className="font-bold tabular-nums text-foreground text-sm">{formatEs(kg, 1, ' kg')}</div>
      <StatusBadge pct={pct} />
    </div>
  );
}

function FatCallout({
  segment,
  kg,
  pct,
}: {
  segment: SegmentKey;
  kg?: number | null;
  pct?: number | null;
}) {
  const layout = CALLOUT_LAYOUT[segment];
  const meta = SEGMENT_META[segment];
  return (
    <div
      className={cn(
        'absolute z-10 text-[11px] leading-tight space-y-0.5',
        layout.className,
        layout.align === 'right' && 'text-right',
        layout.align === 'left' && 'text-left',
        layout.align === 'center' && 'text-center',
      )}
    >
      {segment !== 'trunk' && (
        <div className="text-[9px] text-foreground/70 font-medium">{meta.side}</div>
      )}
      <div className="font-bold tabular-nums text-foreground">{formatEs(pct, 1, ' %')}</div>
      <div className="tabular-nums text-foreground/90">{formatEs(kg, 1, ' kg')}</div>
      <StatusBadge pct={pct} />
    </div>
  );
}

function SegmentPanel({
  title,
  variant,
  legend,
  children,
  sideLabelLeft,
  sideLabelRight,
}: {
  title: string;
  variant: 'lean' | 'fat';
  legend: React.ReactNode;
  children: React.ReactNode;
  sideLabelLeft: string;
  sideLabelRight: string;
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border overflow-hidden',
        variant === 'lean'
          ? 'bg-amber-50/90 border-amber-200/80 dark:bg-amber-950/35 dark:border-amber-800/50'
          : 'bg-rose-50/90 border-rose-200/80 dark:bg-rose-950/35 dark:border-rose-800/50',
      )}
    >
      <div className="px-3 pt-2 pb-1 border-b border-black/5 dark:border-white/10">
        <h4 className="text-xs font-bold text-foreground/90 uppercase tracking-wide">{title}</h4>
        <div className="mt-1 text-[9px] text-muted-foreground leading-snug">{legend}</div>
      </div>

      <div className="relative flex min-h-[300px] sm:min-h-[340px] px-6 py-3">
        <span
          className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-foreground/50 tracking-widest uppercase"
          style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
        >
          {sideLabelLeft}
        </span>
        <span
          className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-foreground/50 tracking-widest uppercase"
          style={{ writingMode: 'vertical-rl' }}
        >
          {sideLabelRight}
        </span>

        <div className="relative mx-auto w-full max-w-[200px] flex-1 h-[280px] sm:h-[300px]">
          <div className="absolute inset-[12%_18%] flex items-center justify-center pointer-events-none">
            <BodySilhouetteSvg className="max-h-full opacity-95" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

interface Props {
  lean: InbodySegmentalLean;
  fat: InbodySegmentalFat;
  measuredAtLabel?: string;
  compact?: boolean;
}

export const InbodySegmentalSilhouette: React.FC<Props> = ({
  lean,
  fat,
  measuredAtLabel,
  compact,
}) => {
  const segments: SegmentKey[] = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'];

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className={cn('pb-2', compact && 'py-3')}>
        <CardTitle className={cn('text-sm', compact && 'text-xs')}>
          Análisis segmental
        </CardTitle>
        {measuredAtLabel && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{measuredAtLabel}</p>
        )}
      </CardHeader>
      <CardContent className={cn('pb-4', compact && 'px-3')}>
        <div className="grid md:grid-cols-2 gap-3">
          <SegmentPanel
            title="Masa magra segmental"
            variant="lean"
            sideLabelLeft="Derecho"
            sideLabelRight="Izquierdo"
            legend={
              <>
                <span className="font-medium text-foreground/80">Masa magra</span>
                <span className="mx-1">·</span>
                <span>Evaluación (% normal)</span>
              </>
            }
          >
            {segments.map((key) => (
              <LeanCallout
                key={key}
                segment={key}
                kg={lean[key]?.kg}
                pct={lean[key]?.pct}
              />
            ))}
          </SegmentPanel>

          <SegmentPanel
            title="Grasa segmental"
            variant="fat"
            sideLabelLeft="Derecho"
            sideLabelRight="Izquierdo"
            legend={
              <>
                <span className="font-medium text-foreground/80">PGC</span>
                <span className="mx-1">·</span>
                <span className="font-medium">Masa grasa</span>
                <span className="mx-1">·</span>
                <span>Evaluación</span>
              </>
            }
          >
            {segments.map((key) => (
              <FatCallout
                key={key}
                segment={key}
                kg={fat[key]?.kg}
                pct={fat[key]?.pct}
              />
            ))}
          </SegmentPanel>
        </div>
      </CardContent>
    </Card>
  );
};
