import {
  formatCustomerPhoneLabels,
  primaryCustomerPhone,
  type CustomerPhoneFields,
} from '@/lib/legacyCustomerPhones';

export const APPOINTMENT_CUSTOMER_SUMMARY_FIELDS =
  'id,name,tax_id,email,phone,phone_mobile,phone_home,phone_norm,legacy_codcli,address_street,address_city,address_postal_code,contact_person,notes';

export type AppointmentCustomerSummary = CustomerPhoneFields & {
  id?: string;
  name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone_norm?: string | null;
  legacy_codcli?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_postal_code?: string | null;
  contact_person?: string | null;
  notes?: string | null;
};

function pickAddress(c: AppointmentCustomerSummary): string | null {
  const street = String(c.address_street ?? '').trim();
  const city = String(c.address_city ?? '').trim();
  const postal = String(c.address_postal_code ?? '').trim();
  const line = [street, postal && city ? `${postal} ${city}` : city || postal].filter(Boolean).join(', ');
  return line || null;
}

/** Línea compacta de contacto para la cabecera de la cita. */
export function formatCustomerContactLine(c: AppointmentCustomerSummary): string {
  const parts: string[] = [];
  const nif = String(c.tax_id ?? '').trim();
  if (nif) parts.push(nif);
  const phoneLabels = formatCustomerPhoneLabels(c);
  parts.push(...phoneLabels);
  if (!phoneLabels.length && primaryCustomerPhone(c)) {
    parts.push(primaryCustomerPhone(c)!);
  }
  const email = String(c.email ?? '').trim();
  if (email) parts.push(email);
  const contact = String(c.contact_person ?? '').trim();
  if (contact) parts.push(contact);
  const legacy = String(c.legacy_codcli ?? '').trim();
  if (legacy) parts.push(`Cód. ${legacy}`);
  const addr = pickAddress(c);
  if (addr) parts.push(addr);
  return parts.join(' · ');
}

export function customerContactFallback(c: AppointmentCustomerSummary): string {
  const note = String(c.notes ?? '').trim();
  if (note) return note.length > 80 ? `${note.slice(0, 77)}…` : note;
  return 'Sin teléfono, email ni NIF — revisar ficha o ejecutar promote_legacy_customer_phones.py';
}
