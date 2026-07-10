import { supabase } from '@/lib/supabase';

export const DASHBOARD_BILLING_CACHE_MAX_ENTRIES = 300;

export async function readDashboardBillingCache<T>(cacheKey: string): Promise<T | null> {
  const { data, error } = await supabase.rpc('dashboard_billing_cache_get', {
    p_cache_key: cacheKey,
  });

  if (error) {
    if (error.code === '42883' || error.code === '42P01') return null;
    console.warn('dashboard_billing_cache_get:', error.message);
    return null;
  }

  return (data as T | null) ?? null;
}

export async function writeDashboardBillingCache(
  cacheKey: string,
  companyId: string,
  payload: unknown,
): Promise<void> {
  const { error } = await supabase.rpc('dashboard_billing_cache_set', {
    p_cache_key: cacheKey,
    p_company_id: companyId,
    p_payload: payload,
    p_max_entries: DASHBOARD_BILLING_CACHE_MAX_ENTRIES,
  });

  if (error && error.code !== '42883' && error.code !== '42P01') {
    console.warn('dashboard_billing_cache_set:', error.message);
  }
}

export async function withDashboardBillingCache<T>(
  cacheKey: string,
  companyId: string,
  compute: () => Promise<T>,
  opts?: { skipCache?: boolean },
): Promise<T> {
  if (!opts?.skipCache) {
    const cached = await readDashboardBillingCache<T>(cacheKey);
    if (cached !== null) return cached;
  }

  const result = await compute();
  void writeDashboardBillingCache(cacheKey, companyId, result);
  return result;
}

export function familiesCacheKey(families: string[] | null | undefined): string {
  if (!families?.length) return 'all';
  return [...families].sort((a, b) => a.localeCompare(b, 'es')).join('\u001f');
}
