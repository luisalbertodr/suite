import { enrichMorphoScanSegmentals } from '@/lib/morphoscanSegmentals';

export interface InbodySegmentEntry {
  kg?: number | null;
  pct?: number | null;
  eval_pct?: number | null;
  /** Valor estándar de referencia (kg), estilo informe Renpho. */
  standard_kg?: number | null;
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
  right_arm?: InbodySegmentEntry;
  left_arm?: InbodySegmentEntry;
  trunk?: InbodySegmentEntry;
  right_leg?: InbodySegmentEntry;
  left_leg?: InbodySegmentEntry;
}

export interface InbodyImpedanceFreq {
  right_arm?: number | null;
  left_arm?: number | null;
  trunk?: number | null;
  right_leg?: number | null;
  left_leg?: number | null;
}

export type ScaleDevice = 'inbody' | 'morphoscan';

export interface InbodyMeasurement {
  id: string;
  company_id: string;
  customer_id: string | null;
  inbody_user_id: string;
  measured_at: string;
  device?: ScaleDevice | string | null;
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
  weight_control_kg?: number | null;
  target_weight_kg?: number | null;
  bone_mass_kg?: number | null;
  protein_mass_kg?: number | null;
  protein_pct?: number | null;
  body_water_pct?: number | null;
  visceral_fat_index?: number | null;
  subcutaneous_fat_pct?: number | null;
  metabolic_age?: number | null;
  smi?: number | null;
  body_type?: string | null;
  heart_rate?: number | null;
  segmental_lean: InbodySegmentalLean;
  segmental_fat: InbodySegmentalFat;
  impedance: Record<string, InbodyImpedanceFreq>;
  edema: Record<string, number | null>;
  source: string;
  import_batch: string;
  raw_payload?: Record<string, unknown>;
  bca?: Record<string, unknown>;
  lb?: Record<string, unknown>;
  imp?: Record<string, InbodyImpedanceFreq> | Record<string, unknown>;
  data_quality?: import('@/lib/inbodyQuality').InbodyDataQuality | null;
}

/** Etiqueta de dispositivo para el selector de sesiones (InBody / MorphoScan). */
export function scaleDeviceFromMeasurement(m: Pick<InbodyMeasurement, 'device' | 'source'>): ScaleDevice {
  const d = (m.device || '').toLowerCase().trim();
  if (d === 'morphoscan' || d === 'morpho' || d === 'renpho') return 'morphoscan';
  if (d === 'inbody') return 'inbody';
  const src = (m.source || '').toLowerCase();
  // ble-scale-sync = bridge MorphoScan Nova / Renpho en mail
  if (
    src.includes('morphoscan') ||
    src.includes('renpho') ||
    src.includes('ble-scale') ||
    src === 'morphoscan_ble'
  ) {
    return 'morphoscan';
  }
  return 'inbody';
}

export function scaleDeviceLabel(device: ScaleDevice): string {
  return device === 'morphoscan' ? 'MorphoScan' : 'InBody';
}

export function isMorphoScanMeasurement(
  m: Pick<InbodyMeasurement, 'device' | 'source'>,
): boolean {
  return scaleDeviceFromMeasurement(m) === 'morphoscan';
}

export function hasMorphoScanExtras(m: InbodyMeasurement): boolean {
  return (
    m.bone_mass_kg != null ||
    m.protein_mass_kg != null ||
    m.protein_pct != null ||
    m.body_water_pct != null ||
    m.visceral_fat_index != null ||
    m.subcutaneous_fat_pct != null ||
    m.metabolic_age != null ||
    m.smi != null ||
    (m.body_type != null && m.body_type !== '') ||
    m.heart_rate != null ||
    m.weight_control_kg != null ||
    m.target_weight_kg != null
  );
}

export type InbodyRangeStatus = 'low' | 'normal' | 'high' | 'unknown';

export function normInbodyUserId(value: string | null | undefined): string {
  return (value || '').replace(/[\s\-.]/g, '').replace(/\u0000/g, '').toUpperCase();
}

