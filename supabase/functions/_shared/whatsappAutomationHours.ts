/** Horario de envío de WhatsApp automáticos (Europe/Madrid). */

export const MADRID_TZ = 'Europe/Madrid';

export type AutomationHoursSettings = {
  marketing_queue_hour_start?: number | null;
  marketing_queue_hour_end?: number | null;
};

export function normalizeAutomationHours(settings: AutomationHoursSettings): {
  hour_start: number;
  hour_end: number;
} {
  const start = Number(settings.marketing_queue_hour_start ?? 10);
  const end = Number(settings.marketing_queue_hour_end ?? 20);
  return {
    hour_start: Math.max(0, Math.min(23, Number.isFinite(start) ? start : 10)),
    hour_end: Math.max(1, Math.min(24, Number.isFinite(end) ? end : 20)),
  };
}

export function madridHour(date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    hour: 'numeric',
    hour12: false,
  });
  const raw = fmt.format(date);
  const hour = Number.parseInt(raw, 10);
  if (!Number.isFinite(hour)) return 0;
  return hour === 24 ? 0 : hour;
}

export function madridMinute(date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    minute: 'numeric',
  });
  const minute = Number.parseInt(fmt.format(date), 10);
  return Number.isFinite(minute) ? minute : 0;
}

/** Minutos transcurridos desde la apertura del horario de envío (Madrid). */
export function madridMinutesSinceWindowOpen(
  settings: AutomationHoursSettings,
  date = new Date(),
): number {
  const { hour_start } = normalizeAutomationHours(settings);
  const hour = madridHour(date);
  const minute = madridMinute(date);
  return (hour - hour_start) * 60 + minute;
}

/** Primera hora de la ventana: priorizar leads acumulados fuera de horario. */
export function isMorningCatchupWindow(
  settings: AutomationHoursSettings,
  date = new Date(),
): boolean {
  if (!isWithinAutomationHours(settings, date)) return false;
  return madridMinutesSinceWindowOpen(settings, date) < 60;
}

export function madridDateKey(date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hora local Madrid inclusive start, exclusive end (20 = hasta 19:59). */
export function isWithinAutomationHours(
  settings: AutomationHoursSettings,
  date = new Date(),
): boolean {
  const { hour_start, hour_end } = normalizeAutomationHours(settings);
  const hour = madridHour(date);
  return hour >= hour_start && hour < hour_end;
}

/** Próximo instante UTC en que abre la ventana de envío. */
export function getNextAutomationWindowStart(
  settings: AutomationHoursSettings,
  from = new Date(),
): Date {
  const { hour_start } = normalizeAutomationHours(settings);
  const dateKey = madridDateKey(from);
  const candidate = new Date(`${dateKey}T${String(hour_start).padStart(2, '0')}:00:00+02:00`);
  if (candidate.getTime() > from.getTime() && isWithinAutomationHours(settings, candidate)) {
    return candidate;
  }
  const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowKey = madridDateKey(tomorrow);
  return new Date(`${tomorrowKey}T${String(hour_start).padStart(2, '0')}:00:00+02:00`);
}
