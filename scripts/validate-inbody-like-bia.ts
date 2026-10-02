/**
 * Validación motor InBody-like vs Luis (2026-08-06 / 2026-10-02) y Marta (2026-08-05).
 * Ejecutar: npx --yes tsx scripts/validate-inbody-like-bia.ts
 */
import {
  computeInbodyLikeComposition,
  estimatePathR50Ohm,
  idealBfmKg,
  idealWeightKg,
  INBODY_LIKE_FORMULA_VERSION,
  INBODY_LIKE_PATH_Z1_GAMMA,
  pathScaleForSex,
  resolveEffectiveR50Ohm,
} from '../src/lib/inbodyLikeBia.ts';
import { buildMorphoScanReport } from '../src/lib/morphoscanReport.ts';
import { adaptMorphoToInbodyView } from '../src/lib/morphoInbodyView.ts';
import type { InbodyMeasurement } from '../src/lib/inbodyMeasurements.ts';

function assertClose(name: string, got: number, exp: number, tol: number) {
  if (Math.abs(got - exp) > tol) {
    throw new Error(`${name}: got ${got}, expected ~${exp} (±${tol})`);
  }
  console.log(`OK ${name}: ${got} ≈ ${exp}`);
}

console.log('=== Formula', INBODY_LIKE_FORMULA_VERSION, '===');
console.log(
  'path scales M/F',
  pathScaleForSex('male'),
  pathScaleForSex('female'),
  'gamma',
  INBODY_LIKE_PATH_Z1_GAMMA,
);

console.log('\n=== Luis Aug (M, 180 cm, 50 y) — prefer path over z1 ===');
const luisProfile = { heightCm: 180, ageYears: 50, sex: 'male' as const };
const luisAugZ20 = {
  trunk: 20,
  left_arm: 297.2,
  left_leg: 259.5,
  right_arm: 285.1,
  right_leg: 271.1,
};
const luisAugZ100 = {
  trunk: 24,
  left_arm: 265.5,
  left_leg: 242.1,
  right_arm: 251.5,
  right_leg: 242.1,
};
const pathAug = estimatePathR50Ohm(luisAugZ20, luisAugZ100);
console.log('path raw Aug', pathAug);
const rLuisPath = resolveEffectiveR50Ohm({
  sex: 'male',
  z1Ohm: 301.6,
  z20: luisAugZ20,
  z100: luisAugZ100,
});
const rLuisZ1Only = resolveEffectiveR50Ohm({ sex: 'male', z1Ohm: 301.6 });
console.log('R_eff Luis path', rLuisPath, 'z1-only', rLuisZ1Only);
if (rLuisPath == null || rLuisZ1Only == null) throw new Error('Luis R null');
if (Math.abs(rLuisPath - rLuisZ1Only) < 1) {
  throw new Error('path should differ from z1-only for Luis Aug');
}
// InBody: 80.4 kg / 19.2 % / FFM 65 / SMM 37 / TBW 47.8 / BMR 1774
const luis = computeInbodyLikeComposition(80.4, luisProfile, rLuisPath);
if (!luis) throw new Error('Luis composition null');
assertClose('Luis Aug pbf vs InBody', luis.pbfPct, 19.2, 2.0);
assertClose('Luis Aug tbw vs InBody', luis.tbwKg, 47.8, 2.5);
assertClose('Luis Aug ffm vs InBody', luis.ffmKg, 65, 2.5);
assertClose('Luis Aug smm vs InBody', luis.smmKg, 37, 3);
assertClose('Luis Aug bmr vs InBody', luis.bmrKcal, 1774, 120);
// LookInBody: ideal ≈ FFM_max/0.85 → 76.4 kg; BFM ideal 11.5 (no BMI22→71.3/10.7)
assertClose('Luis idealW LookInBody', luis.idealWeightKg, 76.4, 0.5);
assertClose('Luis idealBfm LookInBody', luis.idealBfmKg, 11.5, 0.3);
assertClose('Luis idealBfm helper', idealBfmKg(180, 'male'), 11.5, 0.3);
// InBody Aug fat_control -3.9; path×γ → ~−2.6 (path≈z1 → γ casi no-op)
assertClose('Luis Aug fatControl vs InBody', luis.fatControlKg, -3.9, 1.5);
assertClose('Luis weight max (InBody ~82)', luis.ranges.weightKg.max, 82.0, 0.8);
assertClose('Luis fat range min (InBody 8.6)', luis.ranges.fatKg.min, 8.6, 0.4);
assertClose('Luis fat range max (InBody 17.1)', luis.ranges.fatKg.max, 17.1, 0.4);
if (luis.metabolicAge > 55) {
  throw new Error(`Luis metabolic age too high: ${luis.metabolicAge}`);
}
console.log('OK Luis metabolicAge', luis.metabolicAge, 'type', luis.bodyType, 'score', luis.bodyScore);

