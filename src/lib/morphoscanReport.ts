import type {
  InbodyMeasurement,
  InbodyRangeStatus,
} from '@/lib/inbodyMeasurements';
import { formatInbodyNumber } from '@/lib/inbodyMeasurements';
import {
  buildInbodyLikeRanges,
  computeInbodyLikeComposition,
  computeMetabolicAge,
  deriveInbodyLikeBodyScore,
  deriveInbodyLikeBodyType,
  idealWeightKg,
  INBODY_LIKE_FORMULA_VERSION,
  normalizeInbodyLikeSex,
  pickMorphoImpedanceInputs,
  resolveEffectiveR50Ohm,
  type InbodyLikeRanges,
} from '@/lib/inbodyLikeBia';
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
  /** Soft lean / masa muscular */
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
  /** true si TBW/FFM/%BF se recalcularon con motor InBody-like */
  compositionFromSuiteBia?: boolean;
  formulaVersion?: string;
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

/** Si no hay altura, estima H a partir de peso≈IMC 24 (solo fallback UI). */
function estimateHeightFromWeightBand(weightKg: number, sex: 'male' | 'female'): number {
  const bmi = sex === 'male' ? 24 : 23;
  return Math.sqrt(weightKg / bmi) * 100;
}

/**
 * Rangos LookInBody-like (por altura / ideales).
 * `weightKg` se conserva por compatibilidad; se usa solo si falta altura.
 */
export function morphoCompositionRanges(
  sex: string | null | undefined,
  weightKg: number,
  heightCm?: number | null,
): {
  fatKg: { min: number; max: number };
  boneKg: { min: number; max: number };
  proteinKg: { min: number; max: number };
  waterKg: { min: number; max: number };
  muscleKg: { min: number; max: number };
  smmKg: { min: number; max: number };
  weightKg: { min: number; max: number };
} {
  const s = normalizeInbodyLikeSex(sex);
  const h =
    heightCm != null && heightCm >= 100
      ? heightCm
      : estimateHeightFromWeightBand(weightKg, s);
  const ideal = idealWeightKg(h, s);
  const ranges = buildInbodyLikeRanges(h, s, ideal);
  return {
    weightKg: ranges.weightKg,
    fatKg: ranges.fatKg,
    boneKg: ranges.boneKg,
    proteinKg: ranges.proteinKg,
    waterKg: ranges.waterKg,
    muscleKg: ranges.muscleKg,
    smmKg: ranges.smmKg,
  };
}

export function morphoObesityRanges(sex: string | null | undefined): {
  bmi: { min: number; max: number };
  pbf: { min: number; max: number };
} {
  const s = normalizeInbodyLikeSex(sex);
  const ranges = buildInbodyLikeRanges(170, s, idealWeightKg(170, s));
  return { bmi: ranges.bmi, pbf: ranges.pbf };
}

export function deriveMorphoBodyType(
  bmi: number | null,
  pbf: number | null,
  sex?: string | null,
): string | null {
  if (bmi == null || pbf == null) return null;
  return deriveInbodyLikeBodyType(bmi, pbf, normalizeInbodyLikeSex(sex));
}

