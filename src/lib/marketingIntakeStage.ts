/** Nombre canónico de la etapa de entrada para leads nuevos (Meta, importación, etc.) */
export const DEFAULT_INTAKE_STAGE_NAME = 'Nuevo lead';

const INTAKE_NAME_ALIASES = new Set([
  'nuevo lead',
  'nuevo formulario',
]);

export type MarketingStageLike = {
  id: string;
  name: string;
  is_default_intake?: boolean;
  position?: number;
};

/** Resuelve la etapa donde deben caer los leads nuevos. */
export function findMarketingIntakeStage<T extends MarketingStageLike>(
  stages: T[],
): T | null {
  if (!stages.length) return null;
  const normalize = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');

  return (
    stages.find((s) => INTAKE_NAME_ALIASES.has(normalize(s.name))) ??
    stages.find((s) => s.is_default_intake) ??
    stages.find((s) => s.position === 0) ??
    stages[0] ??
    null
  );
}
