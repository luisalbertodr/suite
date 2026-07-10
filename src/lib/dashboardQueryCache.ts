/** Caché local del dashboard: muestra datos previos al instante y actualiza en background. */
const STORAGE_PREFIX = 'suite-dashboard-cache-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry<T> = {
  savedAt: number;
  data: T;
};

function cacheStorageKey(queryKey: readonly unknown[]): string {
  return `${STORAGE_PREFIX}:${JSON.stringify(queryKey)}`;
}

export function readDashboardQueryCache<T>(queryKey: readonly unknown[]): T | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(cacheStorageKey(queryKey));
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry?.savedAt || Date.now() - entry.savedAt > MAX_AGE_MS) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
}

export function readDashboardQueryCacheUpdatedAt(queryKey: readonly unknown[]): number | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(cacheStorageKey(queryKey));
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    if (!entry?.savedAt || Date.now() - entry.savedAt > MAX_AGE_MS) return undefined;
    return entry.savedAt;
  } catch {
    return undefined;
  }
}

export function writeDashboardQueryCache<T>(queryKey: readonly unknown[], data: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { savedAt: Date.now(), data };
    localStorage.setItem(cacheStorageKey(queryKey), JSON.stringify(entry));
  } catch {
    // QuotaExceeded: ignorar.
  }
}

export function dashboardQueryCacheOptions<T>(queryKey: readonly unknown[]) {
  const cached = readDashboardQueryCache<T>(queryKey);
  if (cached === undefined) return {};
  return {
    initialData: cached,
    initialDataUpdatedAt: readDashboardQueryCacheUpdatedAt(queryKey),
  };
}
