/**
 * MorphoScan / Renpho R-MSC04:
 * - Si no hay kg segmentales, los deriva de totales + DF-BIA (Ω).
 * - Completa valor estándar (kg) y % vs estándar (formato informe Renpho: masa / % / estándar).
 * - Estima WHR orientativo (Renpho lo calcula en firmware/app; no viaja por BLE).
 */
import type {
  InbodyImpedanceFreq,
  InbodyMeasurement,
  InbodySegmentEntry,
  InbodySegmentalFat,
  InbodySegmentalLean,
} from '@/lib/inbodyMeasurements';

export type SegmentKey = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';

const SEGMENTS: SegmentKey[] = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'];
const LIMBS: SegmentKey[] = ['right_arm', 'left_arm', 'right_leg', 'left_leg'];

/**
 * Fracciones del total estándar calibradas al informe Renpho
 * (Gemma / MorphoScan: brazos ~5.6 %, tronco ~50.7 %, piernas ~17.7 %).
 */
const LEAN_STD_SHARE: Record<SegmentKey, number> = {
  trunk: 0.507,
  right_leg: 0.177,
  left_leg: 0.177,
  right_arm: 0.056,
  left_arm: 0.056,
};

const FAT_STD_SHARE: Record<SegmentKey, number> = {
  trunk: 0.442,
  right_leg: 0.196,
  left_leg: 0.196,
  right_arm: 0.083,
  left_arm: 0.083,
};

/** Fracción de lean medida (reparto por 1/Z en extremidades). */
const IDEAL_LEAN_SHARE: Record<SegmentKey, number> = {
  trunk: 0.48,
  right_leg: 0.17,
  left_leg: 0.17,
  right_arm: 0.09,
  left_arm: 0.09,
};

