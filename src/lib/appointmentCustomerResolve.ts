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

/** Variantes tipicas Style/Suite (con y sin ceros a la izquierda, pad 6). */
export function legacyCodcliLookupVariants(code: string): string[] {
  const raw = code.trim();
  if (!raw) return [];
  const norm = normLegacyCodcli(raw);
  const variants = new Set<string>([raw, norm]);
  if (/^\d+$/.test(norm)) {
    variants.add(norm.padStart(6, '0'));
    if (norm.length < 8) variants.add(norm.padStart(8, '0'));
  }
  return [...variants];
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

/**
 * Resuelve UUID de cliente Suite a partir de códigos legacy Style (codcli).
 * Solo consulta los códigos pedidos (variantes pad), no toda la empresa.
 */
export async function resolveCustomerIdsByLegacyCodcli(
  companyId: string,
  legacyCodes: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(legacyCodes.map((c) => c.trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  const lookup = new Set<string>();
  for (const code of unique) {
    for (const v of legacyCodcliLookupVariants(code)) lookup.add(v);
  }
  const lookupList = [...lookup];
  if (!lookupList.length) return new Map();

  const out = new Map<string, string>();
  const chunkSize = 80;
  for (let i = 0; i < lookupList.length; i += chunkSize) {
    const chunk = lookupList.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('customers')
      .select('id, legacy_codcli')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .in('legacy_codcli', chunk);
    if (error) throw error;

    for (const row of data ?? []) {
      const rowCode = String(row.legacy_codcli ?? '').trim();
      if (!rowCode || !row.id) continue;
      const key = normLegacyCodcli(rowCode);
      if (!out.has(key)) out.set(key, row.id as string);
    }
  }

  // Asegurar claves pedidas aunque el match fuera por variante pad
  for (const code of unique) {
    const key = normLegacyCodcli(code);
    if (out.has(key)) continue;
    // Ya cubierto por el bucle anterior si hubo match
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

export const CUSTOMER_CODCLI_MAP_QUERY_KEY = 'customer-codcli-map' as const;
