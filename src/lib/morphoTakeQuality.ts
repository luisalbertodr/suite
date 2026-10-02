/**
 * Calidad de toma MorphoScan (Ω / path / z1 / consenso mismo día).
 * - bad: no mostrar en UI clínica
 * - warn: mostrar con aviso; conviene repetir
 * - good: usable
 */
import {
  isMorphoScanMeasurement,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import {
  estimatePathR50Ohm,
  normalizeInbodyLikeSex,
  pathScaleForSex,
  pickMorphoImpedanceInputs,
  z1ScaleForSex,
  type SegmentalOhms,
} from '@/lib/inbodyLikeBia';

export type MorphoTakeGrade = 'good' | 'warn' | 'bad';

export type MorphoTakeIssue =
  | 'no_composition'
  | 'no_z1'
  | 'no_path'
  | 'path_incomplete'
  | 'trunk100_suspect'
  | 'missing_100khz_segment'
  | 'path_z1_discord'
  | 'path_z1_warn'
  | 'same_day_outlier'
  | 'same_day_discord'
  | 'weight_only';

export interface MorphoTakeQuality {
  grade: MorphoTakeGrade;
  /** true si grade !== good (avisar / pedir repetición). */
  needs_repeat: boolean;
  issues: MorphoTakeIssue[];
  title: string;
  message: string;
}

const ISSUE_LABELS: Record<MorphoTakeIssue, string> = {
  no_composition: 'Sin composición corporal',
  no_z1: 'Sin impedancia global (z1)',
  no_path: 'Sin path segmentario usable',
  path_incomplete: 'Path incompleto (falta brazo/tronco/pierna)',
  trunk100_suspect: 'Tronco @100 kHz sospechoso (< 15 Ω)',
  missing_100khz_segment: 'Falta segmento a 100 kHz',
  path_z1_discord: 'Path y z1 discrepan >12 %',
  path_z1_warn: 'Path y z1 discrepan 8–12 %',
  same_day_outlier: 'Fuera del consenso de otras tomas del mismo día',
  same_day_discord: 'Dos tomas del mismo día no coinciden',
  weight_only: 'Solo peso (BIA incompleta)',
};

export function morphoTakeIssueLabel(issue: MorphoTakeIssue): string {
  return ISSUE_LABELS[issue];
}

function dayKeyMadrid(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function pickZ1(m: InbodyMeasurement): number | null {
  const { z1Ohm } = pickMorphoImpedanceInputs(m);
  return z1Ohm;
}

function segmentFlags(z20: SegmentalOhms | null, z100: SegmentalOhms | null): MorphoTakeIssue[] {
  const issues: MorphoTakeIssue[] = [];
  const segs = ['right_arm', 'trunk', 'right_leg'] as const;
  if (!z20) {
    issues.push('path_incomplete');
    return issues;
  }
  let present = 0;
  for (const k of segs) {
    const a = z20[k];
    const b = z100?.[k];
    if (a != null && a > 0) present += 1;
    else if (b != null && b > 0) present += 1;
    if (k === 'trunk' && b != null && b > 0 && b < 15) {
      issues.push('trunk100_suspect');
    }
    if (a != null && a > 0 && (b == null || !(b > 0))) {
      issues.push('missing_100khz_segment');
    }
  }
  if (present < 3) issues.push('path_incomplete');
  return [...new Set(issues)];
}

function baseAssess(m: InbodyMeasurement): MorphoTakeQuality {
  const issues: MorphoTakeIssue[] = [];
  const raw = m.raw_payload ?? {};
  const weightOnly =
    raw.weight_only === true ||
    raw.fat_source === 'none' ||
    (m.pbf_pct == null && m.body_fat_kg == null);

  if (weightOnly) issues.push('weight_only');
  if (m.pbf_pct == null && m.body_fat_kg == null) issues.push('no_composition');

  const z1 = pickZ1(m);
  if (z1 == null || z1 < 100) issues.push('no_z1');

  const { z20, z100 } = pickMorphoImpedanceInputs(m);
  const segIssues = segmentFlags(z20, z100);
  issues.push(...segIssues);

  const path = estimatePathR50Ohm(z20, z100);
  if (path == null) issues.push('no_path');

  const sex = normalizeInbodyLikeSex(m.sex);
  if (path != null && z1 != null && z1 >= 100) {
    const pathR = path * pathScaleForSex(sex);
    const z1R = z1 * z1ScaleForSex(sex);
    if (z1R > 0) {
      const rel = Math.abs(pathR - z1R) / z1R;
      if (rel > 0.12) issues.push('path_z1_discord');
      else if (rel > 0.08) issues.push('path_z1_warn');
    }
  }

  const unique = [...new Set(issues)];
  const badKeys: MorphoTakeIssue[] = [
    'weight_only',
    'no_composition',
    'no_z1',
    'no_path',
    'path_incomplete',
    'path_z1_discord',
  ];
  const hasBad = unique.some((i) => badKeys.includes(i));
  const hasWarn = unique.some(
    (i) =>
      i === 'trunk100_suspect' ||
      i === 'missing_100khz_segment' ||
      i === 'path_z1_warn',
  );

  let grade: MorphoTakeGrade = 'good';
  if (hasBad) grade = 'bad';
  else if (hasWarn) grade = 'warn';

  return finalize(grade, unique);
}

function finalize(grade: MorphoTakeGrade, issues: MorphoTakeIssue[]): MorphoTakeQuality {
  const needs_repeat = grade !== 'good';
  if (grade === 'bad') {
    return {
      grade,
      needs_repeat: true,
      issues,
      title: 'Medición no usable',
      message:
        'Faltan impedancias o el path no es válido. No se muestra en el historial clínico. Repite el pesaje (pies descalzos, mango firme, quieta hasta el bip).',
    };
  }
  if (grade === 'warn') {
    return {
      grade,
      needs_repeat: true,
      issues,
      title: 'Medición poco fiable — conviene repetir',
      message:
        'La toma tiene señales de contacto irregular (Ω incompletos o discordantes). Usa con cautela o vuelve a medir.',
    };
  }
  return {
    grade: 'good',
    needs_repeat: false,
    issues,
    title: 'Medición OK',
    message: 'Impedancias y composición coherentes.',
  };
}

/**
 * Evalúa una toma Morpho. Con siblings aplica consenso del mismo día.
 * InBody u otros devices → good (no aplica).
 */
export function assessMorphoTakeQuality(
  m: InbodyMeasurement,
  siblings: InbodyMeasurement[] = [],
): MorphoTakeQuality {
  if (!isMorphoScanMeasurement(m)) {
    return {
      grade: 'good',
      needs_repeat: false,
      issues: [],
      title: 'Medición OK',
      message: '',
    };
  }

  const base = baseAssess(m);
  if (base.grade === 'bad') return base;

  const day = dayKeyMadrid(m.measured_at);
  const peers = siblings.filter(
    (s) =>
      s.id !== m.id &&
      isMorphoScanMeasurement(s) &&
      dayKeyMadrid(s.measured_at) === day &&
      s.pbf_pct != null,
  );

  const peerQualities = peers
    .map((s) => ({ s, q: baseAssess(s) }))
    .filter((x) => x.q.grade !== 'bad' && x.s.pbf_pct != null);

  if (peerQualities.length === 0 || m.pbf_pct == null) return base;

  const pbfs = peerQualities.map((x) => Number(x.s.pbf_pct));
  pbfs.push(Number(m.pbf_pct));
  pbfs.sort((a, b) => a - b);
  const mid = Math.floor(pbfs.length / 2);
  const median =
    pbfs.length % 2 === 1 ? pbfs[mid]! : (pbfs[mid - 1]! + pbfs[mid]!) / 2;

  const issues = [...base.issues];
  let grade = base.grade;

  if (peerQualities.length === 1) {
    const other = Number(peerQualities[0]!.s.pbf_pct);
    if (Math.abs(Number(m.pbf_pct) - other) > 2) {
      issues.push('same_day_discord');
      grade = 'warn';
    }
  } else if (Math.abs(Number(m.pbf_pct) - median) > 1.5) {
    issues.push('same_day_outlier');
    grade = 'warn';
  }

  return finalize(grade, [...new Set(issues)]);
}

/** true si la medición debe ocultarse del historial clínico. */
export function shouldHideMeasurementInUi(
  m: InbodyMeasurement,
  siblings: InbodyMeasurement[] = [],
): boolean {
  if (isMorphoScanMeasurement(m)) {
    return assessMorphoTakeQuality(m, siblings).grade === 'bad';
  }
  // InBody: ocultar solo si no hay peso ni grasa (toma vacía / abortada)
  if (m.weight_kg == null || m.weight_kg <= 0) return true;
  if (m.pbf_pct == null && m.body_fat_kg == null) return true;
  return false;
}

/** Filtra tomas bad; conserva orden. */
export function filterMeasurementsForClinicalUi(
  list: InbodyMeasurement[],
): InbodyMeasurement[] {
  if (!list.length) return list;
  return list.filter((m) => !shouldHideMeasurementInUi(m, list));
}

export function morphoTakeQualityLabels(q: MorphoTakeQuality): string[] {
  return q.issues.map(morphoTakeIssueLabel);
}
