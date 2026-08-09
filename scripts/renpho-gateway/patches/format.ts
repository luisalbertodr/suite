import type { WeightUnit } from '../config/schema.js';

const KG_TO_LBS = 2.20462;

export function fmtWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null || !Number.isFinite(Number(kg))) return '—';
  const n = Number(kg);
  if (unit === 'lbs') return `${(n * KG_TO_LBS).toFixed(2)} lbs`;
  return `${n.toFixed(2)} kg`;
}
