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

function decodeLatin1CodeUnits(text: string): string {
  try {
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    return text;
  }
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
