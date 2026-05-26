/**
 * Detección y extracción de citas/reservas en leads de Meta (field_data).
 * Mantener alineada la lógica con supabase/functions/meta-sync-leads/index.ts
 */

export type MetaFieldEntry = { name: string; values: string[] };

const EXCLUDE_SUBSTRINGS = [
  'sin_cita',
  'sin_agendar',
  'no_agendar',
  'no_quiero',
  'no_desear',
];

/** Evitar confundir cumpleaños / datos demográficos con una cita. */
const EXCLUDE_DEMOGRAPHIC_SUBSTRINGS = [
  'nacimiento',
  'birth',
  'cumple',
  'fecha_de_nacimiento',
  'edad',
  'años',
  'anos',
  'how_old',
  'date_of_birth',
  'dob',
];

/** Fragmentos que Meta o formularios suelen usar para fecha/hora de visita real (evitar "cita" suelto → capacitación, etc.) */
const APPOINTMENT_KEY_FRAGMENTS = [
  'appointment_request',
  'appointment',
  'select_a_date_and_time',
  'select_a_time',
  'preferred_appointment',
  'preferred_day',
  'when_would_you_like_to_book',
  'when_would_you_like_to_come_in',
  'fecha_de_la_cita',
  'fecha_cita',
  'fecha_y_hora',
  'dia_y_hora',
  'dia_de_la_cita',
  'hora_de_la_cita',
  'solicitar_cita',
  'pedir_cita',
  'agendar_visita',
  'agendar_cita',
  'reservar_cita',
  'proxima_cita',
  'próxima_cita',
  'nueva_cita',
  'primera_cita',
  'confirmacion_cita',
  'confirmación_cita',
  'scheduled_time',
  'date_and_time',
  'time_slot',
  'instant_booking',
  'booking',
  'horario_preferido',
  'dia_preferido',
  'franja',
  'turno',
  'elige_fecha',
  'elige_la_fecha',
  'selecciona_fecha',
  'selecciona_la_fecha',
  'elegir_fecha',
];

/** Mes inglés → índice (Lead Ads / TuPartner suelen enviar «May 15th, 11:00 am»). */
const ENGLISH_MONTH_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const ES_MONTH_TOKEN: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  may: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  sep: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  jun: 5,
  jul: 6,
  ago: 7,
  sept: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

export const normalizeMetaFieldKey = (name: string): string =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');

