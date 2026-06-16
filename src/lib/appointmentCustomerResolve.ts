import type { CustomerSearchRow } from '@/lib/customerSearch';
import type { AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import { supabase } from '@/lib/supabase';

export function normLegacyCodcli(value: string): string {
  const s = value.trim();
  if (!s) return '';
  return s.replace(/^0+/, '') || '0';
}

export function legacyCodcliMatches(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return normLegacyCodcli(x) === normLegacyCodcli(y);
}

export function resolveAppointmentClientPick(
  clientName: string,
  customers: CustomerSearchRow[],
  opts?: {
    customerId?: string | null;
    legacyCodcli?: string | null;
  },
): AppointmentClientPick | null {
  const name = clientName.trim();
  const customerId = opts?.customerId?.trim() || null;
  const legacyCodcli = opts?.legacyCodcli?.trim() || null;

  if (customerId) {
    const c = customers.find((x) => x.id === customerId);
    if (c) return { kind: 'customer', customerId: c.id, displayName: c.name };
    if (name) return { kind: 'customer', customerId, displayName: name };
  }

  if (legacyCodcli) {
    const byLegacy = customers.find((x) => legacyCodcliMatches(legacyCodcli, x.legacy_codcli ?? ''));
    if (byLegacy) return { kind: 'customer', customerId: byLegacy.id, displayName: byLegacy.name };
  }

  if (name) {
    const byName = customers.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
    if (byName) return { kind: 'customer', customerId: byName.id, displayName: byName.name };
    return { kind: 'manual', name };
  }

  return null;
}

/** Resuelve UUID de cliente Suite a partir de códigos legacy Style (codcli). */
export async function resolveCustomerIdsByLegacyCodcli(
  companyId: string,
  legacyCodes: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(legacyCodes.map((c) => c.trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  const { data, error } = await supabase
    .from('customers')
    .select('id, legacy_codcli')
    .eq('company_id', companyId)
    .not('legacy_codcli', 'is', null);
  if (error) throw error;

  const out = new Map<string, string>();
  for (const code of unique) {
    const match = (data ?? []).find((row) =>
      legacyCodcliMatches(code, String(row.legacy_codcli ?? '')),
    );
    if (match?.id) out.set(normLegacyCodcli(code), match.id as string);
  }
  return out;
}

export async function resolveCustomerIdByLegacyCodcli(
  companyId: string,
  legacyCodcli: string | null | undefined,
): Promise<string | null> {
  const code = String(legacyCodcli ?? '').trim();
  if (!code) return null;
  const map = await resolveCustomerIdsByLegacyCodcli(companyId, [code]);
  return map.get(normLegacyCodcli(code)) ?? null;
}
