/**
 * Validación motor InBody-like vs Luis (2026-08-06) y Marta (2026-08-05).
 * Ejecutar: npx --yes tsx scripts/validate-inbody-like-bia.ts
 */
import {
  computeInbodyLikeComposition,
  idealWeightKg,
  resolveEffectiveR50Ohm,
} from '../src/lib/inbodyLikeBia.ts';
import { buildMorphoScanReport } from '../src/lib/morphoscanReport.ts';
import type { InbodyMeasurement } from '../src/lib/inbodyMeasurements.ts';

function assertClose(name: string, got: number, exp: number, tol: number) {
  if (Math.abs(got - exp) > tol) {
    throw new Error(`${name}: got ${got}, expected ~${exp} (±${tol})`);
  }
  console.log(`OK ${name}: ${got} ≈ ${exp}`);
}

console.log('=== Luis (M, 180 cm, 50 y, z1=301.6) ===');
const luisProfile = { heightCm: 180, ageYears: 50, sex: 'male' as const };
// InBody: 80.4 kg / 19.2 % / FFM 65 / SMM 37 / TBW 47.8 / BMR 1774
const rLuis = resolveEffectiveR50Ohm({ sex: 'male', z1Ohm: 301.6 });
console.log('R_eff Luis z1=301.6 →', rLuis);
const luis = computeInbodyLikeComposition(80.4, luisProfile, rLuis!);
if (!luis) throw new Error('Luis composition null');

assertClose('Luis pbf vs InBody', luis.pbfPct, 19.2, 2.5);
assertClose('Luis tbw vs InBody', luis.tbwKg, 47.8, 3);
assertClose('Luis ffm vs InBody', luis.ffmKg, 65, 3);
assertClose('Luis smm vs InBody', luis.smmKg, 37, 3);
assertClose('Luis bmr vs InBody', luis.bmrKcal, 1774, 120);
assertClose('Luis idealW', luis.idealWeightKg, idealWeightKg(180, 'male'), 0.1);
assertClose('Luis weight max (IMC 24.9)', luis.ranges.weightKg.max, 80.7, 0.5);
if (luis.metabolicAge > 55) {
  throw new Error(`Luis metabolic age too high: ${luis.metabolicAge}`);
}
console.log('OK Luis metabolicAge', luis.metabolicAge, 'type', luis.bodyType, 'score', luis.bodyScore);

console.log('\n=== Marta (F, 167 cm, 37 y, z1=380) ===');
const martaProfile = { heightCm: 167, ageYears: 37, sex: 'female' as const };
// InBody: 62.5 kg / 21.4 % / FFM 49.1
const rMarta = resolveEffectiveR50Ohm({ sex: 'female', z1Ohm: 380 });
console.log('R_eff Marta z1=380 →', rMarta);
const marta = computeInbodyLikeComposition(62.5, martaProfile, rMarta!);
if (!marta) throw new Error('Marta composition null');

assertClose('Marta pbf vs InBody', marta.pbfPct, 21.4, 3);
assertClose('Marta ffm vs InBody', marta.ffmKg, 49.1, 4);
assertClose('Marta weight max (IMC 24.9)', marta.ranges.weightKg.max, 69.5, 1);
if (marta.bodyType === 'Obeso') {
  throw new Error(`Marta body type should not be Obeso: ${marta.bodyType}`);
}
console.log('OK Marta metabolicAge', marta.metabolicAge, 'type', marta.bodyType, 'score', marta.bodyScore);

console.log('\n=== Report: ignore numeric physiqueRating ===');
const fake = {
  weight_kg: 80.4,
  height_cm: 180,
  age_years: 50,
  sex: 'male',
  body_type: '9',
  pbf_pct: 14.4,
  body_fat_kg: 11.6,
  raw_payload: { impedance_ohm: 301.6 },
} as InbodyMeasurement;
const report = buildMorphoScanReport(fake);
if (!report.compositionFromSuiteBia) throw new Error('expected Suite BIA');
if (report.body_type === '9' || report.body_type === 'Obeso') {
  throw new Error(`bad body_type from rating: ${report.body_type}`);
}
const wMax = report.compositionRows[0]?.rangeMax;
if (wMax == null || wMax > 90) throw new Error(`weight range still too wide: ${wMax}`);
console.log('OK report body_type', report.body_type, 'pbf', report.pbf_pct, 'age', report.metabolic_age);

console.log('\nALL PASSED');
