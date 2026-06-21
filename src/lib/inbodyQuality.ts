import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatInbodyNumber,
  resolveBodyFatMassRangeKg,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';

export type InbodyQualityIssue =
  | 'pbf_too_low'
  | 'pbf_too_high'
  | 'body_fat_ratio_low'
  | 'pbf_bfm_mismatch'
  | 'composition_sum_mismatch'
  | 'missing_core_fields'
  | 'missing_impedance';

export type InbodyQualityStatus = 'ok' | 'suspicious';

export interface InbodyQualityHint {
  pbf_pct?: number | null;
  body_fat_kg?: number | null;
  weight_kg?: number | null;
  source: 'pbf_derived' | 'bfm_derived' | 'reference_measurement';
}

/** Persistido en inbody_measurements.data_quality */
export interface InbodyDataQuality {
  status: InbodyQualityStatus;
  needs_repeat: boolean;
  issues: InbodyQualityIssue[];
  hint?: InbodyQualityHint | null;
  reference_measurement_id?: string | null;
  reference_measured_at?: string | null;
  checked_at?: string | null;
}

const ISSUE_LABELS: Record<InbodyQualityIssue, string> = {
  pbf_too_low: 'PGC demasiado baja (< 8 %)',
  pbf_too_high: 'PGC demasiado alta (> 60 %)',
  body_fat_ratio_low: 'Masa grasa demasiado baja respecto al peso',
  pbf_bfm_mismatch: 'PGC y masa grasa no coinciden',
  composition_sum_mismatch: 'Peso ≠ masa libre de grasa + grasa',
  missing_core_fields: 'Faltan peso o indicadores de grasa',
  missing_impedance: 'Sin datos de impedancia',
};

export function inbodyQualityIssueLabel(issue: InbodyQualityIssue): string {
  return ISSUE_LABELS[issue];
}

function hasImpedance(m: InbodyMeasurement): boolean {
  const imp = m.impedance;
  if (!imp || typeof imp !== 'object') return false;
  return Object.values(imp).some(
    (block) => block && typeof block === 'object' && Object.values(block).some((v) => v != null && v > 0),
  );
}

/** Evalúa coherencia interna de una medición (sin contexto de otras sesiones). */
export function assessInbodyMeasurementIssues(m: InbodyMeasurement): InbodyQualityIssue[] {
  const issues: InbodyQualityIssue[] = [];
  const w = m.weight_kg;

  if (w == null || w <= 0) {
    issues.push('missing_core_fields');
    return issues;
  }

  if (m.pbf_pct == null && m.body_fat_kg == null) {
    issues.push('missing_core_fields');
  }

  if (m.pbf_pct != null && m.pbf_pct > 0 && m.pbf_pct < 8 && w >= 40) {
    issues.push('pbf_too_low');
  }
  if (m.pbf_pct != null && m.pbf_pct > 60) {
    issues.push('pbf_too_high');
  }

  if (m.body_fat_kg != null && w >= 40 && m.body_fat_kg / w < 0.06) {
    issues.push('body_fat_ratio_low');
  }

  if (
    m.pbf_pct != null &&
    m.body_fat_kg != null &&
    w > 0 &&
    Math.abs(m.pbf_pct - (m.body_fat_kg / w) * 100) > 8
  ) {
    issues.push('pbf_bfm_mismatch');
  }

  if (
    m.ffm_kg != null &&
    m.body_fat_kg != null &&
    Math.abs(w - (m.ffm_kg + m.body_fat_kg)) > 4
  ) {
    issues.push('composition_sum_mismatch');
  }

  if (w >= 40 && m.pbf_pct != null && !hasImpedance(m)) {
    issues.push('missing_impedance');
  }

  return issues;
}

export function isSuspiciousInbodyIssues(issues: InbodyQualityIssue[]): boolean {
  const critical: InbodyQualityIssue[] = [
    'pbf_too_low',
    'pbf_too_high',
    'body_fat_ratio_low',
    'pbf_bfm_mismatch',
    'composition_sum_mismatch',
    'missing_core_fields',
  ];
  return issues.some((i) => critical.includes(i));
}

function inbodyMeasurementQualityScore(m: InbodyMeasurement): number {
  const issues = assessInbodyMeasurementIssues(m);
  if (isSuspiciousInbodyIssues(issues)) return -100;
  let score = 0;
  if (m.pbf_pct != null && m.pbf_pct >= 8) score += 2;
  if (m.body_fat_kg != null) score += 1;
  if (hasImpedance(m)) score += 1;
  if (m.segmental_lean && Object.keys(m.segmental_lean).length > 0) score += 1;
  return score;
}

/** Sesión fiable más cercana en el tiempo (mismo usuario). */
export function findReferenceInbodyMeasurement(
  target: InbodyMeasurement,
  siblings: InbodyMeasurement[],
): InbodyMeasurement | null {
  const candidates = siblings.filter((m) => {
    if (m.id === target.id) return false;
    if (inbodyMeasurementQualityScore(m) < 0) return false;
    return true;
  });
  if (!candidates.length) return null;

  const t = new Date(target.measured_at).getTime();
  candidates.sort(
    (a, b) =>
      Math.abs(new Date(a.measured_at).getTime() - t) -
      Math.abs(new Date(b.measured_at).getTime() - t),
  );
  return candidates[0] ?? null;
}

