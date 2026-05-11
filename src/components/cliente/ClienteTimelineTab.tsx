import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles, Scissors, ClipboardCheck, Stethoscope, Gift } from 'lucide-react';

interface Props {
  history: any[];
  isLoading: boolean;
}

const eventIcons: Record<string, React.ReactNode> = {
  session: <Sparkles className="w-4 h-4" />,
  treatment: <Scissors className="w-4 h-4" />,
  consultation: <Stethoscope className="w-4 h-4" />,
  purchase: <Gift className="w-4 h-4" />,
  default: <ClipboardCheck className="w-4 h-4" />,
};

const eventColors: Record<string, string> = {
  session: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
  treatment: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  consultation: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  purchase: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const eventLabels: Record<string, string> = {
  session: 'Sesión',
  treatment: 'Tratamiento',
  consultation: 'Consulta',
  purchase: 'Compra',
};

export const ClienteTimelineTab: React.FC<Props> = ({ history, isLoading }) => {
  const formatEventDate = (value: unknown): string => {
    const dt = new Date(String(value || ''));
    if (Number.isNaN(dt.getTime())) return 'Fecha no disponible';
    if (dt.getFullYear() < 2000) return 'Fecha pendiente';
    return format(dt, "d MMM yyyy · HH:mm", { locale: es });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-sky-400" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Sin historial</h3>
        <p className="text-sm text-muted-foreground mt-1">Las sesiones y eventos aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-sky-200 via-sky-100 to-transparent dark:from-sky-800 dark:via-sky-900" />

      <div className="space-y-1">
        {history.map((event, idx) => {
          const type = event.event_type || 'default';
          const icon = eventIcons[type] || eventIcons.default;
          const color = eventColors[type] || eventColors.default;
          const label = eventLabels[type] || type;
          const data = event.data || {};

          return (
            <div key={event.id} className="relative flex gap-4 py-3 group">
              {/* Node */}
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${color} transition-transform group-hover:scale-110 flex-shrink-0`}>
                {icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {data.treatment || label}
                    </p>
                    {data.employee && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Profesional: {data.employee}
                      </p>
                    )}
                    {data.session_number && (
                      <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">
                        Sesión {data.session_number} de {data.total_sessions}
                      </p>
                    )}
                    {data.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.notes}</p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatEventDate(event.event_date)}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
