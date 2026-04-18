import type { AppointmentItemDraft } from '@/types/agenda';

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
