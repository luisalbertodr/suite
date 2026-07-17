import React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Siren, Stethoscope } from 'lucide-react';
import {
  diffClinicalHistoryVisits,
  type ClinicalHistoryRecord,
  type ClinicalHistoryVisitDiff,
} from '@/lib/clinicalHistory';
import { cn } from '@/lib/utils';

function formatDateYmd(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), 'dd/MM/yyyy', { locale: es });
  } catch {
    return ymd;
  }
}

export function ClinicalHistoryVisitDiffCard({
  diff,
  compact,
  actions,
  omitAntecedentes = false,
}: {
  diff: ClinicalHistoryVisitDiff;
  compact?: boolean;
  actions?: React.ReactNode;
  /** Si true, el AP vive en el perfil clínico y no se repite en la tarjeta. */
  omitAntecedentes?: boolean;
}) {
  const { record, isFirst, showAntecedentes, antecedentesText, motivo, tratamiento, aviso } = diff;
  const showAp = !omitAntecedentes && showAntecedentes && Boolean(antecedentesText);
  const hasBody = showAp || motivo || tratamiento || aviso;

  return (
    <li
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-sm',
        compact && 'text-xs',
      )}
    >
      <div className={cn('flex flex-col gap-3 p-4', compact && 'p-3 gap-2')}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateYmd(record.fecha)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
              <Stethoscope className="h-3.5 w-3.5" />
              {isFirst ? 'Primera consulta' : 'Consulta'}
            </span>
            {!omitAntecedentes && showAntecedentes && !isFirst && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                AP actualizado
              </span>
            )}
          </div>
          {actions}
        </div>

        {hasBody ? (
          <div className="grid gap-3 md:grid-cols-2">
            {showAp && antecedentesText && (
              <div className="rounded-lg border bg-muted/30 p-3 md:col-span-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {isFirst ? 'AP' : 'AP actualizado'}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{antecedentesText}</p>
              </div>
            )}
            {motivo && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Motivo de consulta
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{motivo}</p>
              </div>
            )}
            {tratamiento && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tratamiento
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{tratamiento}</p>
              </div>
            )}
            {aviso && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/70 dark:bg-amber-950/20 md:col-span-2">
                <div className="flex items-start gap-2">
                  <Siren className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      Aviso a recepción
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-50">
                      {aviso}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin detalle clínico en esta visita.</p>
        )}

        {record.revisiones.length > 0 && (
          <p className="text-xs text-muted-foreground border border-dashed rounded-lg p-2">
            Contiene revisiones antiguas guardadas dentro de la consulta.
          </p>
        )}
      </div>
    </li>
  );
}

type TimelineProps = {
  records: ClinicalHistoryRecord[];
  /** Ascendente (evolución) por defecto; `desc` para listado ficha (más reciente primero). */
  order?: 'asc' | 'desc';
  compact?: boolean;
  maxHeightClassName?: string;
  title?: string;
  omitAntecedentes?: boolean;
  renderActions?: (diff: ClinicalHistoryVisitDiff) => React.ReactNode;
};

export const ClinicalHistoryVisitTimeline: React.FC<TimelineProps> = ({
  records,
  order = 'asc',
  compact,
  maxHeightClassName,
  title,
  omitAntecedentes = false,
  renderActions,
}) => {
  const diffs = React.useMemo(() => {
    const asc = diffClinicalHistoryVisits(records);
    return order === 'desc' ? [...asc].reverse() : asc;
  }, [records, order]);

  if (!diffs.length) return null;

  return (
    <div className="space-y-2">
      {title && (
        <p className={cn('text-xs font-medium text-muted-foreground', compact && 'text-[10px]')}>
          {title}
        </p>
      )}
      <ul
        className={cn(
          'space-y-3',
          maxHeightClassName && 'overflow-y-auto pr-1',
          maxHeightClassName,
          compact && 'text-xs',
        )}
      >
        {diffs.map((diff) => (
          <ClinicalHistoryVisitDiffCard
            key={diff.record.id}
            diff={diff}
            compact={compact}
            omitAntecedentes={omitAntecedentes}
            actions={renderActions?.(diff)}
          />
        ))}
      </ul>
    </div>
  );
};
