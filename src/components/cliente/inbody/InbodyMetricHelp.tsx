import React from 'react';
import { CircleHelp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  INBODY_GLOSSARY,
  inbodyMetricAriaLabel,
  inbodyMetricTitle,
  type InbodyMetricId,
} from '@/lib/inbodyGlossary';

interface MetricHelpProps {
  metricId: InbodyMetricId;
  /** Etiqueta visible; por defecto las siglas/nombre corto del glosario */
  label?: string;
  /** Mostrar nombre completo debajo de la sigla */
  showFullName?: boolean;
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
  /** Etiqueta HTML semántica del contenedor */
  as?: 'span' | 'div';
}

export function InbodyMetricLabel({
  metricId,
  label,
  showFullName = false,
  className,
  labelClassName,
  iconClassName,
  as: Tag = 'span',
}: MetricHelpProps) {
  const entry = INBODY_GLOSSARY[metricId];
  const display = label ?? entry.shortLabel;

  return (
    <Tag className={cn('inline-flex flex-col min-w-0', className)}>
      <span className={cn('font-medium text-foreground truncate leading-tight', labelClassName)}>
        {display}
      </span>
      {showFullName && (
        <span className="text-[9px] text-muted-foreground truncate leading-tight font-normal">
          {entry.fullName}
        </span>
      )}
    </Tag>
  );
}

export function InbodyMetricHelp({
  metricId,
  label,
  showFullName = false,
  className,
  labelClassName,
  iconClassName,
  as = 'span',
}: MetricHelpProps) {
  const entry = INBODY_GLOSSARY[metricId];
  const aria = inbodyMetricAriaLabel(metricId);
  const title = inbodyMetricTitle(metricId);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-start gap-1 min-w-0 max-w-full text-left rounded-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              className,
            )}
            aria-label={aria}
            title={title}
          >
            <InbodyMetricLabel
              metricId={metricId}
              label={label}
              showFullName={showFullName}
              labelClassName={labelClassName}
              as={as === 'div' ? 'div' : 'span'}
            />
            <CircleHelp
              className={cn('h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70', iconClassName)}
              aria-hidden
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[280px] p-3 text-xs leading-relaxed">
          <p className="font-semibold text-foreground">{entry.fullName}</p>
          {displayAbbrev(entry)}
          <p className="mt-1.5 text-muted-foreground">{entry.description}</p>
          <p className="mt-2 pt-2 border-t border-border/60 text-foreground/90">
            <span className="font-medium">Interpretación: </span>
            {entry.interpretation}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function displayAbbrev(entry: (typeof INBODY_GLOSSARY)[InbodyMetricId]) {
  if (entry.shortLabel === entry.fullName) return null;
  return (
    <p className="text-[10px] text-muted-foreground mt-0.5">
      Siglas: <span className="font-medium text-foreground/80">{entry.shortLabel}</span>
    </p>
  );
}

interface SectionHelpProps {
  metricId: InbodyMetricId;
  title?: string;
  className?: string;
}

/** Ayuda en cabeceras de sección (card title + icono). */
export function InbodySectionHelp({ metricId, title, className }: SectionHelpProps) {
  const entry = INBODY_GLOSSARY[metricId];
  const heading = title ?? entry.fullName;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 text-left rounded-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
            aria-label={inbodyMetricAriaLabel(metricId)}
            title={inbodyMetricTitle(metricId)}
          >
            <span>{heading}</span>
            <CircleHelp className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px] p-3 text-xs leading-relaxed">
          <p className="text-muted-foreground">{entry.description}</p>
          <p className="mt-2 pt-2 border-t border-border/60">
            <span className="font-medium">Interpretación: </span>
            {entry.interpretation}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
