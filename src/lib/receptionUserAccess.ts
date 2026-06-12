import { ESTETICA_COMPANY_ID, MEDICINA_COMPANY_ID } from '@/lib/workCenterBilling';

/** Permisos operativos en ambas empresas (Medicina + Estética). */
export const RECEPTION_COMMON_PERMISSION_KEYS = [
  'agenda:read',
  'customers:read',
  'articles:read',
  'sales:read',
  'invoices:read',
  'phone:read_missed',
  'whatsapp:read',
] as const;

/** Marketing en ambas empresas del centro (tablero siempre en Estética). */
export const RECEPTION_MARKETING_PERMISSION_KEYS = [
  'marketing:read',
  'marketing:write',
] as const;

export const RECEPTION_ROLE_NAME = 'recepcion';

export const RECEPTION_COMPANY_PRESETS: Array<{
  companyId: string;
  label: string;
  allow: readonly string[];
  deny: readonly string[];
}> = [
  {
    companyId: ESTETICA_COMPANY_ID,
    label: 'Estética',
    allow: [...RECEPTION_COMMON_PERMISSION_KEYS, ...RECEPTION_MARKETING_PERMISSION_KEYS],
    deny: [],
  },
  {
    companyId: MEDICINA_COMPANY_ID,
    label: 'Medicina',
    allow: [...RECEPTION_COMMON_PERMISSION_KEYS, ...RECEPTION_MARKETING_PERMISSION_KEYS],
    deny: [],
  },
];
