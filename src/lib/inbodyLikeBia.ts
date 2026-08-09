/**
 * Motor de composición estilo InBody / LookInBody Standard para MorphoScan.
 *
 * Entrada: peso + perfil (H/A/S) + impedancia (z1 o mapa segmentario).
 * No usa %BF comercial Renpho; recalcula TBW→FFM→BFM y objetivos clínicos.
 *
 * R efectiva ~50 kHz: z1 Morpho × escala sexo (calibrada a panel InBody/Renpho
 * 2026-08: Marta F×1.08, Luis M×1.33 → R≈400 Ω → TBW≈InBody).
 */

export type InbodyLikeSex = 'male' | 'female';

export interface InbodyLikeProfile {
  heightCm: number;
  ageYears: number;
  sex: InbodyLikeSex;
}

export interface SegmentalOhms {
  right_arm?: number | null;
  left_arm?: number | null;
  trunk?: number | null;
  right_leg?: number | null;
  left_leg?: number | null;
}

export interface InbodyLikeComposition {
  weightKg: number;
  rEffOhm: number;
  tbwKg: number;
  ffmKg: number;
  bodyFatKg: number;
  pbfPct: number;
  proteinMassKg: number;
  boneMassKg: number;
  /** Soft lean ≈ FFM − bone (masa muscular Renpho-like). */
  muscleMassKg: number;
  smmKg: number;
  smi: number;
  bodyWaterPct: number;
  bmi: number;
  bmrKcal: number;
  /** Metodología LookInBody-like. */
  idealWeightKg: number;
  idealBfmKg: number;
  idealFfmKg: number;
  idealSmmKg: number;
  weightControlKg: number;
  fatControlKg: number;
  muscleControlKg: number;
  metabolicAge: number;
  bodyType: string;
  bodyScore: number;
  /** Rangos de composición / obesidad para UI. */
  ranges: InbodyLikeRanges;
  formulaVersion: typeof INBODY_LIKE_FORMULA_VERSION;
}

export interface InbodyLikeRanges {
  weightKg: { min: number; max: number };
  fatKg: { min: number; max: number };
  boneKg: { min: number; max: number };
  proteinKg: { min: number; max: number };
  waterKg: { min: number; max: number };
  muscleKg: { min: number; max: number };
  smmKg: { min: number; max: number };
  bmi: { min: number; max: number };
  pbf: { min: number; max: number };
}

/** Escala z1 Morpho → R50 efectiva (mismo factor que BIA gateway calibrada). */
export const INBODY_LIKE_Z1_SCALE_MALE = 1.33;
export const INBODY_LIKE_Z1_SCALE_FEMALE = 1.08;

export const INBODY_LIKE_FORMULA_VERSION = 'inbody-like-v1-2026-08';

const HYDRATION_FFM = 0.73;
const PROTEIN_OF_FFM = 0.18;
const BONE_OF_FFM = 0.07;
/** SMM ≈ fracción de FFM en adultos (LookInBody / clínica ~55–57 %). */
const SMM_OF_FFM = 0.57;

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function normalizeInbodyLikeSex(sex: string | null | undefined): InbodyLikeSex {
  const s = (sex || '').trim().toLowerCase();
  if (s === 'f' || s === 'female' || s.startsWith('mujer') || s === 'muller') return 'female';
  return 'male';
}

export function z1ScaleForSex(sex: InbodyLikeSex): number {
  return sex === 'male' ? INBODY_LIKE_Z1_SCALE_MALE : INBODY_LIKE_Z1_SCALE_FEMALE;
}

/**
 * Interpolación log-frecuencia 20→100 kHz hacia ~50 kHz (por segmento).
 */
export function interpolateZ50Ohm(z20: number, z100: number): number {
  if (!(z20 > 0) || !(z100 > 0)) return Number.NaN;
  const t = Math.log(50 / 20) / Math.log(100 / 20);
  return Math.exp(Math.log(z20) + t * (Math.log(z100) - Math.log(z20)));
}

/**
 * R de trayecto hemicuerpo dcho. (brazo + tronco + pierna), típico BIA 8-electrodos.
 * Preferir 100 kHz si no hay par 20/100; si hay ambos, interpolar a 50 kHz.
 */
