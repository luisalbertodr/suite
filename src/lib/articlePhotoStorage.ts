/** Ruta estable en bucket article-photos: {companyId}/{codart}.{ext} */
export function articlePhotoStoragePath(
  companyId: string,
  codart: string,
  fileExt: string,
): string {
  const safeCodart = codart.replace(/[^A-Za-z0-9_-]/g, '_');
  const ext = fileExt.startsWith('.') ? fileExt : `.${fileExt}`;
  return `${companyId}/${safeCodart}${ext}`;
}

export function legacyPhotoBasename(filename: string): string {
  return filename.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? filename;
}
