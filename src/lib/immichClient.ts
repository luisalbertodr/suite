import { format, parseISO, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';

export type ImmichAsset = {
  id: string;
  type?: string;
  originalFileName?: string;
  originalMimeType?: string;
  fileCreatedAt?: string;
  localDateTime?: string;
  width?: number;
  height?: number;
};

export type ImmichProxyAction =
  | { action: 'ping' }
  | { action: 'search.by_date'; date: string; size?: number; page?: number }
  | {
      action: 'search.metadata';
      album_ids?: string[];
      description?: string;
      taken_after?: string;
      taken_before?: string;
      size?: number;
      page?: number;
    }
  | { action: 'asset.thumbnail'; asset_id: string; size?: 'preview' | 'thumbnail' }
  | { action: 'asset.download'; asset_id: string };

async function immichEndpoint(): Promise<string> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  if (!baseUrl) throw new Error('Falta VITE_SUPABASE_URL');
  return `${baseUrl.replace(/\/+$/, '')}/functions/v1/immich-proxy`;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  };
}

export async function invokeImmichProxy<T>(payload: ImmichProxyAction): Promise<T> {
  const res = await fetch(await immichEndpoint(), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return body;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res as unknown as T;
}

export async function invokeImmichProxyBinary(
  payload: ImmichProxyAction,
): Promise<{ blob: Blob; fileName?: string; contentType?: string }> {
  const res = await fetch(await immichEndpoint(), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  const responseType = res.headers.get('content-type') ?? '';
  if (responseType.includes('application/json')) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const fileName = res.headers.get('X-Immich-Filename') ?? undefined;
  const assetMime = res.headers.get('X-Immich-Content-Type') ?? undefined;
  return { blob: await res.blob(), fileName, contentType: assetMime };
}

export async function immichPing(): Promise<boolean> {
  await invokeImmichProxy<{ ok: boolean }>({ action: 'ping' });
  return true;
}

/** Fotos del día (yyyy-MM-dd). Por defecto usar hoy. */
export async function searchImmichAssetsByDate(
  dateYmd: string,
  options?: { size?: number; page?: number },
): Promise<{ assets: ImmichAsset[]; total: number }> {
  const data = await invokeImmichProxy<{ assets: ImmichAsset[]; total: number }>({
    action: 'search.by_date',
    date: dateYmd,
    size: options?.size ?? 250,
    page: options?.page ?? 1,
  });
  const assets = (data.assets ?? []).filter((a) => {
    const t = (a.type ?? '').toUpperCase();
    return !t || t === 'IMAGE' || t === 'VIDEO';
  });
  return { assets, total: data.total ?? assets.length };
}

export function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function previousYmd(ymd: string): string {
  return format(subDays(parseISO(`${ymd}T12:00:00`), 1), 'yyyy-MM-dd');
}

const IMMICH_LATEST_DAY_MAX_LOOKBACK = 120;

/** Retrocede día a día desde startYmd hasta encontrar assets o agotar el límite. */
export async function findLatestImmichDayWithAssets(
  startYmd: string,
  maxLookback = IMMICH_LATEST_DAY_MAX_LOOKBACK,
): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return todayYmd();
  let cursor = startYmd;
  for (let i = 0; i < maxLookback; i += 1) {
    const { assets } = await searchImmichAssetsByDate(cursor);
    if (assets.length > 0) return cursor;
    cursor = previousYmd(cursor);
  }
  return startYmd;
}

/**
 * Día inicial del buscador: si hintYmd tiene fotos, ese día; si no, el más reciente con fotos (desde hoy).
 */
export async function resolveImmichBrowseStartDate(hintYmd?: string): Promise<string> {
  const today = todayYmd();
  if (hintYmd && /^\d{4}-\d{2}-\d{2}$/.test(hintYmd) && hintYmd <= today) {
    const { assets } = await searchImmichAssetsByDate(hintYmd);
    if (assets.length > 0) return hintYmd;
  }
  return findLatestImmichDayWithAssets(today);
}

export async function fetchImmichThumbnail(assetId: string): Promise<string> {
  const { blob } = await invokeImmichProxyBinary({
    action: 'asset.thumbnail',
    asset_id: assetId,
    size: 'preview',
  });
  return URL.createObjectURL(blob);
}

export async function downloadImmichAsset(
  assetId: string,
): Promise<{ blob: Blob; fileName: string; mimeType?: string }> {
  const { blob, fileName, contentType } = await invokeImmichProxyBinary({
    action: 'asset.download',
    asset_id: assetId,
  });
  const name = fileName?.trim() || `immich-${assetId}.jpg`;
  return { blob, fileName: name, mimeType: contentType };
}

export function isImmichVideoAsset(asset: ImmichAsset): boolean {
  return (asset.type ?? '').toUpperCase() === 'VIDEO';
}
