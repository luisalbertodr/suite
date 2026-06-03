const HEIC_EXT = /\.hei[cf](\?|$)/i;

async function heic2anyConvert(blob: Blob, quality: number): Promise<Blob> {
  const mod = await import('heic2any');
  const heic2any = mod.default;
  const result = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality,
  });
  const out = Array.isArray(result) ? result[0] : result;
  if (!out) throw new Error('No se pudo convertir la imagen HEIC');
  return out;
}

export function isHeicLike(mime?: string | null, fileName?: string | null, url?: string | null): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/heic' || m === 'image/heif') return true;
  const name = fileName ?? '';
  if (HEIC_EXT.test(name)) return true;
  const u = url ?? '';
  return HEIC_EXT.test(u);
}

export async function convertHeicBlobToJpeg(blob: Blob, quality = 0.85): Promise<Blob> {
  return heic2anyConvert(blob, quality);
}

/** Sustituye extensión .heic/.heif por .jpg para almacenamiento compatible con el navegador. */
export function heicFileNameToJpeg(fileName: string): string {
  if (/\.hei[cf]$/i.test(fileName)) {
    return fileName.replace(/\.hei[cf]$/i, '.jpg');
  }
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.jpg`;
}

export async function prepareImageBlobForUpload(
  blob: Blob,
  fileName: string,
  mimeType?: string,
): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  const mime = (mimeType ?? blob.type ?? '').trim();
  if (!isHeicLike(mime, fileName)) {
    return { blob, fileName, mimeType: mime || blob.type || 'application/octet-stream' };
  }
  const jpeg = await convertHeicBlobToJpeg(blob);
  return {
    blob: jpeg,
    fileName: heicFileNameToJpeg(fileName),
    mimeType: 'image/jpeg',
  };
}

export async function heicUrlToObjectUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const blob = await res.blob();
  const jpeg = await convertHeicBlobToJpeg(blob);
  return URL.createObjectURL(jpeg);
}
