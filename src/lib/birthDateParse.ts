/**
 * Parseo de fechas de nacimiento (Dunasoft fecnac, Meta Lead Ads).
 * Mantener alineado con scripts/legacy_birth_date.py
 */

import type { MetaFieldEntry } from '@/lib/marketingLeadAppointment';
import { normalizeMetaFieldKey } from '@/lib/marketingLeadAppointment';

const BIRTH_DATE_KEY_FRAGMENTS = [
  'nacimiento',
  'birth',
  'fecha_de_nacimiento',
  'fecha_nac',
  'date_of_birth',
  'dob',
  'cumpleanos',
  'cumpleaños',
  'birthday',
  'born',
  'fnac',
  'fecnac',
];

const EN_MONTH: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Convierte texto libre a yyyy-MM-dd o null. */
export function parseBirthDateValue(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ymd = s.slice(0, 10);
    const [y, m, d] = ymd.split('-').map(Number);
    return toYmd(y, m, d);
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const y1 = Number(digits.slice(0, 4));
    const m1 = Number(digits.slice(4, 6));
    const d1 = Number(digits.slice(6, 8));
    if (y1 >= 1900 && y1 <= 2100) {
      const ok = toYmd(y1, m1, d1);
      if (ok) return ok;
    }
    const d2 = Number(digits.slice(0, 2));
    const m2 = Number(digits.slice(2, 4));
    const y2 = Number(digits.slice(4, 8));
    return toYmd(y2, m2, d2);
  }

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 30 ? 1900 : 2000;
    return toYmd(year, month, day);
  }

  const named = s.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([a-záéíóúñ]+)\s+(\d{4})/i,
  ) ?? s.match(/([a-záéíóúñ]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (named) {
    let day: number;
    let monthToken: string;
    let year: number;
    if (named.length === 4 && /^\d/.test(named[1])) {
      day = Number(named[1]);
      monthToken = named[2].toLowerCase();
      year = Number(named[3]);
    } else {
      monthToken = named[1].toLowerCase();
      day = Number(named[2]);
      year = Number(named[3]);
    }
    const monthIdx = EN_MONTH[monthToken];
    if (monthIdx != null) return toYmd(year, monthIdx + 1, day);
  }

  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) {
    const d = new Date(parsed);
    return toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return null;
}

export function metaFieldKeyIndicatesBirthDate(keyNorm: string): boolean {
  if (!keyNorm) return false;
  return BIRTH_DATE_KEY_FRAGMENTS.some((frag) => keyNorm.includes(frag));
}

export function extractBirthDateFromMetaFieldData(
  fieldData: MetaFieldEntry[] | null | undefined,
): string | null {
  if (!fieldData?.length) return null;
  for (const f of fieldData) {
    const key = normalizeMetaFieldKey(f.name);
    if (!metaFieldKeyIndicatesBirthDate(key)) continue;
    const value = (f.values ?? []).map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
    const ymd = parseBirthDateValue(value);
    if (ymd) return ymd;
  }
  return null;
}
