/**
 * Búsqueda unificada de clientes: nombre/apellidos (varias palabras = todas deben aparecer),
 * DNI (tax_id), teléfono y email.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { repairStyleText } from '@/lib/styleTextEncoding';
export type CustomerSearchRow = {
  id: string;
  name: string;
  email?: string | null;
  tax_id?: string | null;
  phone?: string | null;
  phone_home?: string | null;
  phone_mobile?: string | null;
  legacy_codcli?: string | null;
};

/** Escapa comodines para filtros ilike de PostgREST. */
export function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchTokens(rawQuery: string): string[] {
  return normalizeSearchText(rawQuery)
    .replace(/%/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

const CUSTOMER_ILIKE_FIELDS = [
  'name',
  'email',
  'tax_id',
  'phone',
  'phone_mobile',
  'phone_home',
  'legacy_codcli',
] as const;

/** PostgREST `.or()` sobre campos de cliente (tabla `customers`, sin prefijo). */
export function buildCustomerIlikeOrFilter(rawQuery: string): string | null {
  const tokens = searchTokens(rawQuery);
  if (tokens.length === 0) return null;
  const tokenFilter = (token: string) => {
    const pattern = `%${escapeIlike(token)}%`;
    return `or(${CUSTOMER_ILIKE_FIELDS.map((f) => `${f}.ilike.${pattern}`).join(',')})`;
  };
  if (tokens.length === 1) {
    const pattern = `%${escapeIlike(tokens[0]!)}%`;
    return CUSTOMER_ILIKE_FIELDS.map((f) => `${f}.ilike.${pattern}`).join(',');
  }
  return `and(${tokens.map(tokenFilter).join(',')})`;
}

/** PostgREST `.or()` para facturas: número y/o IDs de cliente (máx. para no alargar la URL). */
export function buildInvoiceSearchOrFilter(rawQuery: string, customerIds: string[]): string | null {
  const q = rawQuery.trim().replace(/%/g, '');
  if (!q) return null;
  const pattern = `%${escapeIlike(q)}%`;
  const cappedIds = customerIds.slice(0, 100);
  if (cappedIds.length > 0) {
    return `number.ilike.${pattern},customer_id.in.(${cappedIds.join(',')})`;
  }
  return `number.ilike.${pattern}`;
}

/**
 * Busca IDs de cliente vía RPC (PostgREST devuelve 500 con ilike directo sobre customers + RLS).
 */
export async function searchCustomerIdsByIlike(
  supabase: SupabaseClient,
  companyId: string,
  rawQuery: string,
  options?: { limit?: number; minChars?: number },
): Promise<string[]> {
  const q = rawQuery.trim().replace(/%/g, '');
  const minChars = options?.minChars ?? 2;
  if (!q || q.length < minChars) return [];

  const { data, error } = await supabase.rpc('search_customer_ids', {
    p_catalog_company_id: companyId,
    p_query: q,
    p_limit: options?.limit ?? 100,
  });

  if (error) throw error;
  return (data ?? []) as string[];
}

/** Listado del catálogo de clientes (RPC; evita 500 en GET /customers). */
export async function fetchCatalogCustomers(
  supabase: SupabaseClient,
  companyId: string,
  options?: { limit?: number; offset?: number },
): Promise<CustomerSearchRow[]> {
  const { data, error } = await supabase.rpc('list_catalog_customers', {
    p_catalog_company_id: companyId,
    p_limit: options?.limit ?? 5000,
    p_offset: options?.offset ?? 0,
  });
  if (error) throw error;
  return ((data ?? []) as CustomerSearchRow[]).map((row) => ({
    ...row,
    name: repairStyleText(row.name),
  }));
}

/** Conteo de clientes del catálogo. */
export async function countCatalogCustomers(
  supabase: SupabaseClient,
  companyId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('count_catalog_customers', {
    p_catalog_company_id: companyId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function compactTaxId(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s/g, '');
}

/** Texto normalizado donde buscar (minúsculas, incluye teléfono solo dígitos). */
export function customerSearchHaystack(c: CustomerSearchRow): string {
  const name = normalizeSearchText(c.name || '');
  const email = normalizeSearchText(c.email || '');
  const tax = compactTaxId(c.tax_id);
  const ph = [c.phone, c.phone_home, c.phone_mobile].filter(Boolean).join(' ');
  const phoneRaw = normalizeSearchText(ph);
  const phoneDig = digitsOnly(ph);
  return [name, email, tax, phoneRaw, phoneDig].filter(Boolean).join(' ');
}

/**
 * Cada palabra del texto debe aparecer en el conjunto nombre + email + DNI + teléfono.
 * Los tokens solo numéricos también se comparan con el teléfono sin separadores.
 */
export function customerMatchesSearch(c: CustomerSearchRow, rawQuery: string): boolean {
  const tokens = searchTokens(rawQuery);
  if (tokens.length === 0) return true;

  const haystack = customerSearchHaystack(c);
  const phoneDigits = digitsOnly([c.phone, c.phone_home, c.phone_mobile].filter(Boolean).join(' '));
  const taxCompact = compactTaxId(c.tax_id);

  return tokens.every((t) => {
    const tNoSpace = t.replace(/\s/g, '');
    if (haystack.includes(t)) return true;
    if (taxCompact.includes(tNoSpace)) return true;
    if (/^\d+$/.test(tNoSpace) && phoneDigits.includes(tNoSpace)) return true;
    return false;
  });
}

export function filterCustomersBySearch<T extends CustomerSearchRow>(list: T[], rawQuery: string): T[] {
  const q = rawQuery.trim();
  if (!q) return list;
  return list.filter((c) => customerMatchesSearch(c, q));
}

/** Mínimo de letras o dígitos antes de lanzar búsqueda en servidor. */
export const CUSTOMER_SEARCH_MIN_CHARS = 3;

export function isCustomerSearchQueryReady(raw: string): boolean {
  const q = raw.trim();
  if (!q) return false;
  const letters = (q.match(/[\p{L}]/gu) || []).length;
  const digits = (q.match(/\d/g) || []).length;
  return letters >= CUSTOMER_SEARCH_MIN_CHARS || digits >= CUSTOMER_SEARCH_MIN_CHARS;
}