const IDEAL_FAT_SHARE: Record<SegmentKey, number> = {
  trunk: 0.5,
  right_leg: 0.15,
  left_leg: 0.15,
  right_arm: 0.1,
  left_arm: 0.1,
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function isFemale(sex: string | null | undefined): boolean {
  const s = (sex || '').trim().toLowerCase();
  return s === 'f' || s === 'female' || s.startsWith('mujer') || s === 'muller';
}

function hasSegmentKg(
  lean: InbodySegmentalLean | null | undefined,
  fat: InbodySegmentalFat | null | undefined,
): boolean {
  return SEGMENTS.some((k) => lean?.[k]?.kg != null || fat?.[k]?.kg != null);
}

function pickZMap(impedance: InbodyMeasurement['impedance']): InbodyImpedanceFreq | null {
  const z20 = impedance?.['20khz'];
  const z100 = impedance?.['100khz'];
  const count = (row: InbodyImpedanceFreq | undefined) =>
    SEGMENTS.filter((k) => row?.[k] != null && Number(row[k]) > 0).length;
  if (count(z20) >= 3) return z20!;
  if (count(z100) >= 3) return z100!;
  return null;
}

/** Masa magra total de referencia (kg) ≈ altura × coeficiente (calibrado Renpho PDF). */
export function morphoStandardLeanTotalKg(
  sex: string | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (heightCm == null || !(heightCm > 100)) return null;
  return round2(heightCm * (isFemale(sex) ? 0.237 : 0.28));
}

/** Masa grasa total de referencia (kg). */
export function morphoStandardFatTotalKg(
  sex: string | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (heightCm == null || !(heightCm > 100)) return null;
  return round2(heightCm * (isFemale(sex) ? 0.087 : 0.065));
}

/**
 * WHR orientativo estilo MorphoScan (estimación; no cinta).
 * Calibrado ~0.79 en mujer magra (pbf~12, visceral~1) del informe Renpho.
 */
export function estimateMorphoScanWhr(m: InbodyMeasurement): number | null {
  if (m.whr != null && Number.isFinite(m.whr) && m.whr > 0.5 && m.whr < 1.3) {
    return round2(m.whr);
  }

  const height = m.height_cm;
  const weight = m.weight_kg;
  const bmi =
    m.bmi ??
    (height != null && height > 0 && weight != null ? weight / (height / 100) ** 2 : null);
  const pbf = m.pbf_pct;
  const visceral = m.visceral_fat_index;
  const age = m.age_years;
  if (bmi == null && pbf == null) return null;

  const female = isFemale(m.sex);
  let whr: number;
  if (female) {
    whr =
      0.78 +
      0.004 * Math.max(0, (pbf ?? 22) - 22) +
      0.01 * Math.max(0, (visceral ?? 2) - 2) +
      0.002 * Math.max(0, (bmi ?? 20) - 20) +
      0.0005 * Math.max(0, (age ?? 25) - 25);
    whr = clamp(whr, 0.65, 1.0);
  } else {
    whr =
      0.87 +
      0.005 * Math.max(0, (pbf ?? 18) - 18) +
      0.012 * Math.max(0, (visceral ?? 5) - 5) +
      0.0025 * Math.max(0, (bmi ?? 23) - 23) +
      0.0006 * Math.max(0, (age ?? 30) - 30);
    whr = clamp(whr, 0.75, 1.15);
  }
  return round2(whr);
}

function entryWithStandard(
  kg: number | null | undefined,
  standardKg: number | null,
): InbodySegmentEntry {
  const out: InbodySegmentEntry = {};
  if (kg != null && Number.isFinite(kg)) out.kg = round2(kg);
  if (standardKg != null && standardKg > 0) {
    out.standard_kg = round2(standardKg);
    if (out.kg != null) {
      const pct = round1((100 * out.kg) / standardKg);
      out.eval_pct = pct;
      out.pct = pct;
    }
  }
  return out;
}

/**
 * Reparte lean total: ~52% a extremidades ponderado por 1/Z; el resto al tronco.
 */
export function deriveMorphoScanSegmentals(m: InbodyMeasurement): {
  segmental_lean: InbodySegmentalLean;
  segmental_fat: InbodySegmentalFat;
} | null {
  if (hasSegmentKg(m.segmental_lean, m.segmental_fat)) return null;

  const z = pickZMap(m.impedance ?? {});
  if (!z) return null;

  const leanTotal =
    (m.slm_kg != null && m.slm_kg > 0 ? m.slm_kg : null) ??
    (m.ffm_kg != null && m.ffm_kg > 0 ? m.ffm_kg : null) ??
    (m.weight_kg != null && m.pbf_pct != null
      ? m.weight_kg * (1 - m.pbf_pct / 100)
      : null);
  const fatTotal =
    (m.body_fat_kg != null && m.body_fat_kg > 0 ? m.body_fat_kg : null) ??
    (m.weight_kg != null && m.pbf_pct != null ? (m.weight_kg * m.pbf_pct) / 100 : null);

  if (leanTotal == null || leanTotal < 10) return null;

  const limbG: Partial<Record<SegmentKey, number>> = {};
  let sumLimbG = 0;
  for (const k of LIMBS) {
    const ohm = z[k];
    if (ohm == null || !(ohm > 0)) continue;
    const g = 1 / ohm;
    limbG[k] = g;
    sumLimbG += g;
  }
  if (sumLimbG <= 0) return null;

  const limbLeanTarget = leanTotal * 0.52;
  const leanKg: Record<SegmentKey, number> = {
    right_arm: 0,
    left_arm: 0,
    trunk: 0,
    right_leg: 0,
    left_leg: 0,
  };
  for (const k of LIMBS) {
    const g = limbG[k];
    leanKg[k] = g != null ? (limbLeanTarget * g) / sumLimbG : limbLeanTarget / LIMBS.length;
  }
  leanKg.trunk = Math.max(0, leanTotal - LIMBS.reduce((s, k) => s + leanKg[k], 0));

  const fatKg: Record<SegmentKey, number> = {
    right_arm: 0,
    left_arm: 0,
    trunk: 0,
    right_leg: 0,
    left_leg: 0,
  };
  if (fatTotal != null && fatTotal > 0) {
    let sumW = 0;
    const w: Record<SegmentKey, number> = { ...IDEAL_FAT_SHARE };
    for (const k of LIMBS) {
      const ohm = z[k];
      if (ohm != null && ohm > 0) {
        w[k] = IDEAL_FAT_SHARE[k] * (ohm / 300);
      }
      sumW += w[k];
    }
    sumW += w.trunk;
    for (const k of SEGMENTS) {
      fatKg[k] = (fatTotal * w[k]) / sumW;
    }
  }

  const leanStdTotal = morphoStandardLeanTotalKg(m.sex, m.height_cm);
  const fatStdTotal = morphoStandardFatTotalKg(m.sex, m.height_cm);

  const segmental_lean: InbodySegmentalLean = {
    diff_arm: round2(Math.abs(leanKg.right_arm - leanKg.left_arm)),
    diff_leg: round2(Math.abs(leanKg.right_leg - leanKg.left_leg)),
  };
  const segmental_fat: InbodySegmentalFat = {};

  for (const k of SEGMENTS) {
    const leanStd = leanStdTotal != null ? leanStdTotal * LEAN_STD_SHARE[k] : leanTotal * IDEAL_LEAN_SHARE[k];
    const fatStd = fatStdTotal != null ? fatStdTotal * FAT_STD_SHARE[k] : null;
    segmental_lean[k] = entryWithStandard(leanKg[k], leanStd);
    segmental_fat[k] = entryWithStandard(fatKg[k], fatStd);
  }

  return { segmental_lean, segmental_fat };
}

/** Añade standard_kg / % vs estándar a segmentales que ya tienen kg. */
function attachStandards(
  m: InbodyMeasurement,
): { segmental_lean: InbodySegmentalLean; segmental_fat: InbodySegmentalFat } | null {
  const leanStdTotal = morphoStandardLeanTotalKg(m.sex, m.height_cm);
  const fatStdTotal = morphoStandardFatTotalKg(m.sex, m.height_cm);
  if (leanStdTotal == null && fatStdTotal == null) return null;
  if (!hasSegmentKg(m.segmental_lean, m.segmental_fat)) return null;

  const segmental_lean: InbodySegmentalLean = { ...(m.segmental_lean ?? {}) };
  const segmental_fat: InbodySegmentalFat = { ...(m.segmental_fat ?? {}) };

  for (const k of SEGMENTS) {
    const leanStd = leanStdTotal != null ? leanStdTotal * LEAN_STD_SHARE[k] : null;
    const fatStd = fatStdTotal != null ? fatStdTotal * FAT_STD_SHARE[k] : null;
    const prevLean = m.segmental_lean?.[k];
    const prevFat = m.segmental_fat?.[k];
    if (prevLean?.kg != null || leanStd != null) {
      segmental_lean[k] = {
        ...entryWithStandard(prevLean?.kg, leanStd),
        // conservar eval de InBody si ya venía y no tenemos estándar Morpho
        ...(leanStd == null && prevLean?.eval_pct != null
          ? { eval_pct: prevLean.eval_pct, pct: prevLean.pct ?? prevLean.eval_pct }
          : {}),
      };
    }
    if (prevFat?.kg != null || fatStd != null) {
      const withStd = entryWithStandard(prevFat?.kg, fatStd);
      segmental_fat[k] = {
        kg: withStd.kg ?? prevFat?.kg ?? null,
        pct: withStd.pct ?? prevFat?.pct ?? null,
        standard_kg: withStd.standard_kg ?? null,
        eval_pct: withStd.eval_pct ?? null,
      };
    }
  }

  return { segmental_lean, segmental_fat };
}

/** Rellena segmentales + estándares + WHR estimado para MorphoScan / BLE. */
export function enrichMorphoScanSegmentals(m: InbodyMeasurement): InbodyMeasurement {
  let out: InbodyMeasurement = { ...m };

  const derived = deriveMorphoScanSegmentals(out);
  if (derived) {
    out = {
      ...out,
      segmental_lean: derived.segmental_lean,
      segmental_fat: derived.segmental_fat,
    };
  } else {
    const std = attachStandards(out);
    if (std) {
      out = {
        ...out,
        segmental_lean: std.segmental_lean,
        segmental_fat: std.segmental_fat,
      };
    }
  }

  const whr = estimateMorphoScanWhr(out);
  if (whr != null && (out.whr == null || out.whr === 0)) {
    out = { ...out, whr };
  }

  return out;
}
