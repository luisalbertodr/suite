/**
 * JPG InBody: etiquetas segmentales deben usar % vs estándar (como Análisis segmental),
 * no tratar eval_pct=108 como código ≥2 → «Alto».
 */
import { segmentEvalStatusLabel, segmentStatusFromPct } from '../src/lib/inbodyMeasurements.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Morpho / LookInBody: % vs estándar
assert(segmentEvalStatusLabel({ eval_pct: 108.3 }) === 'Normal', '108.3 → Normal');
assert(segmentEvalStatusLabel({ eval_pct: 84.1 }) === 'Bajo', '84.1 → Bajo');
assert(segmentEvalStatusLabel({ eval_pct: 248.4 }) === 'Alto', '248.4 → Alto');
assert(segmentEvalStatusLabel({ pct: 100 }) === 'Normal', '100 pct → Normal');
assert(segmentEvalStatusLabel({ eval_pct: 90 }) === 'Normal', '90 → Normal');
assert(segmentEvalStatusLabel({ eval_pct: 110 }) === 'Normal', '110 → Normal');
assert(segmentEvalStatusLabel({ eval_pct: 89.9 }) === 'Bajo', '89.9 → Bajo');
assert(segmentEvalStatusLabel({ eval_pct: 110.1 }) === 'Alto', '110.1 → Alto');

// Códigos discretos legacy 0/1/2
assert(segmentEvalStatusLabel({ eval_pct: 0 }) === 'Bajo', 'code 0 → Bajo');
assert(segmentEvalStatusLabel({ eval_pct: 1 }) === 'Normal', 'code 1 → Normal');
assert(segmentEvalStatusLabel({ eval_pct: 2 }) === 'Alto', 'code 2 → Alto');

assert(segmentEvalStatusLabel({}) === '', 'vacío → ""');
assert(segmentStatusFromPct(108.3) === 'normal', 'status 108.3 normal');

console.log('ALL PASSED segment eval labels');
