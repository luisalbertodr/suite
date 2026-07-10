/** Delgado Lamas Medicina Estética SL — área Medicina (facturación por líneas). */
export const MEDICINA_COMPANY_ID = '816af484-92a0-4f65-a5a7-1c907aa4bb3d';

/** María del Mar Lamas Pernas — área Estética (facturación por líneas). */
export const ESTETICA_COMPANY_ID = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

/** Emisor fiscal de líneas medicina (familias 025/23/33, etc.). */
export const MEDICINA_LINE_BILLING_COMPANY_ID = MEDICINA_COMPANY_ID;

/** Emisor fiscal por defecto del resto (estética). */
export const ESTETICA_LINE_BILLING_COMPANY_ID = ESTETICA_COMPANY_ID;

export const WORK_CENTER_BILLING_COMPANY_IDS = [
  MEDICINA_COMPANY_ID,
  ESTETICA_COMPANY_ID,
] as const;