export function estimatePathR50Ohm(
  z20: SegmentalOhms | null | undefined,
  z100: SegmentalOhms | null | undefined,
): number | null {
  const segs = ['right_arm', 'trunk', 'right_leg'] as const;
  const vals: number[] = [];
  for (const k of segs) {
    const a = z20?.[k];
    const b = z100?.[k];
    if (a != null && a > 0 && b != null && b > 0) {
      const z = interpolateZ50Ohm(a, b);
      if (Number.isFinite(z)) vals.push(z);
    } else if (b != null && b > 0) {
      vals.push(b);
    } else if (a != null && a > 0) {
      vals.push(a);
    }
  }
  if (vals.length < 3) return null;
  const sum = vals.reduce((s, v) => s + v, 0);
  return sum > 50 && sum < 2000 ? r1(sum) : null;
}

/**
 * R efectiva ~50 kHz.
 * Preferir z1×escala (calibrada a InBody); si no hay z1, trayecto RA+TR+RL.
 * El path crudo Morpho suele quedar alto (~500–600 Ω) vs R clínica ~400 Ω.
 */
export function resolveEffectiveR50Ohm(opts: {
  sex: InbodyLikeSex;
  z1Ohm?: number | null;
  z20?: SegmentalOhms | null;
  z100?: SegmentalOhms | null;
}): number | null {
  const z1 = opts.z1Ohm;
  if (z1 != null && z1 >= 100 && z1 <= 1500) {
    return r1(z1 * z1ScaleForSex(opts.sex));
  }
  const path = estimatePathR50Ohm(opts.z20, opts.z100);
  if (path != null) {
    // Ajuste empírico path→R50 (Luis 2026-08: path≈518 → ~400)
    return r1(path * 0.77);
  }
  return null;
}

/** TBW (L≈kg) — modelo clínico H²/R + W + A + sexo. */
export function computeTbwLiters(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: InbodyLikeSex,
  rOhm: number,
): number {
  const s = sex === 'male' ? 1 : 0;
  const h2r = (heightCm * heightCm) / rOhm;
  return 0.396 * h2r + 0.156 * weightKg + 0.046 * ageYears + 4.104 * s - 3.19;
}

/** SMM Janssen/Kim-like con la misma R efectiva. */
export function computeSmmKg(
  heightCm: number,
  ageYears: number,
  sex: InbodyLikeSex,
  rOhm: number,
): number {
  const s = sex === 'male' ? 1 : 0;
  const h2r = (heightCm * heightCm) / rOhm;
  return h2r * 0.401 + s * 3.825 - ageYears * 0.071 + 5.1;
}

export function idealWeightKg(heightCm: number, sex: InbodyLikeSex): number {
  const h = heightCm / 100;
  const bmi = sex === 'male' ? 22 : 21.5;
  return r1(bmi * h * h);
}

export function buildInbodyLikeRanges(
  heightCm: number,
  sex: InbodyLikeSex,
  idealW: number,
): InbodyLikeRanges {
  const h = heightCm / 100;
  const wMin = r1(18.5 * h * h);
  const wMax = r1(24.9 * h * h);
  const idealBfm = sex === 'male' ? 0.15 * idealW : 0.23 * idealW;
  const idealFfm = idealW - idealBfm;
  // Bandas ± alrededor del ideal (LookInBody-ish, no 0.95–1.35×peso medido)
  return {
    weightKg: { min: wMin, max: wMax },
    fatKg: { min: r1(idealBfm * 0.7), max: r1(idealBfm * 1.35) },
    boneKg: sex === 'male' ? { min: 2.5, max: 4.3 } : { min: 1.8, max: 3.2 },
    proteinKg: { min: r1(idealFfm * 0.16), max: r1(idealFfm * 0.22) },
    waterKg: { min: r1(idealFfm * 0.68), max: r1(idealFfm * 0.78) },
    muscleKg: { min: r1(idealFfm * 0.88), max: r1(idealFfm * 1.05) },
    smmKg: {
      min: r1(idealFfm * SMM_OF_FFM * 0.9),
      max: r1(idealFfm * SMM_OF_FFM * 1.1),
    },
    bmi: { min: 18.5, max: 24.9 },
    // Objetivo InBody ~15 % / 23 %; banda clínica adulta (no 10–20 comercial estrecha)
    pbf:
      sex === 'male'
        ? { min: 10, max: 22 }
        : { min: 18, max: 30 },
  };
}

