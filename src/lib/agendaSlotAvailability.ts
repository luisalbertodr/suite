/**
 * Precálculo de disponibilidad y ocupación de la cuadrícula de agenda.
 *
 * La cuadrícula pinta `slots × empleados` celdas (p. ej. 42 × 15 = 630). Resolver el horario
 * dentro del render de cada celda implica reparsear `HH:mm` y construir un `Date` por celda;
 * aquí se calcula una sola vez por día en tablas planas indexadas por posición.
 */

import type { Appointment } from '@/types/agenda';
import {
  hhmmToMinutes,
  weekdayKeyFromYmd,
  type AgendaDayHoursMap,
  type AgendaTimeSegment,
  type AgendaUnavailabilityEntry,
} from '@/lib/agendaHours';

/** El slot es reservable: centro y empleado abiertos y sin bloqueo. */
export const SLOT_FLAG_BOOKABLE = 1 << 0;
/** El slot solapa una ausencia explícita del empleado. */
export const SLOT_FLAG_BLOCKED = 1 << 1;

export type AgendaAvailability = {
  slotCount: number;
  employeeCount: number;
  /** 1 = el centro está abierto en ese slot (índice = índice de slot). */
  centerOpen: Uint8Array;
  /** Flags por celda, indexados `employeeIndex * slotCount + slotIndex`. */
  cells: Uint8Array;
};

type MinuteRange = { start: number; end: number };

const EMPTY_RANGES: MinuteRange[] = [];

function toMinuteRanges(segments: AgendaTimeSegment[] | undefined): MinuteRange[] {
  if (!segments?.length) return EMPTY_RANGES;
  const out: MinuteRange[] = [];
  for (const seg of segments) {
    out.push({ start: hhmmToMinutes(seg.open), end: hhmmToMinutes(seg.close) });
  }
  return out;
}

function fullyInside(startMin: number, endMin: number, ranges: MinuteRange[]): boolean {
  if (endMin <= startMin) return false;
  for (const r of ranges) {
    if (startMin >= r.start && endMin <= r.end) return true;
  }
  return false;
}

/** Bloqueos del día convertidos a minutos (los de otras fechas se descartan). */
function dayBlockRanges(dateYmd: string, blocks: AgendaUnavailabilityEntry[]): MinuteRange[] | 'all-day' {
  let out: MinuteRange[] | null = null;
  for (const b of blocks) {
    if (b.date !== dateYmd) continue;
    if (b.allDay) return 'all-day';
    const start = b.start && /^\d{1,2}:\d{2}$/.test(b.start) ? hhmmToMinutes(b.start) : 0;
    const end = b.end && /^\d{1,2}:\d{2}$/.test(b.end) ? hhmmToMinutes(b.end) : 24 * 60;
    (out ??= []).push({ start, end });
  }
  return out ?? EMPTY_RANGES;
}

function overlapsAny(startMin: number, endMin: number, ranges: MinuteRange[]): boolean {
  for (const r of ranges) {
    if (startMin < r.end && endMin > r.start) return true;
  }
  return false;
}

/**
 * Tabla de disponibilidad equivalente a llamar `slotBookableForAgenda` por celda,
 * calculada una vez por (día, horarios, empleados, slots).
 */
