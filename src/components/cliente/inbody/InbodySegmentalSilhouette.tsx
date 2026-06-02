import React, { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  inbodySexLabel,
  inbodyStatusClass,
  inbodyStatusLabel,
  resolveInbodySex,
  segmentLeanEvalPct,
  segmentStatusFromPct,
  type InbodySegmentalFat,
  type InbodySegmentalLean,
} from '@/lib/inbodyMeasurements';
import {
  INBODY_CALLOUT_ANCHORS,
  INBODY_SEGMENT_LABELS,
  INBODY_SILHOUETTE_FRAME,
  INBODY_SILHOUETTE_SRC,
  type InbodySegmentKey,
  type InbodySilhouetteSex,
} from '@/lib/inbodySegmentalLayout';
import { InbodySectionHelp } from './InbodyMetricHelp';

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

function calloutStyle(segment: InbodySegmentKey): React.CSSProperties {
  const anchor = INBODY_CALLOUT_ANCHORS[segment];
  const translateX =
    anchor.align === 'center' ? '-50%' : anchor.align === 'right' ? '-100%' : '0';
  return {
    top: `${anchor.top}%`,
    left: `${anchor.left}%`,
    maxWidth: anchor.maxWidth ? `${anchor.maxWidth}%` : undefined,
    transform: `translate(${translateX}, ${anchor.offsetY ?? 0}px) translateX(${anchor.offsetX ?? 0}px)`,
  };
}

function BodySilhouetteImage({
  src,
  sex,
  className,
  onError,
}: {
  src: string;
  sex: InbodySilhouetteSex;
  className?: string;
  onError?: () => void;
}) {
  const frame = INBODY_SILHOUETTE_FRAME[sex];
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      onError={onError}
      className={cn(
        'absolute pointer-events-none select-none object-contain opacity-90 dark:opacity-80',
        className,
      )}
      style={{
        top: `${frame.top}%`,
        left: `${frame.left}%`,
        width: `${frame.width}%`,
        height: `${frame.height}%`,
        objectPosition: `${frame.objectX}% ${frame.objectY}%`,
        transform: 'translateX(-50%)',
      }}
    />
  );
}

function BodySilhouetteFallback({ sex }: { sex: InbodySilhouetteSex }) {
  const frame = INBODY_SILHOUETTE_FRAME[sex];
  const isFemale = sex === 'female';
  return (
    <svg
      viewBox="0 0 100 240"
      className="absolute pointer-events-none opacity-40"
      aria-hidden
      style={{
        top: `${frame.top}%`,
        left: `${frame.left}%`,
        width: `${frame.width}%`,
        height: `${frame.height}%`,
        transform: 'translateX(-50%)',
      }}
    >
      <g
        fill="hsl(var(--muted-foreground) / 0.15)"
        stroke="hsl(var(--foreground) / 0.2)"
        strokeWidth="0.6"
      >
        <ellipse cx="50" cy="17" rx={isFemale ? 12 : 13} ry="15" />
        {isFemale && (
          <path d="M38 14 Q50 8 62 14 Q64 22 60 28 Q50 32 40 28 Q36 22 38 14 Z" fill="inherit" />
        )}
        <path
          d={
            isFemale
              ? 'M36 32 Q50 26 64 32 L62 96 Q50 100 38 96 Z'
              : 'M34 32 Q50 28 66 32 L64 98 Q50 102 36 98 Z'
          }
        />
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
  evalPct,
}: {
  segment: InbodySegmentKey;
  kg?: number | null;
  evalPct?: number | null;
}) {
  const anchor = INBODY_CALLOUT_ANCHORS[segment];
  const meta = INBODY_SEGMENT_LABELS[segment];
  return (
    <div
      className={cn(
        'absolute z-10 text-[11px] leading-tight rounded px-1 py-0.5',
        'bg-background/85 backdrop-blur-[2px] shadow-sm border border-border/30',
        anchor.align === 'right' && 'text-right',
        anchor.align === 'left' && 'text-left',
        anchor.align === 'center' && 'text-center',
      )}
      style={calloutStyle(segment)}
    >
      <div className="text-[9px] text-foreground/70 font-medium mb-0.5">{meta.side}</div>
      <div className="font-bold tabular-nums text-foreground text-sm">{formatEs(kg, 1, ' kg')}</div>
      {evalPct != null && (
        <div className="tabular-nums text-[10px] text-muted-foreground">{formatEs(evalPct, 1, ' %')}</div>
      )}
      <StatusBadge pct={evalPct} />
    </div>
  );
}

