// Edge function: meta-sync-leads
// ---------------------------------------------------------------------------
// Sincroniza leads desde Meta Lead Ads (Facebook/Instagram) hacia la tabla
// public.marketing_leads. Etapa "Formulario+Agenda ficticia" sólo si en field_data
// se detectan datos de fecha/slot de reserva (heurística). El flag meta_forms.creates_appointment
// ya no fuerza esa columna para todos los leads (evita falsos positivos).
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  sendInitialAutomationForLead,
  type MetaFormAutomation,
} from '../_shared/marketingWhatsappAutomation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type MetaFieldDatum = { name: string; values: string[] };
type MetaLead = {
  id: string;
  created_time?: string;
  field_data?: MetaFieldDatum[];
  form_id?: string;
  ad_id?: string;
  campaign_name?: string;
  platform?: string;
};

type MetaLeadsResponse = {
  data?: MetaLead[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; type?: string; code?: number };
};

type SyncFormResult = {
  form_id: string;
  form_name: string | null;
  status: 'ok' | 'error' | 'skipped';
  inserted: number;
  skipped: number;
  errors: number;
  message?: string;
};

// Heurística de cita en field_data (alineada con src/lib/marketingLeadAppointment.ts).
// Evita falsos positivos: p. ej. "capacitacion" contiene "cita", o "horario" genérico.
const EXCLUDE_SUBSTRINGS = [
  'sin_cita',
  'sin_agendar',
  'no_agendar',
  'no_quiero',
  'no_desear',
];

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
  'nueva_cita',
  'primera_cita',
  'confirmacion_cita',
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

/** Mes inglés → índice (slots tipo «May 15th, 11:00 am» sin año). */
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

function normalizeMetaFieldKey(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
}

const YES_NO_ANSWER_RE =
  /^(si|sí|yes|no|true|false|1|0|ok|vale|confirmo|acepto|de_acuerdo)$/i;

function isYesNoOnlyAnswer(value: string | null | undefined): boolean {
  if (value == null) return true;
  const s = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!s) return true;
  if (YES_NO_ANSWER_RE.test(s)) return true;
  return s.length <= 2;
}

function metaFieldKeyIsBookingIntentQuestion(keyNorm: string): boolean {
  if (!keyNorm) return false;
  return /quiero_agendar|desea_agendar|deseas_agendar|want_to_book|wish_to_book|agendar_mi_cita|agendar.*cuanto_antes|solicitar.*cita.*cuanto/.test(
    keyNorm,
  );
}

function labelLooksLikeBookingIntentQuestion(label: string | null | undefined): boolean {
  if (!label) return false;
  return metaFieldKeyIsBookingIntentQuestion(normalizeMetaFieldKey(label));
}

function isAppointmentLabelNoise(label: string): boolean {
  const v = label.trim().toLowerCase();
  if (!v) return false;
  if (/lipoout|triple\s*glow|medicina\s*est[eé]tica/i.test(v)) return true;
  if (!/\d/.test(v) && v.length >= 12 && !valueLooksLikeScheduleDateTime(v)) return true;
  return false;
}

function sanitizeExtractedAppointment(extracted: {
  label: string | null;
  atIso: string | null;
}): { label: string | null; atIso: string | null } {
  const label = extracted.label?.trim() ?? '';
  if (
    labelLooksLikeBookingIntentQuestion(label) ||
    isYesNoOnlyAnswer(label) ||
    isAppointmentLabelNoise(label)
  ) {
    return { label: null, atIso: null };
  }
  if (extracted.atIso && !label) return extracted;
  if (extracted.atIso && label && !valueLooksLikeScheduleDateTime(label)) {
    return { label: null, atIso: null };
  }
  if (!extracted.atIso && label && !valueLooksLikeScheduleDateTime(label)) {
    return { label: null, atIso: null };
  }
  return extracted;
}

function tagsFromMetaFormName(_formName: string | null | undefined): string[] {
  return [];
}

