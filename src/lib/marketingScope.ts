import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
} from '@/lib/workCenterBilling';

/**
 * Empresa que almacena leads, etapas, Meta y campos de marketing en producción.
 * (Meta + 575 leads están en María del Mar Lamas Pernas; Estética SL solo tiene etapas sembradas vacías.)
 */
export const MARKETING_HOST_COMPANY_ID = MEDICINA_COMPANY_ID;

/** Empresas con permisos de marketing (acceso M+E). */
export const MARKETING_ACCESS_COMPANY_IDS = [
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
] as const;
