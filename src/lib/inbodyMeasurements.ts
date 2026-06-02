export interface InbodySegmentEntry {
  kg?: number | null;
  pct?: number | null;
  eval_pct?: number | null;
}

export interface InbodySegmentalLean {
  right_arm?: InbodySegmentEntry;
  left_arm?: InbodySegmentEntry;
  trunk?: InbodySegmentEntry;
  right_leg?: InbodySegmentEntry;
  left_leg?: InbodySegmentEntry;
  diff_arm?: number | null;
  diff_leg?: number | null;
}

export interface InbodySegmentalFat {
  right_arm?: { kg?: number | null; pct?: number | null };
  left_arm?: { kg?: number | null; pct?: number | null };
  trunk?: { kg?: number | null; pct?: number | null };
  right_leg?: { kg?: number | null; pct?: number | null };
  left_leg?: { kg?: number | null; pct?: number | null };
}

export interface InbodyImpedanceFreq {
  right_arm?: number | null;
  left_arm?: number | null;
  trunk?: number | null;
  right_leg?: number | null;
  left_leg?: number | null;
}

export interface InbodyMeasurement {
  id: string;
  company_id: string;
  customer_id: string | null;
  inbody_user_id: string;
  measured_at: string;
  height_cm: number | null;
  age_years: number | null;
  sex: string | null;
  weight_kg: number | null;
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  smm_kg: number | null;
  smm_min_kg: number | null;
  smm_max_kg: number | null;
  body_fat_kg: number | null;
  body_fat_min_kg: number | null;
  body_fat_max_kg: number | null;
  tbw_kg: number | null;
  tbw_min_kg: number | null;
  tbw_max_kg: number | null;
  ffm_kg: number | null;
  ffm_min_kg: number | null;
  ffm_max_kg: number | null;
  slm_kg: number | null;
  bmi: number | null;
  bmi_min: number | null;
  bmi_max: number | null;
  pbf_pct: number | null;
  pbf_min_pct: number | null;
  pbf_max_pct: number | null;
  whr: number | null;
  whr_min: number | null;
  whr_max: number | null;
  bmr_kcal: number | null;
  bmr_min_kcal: number | null;
  bmr_max_kcal: number | null;
  fat_control_kg: number | null;
  muscle_control_kg: number | null;
  segmental_lean: InbodySegmentalLean;
  segmental_fat: InbodySegmentalFat;
  impedance: Record<string, InbodyImpedanceFreq>;
  edema: Record<string, number | null>;
  source: string;
  import_batch: string;
}

export type InbodyRangeStatus = 'low' | 'normal' | 'high' | 'unknown';

export function normInbodyUserId(value: string | null | undefined): string {
  return (value || '').replace(/[\s\-.]/g, '').toUpperCase();
}

/** Parte numérica del DNI/NIE sin letra de control (clave de cruce entre variantes). */
export function dniNumericKey(value: string | null | undefined): string | null {
  const s = normInbodyUserId(value);
  if (!s) return null;

  // DNI: 7-8 dígitos + letra opcional
  const dni = s.match(/^(\d{7,8})([A-Z])?$/);
  if (dni) return dni[1].padStart(8, '0');

  // NIE: X/Y/Z + 7 dígitos + letra opcional
  const nie = s.match(/^([XYZ]\d{7})([A-Z])?$/);
  if (nie) return nie[1];

  // Fallback: quitar letra final si mezcla dígitos y letras
  if (/^[A-Z0-9]+$/.test(s) && /[0-9]/.test(s) && /[A-Z]/.test(s) && s.at(-1)!.match(/[A-Z]/)) {
    const without = s.slice(0, -1);
    return /^\d{7,8}$/.test(without) ? without.padStart(8, '0') : without;
  }

  return s;
}

/** Todas las variantes equivalentes (con/sin letra, ceros a la izquierda). */
export function dniMatchKeys(value: string | null | undefined): string[] {
  const raw = (value || '').replace(/[\s\-.]/g, '');
  const s = raw.toUpperCase();
  if (!s) return [];

  const keys = new Set<string>([s, raw]);
  const numeric = dniNumericKey(s);
  if (numeric) {
    keys.add(numeric);
    const stripped = numeric.replace(/^0+/, '') || '0';
    keys.add(stripped);
    keys.add(stripped.padStart(8, '0'));
  }
  return [...keys];
}

export function findCustomerIdByDniKeys(
  userId: string | null | undefined,
  lookup: Map<string, string>,
): string | null {
  for (const key of dniMatchKeys(userId)) {
    const id = lookup.get(key);
    if (id) return id;
  }
  return null;
}

export function formatInbodyNumber(
  value: number | null | undefined,
  decimals = 1,
  suffix = '',
): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}${suffix}`;
}

export function inbodyRangeStatus(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): InbodyRangeStatus {
  if (value == null || min == null || max == null) return 'unknown';
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'normal';
}

export function segmentStatusFromPct(pct: number | null | undefined): InbodyRangeStatus {
  if (pct == null || Number.isNaN(pct)) return 'unknown';
  if (pct < 90) return 'low';
  if (pct > 110) return 'high';
  return 'normal';
}

export function inbodyStatusLabel(status: InbodyRangeStatus): string {
  switch (status) {
    case 'low':
      return 'Bajo';
    case 'high':
      return 'Alto';
    case 'normal':
      return 'Normal';
    default:
      return '—';
  }
}

export function inbodyStatusClass(status: InbodyRangeStatus): string {
  switch (status) {
    case 'low':
      return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40';
    case 'high':
      return 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40';
    case 'normal':
      return 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40';
    default:
      return 'text-muted-foreground bg-muted/50';
  }
}

export function inbodySexLabel(sex: string | null | undefined): string {
  const s = (sex || '').trim().toUpperCase();
  if (s === 'F' || s === 'FEMALE' || s === 'MUJER') return 'Mujer';
  if (s === 'M' || s === 'MALE' || s === 'HOMBRE') return 'Hombre';
  return sex || '—';
}

export function inbodyBarScale(
  value: number,
  min: number,
  max: number,
): { start: number; end: number; markerPct: number; normalStartPct: number; normalEndPct: number } {
  const span = Math.max(max - min, 0.001);
  const start = min - span * 0.45;
  const end = max + span * 0.45;
  const total = end - start;
  const markerPct = Math.min(100, Math.max(0, ((value - start) / total) * 100));
  const normalStartPct = ((min - start) / total) * 100;
  const normalEndPct = ((max - start) / total) * 100;
  return { start, end, markerPct, normalStartPct, normalEndPct };
}
