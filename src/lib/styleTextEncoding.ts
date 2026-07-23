/**
 * Repara texto importado de DBF Style (Windows-1252 / Latin-1) mal interpretado como ASCII/UTF-8.
 */
const MOJIBAKE_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ãº', 'ú'],
  ['Ã±', 'ñ'],
  ['Ã\x81', 'Á'],
  ['Ã‰', 'É'],
  ['Ã\x8d', 'Í'],
  ['Ã\x93', 'Ó'],
  ['Ã\x9a', 'Ú'],
  ['Ã\x91', 'Ñ'],
  ['Ã¼', 'ü'],
  ['Ã\x9c', 'Ü'],
  ['Â¿', '¿'],
  ['Â¡', '¡'],
];

/** Topónimos / patrones donde Style sustituyó Ñ por Q/C (p. ej. CORUQA, EspaC1a). */
const Q_FOR_N_LITERALS: ReadonlyArray<[RegExp, string]> = [
  [/\bCORUQA\b/g, 'CORUÑA'],
  [/\bCoruqa\b/g, 'Coruña'],
  [/\bcoruqa\b/g, 'coruña'],
  [/\bCORUCA\b/g, 'CORUÑA'],
  [/\bCoruca\b/g, 'Coruña'],
  [/\bcoruca\b/g, 'coruña'],
  [/\bLA CORUQA\b/g, 'LA CORUÑA'],
  [/\bLa Coruqa\b/g, 'La Coruña'],
  [/\bLA CORUCA\b/g, 'LA CORUÑA'],
  [/\bLa Coruca\b/g, 'La Coruña'],
  [/\bRACAS\b/g, 'RAÑAS'],
  [/\bRacas\b/g, 'Rañas'],
  [/\bracas\b/g, 'rañas'],
  [/EspaC1a/gi, 'España'],
  [/ESPAC1A/g, 'ESPAÑA'],
];

function decodeLatin1CodeUnits(text: string): string {
  try {
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    return text;
  }
}

function repairStyleEnieAsQ(text: string): string {
  let out = text;
  for (const [re, good] of Q_FOR_N_LITERALS) {
    out = out.replace(re, good);
  }
  return out;
}

export function repairStyleText(value: string | null | undefined): string {
  if (value == null) return '';
  let text = String(value).replace(/\0/g, '').trim();
  if (!text) return '';

  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    if (text.includes(bad)) text = text.split(bad).join(good);
  }

  if (/[\u0080-\u00ff]/.test(text)) {
    text = decodeLatin1CodeUnits(text);
  }

  text = repairStyleEnieAsQ(text);

  return text;
}

export function normalizeAgendaAppointmentTextRow<
  T extends { client_name?: string | null; description?: string | null; title?: string | null },
>(row: T): T {
  return {
    ...row,
    client_name: row.client_name != null ? repairStyleText(row.client_name) : row.client_name,
    description: row.description != null ? repairStyleText(row.description) : row.description,
    title: row.title != null ? repairStyleText(row.title) : row.title,
  };
}
