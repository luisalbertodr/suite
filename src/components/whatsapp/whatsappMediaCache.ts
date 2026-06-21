/** Cache en memoria de blobs/object URLs de media WhatsApp (evita re-descargas al scroll). */
const blobPromises = new Map<string, Promise<Blob>>();
const objectUrls = new Map<string, string>();

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

export async function loadWhatsappMediaCached(
  key: string,
  loader: () => Promise<Blob>,
): Promise<string> {
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
    throw e;
  }
}

export function invalidateWhatsappMediaCache(key: string): void {
  blobPromises.delete(key);
  const url = objectUrls.get(key);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(key);
}
