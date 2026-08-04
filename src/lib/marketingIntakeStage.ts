/** Nombre canónico de la etapa de entrada para leads nuevos (Meta, importación, etc.) */
export const DEFAULT_INTAKE_STAGE_NAME = 'Nuevo lead';

export type { MarketingStageRoleLike as MarketingStageLike } from '@/lib/marketingStageRoles';
export { findMarketingIntakeStage } from '@/lib/marketingStageRoles';
