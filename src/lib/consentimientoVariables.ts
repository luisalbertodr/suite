import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ConsentimientoCustomer } from '@/lib/consentimientoTypes';

export type ConsentimientoVariableContext = {
  customer?: ConsentimientoCustomer | null;
  companyName?: string | null;
  tratamiento?: string | null;
  profesional?: string | null;
  fecha?: Date;
};

const VARIABLE_KEYS = [
  'nombre',
  'dni',
  'email',
  'telefono',
  'direccion',
  'empresa',
  'tratamiento',
  'profesional',
  'fecha',
] as const;

export function buildCustomerAddress(customer?: ConsentimientoCustomer | null): string {
  if (!customer) return '';
  const parts = [
    customer.address_street?.trim(),
    [customer.address_postal_code, customer.address_city].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);
  return parts.join(', ');
}

export function buildConsentimientoVariables(
  ctx: ConsentimientoVariableContext,
): Record<string, string> {
  const fecha = ctx.fecha ?? new Date();
  const customer = ctx.customer;
  return {
    nombre: customer?.name?.trim() || '',
    dni: customer?.tax_id?.trim() || '',
    email: customer?.email?.trim() || '',
    telefono: (customer?.phone_mobile || customer?.phone || '').trim(),
    direccion: buildCustomerAddress(customer),
    empresa: ctx.companyName?.trim() || '',
    tratamiento: ctx.tratamiento?.trim() || '',
    profesional: ctx.profesional?.trim() || '',
    fecha: format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es }),
  };
}

/** Sustituye {nombre}, {dni}, etc. en el texto de la plantilla. */
export function applyConsentimientoVariables(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const key of VARIABLE_KEYS) {
    const value = vars[key] ?? '';
    out = out.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
  }
  return out;
}

export const CONSENTIMIENTO_VARIABLE_HINTS: { key: string; label: string }[] = [
  { key: 'nombre', label: 'Nombre del cliente' },
  { key: 'dni', label: 'DNI / NIF' },
  { key: 'email', label: 'Email' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'direccion', label: 'Dirección del cliente' },
  { key: 'empresa', label: 'Nombre de la empresa' },
  { key: 'tratamiento', label: 'Tratamiento / servicio' },
  { key: 'profesional', label: 'Profesional' },
  { key: 'fecha', label: 'Fecha actual' },
];
