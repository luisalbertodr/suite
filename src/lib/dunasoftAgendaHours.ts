import type { AgendaDayHoursMap, AgendaTimeSegment } from '@/lib/agendaHours';
import { hhmmToMinutes } from '@/lib/agendaHours';

export type DunasoftEmployeeHoursRow = {
  lunes?: boolean | null;
  martes?: boolean | null;
  miercoles?: boolean | null;
  jueves?: boolean | null;
  viernes?: boolean | null;
  sabado?: boolean | null;
  domingo?: boolean | null;
  dia1a?: string | null;
  dia1b?: string | null;
  dia1c?: string | null;
  dia1d?: string | null;
  dia2a?: string | null;
  dia2b?: string | null;
  dia2c?: string | null;
  dia2d?: string | null;
  dia3a?: string | null;
  dia3b?: string | null;
  dia3c?: string | null;
  dia3d?: string | null;
  dia4a?: string | null;
  dia4b?: string | null;
  dia4c?: string | null;
  dia4d?: string | null;
  dia5a?: string | null;
  dia5b?: string | null;
  dia5c?: string | null;
  dia5d?: string | null;
  dia6a?: string | null;
  dia6b?: string | null;
  dia6c?: string | null;
  dia6d?: string | null;
  dia7a?: string | null;
  dia7b?: string | null;
  dia7c?: string | null;
  dia7d?: string | null;
};

const JS_TO_DUN_DAY: Record<number, number> = {
  0: 7,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
};

const WORK_DAY_FIELDS: Record<number, keyof DunasoftEmployeeHoursRow> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
};

function normTime(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^\d{1,2}:\d{2}$/.test(t)) return t.length === 4 ? `0${t}` : t.slice(0, 5);
  if (/^\d{3,4}$/.test(t)) {
    const p = t.padStart(4, '0');
    return `${p.slice(0, 2)}:${p.slice(2)}`;
  }
  return null;
}

function segmentPair(
  row: DunasoftEmployeeHoursRow,
  prefix: string,
  a: string,
  b: string
): AgendaTimeSegment | null {
  const open = normTime(row[`${prefix}${a}` as keyof DunasoftEmployeeHoursRow] as string);
  const close = normTime(row[`${prefix}${b}` as keyof DunasoftEmployeeHoursRow] as string);
  if (!open || !close) return null;
  if (hhmmToMinutes(close) <= hhmmToMinutes(open)) return null;
  return { open, close };
}

/** Segmentos horarios del empleado Dunasoft para una fecha concreta. */
export function employeeSegmentsForDate(
  row: DunasoftEmployeeHoursRow,
  date: Date
): AgendaTimeSegment[] {
  const jsDay = date.getDay();
  const workField = WORK_DAY_FIELDS[jsDay];
  if (workField && row[workField] === false) return [];

  const dunDay = JS_TO_DUN_DAY[jsDay] ?? 1;
  const prefix = `dia${dunDay}`;
  const segs: AgendaTimeSegment[] = [];
  const first = segmentPair(row, prefix, 'a', 'b');
  const second = segmentPair(row, prefix, 'c', 'd');
  if (first) segs.push(first);
  if (second) segs.push(second);
  return segs;
}

export function buildEmployeeAgendaHoursMap(
  row: DunasoftEmployeeHoursRow
): AgendaDayHoursMap {
  const out: AgendaDayHoursMap = {};
  for (let js = 0; js <= 6; js += 1) {
    const d = new Date(2026, 0, 4 + js);
    out[String(js)] = employeeSegmentsForDate(row, d);
  }
  return out;
}
