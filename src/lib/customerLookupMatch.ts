import { supabase } from '@/lib/supabase';

export type CustomerLookupRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_home: string | null;
  legacy_codcli?: string | null;
};

const digitsOnly = (s: string | null | undefined): string =>
  (s ?? '').replace(/\D/g, '');

const phoneVariants = (raw: string | null | undefined): string[] => {
  const d = digitsOnly(raw);
  if (!d) return [];
  const out = new Set<string>();
  out.add(d);
  if (d.length > 9) out.add(d.slice(-9));
  if (d.length > 7) out.add(d.slice(-7));
  return [...out];
};

const emailKey = (raw: string | null | undefined): string =>
  (raw ?? '').trim().toLowerCase();

export type CustomerLookupIndex = {
  byPhone: Map<string, CustomerLookupRow>;
  byEmail: Map<string, CustomerLookupRow>;
  customers: CustomerLookupRow[];
  match: (criteria: { phone?: string | null; email?: string | null }) => CustomerLookupRow | null;
};

export function buildCustomerLookupIndex(customers: CustomerLookupRow[]): CustomerLookupIndex {
  const byPhone = new Map<string, CustomerLookupRow>();
  const byEmail = new Map<string, CustomerLookupRow>();

  for (const c of customers) {
    for (const ph of [c.phone, c.phone_mobile, c.phone_home]) {
      for (const variant of phoneVariants(ph)) {
        if (!byPhone.has(variant)) byPhone.set(variant, c);
      }
    }
    const e = emailKey(c.email);
    if (e) byEmail.set(e, c);
  }

  const match: CustomerLookupIndex['match'] = ({ phone, email }) => {
    for (const variant of phoneVariants(phone)) {
      const hit = byPhone.get(variant);
      if (hit) return hit;
    }
    const e = emailKey(email);
    if (e) {
      const hit = byEmail.get(e);
      if (hit) return hit;
    }
    return null;
  };

  return { byPhone, byEmail, customers, match };
}

export async function fetchCustomerLookupRows(companyId: string): Promise<CustomerLookupRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, phone, phone_mobile, phone_home, legacy_codcli')
    .eq('company_id', companyId);
  if (error) throw error;
  return data ?? [];
}

/** Clientes de varias empresas (p. ej. Estética + Medicina) para enlazar leads con agenda/facturación. */
export async function fetchCustomerLookupRowsForCompanies(
  companyIds: readonly string[],
): Promise<CustomerLookupRow[]> {
  const unique = [...new Set(companyIds.filter(Boolean))];
  if (!unique.length) return [];

  const chunks = await Promise.all(unique.map((companyId) => fetchCustomerLookupRows(companyId)));
  const byId = new Map<string, CustomerLookupRow>();
  for (const row of chunks.flat()) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}
