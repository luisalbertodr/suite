/** Roles de etapa anclados a flags; el nombre solo es fallback legacy. */

export type MarketingStageRoleLike = {
  id: string;
  name: string;
  position?: number | null;
  is_default_intake?: boolean | null;
  is_appointment_intake?: boolean | null;
  is_presentada?: boolean | null;
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

export function findMarketingIntakeStageId(
  stages: MarketingStageRoleLike[],
): string | null {
  if (!stages.length) return null;
  return (
    stages.find((s) => s.is_default_intake)?.id ??
    stages.find((s) => INTAKE_NAME_ALIASES.has(normalizeStageName(s.name)))?.id ??
    stages.find((s) => s.position === 0)?.id ??
    stages[0]?.id ??
    null
  );
}

export function findMarketingAppointmentStageId(
  stages: MarketingStageRoleLike[],
): string | null {
  if (!stages.length) return null;
  return (
    stages.find((s) => s.is_appointment_intake)?.id ??
    stages.find((s) => isAppointmentIntakeName(s.name))?.id ??
    null
  );
}