/** Tipo corporal clínico simple (IMC WHO × grasa vs ideal InBody). */
export function deriveInbodyLikeBodyType(bmi: number, pbf: number, sex: InbodyLikeSex): string {
  const idealPbf = sex === 'male' ? 15 : 23;
  const lowBmi = bmi < 18.5;
  const highBmi = bmi >= 25;
  const lowFat = pbf < idealPbf - 5;
  const highFat = pbf >= (sex === 'male' ? 25 : 32);
  if (lowBmi && lowFat) return 'Delgado';
  if (lowBmi && !highFat) return 'Delgado muscular';
  if (!lowBmi && !highBmi && lowFat) return 'Atlético';
  if (!lowBmi && !highBmi && !highFat) return 'Estándar';
  if (!lowBmi && !highBmi && highFat) return 'Sobrepeso';
  if (highBmi && highFat) return 'Obeso';
  if (highBmi && !highFat) return 'Musculoso';
  return 'Estándar';
}

export function deriveInbodyLikeBodyScore(
  bmi: number,
  pbf: number,
  sex: InbodyLikeSex,
): number {
  const ranges = buildInbodyLikeRanges(170, sex, idealWeightKg(170, sex));
  let score = 100;
  if (bmi < ranges.bmi.min) score -= Math.min(30, (ranges.bmi.min - bmi) * 8);
  else if (bmi > ranges.bmi.max) score -= Math.min(30, (bmi - ranges.bmi.max) * 6);
  if (pbf < ranges.pbf.min) score -= Math.min(25, (ranges.pbf.min - pbf) * 2);
  else if (pbf > ranges.pbf.max) score -= Math.min(25, (pbf - ranges.pbf.max) * 2);
  return Math.max(40, Math.min(100, Math.round(score)));
}

/**
 * Edad metabólica: exceso de grasa suma años; exceso de SMM resta.
 * Acotada a edad±15 para evitar valores absurdos.
 */
export function computeMetabolicAge(opts: {
  ageYears: number;
  bodyFatKg: number;
  idealBfmKg: number;
  smmKg: number;
  idealSmmKg: number;
}): number {
  const fatTerm = (opts.bodyFatKg - opts.idealBfmKg) / 0.5;
  const smmTerm = (opts.smmKg - opts.idealSmmKg) / 0.5;
  const raw = opts.ageYears + fatTerm - smmTerm;
  return Math.round(clamp(raw, opts.ageYears - 15, opts.ageYears + 15));
}

