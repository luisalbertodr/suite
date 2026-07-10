import { normLegacyCodcli } from '@/lib/appointmentCustomerResolve';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';

const CHUNK = 100;

export type DunasoftFacturadoChargeRow = {
  customer_id: string;
  charged_on: string;
};

export type MarketingCustomerChargeMeta = {
  id: string;
  phone?: string | null;
  phone_mobile?: string | null;
  phone_home?: string | null;
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

const codcliVariants = (code: string | null | undefined): string[] => {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return [];
  const norm = normLegacyCodcli(trimmed);
  const out = new Set<string>([trimmed, norm, trimmed.padStart(6, '0'), norm.padStart(6, '0')]);
  return [...out].filter(Boolean);
};

const resolveCustomerFromPhone = (
  tel: string | null | undefined,
  phoneToCustomer: Map<string, string>,
): string | null => {
  for (const variant of phoneVariants(tel)) {
    const hit = phoneToCustomer.get(variant);
    if (hit) return hit;
  }
  return null;
};

/** Citas cobradas en agenda Dunasoft/Style (plan2009.facturado). */
export async function fetchDunasoftFacturadoCharges(
  customers: MarketingCustomerChargeMeta[],
): Promise<DunasoftFacturadoChargeRow[]> {
  if (!customers.length) return [];

  const codcliToCustomer = new Map<string, string>();
  const phoneToCustomer = new Map<string, string>();

  for (const customer of customers) {
    for (const variant of codcliVariants(customer.legacy_codcli)) {
      codcliToCustomer.set(variant, customer.id);
    }
    for (const ph of [customer.phone, customer.phone_mobile, customer.phone_home]) {
      for (const variant of phoneVariants(ph)) {
        phoneToCustomer.set(variant, customer.id);
      }
    }
  }

  const charges: DunasoftFacturadoChargeRow[] = [];
  const seen = new Set<string>();

  const pushCharge = (customerId: string, fecha: string) => {
    const chargedOn = fecha.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chargedOn)) return;
    const key = `${customerId}|${chargedOn}`;
    if (seen.has(key)) return;
    seen.add(key);
    charges.push({ customer_id: customerId, charged_on: chargedOn });
  };

  const ingestRows = (
    rows: Array<{ codcli?: string | null; tel1cli?: string | null; fecha?: string | null }>,
  ) => {
    for (const row of rows) {
      const fecha = String(row.fecha ?? '').trim();
      if (!fecha) continue;
      const codcli = String(row.codcli ?? '').trim();
      const customerId =
        (codcli ? codcliToCustomer.get(codcli) : null) ??
        (codcli ? codcliToCustomer.get(normLegacyCodcli(codcli)) : null) ??
        (codcli ? codcliToCustomer.get(codcli.padStart(6, '0')) : null) ??
        resolveCustomerFromPhone(row.tel1cli, phoneToCustomer);
      if (customerId) pushCharge(customerId, fecha);
    }
  };

  const codclis = [...codcliToCustomer.keys()];
  for (let i = 0; i < codclis.length; i += CHUNK) {
    const chunk = codclis.slice(i, i + CHUNK);
    const res = await dunasoftSupabase
      .from('plan2009')
      .select('codcli, tel1cli, fecha')
      .eq('facturado', true)
      .in('codcli', chunk);
    if (res.error) throw res.error;
    ingestRows(res.data ?? []);
  }

  const phoneKeys = [...new Set([...phoneToCustomer.keys()].filter((p) => p.length >= 9))];
  for (let i = 0; i < phoneKeys.length; i += CHUNK) {
    const chunk = phoneKeys.slice(i, i + CHUNK);
    const res = await dunasoftSupabase
      .from('plan2009')
      .select('codcli, tel1cli, fecha')
      .eq('facturado', true)
      .in('tel1cli', chunk);
    if (res.error) throw res.error;
    ingestRows(res.data ?? []);
  }

  return charges;
}

export const hasDunasoftFacturadoSince = (
  charges: DunasoftFacturadoChargeRow[],
  customerId: string,
  sinceDate: string,
): boolean =>
  charges.some((c) => c.customer_id === customerId && c.charged_on >= sinceDate);