export function deriveMorphoBodyScore(
  bmi: number | null,
  pbf: number | null,
  sex: string | null | undefined,
): number | null {
  if (bmi == null || pbf == null) return null;
  return deriveInbodyLikeBodyScore(bmi, pbf, normalizeInbodyLikeSex(sex));
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

function trySuiteBia(m: InbodyMeasurement) {
  const weight = n(m.weight_kg);
  const height = n(m.height_cm);
  const age = n(m.age_years);
  if (weight == null || height == null || age == null) return null;
  const sex = normalizeInbodyLikeSex(m.sex);
  const { z1Ohm, z20, z100 } = pickMorphoImpedanceInputs(m);
  const rEff = resolveEffectiveR50Ohm({ sex, z1Ohm, z20, z100 });
  if (rEff == null) return null;
  return computeInbodyLikeComposition(weight, { heightCm: height, ageYears: age, sex }, rEff);
}

function isNumericPhysiqueRating(v: string): boolean {
  return /^[1-9]$/.test(v.trim());
}

/**
 * Informe MorphoScan con interpretación LookInBody-like.
 * Si hay Z (z1 o segmentaria), recalcula composición; si no, reinterpreta
 * peso/%BF persistidos con ideales/controles/rangos InBody.
 */
export function buildMorphoScanReport(m: InbodyMeasurement): MorphoScanDerivedReport {
  const weight = n(m.weight_kg);
  const height = n(m.height_cm);
  const sex = m.sex;
  const sexNorm = normalizeInbodyLikeSex(sex);
  const age = n(m.age_years);

  const suite = trySuiteBia(m);

  let bodyFatKg = suite?.bodyFatKg ?? n(m.body_fat_kg);
  let pbf = suite?.pbfPct ?? n(m.pbf_pct);
  if (bodyFatKg == null && pbf != null && weight != null) {
    bodyFatKg = round2((weight * pbf) / 100);
  }
  if (pbf == null && bodyFatKg != null && weight != null && weight > 0) {
    pbf = round1((bodyFatKg / weight) * 100);
  }

  let bone = suite?.boneMassKg ?? n(m.bone_mass_kg);
  let slm = suite?.muscleMassKg ?? n(m.slm_kg);
  let smm = suite?.smmKg ?? n(m.smm_kg);
  let ffm = suite?.ffmKg ?? n(m.ffm_kg);
  if (ffm == null && weight != null && bodyFatKg != null) {
    ffm = round2(weight - bodyFatKg);
  }
  if (slm == null && ffm != null && bone != null) {
    slm = round2(ffm - bone);
  }

  let waterPct = suite?.bodyWaterPct ?? n(m.body_water_pct);
  let tbw = suite?.tbwKg ?? n(m.tbw_kg);
  if (tbw == null && waterPct != null && weight != null) {
    tbw = round2((weight * waterPct) / 100);
  }
  if (waterPct == null && tbw != null && weight != null && weight > 0) {
    waterPct = round1((tbw / weight) * 100);
  }
  if (waterPct == null && ffm != null && weight != null && weight > 0) {
    waterPct = round1(((ffm * 0.73) / weight) * 100);
    tbw = round2((weight * waterPct) / 100);
  }

  let proteinMass = suite?.proteinMassKg ?? n(m.protein_mass_kg);
  let proteinPct = n(m.protein_pct);
  if (proteinMass == null && slm != null && tbw != null) {
    proteinMass = round2(Math.max(0, slm - tbw));
  }
  if (proteinPct == null && proteinMass != null && weight != null && weight > 0) {
    proteinPct = round1((proteinMass / weight) * 100);
  }

  let bmi = suite?.bmi ?? n(m.bmi);
  if (bmi == null && weight != null && height != null && height > 0) {
    const hm = height / 100;
    bmi = round1(weight / (hm * hm));
  }

  let smi = suite?.smi ?? n(m.smi);
  if (smi == null && smm != null && height != null && height > 0) {
    const hm = height / 100;
    smi = round1(smm / (hm * hm));
  }

  const idealW =
    suite?.idealWeightKg ?? (height != null ? idealWeightKg(height, sexNorm) : null);

  let weightControl = suite?.weightControlKg ?? n(m.weight_control_kg);
  let fatControl = suite?.fatControlKg ?? n(m.fat_control_kg);
  let muscleControl = suite?.muscleControlKg ?? n(m.muscle_control_kg);

  if (suite == null && height != null && weight != null && idealW != null) {
    const idealBfm = (sexNorm === 'male' ? 0.15 : 0.23) * idealW;
    const idealFfm = idealW - idealBfm;
    if (weightControl == null) weightControl = round1(idealW - weight);
    if (fatControl == null && bodyFatKg != null) fatControl = round1(idealBfm - bodyFatKg);
    if (muscleControl == null && ffm != null) {
      muscleControl = round1(Math.max(0, idealFfm - ffm));
    }
  }

  const storedType = m.body_type != null ? String(m.body_type).trim() : '';
  const bodyType =
    storedType && !isNumericPhysiqueRating(storedType)
      ? storedType
      : deriveMorphoBodyType(bmi, pbf, sex);

  const rawScore = m.raw_payload?.body_score;
  const bodyScore =
    typeof rawScore === 'number' ? rawScore : deriveMorphoBodyScore(bmi, pbf, sex);

  let metabolicAge = suite?.metabolicAge ?? null;
  if (
    metabolicAge == null &&
    age != null &&
    bodyFatKg != null &&
    smm != null &&
    idealW != null
  ) {
    const idealBfm = (sexNorm === 'male' ? 0.15 : 0.23) * idealW;
    const idealFfm = idealW - idealBfm;
    metabolicAge = computeMetabolicAge({
      ageYears: age,
      bodyFatKg,
      idealBfmKg: idealBfm,
      smmKg: smm,
      idealSmmKg: idealFfm * 0.57,
    });
  }

  let bmr = suite?.bmrKcal ?? null;
  if (bmr == null && ffm != null) bmr = Math.round(370 + 21.6 * ffm);
  if (bmr == null) bmr = n(m.bmr_kcal);

  const ranges: InbodyLikeRanges | null =
    height != null
      ? buildInbodyLikeRanges(height, sexNorm, idealWeightKg(height, sexNorm))
      : weight != null
        ? (() => {
            const hEst = estimateHeightFromWeightBand(weight, sexNorm);
            return buildInbodyLikeRanges(hEst, sexNorm, idealWeightKg(hEst, sexNorm));
          })()
        : null;

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
    row('bmi', 'IMC', bmi, ranges?.bmi ?? null, '', 1),
    row('pbf_pct', 'Porcentaje de grasa corporal', pbf, ranges?.pbf ?? null, '%', 1),
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
      value: bmr,
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
      value: n(m.subcutaneous_fat_pct) ?? (pbf != null ? round1(pbf * 0.71) : null),
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
      value: metabolicAge,
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
    bmr_kcal: bmr,
    visceral_fat_index: n(m.visceral_fat_index),
    subcutaneous_fat_pct:
      n(m.subcutaneous_fat_pct) ?? (pbf != null ? round1(pbf * 0.71) : null),
    smi,
    metabolic_age: metabolicAge,
    body_type: bodyType,
    body_score: bodyScore,
    target_weight_kg: idealW,
    weight_control_kg: weightControl,
    fat_control_kg: fatControl,
    muscle_control_kg: muscleControl,
    compositionFromSuiteBia: suite != null,
    formulaVersion: suite != null ? INBODY_LIKE_FORMULA_VERSION : undefined,
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
