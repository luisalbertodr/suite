import { differenceInYears, parseISO } from 'date-fns';

/** Edad en años cumplidos a partir de yyyy-MM-dd. */
export function ageFromBirthDate(birthDateYmd: string | null | undefined, refDate = new Date()): number | null {
  if (!birthDateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateYmd)) return null;
  try {
    const birth = parseISO(`${birthDateYmd}T12:00:00`);
    const years = differenceInYears(refDate, birth);
    return Number.isFinite(years) && years >= 0 && years < 150 ? years : null;
  } catch {
    return null;
  }
}

export function formatAgeLabel(birthDateYmd: string | null | undefined): string | null {
  const age = ageFromBirthDate(birthDateYmd);
  if (age == null) return null;
  return `${age} año${age === 1 ? '' : 's'}`;
}
