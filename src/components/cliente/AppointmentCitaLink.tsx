import React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  appointmentId: string;
  dateYmd: string;
  onOpen?: (appointmentId: string, dateYmd: string) => void;
  className?: string;
}

function formatCitaLabel(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), 'dd/MM/yyyy');
  } catch {
    return ymd;
  }
}

export const AppointmentCitaLink: React.FC<Props> = ({
  appointmentId,
  dateYmd,
  onOpen,
  className,
}) => {
  if (!appointmentId || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;

  const label = `Cita ${formatCitaLabel(dateYmd)}`;

  if (!onOpen) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 shrink-0 text-[10px] text-sky-700 dark:text-sky-400',
          className,
        )}
      >
        <Calendar className="h-3 w-3" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-0.5 shrink-0 text-[10px] font-medium text-sky-700 dark:text-sky-400',
        'hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(appointmentId, dateYmd);
      }}
      title="Abrir cita en la agenda"
    >
      <Calendar className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
};
