import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  REPORT_DATE_PRESETS,
  resolveDatePresetRange,
  type DatePresetId,
} from '@/lib/reportDatePresets';

function formatRangeLabel(fechaDesde?: Date, fechaHasta?: Date): string {
  if (!fechaDesde && !fechaHasta) return 'Seleccionar periodo';
  if (fechaDesde && fechaHasta) {
    const sameDay = fechaDesde.toDateString() === fechaHasta.toDateString();
    if (sameDay) return format(fechaDesde, 'PPP', { locale: es });
    return `${format(fechaDesde, 'd MMM yyyy', { locale: es })} – ${format(fechaHasta, 'd MMM yyyy', { locale: es })}`;
  }
  if (fechaDesde) return `Desde ${format(fechaDesde, 'PPP', { locale: es })}`;
  return `Hasta ${format(fechaHasta!, 'PPP', { locale: es })}`;
}

export type ReportDateRangeValue = {
  fechaDesde?: Date;
  fechaHasta?: Date;
};

type ReportDateRangeFilterProps = {
  value: ReportDateRangeValue;
  onChange: (value: ReportDateRangeValue) => void;
  className?: string;
};

export const ReportDateRangeFilter: React.FC<ReportDateRangeFilterProps> = ({
  value,
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const selectedRange: DateRange | undefined = useMemo(
    () => ({
      from: value.fechaDesde,
      to: value.fechaHasta,
    }),
    [value.fechaDesde, value.fechaHasta],
  );

  const defaultMonth = value.fechaDesde ?? value.fechaHasta ?? new Date();

  const applyPreset = (preset: DatePresetId) => {
    const range = resolveDatePresetRange(preset);
    onChange(range);
    setOpen(false);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label>Periodo</Label>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal h-auto min-h-10',
              !value.fechaDesde && !value.fechaHasta && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{formatRangeLabel(value.fechaDesde, value.fechaHasta)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[250]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={defaultMonth}
            selected={selectedRange}
            onSelect={(range) => {
              onChange({
                fechaDesde: range?.from,
                fechaHasta: range?.to ?? range?.from,
              });
            }}
            initialFocus
            locale={es}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-2">
        {REPORT_DATE_PRESETS.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Elige inicio y fin en el mismo calendario (primer clic = inicio, segundo = fin).
      </p>
    </div>
  );
};
