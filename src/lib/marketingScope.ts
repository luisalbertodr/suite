import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
  WORK_CENTER_BILLING_COMPANY_IDS,
} from '@/lib/workCenterBilling';

/**
 * Empresa que almacena leads, etapas, Meta y campos de marketing en producción.
 * (Meta + leads están en María del Mar Lamas Pernas.)
 */
export const MARKETING_HOST_COMPANY_ID = ESTETICA_COMPANY_ID;

/** Empresas con permisos de marketing (acceso M+E). */
export const MARKETING_ACCESS_COMPANY_IDS = [
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
] as const;

/** Empresas emisoras de facturas / TPV (Estética + Medicina) para sync Presentada. */
export const MARKETING_BILLING_COMPANY_IDS = WORK_CENTER_BILLING_COMPANY_IDS;
