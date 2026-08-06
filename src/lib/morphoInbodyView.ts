/**
 * Adapter MorphoScan → shape InBody para reutilizar la UI LookInBody.
 * Valores de composición / rangos / controles vienen del motor Suite BIA
 * (inbodyLikeBia + buildMorphoScanReport), no del %BF comercial Renpho.
 */
import {
  isMorphoScanMeasurement,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import { buildMorphoScanReport, type MorphoScanDerivedReport } from '@/lib/morphoscanReport';
import { enrichMorphoScanSegmentals } from '@/lib/morphoscanSegmentals';
import { normalizeInbodyLikeSex } from '@/lib/inbodyLikeBia';

export type MorphoExtraFidelity = 'good' | 'orientative' | 'unreliable';

export interface MorphoClinicalExtra {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string;
  decimals?: number;
  /** Fidelidad estimada vs realidad clínica / InBody. */
  fidelity: MorphoExtraFidelity;
  /** ¿Aporta algo al diagnóstico habitual InBody? */
  diagnosticValue: 'high' | 'medium' | 'low';
  note: string;
  /** Si false, no se muestra en UI clínica (solo documentación). */
  showInUi: boolean;
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

function r0(v: number): number {
  return Math.round(v);
}

/** Rangos WHR estilo LookInBody (aprox. por sexo). */
function whrRange(sex: string | null | undefined): { min: number; max: number } {
  return normalizeInbodyLikeSex(sex) === 'female'
    ? { min: 0.75, max: 0.85 }
    : { min: 0.8, max: 0.9 };
}

/**
 * Proyecta un informe Suite BIA sobre columnas InBody (valores + min/max).
 */
export function morphoReportToInbodyFields(
  base: InbodyMeasurement,
  report: MorphoScanDerivedReport,
): InbodyMeasurement {
  const sex = base.sex;
  const whr = whrRange(sex);
  const bmr = report.bmr_kcal;

  const weightRow = report.compositionRows.find((r) => r.id === 'weight_kg');
  const fatRow = report.compositionRows.find((r) => r.id === 'body_fat_kg');
  const smmRow = report.compositionRows.find((r) => r.id === 'smm_kg');
  const waterRow = report.compositionRows.find((r) => r.id === 'tbw_kg');
  const bmiRow = report.obesityRows.find((r) => r.id === 'bmi');
  const pbfRow = report.obesityRows.find((r) => r.id === 'pbf_pct');
  const ffmMin = waterRow?.rangeMin != null ? r1(waterRow.rangeMin / 0.73) : null;
  const ffmMax = waterRow?.rangeMax != null ? r1(waterRow.rangeMax / 0.73) : null;

  return {
    ...base,
    weight_kg: report.weight_kg,
    weight_min_kg: weightRow?.rangeMin ?? null,
    weight_max_kg: weightRow?.rangeMax ?? null,
    smm_kg: report.smm_kg,
    smm_min_kg: smmRow?.rangeMin ?? null,
    smm_max_kg: smmRow?.rangeMax ?? null,
    body_fat_kg: report.body_fat_kg,
    body_fat_min_kg: fatRow?.rangeMin ?? null,
    body_fat_max_kg: fatRow?.rangeMax ?? null,
    tbw_kg: report.tbw_kg,
    tbw_min_kg: waterRow?.rangeMin ?? null,
    tbw_max_kg: waterRow?.rangeMax ?? null,
    ffm_kg: report.ffm_kg,
    ffm_min_kg: ffmMin,
    ffm_max_kg: ffmMax,
    slm_kg: report.slm_kg,
    bmi: report.bmi,
    bmi_min: bmiRow?.rangeMin ?? 18.5,
    bmi_max: bmiRow?.rangeMax ?? 24.9,
    pbf_pct: report.pbf_pct,
    pbf_min_pct: pbfRow?.rangeMin ?? null,
    pbf_max_pct: pbfRow?.rangeMax ?? null,
    whr: report.whr,
    whr_min: report.whr != null ? whr.min : base.whr_min,
    whr_max: report.whr != null ? whr.max : base.whr_max,
    bmr_kcal: bmr,
    bmr_min_kcal: bmr != null ? r0(bmr * 0.9) : null,
    bmr_max_kcal: bmr != null ? r0(bmr * 1.1) : null,
    fat_control_kg: report.fat_control_kg,
    muscle_control_kg: report.muscle_control_kg,
    weight_control_kg: report.weight_control_kg,
    target_weight_kg: report.target_weight_kg,
    bone_mass_kg: report.bone_mass_kg,
    protein_mass_kg: report.protein_mass_kg,
    protein_pct: report.protein_pct,
    body_water_pct: report.body_water_pct,
    visceral_fat_index: report.visceral_fat_index,
    subcutaneous_fat_pct: report.subcutaneous_fat_pct,
    metabolic_age: report.metabolic_age,
    smi: report.smi,
    body_type: report.body_type,
    raw_payload: {
      ...(base.raw_payload ?? {}),
      suite_bia: report.compositionFromSuiteBia === true,
      suite_bia_formula: report.formulaVersion ?? null,
      suite_bia_body_score: report.body_score ?? null,
    },
  };
}

/**
 * Medición Morpho lista para UI InBody (barras verdes, controles, nutrición).
 * InBody puro se devuelve sin cambios.
 */
export function adaptMorphoToInbodyView(m: InbodyMeasurement): InbodyMeasurement {
  if (!isMorphoScanMeasurement(m)) return m;
  const enriched = enrichMorphoScanSegmentals(m);
  const report = buildMorphoScanReport(enriched);
  return morphoReportToInbodyFields(enriched, report);
}

/** Lista completa adaptada (gráficos de evolución coherentes con el informe). */
export function adaptMorphoMeasurementsForInbodyUi(
  list: InbodyMeasurement[],
): InbodyMeasurement[] {
  return list.map(adaptMorphoToInbodyView);
}

export function morphoUsesSuiteBia(m: InbodyMeasurement): boolean {
  return m.raw_payload?.suite_bia === true;
}

/**
 * Extras Morpho vs panel InBody clásico.
 * Criterio: solo mostrar en UI lo orientativo/útil; ocultar lo poco fiable.
 */
export function evaluateMorphoClinicalExtras(m: InbodyMeasurement): MorphoClinicalExtra[] {
  const extras: MorphoClinicalExtra[] = [
    {
      id: 'smi',
      label: 'SMI',
      value: m.smi ?? null,
      unit: 'kg/m²',
      decimals: 1,
      fidelity: 'good',
      diagnosticValue: 'high',
      note: 'Derivado de MME/altura² (misma base Suite BIA). Útil para reserva muscular.',
      showInUi: true,
    },
    {
      id: 'metabolic_age',
      label: 'Edad metabólica',
      value: m.metabolic_age ?? null,
      decimals: 0,
      fidelity: 'orientative',
      diagnosticValue: 'medium',
      note: 'Suite LookInBody-like (grasa/SMM vs ideal). Orientativa, no diagnóstica.',
      showInUi: true,
    },
    {
      id: 'bone_mass_kg',
      label: 'Masa ósea',
      value: m.bone_mass_kg ?? null,
      unit: 'kg',
      decimals: 1,
      fidelity: 'orientative',
      diagnosticValue: 'low',
      note: '~7 % FFM. No sustituye densitometría; poco peso en diagnóstico habitual.',
      showInUi: true,
    },
    {
      id: 'protein_mass_kg',
      label: 'Masa proteica',
      value: m.protein_mass_kg ?? null,
      unit: 'kg',
      decimals: 1,
      fidelity: 'orientative',
      diagnosticValue: 'low',
      note: '~18 % FFM. Redundante con FFM/MME para la mayoría de consultas.',
      showInUi: false,
    },
    {
      id: 'body_type',
      label: 'Tipo corporal',
      value: m.body_type ?? null,
      fidelity: 'orientative',
      diagnosticValue: 'medium',
      note: 'Clasificación Suite (IMC × %BF). Complementa el diagnóstico de obesidad.',
      showInUi: true,
    },
    {
      id: 'visceral_fat_index',
      label: 'Grasa visceral',
      value: m.visceral_fat_index ?? null,
      decimals: 0,
      fidelity: 'unreliable',
      diagnosticValue: 'low',
      note: 'Heurística Morpho/Renpho; no calibrada a InBody. No usar para decidir.',
      showInUi: false,
    },
    {
      id: 'subcutaneous_fat_pct',
      label: 'Grasa subcutánea',
      value: m.subcutaneous_fat_pct ?? null,
      unit: '%',
      decimals: 1,
      fidelity: 'unreliable',
      diagnosticValue: 'low',
      note: 'Aprox. 0,71×%BF. No aporta más que el PGC InBody.',
      showInUi: false,
    },
    {
      id: 'target_weight_kg',
      label: 'Peso óptimo',
      value: m.target_weight_kg ?? null,
      unit: 'kg',
      decimals: 1,
      fidelity: 'good',
      diagnosticValue: 'high',
      note: 'IMC objetivo 22 / 21,5 (LookInBody). Ya reflejado en controles de la UI InBody.',
      showInUi: false,
    },
  ];
  return extras.filter((e) => e.value != null && e.value !== '');
}

export function morphoExtrasForUi(m: InbodyMeasurement): MorphoClinicalExtra[] {
  return evaluateMorphoClinicalExtras(m).filter((e) => e.showInUi);
}