const SPANISH_DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Completa letra de control si el ID InBody trae solo 7-8 dígitos (p. ej. 36108902 → 36108902Y). */
export function completeSpanishDni(userId: string | null | undefined): string {
  const norm = normInbodyUserId(userId);
  if (/^\d{7,8}$/.test(norm)) {
    const num = parseInt(norm.padStart(8, '0'), 10);
    const letter = SPANISH_DNI_LETTERS[num % 23] ?? '';
    return `${norm.padStart(8, '0')}${letter}`;
  }
  return norm;
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

/**
 * LookInBody MFA guarda PBFM_MIN/PBFM_MAX como % normal (p. ej. 12,3–19,7), no kg.
 * En importaciones antiguas se mapearon a body_fat_min_kg/max_kg sin convertir.
 */
export function resolveBodyFatMassRangeKg(
  m: Pick<InbodyMeasurement, 'weight_kg' | 'body_fat_min_kg' | 'body_fat_max_kg'>,
): { min: number | null; max: number | null } {
  const w = m.weight_kg;
  const rawMin = m.body_fat_min_kg;
  const rawMax = m.body_fat_max_kg;
  if (rawMin == null || rawMax == null) return { min: rawMin, max: rawMax };

  if (rawMin > rawMax && rawMin <= 80 && rawMax <= 80 && w != null && w > 0) {
    const loPct = Math.min(rawMin, rawMax);
    const hiPct = Math.max(rawMin, rawMax);
    return { min: (w * loPct) / 100, max: (w * hiPct) / 100 };
  }

  let min = rawMin;
  let max = rawMax;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

/** Medición probablemente corrupta (escaneo abortado / datos incoherentes en LookInBody). */
export function isSuspiciousInbodyMeasurement(m: InbodyMeasurement): boolean {
  if (m.weight_kg == null || m.weight_kg < 40) return false;
  if (m.pbf_pct != null && m.pbf_pct > 0 && m.pbf_pct < 8) return true;
  if (m.body_fat_kg != null && m.body_fat_kg / m.weight_kg < 0.06) return true;
  return false;
}

export type InbodySex = 'male' | 'female';

export function resolveInbodySex(sex: string | null | undefined): InbodySex | null {
  const s = (sex || '').trim().toUpperCase();
  if (s === 'F' || s === 'FEMALE' || s === 'MUJER' || s === 'W') return 'female';
  if (s === 'M' || s === 'MALE' || s === 'HOMBRE') return 'male';
  return null;
}

export function inbodySexLabel(sex: string | null | undefined): string {
  const resolved = resolveInbodySex(sex);
  if (resolved === 'female') return 'Mujer';
  if (resolved === 'male') return 'Hombre';
  return sex || '—';
}

/** % respecto al rango normal InBody (90–110). El dispositivo ya aplica referencias por sexo/edad. */
export function segmentLeanEvalPct(entry?: { pct?: number | null; eval_pct?: number | null }): number | null {
  const v = entry?.eval_pct ?? entry?.pct;
  return v == null || Number.isNaN(v) ? null : v;
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

export type InbodyMarkerCurvePoint = { xPct: number; yPct: number };
export type InbodyCurvePoint = { x: number; y: number };

/** Posición vertical del centro de cada fila de barra (h=20, gap=8 → coincide con gap-2 + h-5). */
export function inbodyBarRowCenterYpct(rowIndex: number, rowCount: number, barHeightPx = 20, gapPx = 8): number {
  const total = rowCount * barHeightPx + Math.max(0, rowCount - 1) * gapPx;
  const center = rowIndex * (barHeightPx + gapPx) + barHeightPx / 2;
  return (center / total) * 100;
}

/** Curva suave que une los marcadores azules de composición corporal (perfil InBody). */
export function inbodyMarkerCurvePathFromPoints(points: InbodyCurvePoint[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    const [a, b] = points;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const [a, b, c] = points;
  const t = 0.38;
  return [
    `M ${a.x} ${a.y}`,
    `C ${a.x} ${a.y - (b.y - a.y) * t}, ${b.x + (b.x - a.x) * t} ${b.y}, ${b.x} ${b.y}`,
    `C ${b.x - (c.x - b.x) * t} ${b.y}, ${c.x} ${c.y + (c.y - b.y) * t}, ${c.x} ${c.y}`,
  ].join(' ');
}

export function inbodyMarkerCurvePath(points: InbodyMarkerCurvePoint[]): string {
  return inbodyMarkerCurvePathFromPoints(points.map((p) => ({ x: p.xPct, y: p.yPct })));
}

export function buildInbodyCompositionMarkerCurve(
  scales: Array<{ markerPct: number } | null>,
): string | null {
  const rowCount = scales.length;
  const points: InbodyMarkerCurvePoint[] = [];
  scales.forEach((scale, index) => {
    if (!scale) return;
    points.push({
      xPct: scale.markerPct,
      yPct: inbodyBarRowCenterYpct(index, rowCount),
    });
  });
  if (points.length < 2) return null;
  return inbodyMarkerCurvePath(points);
}

const BCA_NUMERIC_FIELDS: (keyof InbodyMeasurement)[] = [
  'height_cm', 'age_years', 'weight_kg', 'weight_min_kg', 'weight_max_kg',
  'smm_kg', 'smm_min_kg', 'smm_max_kg', 'body_fat_kg', 'body_fat_min_kg', 'body_fat_max_kg',
  'tbw_kg', 'tbw_min_kg', 'tbw_max_kg', 'ffm_kg', 'ffm_min_kg', 'ffm_max_kg', 'slm_kg',
  'bmi', 'bmi_min', 'bmi_max', 'pbf_pct', 'pbf_min_pct', 'pbf_max_pct',
  'whr', 'whr_min', 'whr_max', 'bmr_kcal', 'bmr_min_kcal', 'bmr_max_kcal',
  'fat_control_kg', 'muscle_control_kg',
];

function parseBcaNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Rellena columnas vacías desde bca/lb/imp (importaciones CSV parciales). */
export function normalizeInbodyMeasurement(raw: InbodyMeasurement): InbodyMeasurement {
  const bca = (raw.bca && typeof raw.bca === 'object' ? raw.bca : {}) as Record<string, unknown>;
  const lb = (raw.lb && typeof raw.lb === 'object' ? raw.lb : {}) as Record<string, unknown>;
  const imp = (raw.imp && typeof raw.imp === 'object' ? raw.imp : {}) as Record<string, unknown>;

  const out: InbodyMeasurement = { ...raw };

  for (const field of BCA_NUMERIC_FIELDS) {
    if (out[field] != null) continue;
    const fromBca = parseBcaNumber(bca[field as string]);
    if (fromBca != null) (out as Record<string, unknown>)[field] = fromBca;
  }

  if (!out.sex && typeof bca.sex === 'string') out.sex = bca.sex;

  const leanFromLb = lb.segmental_lean as InbodySegmentalLean | undefined;
  const fatFromLb = lb.segmental_fat as InbodySegmentalFat | undefined;
  if (leanFromLb && Object.keys(leanFromLb).length > 0) {
    out.segmental_lean = { ...out.segmental_lean, ...leanFromLb };
  }
  if (fatFromLb && Object.keys(fatFromLb).length > 0) {
    out.segmental_fat = { ...out.segmental_fat, ...fatFromLb };
  }

  if ((!out.impedance || Object.keys(out.impedance).length === 0) && Object.keys(imp).length > 0) {
    out.impedance = imp as Record<string, InbodyImpedanceFreq>;
  }

  const bfmRange = resolveBodyFatMassRangeKg(out);
  out.body_fat_min_kg = bfmRange.min;
  out.body_fat_max_kg = bfmRange.max;

  // MorphoScan: impedance Ω sí; lean/fat kg segmentales no vienen por BLE → derivar.
  return enrichMorphoScanSegmentals(out);
}

const ONE_HOUR_MS = 3600_000;

function inbodyMeasurementScore(row: InbodyMeasurement): number {
  let score = 0;
  if (row.customer_id) score += 4;
  if (row.source?.includes('mdb')) score += 2;
  if (row.bmr_kcal != null) score += 1;
  if (row.segmental_lean && Object.keys(row.segmental_lean).length > 0) score += 1;
  if (isSuspiciousInbodyMeasurement(row)) score -= 12;
  if (row.pbf_pct != null && row.pbf_pct >= 8) score += 1;
  return score;
}

/**
 * Colapsa importaciones duplicadas (mismo DNI + desfase 1h por timezone o misma sesión).
 */
export function dedupeInbodyMeasurements(rows: InbodyMeasurement[]): InbodyMeasurement[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  );
  const kept: InbodyMeasurement[] = [];

  for (const row of sorted) {
    const userKey = normInbodyUserId(row.inbody_user_id);
    const t = new Date(row.measured_at).getTime();

    const dupIdx = kept.findIndex((existing) => {
      const sameUser =
        normInbodyUserId(existing.inbody_user_id) === userKey ||
        dniNumericKey(existing.inbody_user_id) === dniNumericKey(row.inbody_user_id);
      if (!sameUser) return false;

      const dt = Math.abs(new Date(existing.measured_at).getTime() - t);
      if (dt === 0) return true;
      if (dt >= ONE_HOUR_MS - 1000 && dt <= ONE_HOUR_MS + 1000) return true;

      if (dt < ONE_HOUR_MS && row.weight_kg != null && existing.weight_kg != null) {
        return Math.abs(row.weight_kg - existing.weight_kg) < 0.05;
      }
      return false;
    });

    if (dupIdx >= 0) {
      const current = kept[dupIdx];
      kept[dupIdx] =
        inbodyMeasurementScore(row) > inbodyMeasurementScore(current) ? row : current;
    } else {
      kept.push(row);
    }
  }

  return kept.sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  );
}