/** Indica si el nombre del campo sugiere fecha/hora de cita agendada (Lead Ads / formularios personalizados). */
export function metaFieldKeyIndicatesAppointment(keyNorm: string): boolean {
  if (!keyNorm) return false;
  if (EXCLUDE_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  if (EXCLUDE_DEMOGRAPHIC_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  return APPOINTMENT_KEY_FRAGMENTS.some((frag) => keyNorm.includes(frag));
}

/**
 * Segunda pasada: claves más genéricas pero sólo si el valor parece fecha/slot (evita ruido).
 */
function metaFieldKeyMightHoldScheduleValue(keyNorm: string): boolean {
  if (!keyNorm) return false;
  if (EXCLUDE_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  if (EXCLUDE_DEMOGRAPHIC_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  if (metaFieldKeyIndicatesAppointment(keyNorm)) return true;
  return /fecha|dia|hora|slot|franja|turno|reserva|visita|schedule|cuando_desead|cuando|preferred|booking|calendario/.test(
    keyNorm,
  );
}

/** Claves que no deben usarse en el barrido «todos los valores» (evita fechas legales/códigos). */
const EXCLUDE_FALLBACK_KEY_SUBSTRINGS = [
  'postal',
  'codigo_postal',
  'zip',
  'nif',
  'cif',
  'dni',
  'passport',
  'terminos',
  'termine',
  'acepto_',
  'consent',
  'privacy',
  'privacidad',
  'utm_',
  'vigencia',
  'caducidad',
  'expir',
  'newsletter',
  'promo',
  'cupon',
  'coupon',
  'email',
  'mail',
  'telefono',
  'phone',
  'movil',
  'mobile',
  'nombre',
  'name',
  'apellido',
  'first_name',
  'last_name',
  'company',
  'empresa',
  'city',
  'ciudad',
  'address',
  'direccion',
  'web',
  'url',
];

function shouldSkipFallbackScanKey(keyNorm: string): boolean {
  return EXCLUDE_FALLBACK_KEY_SUBSTRINGS.some((ex) => keyNorm.includes(ex));
}

/** Entre años baseYear±1 elige el calendario más cercano a `base` (slots sin año). */
function pickClosestLocalCalendarDate(
  month: number,
  day: number,
  hour: number,
  minute: number,
  base: Date,
): Date | null {
  const y0 = base.getFullYear();
  let best: Date | null = null;
  let bestAbs = Infinity;
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const dt = new Date(y, month, day, hour, minute, 0, 0);
    if (Number.isNaN(dt.getTime()) || dt.getMonth() !== month) continue;
    const diff = Math.abs(dt.getTime() - base.getTime());
    if (diff < bestAbs) {
      bestAbs = diff;
      best = dt;
    }
  }
  return best;
}

/** dd/mm/yyyy o dd-mm-yyyy (común en ES). Año de 2 cifras: el siglo más cercano a `base`. */
function parseEuropeanSlashDate(raw: string, base: Date = new Date()): string | null {
  const m = raw
    .trim()
    .match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const yRaw = Number(m[3]);
  const hh = m[4] != null ? Number(m[4]) : 0;
  const mm = m[5] != null ? Number(m[5]) : 0;
  if (yRaw >= 100) {
    const dt = new Date(yRaw, mo, d, hh, mm, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }
  let best: Date | null = null;
  let bestAbs = Infinity;
  for (const century of [1900, 2000, 2100]) {
    const yy = century + yRaw;
    const dt = new Date(yy, mo, d, hh, mm, 0, 0);
    if (Number.isNaN(dt.getTime()) || dt.getMonth() !== mo) continue;
    const diff = Math.abs(dt.getTime() - base.getTime());
    if (diff < bestAbs) {
      bestAbs = diff;
      best = dt;
    }
  }
  return best ? best.toISOString() : null;
}

/** Ej. "13 may 2026 10:30" / "13 mayo 2026, 10:30" */
function parseDayMonthNameYear(raw: string): string | null {
  const cleaned = raw.trim().replace(/,/g, ' ');
  const re =
    /^(\d{1,2})\s+([a-záéíóúñ]{3,12})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/i;
  const m = cleaned.match(re);
  if (!m) return null;
  const day = Number(m[1]);
  const monToken = m[2].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const month = ES_MONTH_TOKEN[monToken];
  if (month == null) return null;
  const year = Number(m[3]);
  const hh = m[4] != null ? Number(m[4]) : 12;
  const min = m[5] != null ? Number(m[5]) : 0;
  const dt = new Date(year, month, day, hh, min, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/**
 * Slots típicos de Meta instant booking / TuPartner: "May 15th, 11:00 am" (sin año).
 */
export function parseEnglishMonthDayTimeIso(
  raw: string | null | undefined,
  base: Date = new Date(),
): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const re =
    /^\s*([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i;
  const m = s.match(re);
  if (!m) return null;
  const monToken = m[1].toLowerCase();
  const month = ENGLISH_MONTH_INDEX[monToken];
  if (month == null) return null;
  const day = Number(m[2]);
  let hour = Number(m[3]);
  const minute = Number(m[4]);
  const ampm = (m[5] ?? '').toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const dt = pickClosestLocalCalendarDate(month, day, hour, minute, base);
  if (!dt) return null;
  return dt.toISOString();
}

/** Normaliza sufijo de zona tipo "(CEST)" para Date.parse */
export const parseLooseMetaDateString = (
  raw: string | null | undefined,
  base: Date = new Date(),
): string | null => {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const eu = parseEuropeanSlashDate(s, base);
  if (eu) return eu;
  const dmy = parseDayMonthNameYear(s);
  if (dmy) return dmy;
  s = s.replace(/\s+\([A-Z]{2,5}\)$/, '').trim();
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  return null;
};

/**
 * Etiquetas tipo "May 12th, 5:30 pm" → ISO (misma idea que TuPartner).
 */
export const parseAppointmentStyleLabel = (
  label: string | null | undefined,
  base: Date = new Date(),
): string | null => {
  if (!label) return null;
  const cleaned = String(label).trim().replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const candidates: Date[] = [];
  for (const y of [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1]) {
    const d = new Date(`${cleaned}, ${y}`);
    if (!Number.isNaN(d.getTime())) candidates.push(d);
  }
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) =>
    Math.abs(a.getTime() - base.getTime()) <= Math.abs(b.getTime() - base.getTime()) ? a : b,
  );
  return best.toISOString();
};

export function parseFlexibleAppointmentIso(
  raw: string | null | undefined,
  base: Date = new Date(),
): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return (
    parseLooseMetaDateString(s, base) ??
    parseEnglishMonthDayTimeIso(s, base) ??
    parseAppointmentStyleLabel(s, base)
  );
}

export function valueLooksLikeScheduleDateTime(
  raw: string | null | undefined,
  base: Date = new Date(),
): boolean {
  if (!raw || String(raw).trim().length < 6) return false;
  const s = String(raw).trim();
  if (parseFlexibleAppointmentIso(s, base)) return true;
  if (parseEuropeanSlashDate(s, base)) return true;
  if (parseDayMonthNameYear(s)) return true;
  if (/\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/\d{1,2}\s+[a-záéíóúñ]{3,12}\s+\d{4}/i.test(s)) return true;
  if (parseEnglishMonthDayTimeIso(s, base)) return true;
  return false;
}

export function metaFieldDataHasAppointmentField(
  fields: Array<{ name?: string; values?: string[] }> | undefined,
): boolean {
  if (!fields || fields.length === 0) return false;
  const extracted = extractAppointmentFromMetaFieldData(fields as MetaFieldEntry[]);
  return !!(extracted.atIso || extracted.label);
}

export type ExtractedLeadAppointment = {
  label: string | null;
  atIso: string | null;
};

/**
 * Formularios "instant booking" / reserva: Meta a veces envía preguntas genéricas
 * (p. ej. sin "fecha" en la clave). Si el formulario está marcado como reservas,
 * buscamos en todos los valores un slot/fecha parseable.
 */
function scanAllFieldValuesForAppointmentFallback(
  fields: MetaFieldEntry[] | undefined,
  base: Date,
): ExtractedLeadAppointment {
  if (!fields || fields.length === 0) return { label: null, atIso: null };
  const hits: Array<{ key: string; value: string }> = [];
  for (const f of fields) {
    const key = normalizeMetaFieldKey(f?.name ?? '');
    if (EXCLUDE_SUBSTRINGS.some((ex) => key.includes(ex))) continue;
    if (EXCLUDE_DEMOGRAPHIC_SUBSTRINGS.some((ex) => key.includes(ex))) continue;
    if (shouldSkipFallbackScanKey(key)) continue;
    const v = (f.values ?? []).map((x) => String(x).trim()).find(Boolean);
    if (!v) continue;
    if (!valueLooksLikeScheduleDateTime(v, base)) continue;
    hits.push({ key, value: v });
  }
  if (hits.length === 0) return { label: null, atIso: null };
  const label = hits.map((h) => h.value).join(' · ');
  let atIso: string | null = null;
  for (const h of hits) {
    const parsed = parseFlexibleAppointmentIso(h.value, base);
    if (parsed) {
      atIso = parsed;
      break;
    }
  }
  return { label, atIso };
}

export type ExtractAppointmentOpts = {
  createsAppointment?: boolean;
  /** P.ej. created_time Meta / created_at fila: ancla año en slots sin año. */
  referenceTime?: Date | string;
};

function toValidReferenceTime(input: Date | string | undefined): Date {
  if (input == null) return new Date();
  const t = input instanceof Date ? input : new Date(input);
  return Number.isNaN(t.getTime()) ? new Date() : t;
}

/**
 * Extrae texto legible y, si es posible, timestamp ISO desde extras de Meta (field_data).
 * @param opts.createsAppointment Si true (formulario Meta "Con reservas"), segunda pasada por todos los valores.
 * @param opts.referenceTime Fecha de referencia del lead (evita desplazar +1 año slots en pasado reciente).
 */
export function extractAppointmentFromMetaFieldData(
  fields: MetaFieldEntry[] | undefined,
  opts?: ExtractAppointmentOpts,
): ExtractedLeadAppointment {
  const base = toValidReferenceTime(opts?.referenceTime);
  if (!fields || fields.length === 0) return { label: null, atIso: null };

  const hits: Array<{ key: string; value: string }> = [];

  const pushHit = (key: string, value: string) => {
    hits.push({ key, value });
  };

  // 1) Claves explícitas de cita
  for (const f of fields) {
    const key = normalizeMetaFieldKey(f?.name ?? '');
    if (!metaFieldKeyIndicatesAppointment(key)) continue;
    const v = (f.values ?? []).map((x) => String(x).trim()).find(Boolean);
    if (v) pushHit(key, v);
  }

  // 2) Claves ambiguas sólo si el valor parece fecha/slot
  if (hits.length === 0) {
    for (const f of fields) {
      const key = normalizeMetaFieldKey(f?.name ?? '');
      if (!metaFieldKeyMightHoldScheduleValue(key)) continue;
      const v = (f.values ?? []).map((x) => String(x).trim()).find(Boolean);
      if (!v) continue;
      if (!valueLooksLikeScheduleDateTime(v, base)) continue;
      pushHit(key, v);
    }
  }

  if (hits.length === 0) {
    if (opts?.createsAppointment) {
      return scanAllFieldValuesForAppointmentFallback(fields, base);
    }
    return { label: null, atIso: null };
  }

  const label = hits.map((h) => h.value).join(' · ');
  let atIso: string | null = null;
  for (const h of hits) {
    const parsed = parseFlexibleAppointmentIso(h.value, base);
    if (parsed) {
      atIso = parsed;
      break;
    }
  }

  if (!(atIso || label) && opts?.createsAppointment) {
    const fb = scanAllFieldValuesForAppointmentFallback(fields, base);
    if (fb.atIso || fb.label) return fb;
  }

  return { label, atIso };
}

export type ResolvedLeadAppointment = {
  /** ISO UTC si hay fecha interpretable (columna o field_data). */
  atIso: string | null;
  /** Texto crudo para mostrar si no hay atIso (ej. slot textual de Meta). */
  label: string | null;
};

/**
 * Prioriza columnas persistidas; si faltan, infiere desde field_data (sync Meta antigua).
 */
export function resolveLeadAppointmentParts(lead: {
  appointment_at?: string | null;
  appointment_label?: string | null;
  field_data?: unknown;
}): ResolvedLeadAppointment {
  const fd = Array.isArray(lead.field_data)
    ? (lead.field_data as MetaFieldEntry[])
    : [];
  const refRaw = lead.external_created_at ?? lead.created_at;
  const ref =
    refRaw && typeof refRaw === 'string'
      ? new Date(refRaw)
      : new Date();
  const base = Number.isNaN(ref.getTime()) ? new Date() : ref;
  const extracted = extractAppointmentFromMetaFieldData(fd, { referenceTime: base });

  let atIso: string | null = null;
  if (lead.appointment_at) {
    const d = new Date(lead.appointment_at);
    if (!Number.isNaN(d.getTime())) atIso = d.toISOString();
  }
  if (!atIso && extracted.atIso) atIso = extracted.atIso;

  const label =
    (lead.appointment_label?.trim() || null) ?? (extracted.label ?? null);

  return { atIso, label };
}