export function computeInbodyLikeComposition(
  weightKg: number,
  profile: InbodyLikeProfile,
  rEffOhm: number,
): InbodyLikeComposition | null {
  if (!(weightKg >= 20 && weightKg <= 300)) return null;
  if (!(profile.heightCm >= 100 && profile.heightCm <= 230)) return null;
  if (!(profile.ageYears >= 10 && profile.ageYears <= 100)) return null;
  if (!(rEffOhm >= 150 && rEffOhm <= 1200)) return null;

  const { heightCm, ageYears, sex } = profile;
  let tbw = computeTbwLiters(weightKg, heightCm, ageYears, sex, rEffOhm);
  if (!(tbw > 10 && tbw < weightKg)) return null;

  let ffm = tbw / HYDRATION_FFM;
  if (ffm >= weightKg) ffm = weightKg * 0.96;
  if (ffm <= weightKg * 0.4) return null;

  const bodyFatKg = weightKg - ffm;
  const pbfPct = (bodyFatKg / weightKg) * 100;
  if (!(pbfPct >= 3 && pbfPct <= 55)) return null;

  const proteinMassKg = ffm * PROTEIN_OF_FFM;
  const boneMassKg = ffm * BONE_OF_FFM;
  const muscleMassKg = Math.max(0, ffm - boneMassKg);

  let smmKg = computeSmmKg(heightCm, ageYears, sex, rEffOhm);
  // Si Janssen se desvía mucho de fracción FFM, anclar a 0.57×FFM
  const smmFromFfm = ffm * SMM_OF_FFM;
  if (Math.abs(smmKg - smmFromFfm) > 8) {
    smmKg = smmFromFfm;
  }
  smmKg = clamp(smmKg, ffm * 0.35, ffm * 0.7);

  const hm = heightCm / 100;
  const smi = smmKg / (hm * hm);
  const bmi = weightKg / (hm * hm);
  const bmrKcal = Math.round(370 + 21.6 * ffm);

  const idealW = idealWeightKg(heightCm, sex);
  const idealBfmKg = (sex === 'male' ? 0.15 : 0.23) * idealW;
  const idealFfmKg = idealW - idealBfmKg;
  const idealSmmKg = idealFfmKg * SMM_OF_FFM;

  const weightControlKg = r1(idealW - weightKg);
  const fatControlKg = r1(idealBfmKg - bodyFatKg);
  let muscleControlKg = r1(idealFfmKg - ffm);
  if (muscleControlKg < 0) muscleControlKg = 0;

  const metabolicAge = computeMetabolicAge({
    ageYears,
    bodyFatKg,
    idealBfmKg,
    smmKg,
    idealSmmKg,
  });

  const ranges = buildInbodyLikeRanges(heightCm, sex, idealW);

  return {
    weightKg: r2(weightKg),
    rEffOhm: r1(rEffOhm),
    tbwKg: r2(tbw),
    ffmKg: r2(ffm),
    bodyFatKg: r2(bodyFatKg),
    pbfPct: r1(pbfPct),
    proteinMassKg: r2(proteinMassKg),
    boneMassKg: r2(boneMassKg),
    muscleMassKg: r2(muscleMassKg),
    smmKg: r2(smmKg),
    smi: r1(smi),
    bodyWaterPct: r1((tbw / weightKg) * 100),
    bmi: r1(bmi),
    bmrKcal,
    idealWeightKg: idealW,
    idealBfmKg: r2(idealBfmKg),
    idealFfmKg: r2(idealFfmKg),
    idealSmmKg: r2(idealSmmKg),
    weightControlKg,
    fatControlKg,
    muscleControlKg,
    metabolicAge,
    bodyType: deriveInbodyLikeBodyType(bmi, pbfPct, sex),
    bodyScore: deriveInbodyLikeBodyScore(bmi, pbfPct, sex),
    ranges,
    formulaVersion: INBODY_LIKE_FORMULA_VERSION,
  };
}

/** Extrae z1 / mapas desde medición Morpho (columnas + raw_payload). */
export function pickMorphoImpedanceInputs(m: {
  impedance?: Record<string, SegmentalOhms | undefined> | null;
  raw_payload?: Record<string, unknown> | null;
}): {
  z1Ohm: number | null;
  z20: SegmentalOhms | null;
  z100: SegmentalOhms | null;
} {
  const raw = m.raw_payload ?? {};
  const z1Raw = raw.impedance_ohm ?? raw.z1;
  const z1Ohm =
    typeof z1Raw === 'number' && z1Raw >= 100 && z1Raw <= 1500
      ? z1Raw
      : typeof z1Raw === 'string' && Number(z1Raw) >= 100
        ? Number(z1Raw)
        : null;

  const imp = m.impedance ?? {};
  const fromRawImp = raw.impedance;
  const z20 =
    (imp['20khz'] as SegmentalOhms | undefined) ??
    (fromRawImp && typeof fromRawImp === 'object'
      ? ((fromRawImp as Record<string, SegmentalOhms>)['20khz'] ?? null)
      : null);
  const z100 =
    (imp['100khz'] as SegmentalOhms | undefined) ??
    (fromRawImp && typeof fromRawImp === 'object'
      ? ((fromRawImp as Record<string, SegmentalOhms>)['100khz'] ?? null)
      : null);

  return { z1Ohm, z20: z20 ?? null, z100: z100 ?? null };
}
