/** Cache en memoria de blobs/object URLs de media WhatsApp (evita re-descargas al scroll). */
const blobPromises = new Map<string, Promise<Blob>>();
const objectUrls = new Map<string, string>();
/** Media que ya devolvió 410 / no disponible en OpenWA (no reintentar en la sesión). */
const unavailableKeys = new Set<string>();

/** Máximo de descargas simultáneas al proxy (evita 502 por saturación/timeouts). */
const MAX_CONCURRENT_DOWNLOADS = 1;
let activeDownloads = 0;
const downloadWaiters: Array<() => void> = [];

function acquireDownloadSlot(): Promise<void> {
  if (activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
    activeDownloads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    downloadWaiters.push(() => {
      activeDownloads += 1;
      resolve();
    });
  });
}

function releaseDownloadSlot(): void {
  activeDownloads = Math.max(0, activeDownloads - 1);
  const next = downloadWaiters.shift();
  next?.();
}

export function whatsappMediaCacheKey(chatId: string, messageId: string): string {
  return `${chatId}:${messageId}`;
}

export function getCachedWhatsappMediaUrl(key: string): string | null {
  return objectUrls.get(key) ?? null;
}

export function isWhatsappMediaUnavailable(key: string | null | undefined): boolean {
  return !!key && unavailableKeys.has(key);
}

export function markWhatsappMediaUnavailable(key: string): void {
  unavailableKeys.add(key);
  blobPromises.delete(key);
}

export async function loadWhatsappMediaCached(
  key: string,
  loader: () => Promise<Blob>,
): Promise<string> {
  if (unavailableKeys.has(key)) {
    throw new Error('Media no disponible');
  }

  const cachedUrl = objectUrls.get(key);
  if (cachedUrl) return cachedUrl;

  let pending = blobPromises.get(key);
  if (!pending) {
    pending = (async () => {
      await acquireDownloadSlot();
      try {
        return await loader();
      } finally {
        releaseDownloadSlot();
      }
    })();
    blobPromises.set(key, pending);
  }

  try {
    const blob = await pending;
    let url = objectUrls.get(key);
    if (!url) {
      url = URL.createObjectURL(blob);
      objectUrls.set(key, url);
    }
    return url;
  } catch (e) {
    blobPromises.delete(key);
    const msg = e instanceof Error ? e.message : '';
    if (/expirad|410|gone|no disponible|no devolvió|not found/i.test(msg)) {
      unavailableKeys.add(key);
    }
    throw e;
  }
}

export function invalidateWhatsappMediaCache(key: string): void {
  unavailableKeys.delete(key);
  blobPromises.delete(key);
  const url = objectUrls.get(key);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(key);
}
