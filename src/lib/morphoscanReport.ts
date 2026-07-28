import type {
  InbodyMeasurement,
  InbodyRangeStatus,
} from '@/lib/inbodyMeasurements';
import { formatInbodyNumber } from '@/lib/inbodyMeasurements';
import { estimateMorphoScanWhr } from '@/lib/morphoscanSegmentals';

export type MorphoEval = 'low' | 'standard' | 'high' | 'unknown';

export interface MorphoMetricRow {
  id: string;
  label: string;
  value: number | null;
  unit?: string;
  decimals?: number;
  rangeMin?: number | null;
  rangeMax?: number | null;
  eval: MorphoEval;
}

export interface MorphoScanDerivedReport {
  weight_kg: number | null;
  body_fat_kg: number | null;
  pbf_pct: number | null;
  bone_mass_kg: number | null;
  protein_mass_kg: number | null;
  protein_pct: number | null;
  tbw_kg: number | null;
  body_water_pct: number | null;
  /** Renpho soft lean / masa muscular */
  slm_kg: number | null;
  smm_kg: number | null;
  ffm_kg: number | null;
  bmi: number | null;
  whr: number | null;
  bmr_kcal: number | null;
  visceral_fat_index: number | null;
  subcutaneous_fat_pct: number | null;
  smi: number | null;
  metabolic_age: number | null;
  body_type: string | null;
  body_score: number | null;
  target_weight_kg: number | null;
  weight_control_kg: number | null;
  fat_control_kg: number | null;
  muscle_control_kg: number | null;
  compositionRows: MorphoMetricRow[];
  obesityRows: MorphoMetricRow[];
  otherRows: MorphoMetricRow[];
}

