export type MetaFieldDatum = { name: string; values?: string[] };

function normalizeFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/_/g, ' ');
}

function humanizeFieldValue(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstFieldValue(fields: MetaFieldDatum[], matcher: (name: string) => boolean): string {
  for (const field of fields) {
    if (!matcher(normalizeFieldKey(field.name))) continue;
    const value = field.values?.[0];
    if (value?.trim()) return humanizeFieldValue(value);
  }
  return '';
}

function isExcludedRespuestaZonaField(name: string): boolean {
  return (
    name.includes('buscando') ||
    name.includes('reducir') ||
    name.includes('grasa') ||
    name.includes('tonificar') ||
    name.includes('rejuvenecer') ||
    name.includes('coruna') ||
    name.includes('costo') ||
    name.includes('promocional') ||
    name.includes('listo') ||
    name.includes('reservar') ||
    name.includes('agendar') ||
    name.includes('venir') ||
    name.includes('ubicado') ||
    name.includes('sesion') ||
    name.includes('oferta')
  );
}

/** Pregunta Meta que pide la zona/área a tratar (no sí/no genéricos del funnel). */
function isRespuestaZonaQuestionField(name: string): boolean {
  if (isExcludedRespuestaZonaField(name)) return false;
  if (name.includes('remodelar')) return true;
  if (name.includes('zona')) return true;
  if (name.includes('area') && (name.includes('tratar') || name.includes('cuerpo') || name.includes('rostro'))) {
    return true;
  }
  if (name.includes('rostro') || name.includes('facial')) return true;
  if (name.includes('tratar') && (name.includes('area') || name.includes('rostro'))) return true;
  return false;
}

/** Zona corporal o facial desde field_data del formulario Meta. */
export function extractRespuestaZona(fieldData: unknown): string {
  const fields = Array.isArray(fieldData) ? (fieldData as MetaFieldDatum[]) : [];
  const zona = firstFieldValue(fields, isRespuestaZonaQuestionField);
  if (zona) return zona;

  for (const field of fields) {
    const value = field.values?.[0];
    if (!value?.trim()) continue;
    const name = normalizeFieldKey(field.name);
    if (isExcludedRespuestaZonaField(name)) continue;
    return humanizeFieldValue(value);
  }
  return '';
}

function formatSpanishProposalDay(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function madridWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
  }).format(date);
}

/** Próximos días laborables (sin domingo) para {propuesta_dia_1} y {propuesta_dia_2}. */
export function buildPropuestaDias(count = 2, from = new Date()): string[] {
  const out: string[] = [];
  const cursor = new Date(from);
  while (out.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (madridWeekdayShort(cursor) === 'Sun') continue;
    out.push(formatSpanishProposalDay(cursor));
  }
  return out;
}

export function buildMarketingFieldTemplateVars(fieldData: unknown): Record<string, string> {
  const respuestaZona = extractRespuestaZona(fieldData);
  const dias = buildPropuestaDias(2);
  return {
    respuesta_zona: respuestaZona,
    propuesta_dia_1: dias[0] ?? '',
    propuesta_dia_2: dias[1] ?? '',
  };
}