function deriveHint(m: InbodyMeasurement, issues: InbodyQualityIssue[]): InbodyQualityHint | null {
  const w = m.weight_kg;
  if (w == null || w <= 0) return null;

  if (
    issues.includes('pbf_bfm_mismatch') &&
    m.pbf_pct != null &&
    m.pbf_pct >= 8 &&
    m.pbf_pct <= 60
  ) {
    return {
      pbf_pct: m.pbf_pct,
      body_fat_kg: (w * m.pbf_pct) / 100,
      weight_kg: w,
      source: 'pbf_derived',
    };
  }

  if (
    issues.includes('pbf_bfm_mismatch') &&
    m.body_fat_kg != null &&
    m.body_fat_kg / w >= 0.06
  ) {
    return {
      pbf_pct: (m.body_fat_kg / w) * 100,
      body_fat_kg: m.body_fat_kg,
      weight_kg: w,
      source: 'bfm_derived',
    };
  }

  return null;
}

export function buildInbodyDataQuality(
  measurement: InbodyMeasurement,
  siblings: InbodyMeasurement[] = [],
): InbodyDataQuality {
  const issues = assessInbodyMeasurementIssues(measurement);
  const suspicious = isSuspiciousInbodyIssues(issues);
  const reference = suspicious ? findReferenceInbodyMeasurement(measurement, siblings) : null;
  const hint =
    deriveHint(measurement, issues) ??
    (reference
      ? {
          pbf_pct: reference.pbf_pct,
          body_fat_kg: reference.body_fat_kg,
          weight_kg: reference.weight_kg,
          source: 'reference_measurement' as const,
        }
      : null);

  return {
    status: suspicious ? 'suspicious' : 'ok',
    needs_repeat: suspicious,
    issues,
    hint,
    reference_measurement_id: reference?.id ?? null,
    reference_measured_at: reference?.measured_at ?? null,
    checked_at: new Date().toISOString(),
  };
}

export function resolveInbodyDataQuality(
  measurement: InbodyMeasurement,
  siblings: InbodyMeasurement[] = [],
): InbodyDataQuality {
  if (measurement.data_quality?.checked_at && measurement.data_quality.status) {
    return measurement.data_quality;
  }
  return buildInbodyDataQuality(measurement, siblings);
}

export function formatReferenceSessionLabel(m: InbodyMeasurement): string {
  const date = format(new Date(m.measured_at), 'dd/MM/yyyy', { locale: es });
  const parts = [date];
  if (m.weight_kg != null) parts.push(formatInbodyNumber(m.weight_kg, 1, ' kg'));
  if (m.pbf_pct != null) parts.push(`PGC ${formatInbodyNumber(m.pbf_pct, 1, '%')}`);
  if (m.body_fat_kg != null) parts.push(`grasa ${formatInbodyNumber(m.body_fat_kg, 1, ' kg')}`);
  return parts.join(' · ');
}

export function formatInbodyQualityAlert(
  quality: InbodyDataQuality,
  reference?: InbodyMeasurement | null,
): { title: string; body: string; issues: string[] } {
  const issues = quality.issues.map(inbodyQualityIssueLabel);
  const title = 'Medición posiblemente errónea — conviene repetir el escaneo InBody';

  const parts: string[] = [
    'Los valores registrados no son fisiológicamente coherentes (escaneo abortado o fallido en el dispositivo).',
  ];

  if (quality.hint?.source === 'reference_measurement' && reference) {
    parts.push(
      `Como orientación, use la sesión del ${formatReferenceSessionLabel(reference)}.`,
    );
  } else if (quality.hint?.source === 'pbf_derived' && quality.hint.body_fat_kg != null) {
    parts.push(
      `A partir del PGC registrado, la masa grasa coherente sería ~${formatInbodyNumber(quality.hint.body_fat_kg, 1, ' kg')}.`,
    );
  } else if (quality.hint?.source === 'bfm_derived' && quality.hint.pbf_pct != null) {
    parts.push(
      `A partir de la masa grasa registrada, el PGC coherente sería ~${formatInbodyNumber(quality.hint.pbf_pct, 1, '%')}.`,
    );
  } else {
    parts.push('Compare con otra sesión cercana del mismo cliente.');
  }

  return { title, body: parts.join(' '), issues };
}

/** Corrige rango MFA %→kg al importar o normalizar filas. */
export function fixBodyFatMassRangeKg(
  weightKg: number | null | undefined,
  minKg: number | null | undefined,
  maxKg: number | null | undefined,
): { min: number | null; max: number | null } {
  return resolveBodyFatMassRangeKg({
    weight_kg: weightKg ?? null,
    body_fat_min_kg: minKg ?? null,
    body_fat_max_kg: maxKg ?? null,
  });
}
