import type { CustomerSearchRow } from '@/lib/customerSearch';
import type { AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import { isInbodyPlaceholderCustomerName } from '@/lib/inbodyMeasurements';
import { supabase } from '@/lib/supabase';
import type { AppointmentCustomerSummary } from '@/lib/appointmentCustomerSummary';
import { APPOINTMENT_CUSTOMER_SUMMARY_FIELDS } from '@/lib/appointmentCustomerSummary';

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

export function customerNameMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function pickBestLegacyCustomer(
  customers: CustomerSearchRow[],
  legacyCodcli: string,
): CustomerSearchRow | undefined {
  const matches = customers.filter((x) => legacyCodcliMatches(legacyCodcli, x.legacy_codcli ?? ''));
  if (!matches.length) return undefined;
  return matches.find((x) => !isInbodyPlaceholderCustomerName(x.name)) ?? matches[0];
}

function customerMatchesAppointment(
  customer: Pick<CustomerSearchRow, 'name' | 'legacy_codcli'>,
  clientName: string,
  legacyCodcli: string | null,
): boolean {
  if (isInbodyPlaceholderCustomerName(customer.name)) return false;
  const name = clientName.trim();
  if (name && customerNameMatches(customer.name, name)) return true;
  if (legacyCodcli && legacyCodcliMatches(legacyCodcli, customer.legacy_codcli ?? '')) return true;
  return !name && !legacyCodcli;
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

  if (legacyCodcli) {
    const byLegacy = pickBestLegacyCustomer(customers, legacyCodcli);
    if (byLegacy) return { kind: 'customer', customerId: byLegacy.id, displayName: byLegacy.name };
  }

  if (name) {
    const byName = customers.find(
      (x) => customerNameMatches(x.name, name) && !isInbodyPlaceholderCustomerName(x.name),
    );
    if (byName) return { kind: 'customer', customerId: byName.id, displayName: byName.name };
    return { kind: 'manual', name };
  }

  if (customerId) {
    const c = customers.find((x) => x.id === customerId);
    if (c && customerMatchesAppointment(c, name, legacyCodcli)) {
      return { kind: 'customer', customerId: c.id, displayName: c.name };
    }
  }

  return null;
}

export type AppointmentCustomerResolveInput = {
  clientName?: string | null;
  customerId?: string | null;
  legacyCodcli?: string | null;
};

/** Resolución fiable vía BD (no depende del catálogo en memoria de la agenda). */
export async function resolveAppointmentCustomerFromDb(
  companyId: string,
  input: AppointmentCustomerResolveInput,
): Promise<AppointmentCustomerSummary | null> {
  const clientName = String(input.clientName ?? '').trim();
  const legacyCodcli = String(input.legacyCodcli ?? '').trim() || null;
  const storedCustomerId = String(input.customerId ?? '').trim() || null;

  const fetchById = async (id: string): Promise<AppointmentCustomerSummary | null> => {
    const { data, error } = await supabase
      .from('customers')
      .select(APPOINTMENT_CUSTOMER_SUMMARY_FIELDS)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle();
    if (error) throw error;
    return (data as AppointmentCustomerSummary | null) ?? null;
  };

  if (legacyCodcli) {
    const id = await resolveCustomerIdByLegacyCodcli(companyId, legacyCodcli);
    if (id) {
      const byLegacy = await fetchById(id);
      if (byLegacy && !isInbodyPlaceholderCustomerName(byLegacy.name)) {
        return byLegacy;
      }
    }
  }

  if (clientName) {
    const { data, error } = await supabase
      .from('customers')
      .select(APPOINTMENT_CUSTOMER_SUMMARY_FIELDS)
      .eq('company_id', companyId)
      .is('archived_at', null)
      .ilike('name', clientName)
      .limit(8);
    if (error) throw error;
    const byName = (data ?? []).find(
      (row) =>
        customerNameMatches(String(row.name ?? ''), clientName) &&
        !isInbodyPlaceholderCustomerName(row.name),
    ) as AppointmentCustomerSummary | undefined;
    if (byName) return byName;
  }

  if (storedCustomerId) {
    const stored = await fetchById(storedCustomerId);
    if (stored && customerMatchesAppointment(stored, clientName, legacyCodcli)) {
      return stored;
    }
  }

  return null;
}

export function isWrongInbodyAppointmentLink(
  customer: Pick<AppointmentCustomerSummary, 'name'> | null | undefined,
  clientName: string,
  legacyCodcli: string | null | undefined,
): boolean {
  if (!customer?.name) return false;
  if (!isInbodyPlaceholderCustomerName(customer.name)) return false;
  const name = clientName.trim();
  if (name && !customerNameMatches(customer.name, name)) return true;
  if (legacyCodcli?.trim()) return true;
  return true;
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
  const nameByKey = new Map<string, string>();
  const chunkSize = 80;
  for (let i = 0; i < lookupList.length; i += chunkSize) {
    const chunk = lookupList.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('customers')
      .select('id, legacy_codcli, name')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .in('legacy_codcli', chunk);
    if (error) throw error;

    for (const row of data ?? []) {
      const rowCode = String(row.legacy_codcli ?? '').trim();
      if (!rowCode || !row.id) continue;
      const key = normLegacyCodcli(rowCode);
      const rowName = String(row.name ?? '').trim();
      const existingId = out.get(key);
      if (!existingId) {
        out.set(key, row.id as string);
        nameByKey.set(key, rowName);
        continue;
      }
      const existingName = nameByKey.get(key) ?? '';
      if (
        isInbodyPlaceholderCustomerName(existingName) &&
        !isInbodyPlaceholderCustomerName(rowName)
      ) {
        out.set(key, row.id as string);
        nameByKey.set(key, rowName);
      }
    }
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
