/** Roles de etapa anclados a flags; el nombre solo es fallback legacy. */

export type MarketingStageRoleLike = {
  id: string;
  name: string;
  position?: number | null;
  is_default_intake?: boolean | null;
  is_appointment_intake?: boolean | null;
  is_presentada?: boolean | null;
  is_won?: boolean | null;
};

const normalizeStageName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const INTAKE_NAME_ALIASES = new Set(['nuevo lead', 'nuevo formulario']);

const isAppointmentIntakeName = (name: string): boolean => {
  const n = normalizeStageName(name);
  if (n.includes('formulario') && n.includes('agenda ficticia')) return true;
  if (n.includes('cita sin pago')) return true;
  if (n.includes('cita confirmada') && n.includes('sin pago')) return true;
  return false;
};

/** Presentada / Presentados / Presentada con éxito. Excluye «No presentada». */
export const isPresentadaExitoStageName = (name: string | null | undefined): boolean => {
  if (!name?.trim()) return false;
  const n = normalizeStageName(name);
  if (/(^|[^a-z])no\s+presentad/.test(n)) return false;
  return /presentad[oa]s?/.test(n);
};

/** Etapa de entrada (Meta, cola WA, depósitos). Flag primero; nombre solo fallback. */
export function findMarketingIntakeStage<T extends MarketingStageRoleLike>(
  stages: T[],
): T | null {
  if (!stages.length) return null;
  return (
    stages.find((s) => s.is_default_intake) ??
    stages.find((s) => INTAKE_NAME_ALIASES.has(normalizeStageName(s.name))) ??
    stages.find((s) => s.position === 0) ??
    stages[0] ??
    null
  );
}

/** Etapa de cita / agenda ficticia. */
export function findMarketingAppointmentStage<T extends MarketingStageRoleLike>(
  stages: T[],
): T | null {
  if (!stages.length) return null;
  return (
    stages.find((s) => s.is_appointment_intake) ??
    stages.find((s) => isAppointmentIntakeName(s.name)) ??
    null
  );
}

/** Etapa de presentación facturada (sync Style). */
export function findMarketingPresentadaStage<T extends MarketingStageRoleLike>(
  stages: T[],
): T | null {
  if (!stages.length) return null;
  return (
    stages.find((s) => s.is_presentada) ??
    stages.find((s) => isPresentadaExitoStageName(s.name)) ??
    null
  );
}

export function stageExpectsAgendaContext(stage: MarketingStageRoleLike): boolean {
  return Boolean(stage.is_appointment_intake) || isAppointmentIntakeName(stage.name);
}