function n(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return v;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Eval Renpho-like: Bajo / Estándar / Alto. */
export function morphoEval(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): MorphoEval {
  if (value == null || min == null || max == null) return 'unknown';
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'standard';
}

export function morphoEvalLabel(e: MorphoEval): string {
  switch (e) {
    case 'low':
      return 'Bajo';
    case 'high':
      return 'Alto';
    case 'standard':
      return 'Estándar';
    default:
      return '—';
  }
}

export function morphoEvalToInbodyStatus(e: MorphoEval): InbodyRangeStatus {
  if (e === 'low') return 'low';
  if (e === 'high') return 'high';
  if (e === 'standard') return 'normal';
  return 'unknown';
}

/**
 * Rangos aproximados estilo Renpho (mujer/hombre adultos).
 * No son clínicos oficiales; sirven para UI cuando la medición no trae min/max.
 */
export function morphoCompositionRanges(
  sex: string | null | undefined,
  weightKg: number,
): {
  fatKg: { min: number; max: number };
  boneKg: { min: number; max: number };
  proteinKg: { min: number; max: number };
  waterKg: { min: number; max: number };
  muscleKg: { min: number; max: number };
  smmKg: { min: number; max: number };
  weightKg: { min: number; max: number };
} {
  const female = (sex || '').toUpperCase().startsWith('F') || (sex || '').toLowerCase() === 'female';
  // Peso óptimo ~ IMC 18.5–25 (altura se aplica fuera); aquí banda relativa al peso medido.
  const wMin = round1(weightKg * 0.95);
  const wMax = round1(weightKg * 1.35);
  if (female) {
    return {
      weightKg: { min: wMin, max: wMax },
      fatKg: { min: round1(weightKg * 0.22), max: round1(weightKg * 0.35) },
      boneKg: { min: 2.0, max: 3.5 },
      proteinKg: { min: round1(weightKg * 0.14), max: round1(weightKg * 0.19) },
      waterKg: { min: round1(weightKg * 0.45), max: round1(weightKg * 0.6) },
      muscleKg: { min: round1(weightKg * 0.65), max: round1(weightKg * 0.85) },
      smmKg: { min: round1(weightKg * 0.35), max: round1(weightKg * 0.5) },
    };
  }
  return {
    weightKg: { min: wMin, max: wMax },
    fatKg: { min: round1(weightKg * 0.1), max: round1(weightKg * 0.22) },
    boneKg: { min: 2.5, max: 4.0 },
    proteinKg: { min: round1(weightKg * 0.15), max: round1(weightKg * 0.2) },
    waterKg: { min: round1(weightKg * 0.5), max: round1(weightKg * 0.65) },
    muscleKg: { min: round1(weightKg * 0.7), max: round1(weightKg * 0.9) },
    smmKg: { min: round1(weightKg * 0.4), max: round1(weightKg * 0.55) },
  };
}

export function morphoObesityRanges(sex: string | null | undefined): {
  bmi: { min: number; max: number };
  pbf: { min: number; max: number };
} {
  const female = (sex || '').toUpperCase().startsWith('F') || (sex || '').toLowerCase() === 'female';
  return {
    bmi: { min: 18.5, max: 24.9 },
    pbf: female ? { min: 21, max: 35 } : { min: 10, max: 20 },
  };
}

/** Matriz Renpho-like IMC × % grasa → tipo corporal. */
export function deriveMorphoBodyType(bmi: number | null, pbf: number | null): string | null {
  if (bmi == null || pbf == null) return null;
  const lowBmi = bmi < 18.5;
  const highBmi = bmi >= 25;
  const lowFat = pbf < 18;
  const highFat = pbf >= 28;
  if (lowBmi && lowFat) return 'Delgado';
  if (lowBmi && !highFat) return 'Delgado muscular';
  if (!lowBmi && !highBmi && lowFat) return 'Atlético';
  if (!lowBmi && !highBmi && !highFat) return 'Estándar';
  if (!lowBmi && !highBmi && highFat) return 'Sobrepeso';
  if (highBmi && highFat) return 'Obeso';
  if (highBmi && !highFat) return 'Musculoso';
  return 'Estándar';
}

/**
 * Puntuación corporal aproximada (0–100) a partir de IMC y % grasa
 * (penaliza desviación respecto a bandas estándar).
 */
export function deriveMorphoBodyScore(
  bmi: number | null,
  pbf: number | null,
  sex: string | null | undefined,
): number | null {
  if (bmi == null || pbf == null) return null;
  const { bmi: bR, pbf: pR } = morphoObesityRanges(sex);
  let score = 100;
  if (bmi < bR.min) score -= Math.min(30, (bR.min - bmi) * 8);
  else if (bmi > bR.max) score -= Math.min(30, (bmi - bR.max) * 6);
  if (pbf < pR.min) score -= Math.min(25, (pR.min - pbf) * 2);
  else if (pbf > pR.max) score -= Math.min(25, (pbf - pR.max) * 2);
  return Math.max(40, Math.min(100, Math.round(score)));
}

function optimalWeightKg(heightCm: number | null, sex: string | null | undefined): number | null {
  if (heightCm == null || heightCm < 100) return null;
  const h = heightCm / 100;
  const female = (sex || '').toUpperCase().startsWith('F') || (sex || '').toLowerCase() === 'female';
  // IMC objetivo ~21.5 (mujer) / 22 (hombre)
  const targetBmi = female ? 21.5 : 22;
  return round1(targetBmi * h * h);
}

function row(
  id: string,
  label: string,
  value: number | null,
  range: { min: number; max: number } | null,
  unit = 'kg',
  decimals = 1,
): MorphoMetricRow {
  return {
    id,
    label,
    value,
    unit,
    decimals,
    rangeMin: range?.min ?? null,
    rangeMax: range?.max ?? null,
    eval: morphoEval(value, range?.min, range?.max),
  };
}

/**
 * Enriquece una medición MorphoScan con campos derivados (SMI, objetivos, tipo, score)
 * sin recalcular BIA: usa peso/grasa/músculo/hueso ya persistidos.
 */
export function buildMorphoScanReport(m: InbodyMeasurement): MorphoScanDerivedReport {
  const weight = n(m.weight_kg);
  const height = n(m.height_cm);
  const sex = m.sex;

  let bodyFatKg = n(m.body_fat_kg);
  let pbf = n(m.pbf_pct);
  if (bodyFatKg == null && pbf != null && weight != null) {
    bodyFatKg = round2((weight * pbf) / 100);
  }
  if (pbf == null && bodyFatKg != null && weight != null && weight > 0) {
    pbf = round1((bodyFatKg / weight) * 100);
  }

  let bone = n(m.bone_mass_kg);
  let slm = n(m.slm_kg);
  let smm = n(m.smm_kg);
  let ffm = n(m.ffm_kg);
  if (ffm == null && weight != null && bodyFatKg != null) {
    ffm = round2(weight - bodyFatKg);
  }
  if (slm == null && ffm != null && bone != null) {
    slm = round2(ffm - bone);
  }
  if (ffm == null && slm != null && bone != null) {
    ffm = round2(slm + bone);
  }

  let waterPct = n(m.body_water_pct);
  let tbw = n(m.tbw_kg);
  if (tbw == null && waterPct != null && weight != null) {
    tbw = round2((weight * waterPct) / 100);
  }
  if (waterPct == null && tbw != null && weight != null && weight > 0) {
    waterPct = round1((tbw / weight) * 100);
  }
  if (waterPct == null && ffm != null && weight != null && weight > 0) {
    // Hidratación magra ~73% (misma heurística del bridge)
    waterPct = round1(((ffm * 0.73) / weight) * 100);
    tbw = round2((weight * waterPct) / 100);
  }

  let proteinMass = n(m.protein_mass_kg);
  let proteinPct = n(m.protein_pct);
  if (proteinMass == null && slm != null && tbw != null) {
    proteinMass = round2(Math.max(0, slm - tbw));
  }
  if (proteinPct == null && proteinMass != null && weight != null && weight > 0) {
    proteinPct = round1((proteinMass / weight) * 100);
  }

  let bmi = n(m.bmi);
  if (bmi == null && weight != null && height != null && height > 0) {
    const hm = height / 100;
    bmi = round1(weight / (hm * hm));
  }

  let smi = n(m.smi);
  if (smi == null && smm != null && height != null && height > 0) {
    const hm = height / 100;
    smi = round1(smm / (hm * hm));
  }

  const target =
    n(m.target_weight_kg) ?? (height != null ? optimalWeightKg(height, sex) : null);
  let weightControl = n(m.weight_control_kg);
  let fatControl = n(m.fat_control_kg);
  let muscleControl = n(m.muscle_control_kg);
  if (weight != null && target != null && weightControl == null) {
    weightControl = round1(target - weight);
  }
  if (bodyFatKg != null && weight != null && fatControl == null) {
    const ranges = morphoCompositionRanges(sex, weight);
    const midFat = (ranges.fatKg.min + ranges.fatKg.max) / 2;
    fatControl = round1(midFat - bodyFatKg);
  }
  if (smm != null && weight != null && muscleControl == null) {
    const ranges = morphoCompositionRanges(sex, weight);
    const midSmm = (ranges.smmKg.min + ranges.smmKg.max) / 2;
    muscleControl = round1(midSmm - smm);
  }

  const bodyType =
    (m.body_type && String(m.body_type).trim()) || deriveMorphoBodyType(bmi, pbf);
  const rawScore = m.raw_payload?.body_score;
  const bodyScore =
    typeof rawScore === 'number'
      ? rawScore
      : deriveMorphoBodyScore(bmi, pbf, sex);

  const ranges =
    weight != null ? morphoCompositionRanges(sex, weight) : null;
  const obesity = morphoObesityRanges(sex);

  const compositionRows: MorphoMetricRow[] = [
    row('weight_kg', 'Peso', weight, ranges?.weightKg ?? null),
    row('body_fat_kg', 'Masa grasa corporal', bodyFatKg, ranges?.fatKg ?? null),
    row('bone_mass_kg', 'Masa ósea', bone, ranges?.boneKg ?? null),
    row('protein_mass_kg', 'Masa proteica', proteinMass, ranges?.proteinKg ?? null),
    row('tbw_kg', 'Masa de agua corporal', tbw, ranges?.waterKg ?? null),
    row('slm_kg', 'Masa muscular', slm, ranges?.muscleKg ?? null),
    row('smm_kg', 'Masa muscular esquelética', smm, ranges?.smmKg ?? null),
  ];

  const obesityRows: MorphoMetricRow[] = [
    row('bmi', 'IMC', bmi, obesity.bmi, '', 1),
    row('pbf_pct', 'Porcentaje de grasa corporal', pbf, obesity.pbf, '%', 1),
  ];

  const otherRows: MorphoMetricRow[] = [
    {
      id: 'visceral_fat_index',
      label: 'Grasa visceral',
      value: n(m.visceral_fat_index),
      decimals: 0,
      eval: 'unknown',
    },
    {
      id: 'bmr_kcal',
      label: 'Tasa metabólica basal',
      value: n(m.bmr_kcal),
      unit: 'kcal',
      decimals: 0,
      eval: 'unknown',
    },
    {
      id: 'ffm_kg',
      label: 'Peso corporal sin grasa',
      value: ffm,
      unit: 'kg',
      decimals: 1,
      eval: 'unknown',
    },
    {
      id: 'subcutaneous_fat_pct',
      label: 'Grasa subcutánea',
      value: n(m.subcutaneous_fat_pct),
      unit: '%',
      decimals: 1,
      eval: 'unknown',
    },
    {
      id: 'smi',
      label: 'SMI',
      value: smi,
      unit: 'kg/m²',
      decimals: 1,
      eval: 'unknown',
    },
    {
      id: 'metabolic_age',
      label: 'Edad metabólica',
      value: n(m.metabolic_age),
      decimals: 0,
      eval: 'unknown',
    },
    {
      id: 'whr',
      label: 'WHR',
      value: n(m.whr) ?? estimateMorphoScanWhr(m),
      decimals: 2,
      eval: 'unknown',
    },
  ].filter((r) => r.value != null) as MorphoMetricRow[];

  return {
    weight_kg: weight,
    body_fat_kg: bodyFatKg,
    pbf_pct: pbf,
    bone_mass_kg: bone,
    protein_mass_kg: proteinMass,
    protein_pct: proteinPct,
    tbw_kg: tbw,
    body_water_pct: waterPct,
    slm_kg: slm,
    smm_kg: smm,
    ffm_kg: ffm,
    bmi,
    whr: n(m.whr) ?? estimateMorphoScanWhr(m),
    bmr_kcal: n(m.bmr_kcal),
    visceral_fat_index: n(m.visceral_fat_index),
    subcutaneous_fat_pct: n(m.subcutaneous_fat_pct),
    smi,
    metabolic_age: n(m.metabolic_age),
    body_type: bodyType,
    body_score: bodyScore,
    target_weight_kg: target,
    weight_control_kg: weightControl,
    fat_control_kg: fatControl,
    muscle_control_kg: muscleControl,
    compositionRows,
    obesityRows,
    otherRows,
  };
}

export function formatMorphoMetric(row: MorphoMetricRow): string {
  return formatInbodyNumber(row.value, row.decimals ?? 1, row.unit ? ` ${row.unit}` : '');
}

export function formatMorphoRange(row: MorphoMetricRow): string {
  if (row.rangeMin == null || row.rangeMax == null) return '—';
  const d = row.decimals ?? 1;
  return `${row.rangeMin.toFixed(d)} – ${row.rangeMax.toFixed(d)}`;
}
