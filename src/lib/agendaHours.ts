/**
 * Horario del centro y de empleados (JSON en companies / agenda_employees).
 * Día 0 = domingo … 6 = sábado (getDay() JS).
 */

export type AgendaTimeSegment = { open: string; close: string };
/** Claves "0".."6" como string; array vacío = cerrado todo el día */
export type AgendaDayHoursMap = Record<string, AgendaTimeSegment[]>;

export type AgendaUnavailabilityEntry = {
  date: string;
  allDay?: boolean;
  start?: string;
  end?: string;
};

export const DEFAULT_AGENDA_CENTER_HOURS: AgendaDayHoursMap = {
  '0': [],
  '1': [{ open: '10:00', close: '20:30' }],
  '2': [{ open: '10:00', close: '20:30' }],
  '3': [{ open: '10:00', close: '20:30' }],
  '4': [{ open: '10:00', close: '20:30' }],
  '5': [{ open: '10:00', close: '20:30' }],
  '6': [{ open: '10:00', close: '14:00' }],
};

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return hh * 60 + mm;
}

export function minutesToHHmm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeDayKey(d: unknown): string {
  const n = typeof d === 'number' ? d : parseInt(String(d), 10);
  if (!Number.isFinite(n) || n < 0 || n > 6) return '0';
  return String(n);
}

export function parseAgendaDayHoursMap(raw: unknown): AgendaDayHoursMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_AGENDA_CENTER_HOURS };
  }
  const o = raw as Record<string, unknown>;
  const out: AgendaDayHoursMap = {};
  let anySeg = false;
  for (const k of DAY_KEYS) {
    const v = o[k];
    if (!Array.isArray(v)) {
      out[k] = [];
      continue;
    }
    const segs: AgendaTimeSegment[] = [];
    for (const item of v) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      const open = typeof s.open === 'string' ? s.open : '';
      const close = typeof s.close === 'string' ? s.close : '';
      if (!/^\d{1,2}:\d{2}$/.test(open) || !/^\d{1,2}:\d{2}$/.test(close)) continue;
      const oM = hhmmToMinutes(open);
      const cM = hhmmToMinutes(close);
      if (cM > oM) segs.push({ open, close });
    }
    out[k] = segs;
    if (segs.length) anySeg = true;
  }
  if (!anySeg) return { ...DEFAULT_AGENDA_CENTER_HOURS };
  return out;
}

/** Rango vertical de la cuadrícula (minutos desde medianoche) según el horario configurado */
export function getAgendaGridEnvelopeMinutes(center: AgendaDayHoursMap): { startMin: number; endMin: number } {
  let minM = 24 * 60;
  let maxM = 0;
  for (const k of DAY_KEYS) {
    const segs = center[k] ?? [];
    for (const seg of segs) {
      const a = hhmmToMinutes(seg.open);
      const b = hhmmToMinutes(seg.close);
      minM = Math.min(minM, a);
      maxM = Math.max(maxM, b);
    }
  }
  if (minM >= maxM) {
    return { startMin: 10 * 60, endMin: 21 * 60 };
  }
  return { startMin: minM, endMin: maxM };
}

/** El intervalo [slotStartMin, slotEndMin) queda totalmente dentro de algún tramo */
export function slotFullyInsideSegments(
  slotStartMin: number,
  slotEndMin: number,
  segments: AgendaTimeSegment[],
): boolean {
  if (slotEndMin <= slotStartMin) return false;
  return segments.some((seg) => {
    const a = hhmmToMinutes(seg.open);
    const b = hhmmToMinutes(seg.close);
    return slotStartMin >= a && slotEndMin <= b;
  });
}

export function parseUnavailability(raw: unknown): AgendaUnavailabilityEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AgendaUnavailabilityEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const date = typeof r.date === 'string' ? r.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      date,
      allDay: Boolean(r.allDay),
      start: typeof r.start === 'string' ? r.start : undefined,
      end: typeof r.end === 'string' ? r.end : undefined,
    });
  }
  return out;
}

/** True = el empleado NO está disponible en ese tramo (solapa con bloqueo) */
export function isEmployeeUnavailableBlock(
  dateYmd: string,
  slotStartMin: number,
  slotEndMin: number,
  blocks: AgendaUnavailabilityEntry[],
): boolean {
  for (const b of blocks) {
    if (b.date !== dateYmd) continue;
    if (b.allDay) return true;
    const st = b.start && /^\d{1,2}:\d{2}$/.test(b.start) ? hhmmToMinutes(b.start) : 0;
    const en = b.end && /^\d{1,2}:\d{2}$/.test(b.end) ? hhmmToMinutes(b.end) : 24 * 60;
    if (slotStartMin < en && slotEndMin > st) return true;
  }
  return false;
}

export function weekdayKeyFromYmd(dateYmd: string): string {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return normalizeDayKey(dt.getDay());
}

/** Segmentos efectivos del empleado ese día (null weekly = copia del centro) */
export function employeeDaySegments(
  dayKey: string,
  center: AgendaDayHoursMap,
  weeklyHours: AgendaDayHoursMap | null | undefined,
): AgendaTimeSegment[] {
  if (weeklyHours == null) return center[dayKey] ?? [];
  const fromEmp = weeklyHours[dayKey];
  if (!Array.isArray(fromEmp)) return center[dayKey] ?? [];
  return fromEmp;
}

export function slotBookableForAgenda(
  dateYmd: string,
  slotStartMin: number,
  slotEndMin: number,
  center: AgendaDayHoursMap,
  employeeWeekly: AgendaDayHoursMap | null | undefined,
  employeeBlocks: AgendaUnavailabilityEntry[],
): { centerOpen: boolean; employeeOpen: boolean; blocked: boolean; bookable: boolean; schedulingAllowed: boolean } {
  const dayKey = weekdayKeyFromYmd(dateYmd);
  const centerSegs = center[dayKey] ?? [];
  const empSegs = employeeDaySegments(dayKey, center, employeeWeekly);

  const centerOpen = slotFullyInsideSegments(slotStartMin, slotEndMin, centerSegs);
  const employeeOpen =
    empSegs.length === 0
      ? false
      : slotFullyInsideSegments(slotStartMin, slotEndMin, empSegs) &&
        slotFullyInsideSegments(slotStartMin, slotEndMin, centerSegs);
  const blocked = isEmployeeUnavailableBlock(dateYmd, slotStartMin, slotEndMin, employeeBlocks);
  const bookable = centerOpen && employeeOpen && !blocked;
  return {
    centerOpen,
    employeeOpen: employeeOpen && !blocked,
    blocked,
    bookable,
    /** Fuera de horario habitual sigue permitido; solo bloquean ausencias explícitas. */
    schedulingAllowed: !blocked,
  };
}

/** Genera slots [startMin, endMin) cada slotMinutes */
export function generateAgendaSlots(
  startMin: number,
  endMin: number,
  slotMinutes: 15 | 30,
): { time: string; hour: number; minute: number }[] {
  const slots: { time: string; hour: number; minute: number }[] = [];
  for (let t = startMin; t < endMin; t += slotMinutes) {
    const time = minutesToHHmm(t);
    slots.push({ time, hour: Math.floor(t / 60), minute: t % 60 });
  }
  return slots;
}
