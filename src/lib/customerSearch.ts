/**
 * Búsqueda unificada de clientes: nombre/apellidos (varias palabras = todas deben aparecer),
 * DNI (tax_id), teléfono y email.
 */

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

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function compactTaxId(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s/g, '');
}

/** Texto normalizado donde buscar (minúsculas, incluye teléfono solo dígitos). */
export function customerSearchHaystack(c: CustomerSearchRow): string {
  const name = (c.name || '').toLowerCase();
  const email = (c.email || '').toLowerCase();
  const tax = compactTaxId(c.tax_id);
  const ph = [c.phone, c.phone_home, c.phone_mobile].filter(Boolean).join(' ');
  const phoneRaw = ph.toLowerCase();
  const phoneDig = digitsOnly(ph);
  return [name, email, tax, phoneRaw, phoneDig].filter(Boolean).join(' ');
}

/**
 * Cada palabra del texto debe aparecer en el conjunto nombre + email + DNI + teléfono.
 * Los tokens solo numéricos también se comparan con el teléfono sin separadores.
 */
export function customerMatchesSearch(c: CustomerSearchRow, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
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
