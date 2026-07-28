import { supabase } from '@/lib/supabase';

export type ExistingCustomerMatch = {
  id: string;
  name: string;
  phone?: string | null;
  phone_norm?: string | null;
  tax_id?: string | null;
  legacy_codcli?: string | null;
  match: 'phone' | 'tax_id' | 'name';
};

function digitsLast9(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

function normTaxId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-.]/g, '');
}

/** Nombre comparable: minúsculas, sin tildes, solo [a-z0-9] y espacios. */
export function normalizeCustomerNameKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Busca ficha activa duplicada por teléfono, DNI o nombre exacto (match único). */
export async function findExistingCustomerDuplicate(
  companyId: string,
  opts: { name?: string; phone?: string; taxId?: string },
): Promise<ExistingCustomerMatch | null> {
  const phone9 = opts.phone ? digitsLast9(opts.phone) : null;
  if (phone9) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, phone_mobile, phone_home, phone_norm, tax_id, legacy_codcli')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .eq('phone_norm', phone9)
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        id: data.id,
        name: data.name,
        phone: data.phone ?? data.phone_mobile ?? data.phone_home,
        phone_norm: data.phone_norm,
        tax_id: data.tax_id,
        legacy_codcli: data.legacy_codcli,
        match: 'phone',
      };
    }
  }

  const tax = opts.taxId ? normTaxId(opts.taxId) : '';
  if (tax.length >= 5) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, phone_mobile, phone_home, phone_norm, tax_id, legacy_codcli')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .ilike('tax_id', `%${tax}%`)
      .limit(5);
    const exact = (data ?? []).filter(
      (r) => normTaxId(String(r.tax_id ?? '')) === tax,
    );
    if (exact.length === 1) {
      const row = exact[0]!;
      return {
        id: row.id,
        name: row.name,
        phone: row.phone ?? row.phone_mobile ?? row.phone_home,
        phone_norm: row.phone_norm,
        tax_id: row.tax_id,
        legacy_codcli: row.legacy_codcli,
        match: 'tax_id',
      };
    }
  }

  const name = (opts.name ?? '').trim();
  const nameKey = normalizeCustomerNameKey(name);
  if (nameKey.length >= 8) {
    // ilike exacto + barrido acotado por primera palabra para cubrir tildes distintas
    const first = nameKey.split(' ')[0] ?? '';
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, phone_mobile, phone_home, phone_norm, tax_id, legacy_codcli')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .ilike('name', first.length >= 3 ? `%${first}%` : name)
      .limit(40);
    const exact = (data ?? []).filter(
      (r) => normalizeCustomerNameKey(String(r.name ?? '')) === nameKey,
    );
    if (exact.length === 1) {
      const row = exact[0]!;
      return {
        id: row.id,
        name: row.name,
        phone: row.phone ?? row.phone_mobile ?? row.phone_home,
        phone_norm: row.phone_norm,
        tax_id: row.tax_id,
        legacy_codcli: row.legacy_codcli,
        match: 'name',
      };
    }
  }

  return null;
}