function FatCallout({
  segment,
  kg,
  pbfPct,
}: {
  segment: InbodySegmentKey;
  kg?: number | null;
  pbfPct?: number | null;
}) {
  const anchor = INBODY_CALLOUT_ANCHORS[segment];
  const meta = INBODY_SEGMENT_LABELS[segment];
  return (
    <div
      className={cn(
        'absolute z-10 text-[11px] leading-tight space-y-0.5 rounded px-1 py-0.5',
        'bg-background/85 backdrop-blur-[2px] shadow-sm border border-border/30',
        anchor.align === 'right' && 'text-right',
        anchor.align === 'left' && 'text-left',
        anchor.align === 'center' && 'text-center',
      )}
      style={calloutStyle(segment)}
    >
      <div className="text-[9px] text-foreground/70 font-medium">{meta.side}</div>
      <div className="font-bold tabular-nums text-foreground">{formatEs(pbfPct, 1, ' %')}</div>
      <div className="tabular-nums text-foreground/90">{formatEs(kg, 1, ' kg')}</div>
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
  silhouetteSrc,
  silhouetteSex,
}: {
  title: string;
  variant: 'lean' | 'fat';
  legend: React.ReactNode;
  children: React.ReactNode;
  sideLabelLeft: string;
  sideLabelRight: string;
  silhouetteSrc: string;
  silhouetteSex: InbodySilhouetteSex;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const handleImageError = useCallback(() => setImageFailed(true), []);

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
        <h4 className="text-xs font-bold text-foreground/90 uppercase tracking-wide">
          {variant === 'lean' ? (
            <InbodySectionHelp metricId="segmental_lean" title={title} className="text-xs font-bold uppercase tracking-wide" />
          ) : (
            <InbodySectionHelp metricId="segmental_fat" title={title} className="text-xs font-bold uppercase tracking-wide" />
          )}
        </h4>
        <div className="mt-1 text-[9px] text-muted-foreground leading-snug">{legend}</div>
      </div>

      <div className="relative flex min-h-[280px] sm:min-h-[300px] px-3 py-2">
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

        <div className="relative mx-auto w-full max-w-[210px] flex-1 h-[260px] sm:h-[280px]">
          {!imageFailed ? (
            <BodySilhouetteImage src={silhouetteSrc} sex={silhouetteSex} onError={handleImageError} />
          ) : (
            <BodySilhouetteFallback sex={silhouetteSex} />
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

interface Props {
  lean: InbodySegmentalLean;
  fat: InbodySegmentalFat;
  /** Sexo registrado en la medición InBody (M/F). Define silueta y rangos de referencia del equipo. */
  sex?: string | null;
  measuredAtLabel?: string;
  compact?: boolean;
}

export const InbodySegmentalSilhouette: React.FC<Props> = ({
  lean,
  fat,
  sex,
  measuredAtLabel,
  compact,
}) => {
  const segments: InbodySegmentKey[] = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'];
  const silhouetteSex: InbodySilhouetteSex = resolveInbodySex(sex) ?? 'male';
  const silhouetteSrc = INBODY_SILHOUETTE_SRC[silhouetteSex];
  const sexLabel = useMemo(() => inbodySexLabel(sex), [sex]);

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className={cn('pb-2', compact && 'py-3')}>
        <CardTitle className={cn('text-sm', compact && 'text-xs')}>
          <InbodySectionHelp metricId="segmental_lean" title="Análisis segmental" className={cn('text-sm', compact && 'text-xs')} />
          {sexLabel !== '—' && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">· {sexLabel}</span>
          )}
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
            silhouetteSrc={silhouetteSrc}
            silhouetteSex={silhouetteSex}
            legend={
              <>
                <InbodySectionHelp
                  metricId="segment_lean_eval"
                  title="Masa magra · Evaluación (% normal)"
                  className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground"
                />
              </>
            }
          >
            {segments.map((key) => (
              <LeanCallout
                key={key}
                segment={key}
                kg={lean[key]?.kg}
                evalPct={segmentLeanEvalPct(lean[key])}
              />
            ))}
          </SegmentPanel>

          <SegmentPanel
            title="Grasa segmental"
            variant="fat"
            sideLabelLeft="Derecho"
            sideLabelRight="Izquierdo"
            silhouetteSrc={silhouetteSrc}
            silhouetteSex={silhouetteSex}
            legend={
              <>
                <InbodySectionHelp
                  metricId="segment_fat_pbf"
                  title="PGC segmental · Masa grasa"
                  className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground"
                />
              </>
            }
          >
            {segments.map((key) => (
              <FatCallout
                key={key}
                segment={key}
                kg={fat[key]?.kg}
                pbfPct={fat[key]?.pct}
              />
            ))}
          </SegmentPanel>
        </div>
      </CardContent>
    </Card>
  );
};
