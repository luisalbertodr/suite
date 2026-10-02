import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  formatInbodyQualityAlert,
  resolveInbodyDataQuality,
} from '@/lib/inbodyQuality';
import { isMorphoScanMeasurement, type InbodyMeasurement } from '@/lib/inbodyMeasurements';
import {
  assessMorphoTakeQuality,
  morphoTakeIssueLabel,
  morphoTakeQualityLabels,
  type MorphoTakeIssue,
} from '@/lib/morphoTakeQuality';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Por encima del Select (z-295) para que el aviso no quede tapado. */
const WARNING_TOOLTIP_Z = 'z-[310]';

interface Props {
  measurement: InbodyMeasurement;
  siblings: InbodyMeasurement[];
  className?: string;
  /** Tamaño del icono */
  iconClassName?: string;
  /** Lado preferido del tooltip (p. ej. right junto al desplegable). */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/** Icono ⚠ con el detalle de calidad solo al pasar el ratón (sin banner superior). */
export function InbodyQualityWarningIcon({
  measurement,
  siblings,
  className,
  iconClassName,
  side = 'top',
}: Props) {
  const alert = useMemo(() => {
    if (isMorphoScanMeasurement(measurement)) {
      const raw = measurement.raw_payload ?? {};
      const grade = raw.morpho_take_grade as string | undefined;
      // Preferir calidad ya calculada en el adaptador (consenso con todas las tomas).
      if (grade === 'good') return null;
      if (grade === 'warn' || grade === 'bad') {
        const issues = Array.isArray(raw.morpho_take_issues)
          ? (raw.morpho_take_issues as MorphoTakeIssue[])
          : [];
        return {
          title: String(raw.morpho_take_title || 'Medición poco fiable — conviene repetir'),
          body: String(
            raw.morpho_take_message ||
              'La toma tiene señales de contacto irregular. Conviene repetir el pesaje.',
          ),
          issues: issues.map((i) => morphoTakeIssueLabel(i)),
        };
      }
      const q = assessMorphoTakeQuality(measurement, siblings);
      if (q.grade === 'good') return null;
      return {
        title: q.title,
        body: q.message,
        issues: morphoTakeQualityLabels(q),
      };
    }
    const quality = resolveInbodyDataQuality(measurement, siblings);
    if (!(quality.status === 'suspicious' && quality.needs_repeat)) return null;
    const reference = quality.reference_measurement_id
      ? siblings.find((m) => m.id === quality.reference_measurement_id) ?? null
      : null;
    return formatInbodyQualityAlert(quality, reference);
  }, [measurement, siblings]);

  if (!alert) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-sm p-0.5',
              'text-amber-600 dark:text-amber-400 cursor-help',
              'hover:bg-amber-50 dark:hover:bg-amber-950/40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
              className,
            )}
            aria-label={alert.title}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <AlertTriangle className={cn('h-3.5 w-3.5', iconClassName)} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'max-w-[320px] p-3 text-xs leading-relaxed border-amber-200 bg-amber-50 text-amber-950',
            'dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50',
            // Select usa z-[295]; el aviso debe quedar por encima
            WARNING_TOOLTIP_Z,
          )}
        >
          <p className="font-medium">{alert.title}</p>
          <p className="mt-1 opacity-90">{alert.body}</p>
          {alert.issues.length > 0 ? (
            <ul className="mt-1.5 list-disc pl-4 text-[11px] opacity-90">
              {alert.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** @deprecated El aviso ya no usa banner; se mantiene por compatibilidad de imports. */
export function InbodyQualityAlert(_props: {
  measurement: InbodyMeasurement;
  siblings: InbodyMeasurement[];
  onSelectReference?: (id: string) => void;
  compact?: boolean;
}) {
  return null;
}