export function buildAgendaAvailability(params: {
  dateYmd: string;
  slotStartMinutes: number[];
  slotMinutes: number;
  centerHours: AgendaDayHoursMap;
  employees: { id: string }[];
  employeeAgendaById: Record<
    string,
    { weekly: AgendaDayHoursMap | null; blocks: AgendaUnavailabilityEntry[] }
  >;
}): AgendaAvailability {
  const { dateYmd, slotStartMinutes, slotMinutes, centerHours, employees, employeeAgendaById } = params;
  const slotCount = slotStartMinutes.length;
  const employeeCount = employees.length;

  const dayKey = weekdayKeyFromYmd(dateYmd);
  const centerRanges = toMinuteRanges(centerHours[dayKey]);

  const centerOpen = new Uint8Array(slotCount);
  for (let s = 0; s < slotCount; s += 1) {
    const start = slotStartMinutes[s]!;
    centerOpen[s] = fullyInside(start, start + slotMinutes, centerRanges) ? 1 : 0;
  }

  const cells = new Uint8Array(slotCount * employeeCount);
  for (let e = 0; e < employeeCount; e += 1) {
    const meta = employeeAgendaById[employees[e]!.id];
    const weekly = meta?.weekly ?? null;
    const weeklyDay = weekly?.[dayKey];
    const empRanges = Array.isArray(weeklyDay) ? toMinuteRanges(weeklyDay) : centerRanges;
    const blocks = meta?.blocks?.length ? dayBlockRanges(dateYmd, meta.blocks) : EMPTY_RANGES;
    const blockedAllDay = blocks === 'all-day';
    const blockRanges = blockedAllDay ? EMPTY_RANGES : blocks;
    const base = e * slotCount;

    for (let s = 0; s < slotCount; s += 1) {
      const start = slotStartMinutes[s]!;
      const end = start + slotMinutes;
      const blocked = blockedAllDay || (blockRanges.length > 0 && overlapsAny(start, end, blockRanges));
      const employeeOpen =
        empRanges.length > 0 && centerOpen[s] === 1 && fullyInside(start, end, empRanges);
      let flags = 0;
      if (employeeOpen && !blocked) flags |= SLOT_FLAG_BOOKABLE;
      if (blocked) flags |= SLOT_FLAG_BLOCKED;
      cells[base + s] = flags;
    }
  }

  return { slotCount, employeeCount, centerOpen, cells };
}

/** Intervalos ocupados por empleado, aplanados como `[start0, end0, start1, end1, …]`. */
export type AgendaOccupancyIndex = Map<string, number[]>;

/**
 * Índice de ocupación en O(citas). Reemplaza el barrido `citas × slots` que se hacía
 * para saber si una celda está ocupada.
 */
export function buildAgendaOccupancyIndex(appointments: Appointment[]): AgendaOccupancyIndex {
  const index: AgendaOccupancyIndex = new Map();
  for (const apt of appointments) {
    let flat = index.get(apt.employeeId);
    if (!flat) {
      flat = [];
      index.set(apt.employeeId, flat);
    }
    const segments = apt.timeSegments;
    if (segments?.length) {
      for (const seg of segments) {
        flat.push(hhmmToMinutes(seg.startTime), hhmmToMinutes(seg.endTime));
      }
      continue;
    }
    flat.push(
      hhmmToMinutes(apt.startTime),
      hhmmToMinutes(apt.occupiedEndTime || apt.endTime),
    );
  }
  return index;
}

export function isAgendaRangeOccupied(
  index: AgendaOccupancyIndex,
  employeeId: string,
  startMin: number,
  endMin: number,
): boolean {
  const flat = index.get(employeeId);
  if (!flat) return false;
  for (let i = 0; i < flat.length; i += 2) {
    if (startMin < flat[i + 1]! && endMin > flat[i]!) return true;
  }
  return false;
}

/**
 * Claves `employeeId|HH:mm` de slots ocupados. Solo se necesita para el modo pegar
 * (portapapeles de citas); el resto de la cuadrícula consulta el índice de intervalos.
 */
export function buildAgendaOccupiedSlotKeys(
  index: AgendaOccupancyIndex,
  slotTimes: string[],
  gridStartMin: number,
  slotMinutes: number,
): Set<string> {
  const keys = new Set<string>();
  if (!slotTimes.length) return keys;
  for (const [employeeId, flat] of index) {
    for (let i = 0; i < flat.length; i += 2) {
      const start = flat[i]!;
      const end = flat[i + 1]!;
      if (end <= start) continue;
      const first = Math.max(0, Math.floor((start - gridStartMin) / slotMinutes));
      const last = Math.min(slotTimes.length - 1, Math.ceil((end - gridStartMin) / slotMinutes) - 1);
      for (let k = first; k <= last; k += 1) {
        keys.add(`${employeeId}|${slotTimes[k]!}`);
      }
    }
  }
  return keys;
}