function metaFieldKeyIndicatesAppointment(keyNorm: string): boolean {
  if (!keyNorm) return false;
  if (EXCLUDE_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  if (EXCLUDE_DEMOGRAPHIC_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  return APPOINTMENT_KEY_FRAGMENTS.some((frag) => keyNorm.includes(frag));
}

function metaFieldKeyMightHoldScheduleValue(keyNorm: string): boolean {
  if (!keyNorm) return false;
  if (EXCLUDE_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  if (EXCLUDE_DEMOGRAPHIC_SUBSTRINGS.some((ex) => keyNorm.includes(ex))) return false;
  if (metaFieldKeyIndicatesAppointment(keyNorm)) return true;
  return /fecha|dia|hora|slot|franja|turno|reserva|visita|schedule|cuando_desead|cuando|preferred|booking|calendario/.test(
    keyNorm,
  );
}

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

function appointmentReferenceFromLead(lead: { created_time?: string }): Date {
  if (lead.created_time) {
    const d = new Date(lead.created_time);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

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

function parseEnglishMonthDayTimeIso(
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

function parseLooseMetaDateString(
  raw: string | null | undefined,
  base: Date = new Date(),
): string | null {
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
}

function parseAppointmentStyleLabel(
  label: string | null | undefined,
  base: Date = new Date(),
): string | null {
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
}

function parseFlexibleAppointmentIso(
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

function valueLooksLikeScheduleDateTime(raw: string, base: Date = new Date()): boolean {
  if (!raw || raw.trim().length < 6) return false;
  const s = raw.trim();
  if (parseFlexibleAppointmentIso(s, base)) return true;
  if (parseEuropeanSlashDate(s, base)) return true;
  if (parseDayMonthNameYear(s)) return true;
  if (/\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/\d{1,2}\s+[a-záéíóúñ]{3,12}\s+\d{4}/i.test(s)) return true;
  if (parseEnglishMonthDayTimeIso(s, base)) return true;
  return false;
}

function scanAllFieldValuesForAppointmentFallback(
  fields: MetaFieldDatum[] | undefined,
  base: Date,
): { label: string | null; atIso: string | null } {
  if (!fields || fields.length === 0) return { label: null, atIso: null };
  const hits: Array<{ key: string; value: string }> = [];
  for (const f of fields) {
    const key = normalizeMetaFieldKey(f?.name ?? '');
    if (EXCLUDE_SUBSTRINGS.some((ex) => key.includes(ex))) continue;
    if (EXCLUDE_DEMOGRAPHIC_SUBSTRINGS.some((ex) => key.includes(ex))) continue;
    if (shouldSkipFallbackScanKey(key)) continue;
    const raw = Array.isArray(f.values) ? f.values : [];
    const v = raw.map((x) => String(x).trim()).find((s) => s.length > 0);
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

function extractAppointmentFromMetaFieldsCore(
  fields: MetaFieldDatum[] | undefined,
  base: Date,
): { label: string | null; atIso: string | null } {
  if (!fields || fields.length === 0) return { label: null, atIso: null };

  type Hit = { key: string; value: string };
  const hits: Hit[] = [];

  for (const f of fields) {
    const key = normalizeMetaFieldKey(f?.name ?? '');
    if (!metaFieldKeyIndicatesAppointment(key)) continue;
    const raw = Array.isArray(f.values) ? f.values : [];
    const v = raw.map((x) => String(x).trim()).find((s) => s.length > 0);
    if (!v || isYesNoOnlyAnswer(v)) continue;
    if (metaFieldKeyIsBookingIntentQuestion(key) && !valueLooksLikeScheduleDateTime(v, base)) {
      continue;
    }
    if (v) hits.push({ key, value: v });
  }

  if (hits.length === 0) {
    for (const f of fields) {
      const key = normalizeMetaFieldKey(f?.name ?? '');
      if (!metaFieldKeyMightHoldScheduleValue(key)) continue;
      if (metaFieldKeyIsBookingIntentQuestion(key)) continue;
      const raw = Array.isArray(f.values) ? f.values : [];
      const v = raw.map((x) => String(x).trim()).find((s) => s.length > 0);
      if (!v || isYesNoOnlyAnswer(v)) continue;
      if (!valueLooksLikeScheduleDateTime(v, base)) continue;
      hits.push({ key, value: v });
    }
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

  return sanitizeExtractedAppointment({ label, atIso });
}

/** Si el formulario tiene "Con reservas Meta", escanea todos los valores (slots sin clave reconocible). */
function extractAppointmentFromMetaFields(
  fields: MetaFieldDatum[] | undefined,
  form?: { creates_appointment?: boolean | null },
  referenceBase?: Date,
): { label: string | null; atIso: string | null } {
  const base =
    referenceBase && !Number.isNaN(referenceBase.getTime())
      ? referenceBase
      : new Date();
  const core = extractAppointmentFromMetaFieldsCore(fields, base);
  if (core.atIso || core.label) return core;
  if (form?.creates_appointment) {
    const fb = scanAllFieldValuesForAppointmentFallback(fields, base);
    if (fb.atIso || fb.label) return sanitizeExtractedAppointment(fb);
  }
  return core;
}

function normalizeFieldName(name: string): string {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function firstValue(values?: string[]): string | null {
  if (!values || values.length === 0) return null;
  const v = String(values[0] ?? '').trim();
  return v.length === 0 ? null : v;
}

/** Últimos 9 dígitos para deduplicar leads (alineado con marketing_leads.phone_norm en BD). */
function phoneDigitsLast9(phone: string | null | undefined): string | null {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (d.length >= 9) return d.slice(-9);
  return null;
}

function mergeLeadFieldData(
  a: MetaFieldDatum[] | undefined,
  b: MetaFieldDatum[] | undefined,
): MetaFieldDatum[] {
  const merge = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const seen = new Set<string>();
  const out: MetaFieldDatum[] = [];
  for (const f of merge) {
    const sig = `${normalizeMetaFieldKey(f?.name ?? '')}:${(f.values ?? []).join('\u001f')}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ name: f.name, values: Array.isArray(f.values) ? f.values : [] });
  }
  return out;
}

function parseLeadFields(lead: MetaLead) {
  const fields = Array.isArray(lead.field_data) ? lead.field_data : [];
  let firstName: string | null = null;
  let lastName: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  const extras: Array<{ name: string; values: string[] }> = [];

  for (const f of fields) {
    const key = normalizeFieldName(f?.name ?? '');
    const value = firstValue(f?.values);
    if (!key) continue;
    switch (key) {
      case 'first_name':
        firstName = value;
        break;
      case 'last_name':
        lastName = value;
        break;
      case 'full_name': {
        if (value && !firstName) {
          const parts = value.split(/\s+/);
          firstName = parts[0] ?? null;
          if (parts.length > 1 && !lastName) lastName = parts.slice(1).join(' ');
        }
        break;
      }
      case 'phone':
      case 'phone_number':
        phone = value;
        break;
      case 'email':
        email = value;
        break;
      default:
        extras.push({ name: key, values: Array.isArray(f.values) ? f.values : [] });
    }
  }

  return { firstName, lastName, phone, email, extras };
}

async function fetchAllLeads(
  apiVersion: string,
  formId: string,
  accessToken: string,
  /** Unix segundos; Meta exige número para `time_created`, no ISO string. */
  sinceUnix: number | null,
): Promise<{ leads: MetaLead[]; error?: string }> {
  const leads: MetaLead[] = [];
  const baseFields =
    'id,created_time,field_data,form_id,ad_id,campaign_name,platform';
  let nextUrl: string | null = null;

  const buildInitialUrl = () => {
    const url = new URL(
      `https://graph.facebook.com/${apiVersion}/${formId}/leads`,
    );
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', baseFields);
    url.searchParams.set('limit', '100');
    if (sinceUnix != null && Number.isFinite(sinceUnix)) {
      url.searchParams.set(
        'filtering',
        JSON.stringify([
          { field: 'time_created', operator: 'GREATER_THAN', value: sinceUnix },
        ]),
      );
    }
    return url.toString();
  };

  let current: string = buildInitialUrl();
  let safety = 0;

  while (current && safety < 20) {
    safety++;
    const resp = await fetch(current, { method: 'GET' });
    const text = await resp.text();
    let payload: MetaLeadsResponse;
    try {
      payload = JSON.parse(text) as MetaLeadsResponse;
    } catch {
      return {
        leads,
        error: `Respuesta no JSON desde Meta (HTTP ${resp.status})`,
      };
    }
    if (!resp.ok || payload.error) {
      const msg =
        payload.error?.message ??
        `HTTP ${resp.status}: ${text.slice(0, 200)}`;
      return { leads, error: msg };
    }
    if (Array.isArray(payload.data)) leads.push(...payload.data);
    nextUrl = payload.paging?.next ?? null;
    current = nextUrl ?? '';
  }

  return { leads };
}

async function resolveCompanyId(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string,
): Promise<string | null> {
  const allowed = new Set<string>();

  const { data: active } = await admin
    .from('user_active_company')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (active?.company_id) allowed.add(String(active.company_id));

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', userId);
  for (const row of profiles ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  const { data: roles } = await admin
    .from('user_company_roles')
    .select('company_id')
    .eq('user_id', userId);
  for (const row of roles ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  if (requestedCompanyId && allowed.has(requestedCompanyId)) {
    return requestedCompanyId;
  }
  if (active?.company_id) return String(active.company_id);
  const first = profiles?.find((p) => p.company_id)?.company_id;
  if (first) return String(first);
  const roleCompany = roles?.find((r) => r.company_id)?.company_id;
  return roleCompany ? String(roleCompany) : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Faltan variables de entorno de Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Falta token de autenticación' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let body: {
      company_id?: string;
      form_ids?: string[];
      force?: boolean;
      full_meta_resync?: boolean;
      confirm_full_meta_resync?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const companyId = await resolveCompanyId(
      admin,
      userData.user.id,
      body.company_id,
    );
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'No se encontró empresa para el usuario' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: config, error: cfgErr } = await admin
      .from('meta_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!config) {
      return new Response(
        JSON.stringify({
          error:
            'No hay configuración de Meta. Configura business_id, access_token y formularios en Configuración → Meta.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!config.access_token) {
      return new Response(
        JSON.stringify({ error: 'Falta access_token en la configuración de Meta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const fullResync =
      body.full_meta_resync === true &&
      body.confirm_full_meta_resync === 'BORRAR_LEADS_META';

    if (fullResync && body.force !== true) {
      return new Response(
        JSON.stringify({
          error:
            'La resincronización completa es destructiva: envía force: true junto con full_meta_resync y confirm_full_meta_resync.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!config.enabled && !body.force) {
      return new Response(
        JSON.stringify({ error: 'La sincronización con Meta está deshabilitada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let formsQuery = admin
      .from('meta_forms')
      .select('*')
      .eq('company_id', companyId)
      .eq('enabled', true);
    if (body.form_ids && body.form_ids.length > 0) {
      formsQuery = formsQuery.in('form_id', body.form_ids);
    }
    const { data: forms, error: formsErr } = await formsQuery;
    if (formsErr) throw formsErr;
    if (!forms || forms.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            'No hay formularios Meta configurados. Añade alguno en Configuración → Meta.',
          forms: [],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let deletedMetaLeads = 0;
    if (fullResync) {
      const { data: delRows, error: delErr } = await admin
        .from('marketing_leads')
        .delete()
        .eq('company_id', companyId)
        .in('source', ['meta', 'facebook', 'instagram'])
        .select('id');
      if (delErr) throw delErr;
      deletedMetaLeads = Array.isArray(delRows) ? delRows.length : 0;

      const { error: resetCursorsErr } = await admin
        .from('meta_forms')
        .update({
          last_lead_created_time: null,
          last_lead_external_id: null,
        })
        .eq('company_id', companyId);
      if (resetCursorsErr) throw resetCursorsErr;
    }

    const { data: stages, error: stagesErr } = await admin
      .from('marketing_lead_stages')
      .select('id, name, is_default_intake, position')
      .eq('company_id', companyId)
      .order('position', { ascending: true });
    if (stagesErr) throw stagesErr;

    const stageByName = new Map<string, string>();
    for (const s of stages ?? []) {
      if (s.name) stageByName.set(s.name.toLowerCase(), s.id);
    }
    const intakeStageId =
      (stages ?? []).find((s) => s.is_default_intake)?.id ??
      stageByName.get('nuevo lead') ??
      stageByName.get('nuevo formulario') ??
      (stages ?? [])[0]?.id ??
      null;
    const appointmentStageId =
      stageByName.get('formulario+agenda ficticia') ??
      stageByName.get('formulario + agenda ficticia') ??
      intakeStageId;

    const results: SyncFormResult[] = [];
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const form of forms) {
      const targetIntake = form.default_stage_id ?? intakeStageId;
      const targetAppointment =
        form.appointment_stage_id ??
        (form.creates_appointment ? appointmentStageId : null) ??
        appointmentStageId;

      const sinceUnix = fullResync
        ? null
        : form.last_lead_created_time
          ? Math.floor(new Date(form.last_lead_created_time).getTime() / 1000)
          : null;

      const { leads: metaLeads, error: fetchErr } = await fetchAllLeads(
        config.graph_api_version || 'v23.0',
        form.form_id,
        config.access_token,
        sinceUnix,
      );

      if (fetchErr) {
        totalErrors++;
        results.push({
          form_id: form.form_id,
          form_name: form.form_name,
          status: 'error',
          inserted: 0,
          skipped: 0,
          errors: 1,
          message: fetchErr,
        });
        await admin
          .from('meta_forms')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'error',
            last_sync_message: fetchErr.slice(0, 500),
          })
          .eq('id', form.id);
        continue;
      }

      // Cargamos TODOS los leads de la empresa (id/external_id/phone/email) para poder
      // emparejar por external_id, por teléfono normalizado (últimos 9 dígitos) y por email.
      const { data: existingAll, error: existingErr } = await admin
        .from('marketing_leads')
        .select('id, external_id, phone, email')
        .eq('company_id', companyId);
      if (existingErr) throw existingErr;

      const existingByExternal = new Map<string, string>();
      const existingByPhone9   = new Map<string, string>();
      const existingByPhoneAll = new Map<string, string>();
      const existingByEmail    = new Map<string, string>();
      for (const row of existingAll ?? []) {
        if (row.external_id) existingByExternal.set(row.external_id, row.id);
        if (row.phone) {
          const d = row.phone.replace(/\D/g, '');
          if (d.length >= 7) {
            existingByPhoneAll.set(d, row.id);
            const n9 = phoneDigitsLast9(row.phone);
            if (n9) existingByPhone9.set(n9, row.id);
          }
        }
        if (row.email) {
          existingByEmail.set(row.email.trim().toLowerCase(), row.id);
        }
      }

      const findExistingLeadId = (
        leadId: string,
        phone: string | null,
        email: string | null,
      ): string | null => {
        if (existingByExternal.has(leadId)) return existingByExternal.get(leadId)!;
        // Siempre deduplicar por teléfono/email (también tras resync completa: evita duplicar vs TuPartner u otros).
        if (phone) {
          const d = phone.replace(/\D/g, '');
          if (d.length >= 7) {
            const byFull = existingByPhoneAll.get(d);
            if (byFull) return byFull;
            const n9 = phoneDigitsLast9(phone);
            if (n9) {
              const byLast9 = existingByPhone9.get(n9);
              if (byLast9) return byLast9;
            }
          }
        }
        if (email) {
          const e = email.trim().toLowerCase();
          if (e) {
            const byEmail = existingByEmail.get(e);
            if (byEmail) return byEmail;
          }
        }
        return null;
      };

      type BackfillTarget = {
        id: string;
        externalId: string;
        /** Lead completo de Meta para fusionar datos si ya había otro external_id. */
        metaLead: MetaLead;
        formName: string | null;
        campaign: string | null;
        externalCreatedAt: string | null;
        source: string;
      };

      const rows: Record<string, unknown>[] = [];
      /** field_data fusionados por fila (mismo índice que rows), sólo en memoria. */
      const rowsMergedFd: MetaFieldDatum[][] = [];
      /** Dedupe dentro del mismo lote/API: mismo teléfono → una sola fila. */
      const pendingRowIndexByPhone9 = new Map<string, number>();
      const toBackfill: BackfillTarget[] = [];
      let skipped = 0;
      let lastCreatedTime: string | null = fullResync ? null : form.last_lead_created_time ?? null;
      let lastExternalId: string | null = fullResync ? null : form.last_lead_external_id ?? null;

      for (const lead of metaLeads) {
        if (!lead.id) continue;

        const { firstName, lastName, phone, email, extras } = parseLeadFields(lead);
        const platform = (lead.platform ?? '').toLowerCase();
        let source = 'meta';
        if (platform.includes('instagram')) source = 'instagram';
        else if (platform.includes('facebook')) source = 'facebook';

        const matchId = findExistingLeadId(lead.id, phone, email);
        const n9 = phoneDigitsLast9(phone);

        let consumedByBatchMerge = false;
        if (!matchId && n9 && pendingRowIndexByPhone9.has(n9)) {
          const idx = pendingRowIndexByPhone9.get(n9)!;
          rowsMergedFd[idx] = mergeLeadFieldData(rowsMergedFd[idx], lead.field_data);
          const mergedFd = rowsMergedFd[idx];
          const reparsed = parseLeadFields({ field_data: mergedFd } as MetaLead);
          const prev = rows[idx] as Record<string, unknown>;
          const tNew = lead.created_time ? new Date(lead.created_time).getTime() : 0;
          const tOld = prev.external_created_at
            ? new Date(String(prev.external_created_at)).getTime()
            : 0;
          const newer = tNew >= tOld;
          const apptExtract = extractAppointmentFromMetaFields(
            mergedFd,
            form,
            appointmentReferenceFromLead(lead),
          );
          const hasAppt = !!(apptExtract.atIso || apptExtract.label);
          rows[idx] = {
            company_id: companyId,
            stage_id: hasAppt ? targetAppointment : targetIntake,
            external_id: newer ? lead.id : prev.external_id,
            source: newer ? source : prev.source,
            form_name: form.form_name ?? prev.form_name ?? null,
            campaign: newer ? (lead.campaign_name ?? null) : prev.campaign,
            first_name: reparsed.firstName,
            last_name: reparsed.lastName,
            phone: reparsed.phone,
            email: reparsed.email,
            field_data: reparsed.extras,
            external_created_at: newer ? lead.created_time : prev.external_created_at,
            appointment_at: apptExtract.atIso,
            appointment_label: apptExtract.label,
            tags: newer ? tagsFromMetaFormName(form.form_name) : (prev.tags as string[] | undefined) ?? [],
          };
          consumedByBatchMerge = true;
        }

        if (!consumedByBatchMerge && matchId) {
          // El lead ya existe (importado de CRM antiguo o sync previa). No tocamos
          // su etapa ni datos editados por el usuario; sólo registramos el external_id
          // de Meta para que en futuras syncs sea trivial reconocerlo.
          skipped++;
          // Sólo backfill si no es ya un external_id de Meta conocido.
          if (!existingByExternal.has(lead.id)) {
            toBackfill.push({
              id: matchId,
              externalId: lead.id,
              metaLead: lead,
              formName: form.form_name ?? null,
              campaign: lead.campaign_name ?? null,
              externalCreatedAt: lead.created_time ?? null,
              source,
            });
            // Lo registramos en el índice por si en este mismo run aparece otra vez.
            existingByExternal.set(lead.id, matchId);
          }
        } else if (!consumedByBatchMerge) {
          const apptExtract = extractAppointmentFromMetaFields(
            lead.field_data,
            form,
            appointmentReferenceFromLead(lead),
          );
          const hasAppt = !!(apptExtract.atIso || apptExtract.label);
          const stageId = hasAppt ? targetAppointment : targetIntake;

          rows.push({
            company_id: companyId,
            stage_id: stageId,
            meta_form_id: form.id,
            external_id: lead.id,
            source,
            form_name: form.form_name ?? null,
            campaign: lead.campaign_name ?? null,
            first_name: firstName,
            last_name: lastName,
            phone,
            email,
            field_data: extras,
            external_created_at: lead.created_time ?? null,
            appointment_at: apptExtract.atIso,
            appointment_label: apptExtract.label,
            tags: tagsFromMetaFormName(form.form_name),
          });
          rowsMergedFd.push(mergeLeadFieldData([], lead.field_data));
          if (n9) pendingRowIndexByPhone9.set(n9, rows.length - 1);
        }

        if (
          lead.created_time &&
          (!lastCreatedTime || new Date(lead.created_time) > new Date(lastCreatedTime))
        ) {
          lastCreatedTime = lead.created_time;
          lastExternalId = lead.id;
        }
      }

      let inserted = 0;
      let formErrors = 0;
      let insertErrDetail: string | null = null;
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { data: ins, error: insErr } = await admin
          .from('marketing_leads')
          .insert(slice)
          .select('id');
        if (insErr) {
          console.error('meta-sync insert error', insErr);
          formErrors += slice.length;
          if (!insertErrDetail) {
            insertErrDetail =
              typeof insErr.message === 'string' && insErr.message.length > 0
                ? insErr.message
                : JSON.stringify(insErr);
          }
        } else {
          inserted += ins?.length ?? 0;
          if (form.whatsapp_automation_enabled && ins?.length) {
            for (let j = 0; j < ins.length; j++) {
              const leadId = ins[j]?.id as string | undefined;
              if (!leadId) continue;
              const srcRow = rows[i + j];
              try {
                await sendInitialAutomationForLead(
                  admin,
                  companyId,
                  leadId,
                  {
                    phone: srcRow.phone as string | null,
                    first_name: srcRow.first_name as string | null,
                    last_name: srcRow.last_name as string | null,
                    email: srcRow.email as string | null,
                    campaign: srcRow.campaign as string | null,
                    form_name: srcRow.form_name as string | null,
                    appointment_at: srcRow.appointment_at as string | null,
                    appointment_label: srcRow.appointment_label as string | null,
                    source: srcRow.source as string | null,
                    meta_form_id: form.id,
                  },
                  form as MetaFormAutomation,
                );
              } catch (autoErr) {
                console.error('meta-sync WhatsApp automation failed:', autoErr);
              }
            }
          }
        }
      }

      // Fusionar envíos Meta en fila existente (mismo teléfono/email u otro CRM).
      // Antes sólo se actualizaba si external_id era null → los reenvíos con nuevo id de Meta no se veían.
      for (const b of toBackfill) {
        const { data: row, error: selErr } = await admin
          .from('marketing_leads')
          .select(
            'external_id, external_created_at, first_name, last_name, phone, email, field_data, appointment_at, appointment_label, stage_id, form_name, campaign',
          )
          .eq('id', b.id)
          .maybeSingle();
        if (selErr || !row) {
          console.warn(`merge meta lead: no fila ${b.id}`, selErr?.message);
          continue;
        }

        const parsed = parseLeadFields(b.metaLead);
        const apptNew = extractAppointmentFromMetaFields(
          b.metaLead.field_data,
          form,
          appointmentReferenceFromLead(b.metaLead),
        );
        const hasApptNew = !!(apptNew.atIso || apptNew.label);
        const tNew = b.externalCreatedAt ? new Date(b.externalCreatedAt).getTime() : 0;
        const tOld = row.external_created_at ? new Date(String(row.external_created_at)).getTime() : 0;
        const isNewer = !row.external_created_at || tNew >= tOld;
        const rowHadAppt = !!(row.appointment_at || row.appointment_label);

        const existingFd = (Array.isArray(row.field_data) ? row.field_data : []) as MetaFieldDatum[];
        const patch: Record<string, unknown> = {};

        if (isNewer) {
          patch.external_id = b.externalId;
          patch.first_name = parsed.firstName;
          patch.last_name = parsed.lastName;
          if (parsed.phone) patch.phone = parsed.phone;
          if (parsed.email) patch.email = parsed.email;
          patch.form_name = b.formName ?? row.form_name;
          patch.campaign = b.campaign ?? row.campaign;
          patch.external_created_at = b.externalCreatedAt;
          patch.source = b.source;
          patch.field_data = mergeLeadFieldData(existingFd, parsed.extras as MetaFieldDatum[]);
          patch.tags = tagsFromMetaFormName(b.formName ?? row.form_name);
          if (hasApptNew) {
            patch.appointment_at = apptNew.atIso;
            patch.appointment_label = apptNew.label;
            patch.stage_id = targetAppointment;
          } else if (rowHadAppt) {
            patch.appointment_at = null;
            patch.appointment_label = null;
            patch.stage_id = targetIntake;
          }
        } else if (row.external_id == null) {
          patch.external_id = b.externalId;
          patch.source = b.source;
          if (b.formName) patch.form_name = b.formName;
          if (b.campaign) patch.campaign = b.campaign;
          if (b.externalCreatedAt) patch.external_created_at = b.externalCreatedAt;
        }

        if (!isNewer && hasApptNew && !rowHadAppt) {
          patch.appointment_at = apptNew.atIso;
          patch.appointment_label = apptNew.label;
          patch.stage_id = targetAppointment;
        }

        if (Object.keys(patch).length === 0) continue;

        const { error: upErr } = await admin.from('marketing_leads').update(patch).eq('id', b.id);
        if (upErr) {
          console.warn(`merge meta lead failed for ${b.id}:`, upErr.message);
        }
      }

      totalInserted += inserted;
      totalSkipped += skipped;
      totalErrors += formErrors;

      await admin
        .from('meta_forms')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: formErrors > 0 ? 'partial' : 'ok',
          last_sync_message:
            formErrors > 0
              ? `${inserted} insertados, ${formErrors} con error${
                  insertErrDetail
                    ? `: ${insertErrDetail.slice(0, 400)}${
                        insertErrDetail.length > 400 ? '…' : ''
                      }`
                    : ''
                }`
              : `${inserted} insertados, ${skipped} ya existían`,
          last_lead_created_time: lastCreatedTime,
          last_lead_external_id: lastExternalId,
        })
        .eq('id', form.id);

      results.push({
        form_id: form.form_id,
        form_name: form.form_name,
        status: formErrors > 0 ? 'error' : 'ok',
        inserted,
        skipped,
        errors: formErrors,
        ...(insertErrDetail ? { message: insertErrDetail.slice(0, 2000) } : {}),
      });
    }

    const overallStatus: 'ok' | 'partial' | 'error' =
      totalErrors === 0 ? 'ok' : totalInserted > 0 ? 'partial' : 'error';

    const errorDetails = results
      .filter((r) => r.message)
      .map((r) => `${r.form_name ?? r.form_id}: ${r.message}`)
      .join(' · ');
    const baseConfigMsg =
      fullResync && deletedMetaLeads > 0
        ? `Resync: eliminados ${deletedMetaLeads} leads Meta previos; insertados ${totalInserted}, omitidos ${totalSkipped}, errores ${totalErrors}`
        : `Insertados ${totalInserted}, omitidos ${totalSkipped}, con error ${totalErrors}`;
    const lastConfigMessage =
      totalErrors > 0 && errorDetails.length > 0
        ? `${baseConfigMsg}. Detalle: ${errorDetails}`.slice(0, 4000)
        : baseConfigMsg;

    await admin
      .from('meta_config')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: overallStatus,
        last_sync_message: lastConfigMessage,
        last_sync_inserted: totalInserted,
        last_sync_skipped: totalSkipped,
      })
      .eq('company_id', companyId);

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: totalInserted,
        skipped: totalSkipped,
        errors: totalErrors,
        deleted_meta_leads: deletedMetaLeads,
        full_meta_resync: fullResync,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error sincronizando Meta';
    console.error('meta-sync-leads failed', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
