import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';

export type DatePresetId = 'today' | 'week' | 'month' | 'lastMonth' | 'quarter' | 'year';

export const REPORT_DATE_PRESETS: { label: string; value: DatePresetId }[] = [
  { label: 'Hoy', value: 'today' },
  { label: 'Esta semana', value: 'week' },
  { label: 'Este mes', value: 'month' },
  { label: 'Mes pasado', value: 'lastMonth' },
  { label: 'Este trimestre', value: 'quarter' },
  { label: 'Este año', value: 'year' },
];

export function resolveDatePresetRange(preset: DatePresetId): { fechaDesde: Date; fechaHasta: Date } {
  const now = new Date();
  const fechaHasta = endOfDay(now);
  let fechaDesde: Date;

  switch (preset) {
    case 'today':
      fechaDesde = startOfDay(now);
      break;
    case 'week':
      fechaDesde = startOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      fechaDesde = startOfMonth(now);
      break;
    case 'lastMonth': {
      const prev = subMonths(now, 1);
      fechaDesde = startOfMonth(prev);
      return { fechaDesde, fechaHasta: endOfMonth(prev) };
    }
    case 'quarter':
      fechaDesde = startOfQuarter(now);
      break;
    case 'year':
      fechaDesde = startOfYear(now);
      break;
    default:
      fechaDesde = startOfMonth(now);
  }

  return { fechaDesde, fechaHasta };
}