console.log('\n=== Luis Oct (path) — z1 solo fallaba ~22 %; path ~18 % ===');
const luisOctZ20 = {
  trunk: 19.1,
  left_arm: 316.4,
  left_leg: 297.2,
  right_arm: 297.2,
  right_leg: 289.9,
};
const luisOctZ100 = {
  trunk: 10,
  left_arm: 280.3,
  left_leg: 257.4,
  right_arm: 258.5,
  right_leg: 257.4,
};
const rLuisOct = resolveEffectiveR50Ohm({
  sex: 'male',
  z1Ohm: 326.3,
  z20: luisOctZ20,
  z100: luisOctZ100,
});
const rLuisOctZ1 = resolveEffectiveR50Ohm({ sex: 'male', z1Ohm: 326.3 });
console.log('R_eff Luis Oct path', rLuisOct, 'z1-only', rLuisOctZ1);
const luisOct = computeInbodyLikeComposition(79.5, luisProfile, rLuisOct!);
if (!luisOct) throw new Error('Luis Oct composition null');
// InBody 07:49: 79.3 kg / 17.6 % / FFM 65.4 / TBW 47.9 / fat_control −2.4
assertClose('Luis Oct pbf vs InBody', luisOct.pbfPct, 17.6, 1.0);
assertClose('Luis Oct tbw vs InBody', luisOct.tbwKg, 47.9, 1.0);
assertClose('Luis Oct ffm vs InBody', luisOct.ffmKg, 65.4, 1.2);
assertClose('Luis Oct bodyFat vs InBody', luisOct.bodyFatKg, 13.9, 0.5);
assertClose('Luis Oct fatControl vs InBody', luisOct.fatControlKg, -2.4, 0.5);
const luisOctZ1Comp = computeInbodyLikeComposition(79.5, luisProfile, rLuisOctZ1!);
if (!luisOctZ1Comp) throw new Error('Luis Oct z1 null');
if (Math.abs(luisOctZ1Comp.pbfPct - 17.6) < Math.abs(luisOct.pbfPct - 17.6)) {
  throw new Error(
    `path should beat z1 on Oct: path=${luisOct.pbfPct} z1=${luisOctZ1Comp.pbfPct}`,
  );
}
console.log('OK path beats z1 on Oct', luisOct.pbfPct, '< error than', luisOctZ1Comp.pbfPct);

console.log('\n=== Marta (F, 167 cm, 37 y) — path×0.635 ===');
const martaProfile = { heightCm: 167, ageYears: 37, sex: 'female' as const };
const martaZ20 = {
  trunk: 21.7,
  left_arm: 375.7,
  right_arm: 380.2,
  right_leg: 261.9,
};
const martaZ100 = {
  trunk: 23.1,
  left_arm: 335.2,
  right_arm: 338.7,
  right_leg: 240.3,
  left_leg: 240.3,
};
const rMarta = resolveEffectiveR50Ohm({
  sex: 'female',
  z1Ohm: 380,
  z20: martaZ20,
  z100: martaZ100,
});
console.log('R_eff Marta path', rMarta);
const marta = computeInbodyLikeComposition(62.5, martaProfile, rMarta!);
if (!marta) throw new Error('Marta composition null');
// InBody: 62.5 kg / 21.4 % / FFM 49.1
assertClose('Marta pbf vs InBody', marta.pbfPct, 21.4, 2.0);
assertClose('Marta ffm vs InBody', marta.ffmKg, 49.1, 2.5);
assertClose('Marta weight max (IMC ~25.3)', marta.ranges.weightKg.max, 70.6, 1.2);
// Ideal femenino sigue IMC 21.5 (fat_control clínica alineado)
assertClose('Marta idealW', marta.idealWeightKg, idealWeightKg(167, 'female'), 0.2);
if (marta.bodyType === 'Obeso') {
  throw new Error(`Marta body type should not be Obeso: ${marta.bodyType}`);
}
console.log('OK Marta metabolicAge', marta.metabolicAge, 'type', marta.bodyType, 'score', marta.bodyScore);

console.log('\n=== Report: ignore numeric physiqueRating ===');
const fake = {
  device: 'morphoscan',
  source: 'ble-scale-sync',
  weight_kg: 80.4,
  height_cm: 180,
  age_years: 50,
  sex: 'male',
  body_type: '9',
  pbf_pct: 14.4,
  body_fat_kg: 11.6,
  raw_payload: { impedance_ohm: 301.6 },
  impedance: { '20khz': luisAugZ20, '100khz': luisAugZ100 },
  segmental_lean: {},
  segmental_fat: {},
  edema: {},
} as InbodyMeasurement;
const report = buildMorphoScanReport(fake);
if (!report.compositionFromSuiteBia) throw new Error('expected Suite BIA');
if (report.body_type === '9' || report.body_type === 'Obeso') {
  throw new Error(`bad body_type from rating: ${report.body_type}`);
}
const wMax = report.compositionRows[0]?.rangeMax;
if (wMax == null || wMax > 90) throw new Error(`weight range still too wide: ${wMax}`);
console.log('OK report body_type', report.body_type, 'pbf', report.pbf_pct, 'age', report.metabolic_age);
assertClose('report Luis Aug path pbf', report.pbf_pct!, 19.2, 2.0);
assertClose('report Luis Aug fatControl', report.fat_control_kg!, -3.9, 1.5);

console.log('\n=== Adapter Morpho → UI InBody ===');
const adapted = adaptMorphoToInbodyView(fake);
if (adapted.pbf_pct == null || Math.abs(adapted.pbf_pct - 17.6) > 0.6) {
  // path×0.73×(path/z1)^γ @ 80.4 → ~17.6 %
  throw new Error(`adapted pbf ${adapted.pbf_pct}`);
}
if (adapted.weight_max_kg == null || adapted.weight_max_kg > 90) {
  throw new Error(`adapted weight max ${adapted.weight_max_kg}`);
}
if (adapted.smm_min_kg == null || adapted.tbw_min_kg == null) {
  throw new Error('adapted missing ranges');
}
if (adapted.raw_payload?.suite_bia !== true) throw new Error('suite_bia flag missing');
// Aug InBody fat_ctrl -3.9; no volver al ideal BMI22 (−4.7 con grasa alta)
if (adapted.fat_control_kg == null || adapted.fat_control_kg < -4.0 || adapted.fat_control_kg > -1.5) {
  throw new Error(`adapted fat_control out of band: ${adapted.fat_control_kg}`);
}
console.log('OK adapted pbf', adapted.pbf_pct, 'smm', adapted.smm_kg, 'fatCtrl', adapted.fat_control_kg);

console.log('\nALL PASSED');
