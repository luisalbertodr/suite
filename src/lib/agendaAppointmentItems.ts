import type { AppointmentItemDraft, AppointmentItemKind, AppointmentTimeSegment } from '@/types/agenda';

export function calcEndFromStart(start: string, totalMinutes: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Math.max(0, totalMinutes);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

export function minutesBetweenHHmm(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
}

export function occupiedMinutes(
  items: Pick<AppointmentItemDraft, 'occupies_time' | 'duration_minutes'>[]
): number {
  return items
    .filter((i) => i.occupies_time)
    .reduce((s, i) => s + (Number(i.duration_minutes) || 0), 0);
}

export function effectiveDurationMinutes(
  items: Pick<AppointmentItemDraft, 'occupies_time' | 'duration_minutes'>[]
): number {
  const o = occupiedMinutes(items);
  return o > 0 ? o : 15;
}

/** Por defecto: servicios ocupan tiempo; productos y compra de bono no. */
export function defaultOccupiesTime(
  kind: AppointmentItemKind,
  opts?: { usingVoucher?: boolean }
): boolean {
  if (kind === 'service') return true;
  if (kind === 'bonus') return !!opts?.usingVoucher;
  return false;
}

export function partitionAppointmentItems(items: AppointmentItemDraft[]): {
  timeItems: AppointmentItemDraft[];
  paymentItems: AppointmentItemDraft[];
} {
  const timeItems: AppointmentItemDraft[] = [];
  const paymentItems: AppointmentItemDraft[] = [];
  for (const item of items) {
    if (item.occupies_time && Number(item.duration_minutes || 0) > 0) {
      timeItems.push(item);
    } else {
      paymentItems.push(item);
    }
  }
  return { timeItems, paymentItems };
}

/** Construye tramos horarios secuenciales según el orden de los ítems. */
export function buildAppointmentTimeSegments(
  startTime: string,
  items: AppointmentItemDraft[]
): AppointmentTimeSegment[] {
  let cursor = startTime;
  const segments: AppointmentTimeSegment[] = [];
  for (const item of items) {
    if (!item.occupies_time) continue;
    const durationMinutes = Math.max(0, Number(item.duration_minutes) || 0);
    if (durationMinutes <= 0) continue;
    const endTime = calcEndFromStart(cursor, durationMinutes);
    segments.push({
      clientKey: item.clientKey,
      label: (item.label || 'Servicio').trim() || 'Servicio',
      kind: item.kind,
      startTime: cursor,
      endTime,
      durationMinutes,
    });
    cursor = endTime;
  }
  return segments;
}

export function occupiedEndTimeFromItems(startTime: string, items: AppointmentItemDraft[]): string {
  const segments = buildAppointmentTimeSegments(startTime, items);
  if (!segments.length) return startTime;
  return segments[segments.length - 1]!.endTime;
}

/** Comprueba si un slot [slotStart, slotStart+slotMinutes) solapa tramos ocupados. */
export function slotOverlapsOccupiedTime(
  slotStartMin: number,
  slotEndMin: number,
  appointmentStartTime: string,
  segments: AppointmentTimeSegment[] | undefined,
  fallbackEndTime: string
): boolean {
  if (segments?.length) {
    return segments.some((seg) => {
      const segStart = hhmmToMinutes(seg.startTime);
      const segEnd = hhmmToMinutes(seg.endTime);
      return slotStartMin < segEnd && slotEndMin > segStart;
    });
  }
  const aptStart = hhmmToMinutes(appointmentStartTime);
  const aptEnd = hhmmToMinutes(fallbackEndTime);
  return slotStartMin < aptEnd && slotEndMin > aptStart;
}
