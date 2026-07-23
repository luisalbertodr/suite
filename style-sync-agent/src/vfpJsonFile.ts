import fs from "node:fs";

/**
 * VFP FILETOSTR lee el JSON inbound como ANSI/Windows-1252.
 * Si el fichero es UTF-8, bytes como C3 B1 (ñ) se interpretan como Ã± y
 * acaban escritos así en el DBF. Escribimos el JSON en latin1/cp1252-compatible
 * para que ñ/á/é… lleguen como un solo byte (F1, E1, …).
 */
export function encodeJsonForVfp(value: unknown, space: number = 2): Buffer {
  const text = JSON.stringify(value, null, space);
  const bytes = Buffer.allocUnsafe(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i] = code <= 0xff ? code : 0x3f; // '?' fuera de latin1
  }
  return bytes;
}

export function writeVfpJsonFile(filePath: string, value: unknown, space: number = 2): void {
  fs.writeFileSync(filePath, encodeJsonForVfp(value, space));
}
