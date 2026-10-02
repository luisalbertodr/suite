/**
 * Validación calidad de tomas Morpho.
 * Ejecutar: npx --yes tsx scripts/validate-morpho-take-quality.ts
 */
import {
  assessMorphoTakeQuality,
  filterMeasurementsForClinicalUi,
  shouldHideMeasurementInUi,
} from '../src/lib/morphoTakeQuality.ts';
import type { InbodyMeasurement } from '../src/lib/inbodyMeasurements.ts';

function m(partial: Partial<InbodyMeasurement> & { id: string }): InbodyMeasurement {
  return {
    device: 'morphoscan',
    source: 'ble-scale-sync',
    measured_at: '2026-09-28T10:40:00+02:00',
    sex: 'F',
    weight_kg: 52.2,
    pbf_pct: 28.2,
    body_fat_kg: 14.72,
    impedance: {},
    raw_payload: {},
    segmental_lean: {},
    segmental_fat: {},
    edema: {},
    ...partial,
  } as InbodyMeasurement;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
}

const good = m({
  id: 'g1',
  raw_payload: { impedance_ohm: 380.8 },
  impedance: {
    '20khz': { trunk: 22.4, right_arm: 320, right_leg: 332 },
    '100khz': { trunk: 23.1, right_arm: 280, right_leg: 300 },
  },
});
assert(assessMorphoTakeQuality(good).grade === 'good', 'toma completa → good');

const weightOnly = m({
  id: 'b1',
  pbf_pct: null,
  body_fat_kg: null,
  raw_payload: { weight_only: true },
  impedance: {},
});
assert(assessMorphoTakeQuality(weightOnly).grade === 'bad', 'solo peso → bad');
assert(shouldHideMeasurementInUi(weightOnly), 'bad se oculta');

const warnTrunk = m({
  id: 'w1',
  raw_payload: { impedance_ohm: 381.3 },
  impedance: {
    '20khz': { trunk: 22.9, right_arm: 320, right_leg: 318 },
    '100khz': { trunk: 13.5, right_arm: 280, right_leg: 290 },
  },
});
assert(assessMorphoTakeQuality(warnTrunk).grade === 'warn', 'tronco100 sospechoso → warn');
assert(!shouldHideMeasurementInUi(warnTrunk), 'warn se muestra');

const a = m({
  id: 'd1',
  measured_at: '2026-09-28T10:40:00+02:00',
  pbf_pct: 28.2,
  raw_payload: { impedance_ohm: 408.9 },
  impedance: {
    '20khz': { trunk: 24.9, right_arm: 350, right_leg: 367 },
    '100khz': { trunk: 18.4, right_arm: 310, right_leg: 330 },
  },
});
const b = m({
  id: 'd2',
  measured_at: '2026-09-28T11:29:00+02:00',
  pbf_pct: 21.6,
  weight_kg: 50.75,
  raw_payload: { impedance_ohm: 407.6 },
  impedance: {
    '20khz': { trunk: 23.6, right_arm: 340, right_leg: 331 },
    '100khz': { trunk: 12.4, right_arm: 300, right_leg: 300 },
  },
});
const qb = assessMorphoTakeQuality(b, [a, b]);
assert(qb.grade === 'warn', 'outlier mismo día → warn');
assert(qb.issues.includes('same_day_outlier') || qb.issues.includes('trunk100_suspect'), 'marca outlier o tronco');

const list = [good, weightOnly, warnTrunk, a, b];
const filtered = filterMeasurementsForClinicalUi(list);
assert(!filtered.some((x) => x.id === 'b1'), 'filtro quita bad');
assert(filtered.some((x) => x.id === 'w1'), 'filtro conserva warn');

const inbodyEmpty = {
  id: 'i1',
  device: 'inbody',
  source: 'csv',
  measured_at: '2026-09-30T09:00:00+02:00',
  weight_kg: null,
  pbf_pct: null,
  body_fat_kg: null,
} as InbodyMeasurement;
assert(shouldHideMeasurementInUi(inbodyEmpty), 'InBody vacía se oculta');

console.log('\nALL PASSED');
