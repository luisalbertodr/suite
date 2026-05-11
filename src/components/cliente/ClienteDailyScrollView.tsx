import React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  ClipboardList,
  FileSignature,
  Gift,
  Image as ImageIcon,
  Stethoscope,
  CalendarClock,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerDayTimeline, type DayGroup } from '@/hooks/useCustomerDayTimeline';
import { cn } from '@/lib/utils';

const kindIcon = (kind: string) => {
  if (kind === 'clinic_note' || kind === 'consulta') return Stethoscope;
  if (kind === 'consent') return FileSignature;
  if (kind === 'bono_purchase' || kind === 'bono_use' || kind === 'purchase') return Gift;
  if (kind === 'appointment') return CalendarClock;
  if (kind === 'aesthetic' || kind === 'session' || kind === 'treatment') return ClipboardList;
  return ImageIcon;
};

const kindPill = (kind: string) => {
  const k = (kind || '').toLowerCase();
  if (k === 'clinic_note') return 'Clínica';
  if (k === 'consent') return 'Consentimiento';
  if (k === 'bono_purchase') return 'Compra bono';
  if (k === 'bono_use') return 'Uso bono';
  if (k === 'appointment') return 'Cita';
  if (k === 'aesthetic' || k === 'session' || k === 'treatment') return 'Seguimiento';
  return k || 'Otro';
};

function dayTitle(ymd: string): string {
  try {
    return format(parseISO(ymd + 'T12:00:00'), "EEEE, d MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

function DayCard({ day }: { day: DayGroup }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 sticky top-0 z-[1] bg-background/90 backdrop-blur py-1 border-b border-sky-100/80 dark:border-sky-900/40">
        <Calendar className="w-4 h-4 text-sky-600 flex-shrink-0" />
        <h3 className="text-sm font-semibold capitalize text-foreground">{dayTitle(day.date)}</h3>
        {day.hasDailyLog && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
            Libro
          </span>
        )}
      </div>
      {day.daySummary && (
        <p className="text-xs text-muted-foreground border-l-2 border-sky-200 pl-2">{day.daySummary}</p>
      )}

      {day.assets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {day.assets.map((a) => (
            <span
              key={a.id}
              className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
            >
              {a.title || a.kind} {a.storagePath && '· documento'}
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {day.items.map((it) => {
          const Icon = kindIcon(it.kind);
          return (
            <li key={it.id}>
              <Card className="border-sky-100/60 dark:border-sky-900/30 shadow-sm">
                <CardHeader className="py-2 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-2 min-w-0">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight break-words">
                          {it.title}
                        </p>
                        {it.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-wrap">
                            {it.subtitle}
                          </p>
                        )}
                        {it.imageUrls && it.imageUrls.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {it.imageUrls.map((u, i) => (
                              <a
                                key={i}
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-sky-600 hover:underline"
                              >
                                Foto {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {kindPill(it.kind)}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {it.timeLabel}
                      {it.amountLabel && (
                        <span className="block text-right text-foreground font-medium">
                          {it.amountLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface Props {
  customerId: string;
  className?: string;
}

export const ClienteDailyScrollView: React.FC<Props> = ({ customerId, className }) => {
  const { data, isLoading, isError, error } = useCustomerDayTimeline(customerId);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-6 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error instanceof Error ? error.message : 'No se pudo cargar el historial diario.'}
      </p>
    );
  }

  if (!data?.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-sky-200/80 bg-sky-50/40 dark:border-sky-800/50 dark:bg-sky-950/20 px-4 py-8 text-center',
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">Sin actividad registrada aún en esta compañía.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Los registros de clínica, citas, bonos y consentimientos se agruparán aquí por día.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-8 max-w-3xl pl-0 border-l-2 border-sky-200/50 ml-1 dark:border-sky-800/50',
        className,
      )}
    >
      {data.map((day) => (
        <div key={day.date} className="pl-3 sm:pl-4">
          <DayCard day={day} />
        </div>
      ))}
    </div>
  );
};
