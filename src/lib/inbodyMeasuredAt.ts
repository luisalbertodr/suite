/** Lookin'Body / InBody guarda la hora de pared en Europe/Madrid. */
export const INBODY_TIMEZONE = 'Europe/Madrid';

function madridPartsFromUtc(utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INBODY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Convierte fecha/hora de pared (Madrid) a ISO UTC para timestamptz. */
export function madridWallClockToISO(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  let lo = Date.UTC(year, month - 1, day, hour - 3, minute, second);
  let hi = Date.UTC(year, month - 1, day, hour + 1, minute, second);

  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = madridPartsFromUtc(mid);
    const cmp =
      p.year - year ||
      p.month - month ||
      p.day - day ||
      p.hour - hour ||
      p.minute - minute ||
      p.second - second;
    if (cmp === 0) return new Date(mid).toISOString();
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return new Date(lo).toISOString();
}

export function parseInbodyMeasuredAt(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(/\u0000/g, '');

  const lookin = s.match(
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i,
  );
  if (lookin) {
    let hour = Number(lookin[4]);
    const minute = Number(lookin[5]);
    const second = Number(lookin[6]);
    const ampm = (lookin[7] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return madridWallClockToISO(
      Number(lookin[1]),
      Number(lookin[2]),
      Number(lookin[3]),
      hour,
      minute,
      second,
    );
  }

  if (/^\d{14}$/.test(s)) {
    return madridWallClockToISO(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)),
      Number(s.slice(6, 8)),
      Number(s.slice(8, 10)),
      Number(s.slice(10, 12)),
      Number(s.slice(12, 14)),
    );
  }

  const eu = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (eu) {
    const [, dd, mm, yyyy, hh = '0', min = '0', sec = '0'] = eu;
    return madridWallClockToISO(
      Number(yyyy),
      Number(mm),
      Number(dd),
      Number(hh),
      Number(min),
      Number(sec),
    );
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}
