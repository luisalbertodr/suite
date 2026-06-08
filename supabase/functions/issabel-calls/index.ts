import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CallDirection = 'outbound' | 'inbound' | 'missed';
type CallDisplayType = 'outbound' | 'inbound' | 'missed' | 'voicemail';

type Body = {
  action: 'calls.list' | 'calls.sync_missed' | 'calls.recording';
  company_id?: string;
  from?: string;
  to?: string;
  direction?: CallDirection | 'voicemail';
  limit?: number;
  recording?: string;
  call_id?: string;
};

type PhoneAccess = 'all' | 'missed' | 'none';

type RawCdr = Record<string, unknown>;

type AppUser = {
  id: string;
  email?: string | null;
};

type CustomerMatch = {
  id: string;
  name: string;
  phone?: string | null;
  phone_mobile?: string | null;
  phone_home?: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pick(row: RawCdr, keys: string[]): string {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return '';
}

function pickNumber(row: RawCdr, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== '') return asNumber(value);
  }
  return 0;
}

/** Último domingo del mes (0=domingo) en calendario UTC. */
function lastSundayUtc(year: number, monthIndex: number): number {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  return lastDay.getUTCDate() - lastDay.getUTCDay();
}

/** Horario de verano UE (Europe/Madrid): último domingo marzo–octubre, 01:00 UTC. */
function isEuropeMadridDST(utcInstant: Date): boolean {
  const year = utcInstant.getUTCFullYear();
  const dstStart = Date.UTC(year, 2, lastSundayUtc(year, 2), 1, 0, 0);
  const dstEnd = Date.UTC(year, 9, lastSundayUtc(year, 9), 1, 0, 0);
  const t = utcInstant.getTime();
  return t >= dstStart && t < dstEnd;
}

/** CDR Issabel/Asterisk: fecha/hora local sin zona (p. ej. "2026-06-04 10:00:00"). */
function offsetForNaiveIssabelLocal(isoLocal: string): string {
  const fixed = Deno.env.get('ISSABEL_TZ_OFFSET');
  if (fixed) return fixed.startsWith('+') || fixed.startsWith('-') ? fixed : `+${fixed}`;

  const m = isoLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '+01:00';

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const approxUtc = Date.UTC(year, month - 1, day, hour - 1, minute);
  return isEuropeMadridDST(new Date(approxUtc)) ? '+02:00' : '+01:00';
}

function normalizeDate(value: string): string {
  if (!value) return new Date().toISOString();
  const trimmed = value.trim();
  const withT = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(withT)) {
    const normalized = withT.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return value;
  }

  const offset = offsetForNaiveIssabelLocal(withT);
  const date = new Date(`${withT}${offset}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

const BUSINESS_PHONE = '881242909';
const INBOUND_DESTINATION = '100';
/** Teléfono público, grupo y extensiones Lipoout (no son el cliente en pantalla). */
const LIPOOUT_INFRA_DIGITS = new Set(['881242909', '100', '1001', '1002']);
/** Destinos de buzón de voz en Issabel (vms1002 es el activo en centralita). */
const VOICEMAIL_DESTINATIONS = new Set(['vms1002', 'vms102']);

function isVoicemailDestination(destination: string): boolean {
  const d = destination.toLowerCase();
  if (VOICEMAIL_DESTINATIONS.has(d)) return true;
  return /^vms\d+$/i.test(d);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isExternalCustomerPhone(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 9) return false;
  return !LIPOOUT_INFRA_DIGITS.has(digits);
}

function computeDisplayType(call: Pick<NormalizedCall, 'direction' | 'missed_reason'>): CallDisplayType {
  if (call.missed_reason === 'voicemail') return 'voicemail';
  if (call.direction === 'outbound') return 'outbound';
  if (call.direction === 'inbound') return 'inbound';
  return 'missed';
}

function isCustomerFacingCall(call: Pick<NormalizedCall, 'customer_phone'>): boolean {
  return isExternalCustomerPhone(call.customer_phone);
}

function canListenRecording(
  call: Pick<NormalizedCall, 'missed_reason' | 'recording_path' | 'recording_url' | 'duration_seconds' | 'id'>,
  phoneAccess: PhoneAccess,
): boolean {
  if (!call.recording_path && !(phoneAccess === 'all' && call.duration_seconds > 0 && call.id)) {
    return false;
  }
  if (phoneAccess === 'all') return true;
  if (phoneAccess === 'missed') return call.missed_reason === 'voicemail';
  return false;
}

function resolveDisplayParty(
  call: Pick<NormalizedCall, 'customer_phone'>,
  customer: CustomerMatch | null | undefined,
): string {
  if (customer?.name) return customer.name;
  const digits = digitsOnly(call.customer_phone);
  if (isExternalCustomerPhone(digits)) return call.customer_phone || digits;
  return call.customer_phone || '-';
}

function matchesDirectionFilter(call: NormalizedCall, direction?: Body['direction']): boolean {
  if (!direction) return true;
  const displayType = computeDisplayType(call);
  if (direction === 'voicemail') return displayType === 'voicemail';
  if (direction === 'missed') return displayType === 'missed';
  return displayType === direction;
}

function customerPhoneForCall(row: RawCdr): string {
  const source = pick(row, ['src', 'source', 'caller', 'callerid', 'clid']);
  const destination = pick(row, ['dst', 'destination', 'callee', 'did']);
  if (digitsOnly(source) === BUSINESS_PHONE) return destination;
  return source;
}

function isSuccessfullyAnswered(row: RawCdr): boolean {
  const destination = pick(row, ['dst', 'destination', 'callee', 'did']).toLowerCase();
  if (isVoicemailDestination(destination)) return false;
  const disposition = pick(row, ['disposition', 'status', 'dstchannel']).toUpperCase();
  const billsec = pickNumber(row, ['billsec', 'answered_seconds']);
  const duration = pickNumber(row, ['duration', 'duration_seconds']);
  const talkSeconds = billsec > 0 ? billsec : duration;
  return disposition.includes('ANSWERED') && talkSeconds > 0;
}

function deriveDirection(row: RawCdr, internalExtensionPattern: RegExp): CallDirection {
  const destination = pick(row, ['dst', 'destination', 'callee', 'did']).toLowerCase();
  const source = pick(row, ['src', 'source', 'caller', 'callerid', 'clid']);

  if (isVoicemailDestination(destination)) return 'missed';

  // Contestada con conversación: nunca es perdida (evita CDR duplicados de ring/buzón).
  if (isSuccessfullyAnswered(row)) {
    if (digitsOnly(source) === BUSINESS_PHONE) return 'outbound';
    return 'inbound';
  }

  const explicit = pick(row, ['direction', 'call_direction', 'type', 'call_type']).toLowerCase();
  if (['outbound', 'saliente', 'realizada'].includes(explicit)) return 'outbound';
  if (['inbound', 'entrante', 'recibida'].includes(explicit)) return 'inbound';
  if (['missed', 'perdida', 'lost'].includes(explicit)) return 'missed';

  const disposition = pick(row, ['disposition', 'status', 'dstchannel']).toUpperCase();
  if (disposition.includes('NO ANSWER')) return 'missed';
  if (digitsOnly(source) === BUSINESS_PHONE) return 'outbound';
  if (destination === INBOUND_DESTINATION) return 'inbound';

  const billsec = pickNumber(row, ['billsec', 'answered_seconds']);
  if ((disposition.includes('BUSY') || disposition.includes('FAILED')) && billsec === 0) {
    return 'missed';
  }

  return internalExtensionPattern.test(source) ? 'outbound' : 'inbound';
}

function stripMonitorPath(path: string): string {
  return path
    .replace(/^\/+/, '')
    .replace(/^var\/spool\/asterisk\/monitor\/?/i, '');
}

function recordingsBaseUrl(): string | null {
  const configured = Deno.env.get('ISSABEL_RECORDINGS_BASE_URL');
  if (configured) return configured.replace(/\/$/, '');
  const cdrUrl = Deno.env.get('ISSABEL_CDR_URL');
  if (!cdrUrl) return null;
  try {
    const origin = new URL(cdrUrl).origin;
    return `${origin}/monitor`;
  } catch {
    return null;
  }
}

function resolveRecordingPath(row: RawCdr, call: Pick<NormalizedCall, 'missed_reason' | 'id'>): string | null {
  const raw = pick(row, ['recording_url', 'recordingfile', 'recording']);
  if (raw) return raw;
  if (call.missed_reason === 'voicemail') {
    const uid = pick(row, ['uniqueid', 'id']) || call.id;
    if (uid) return `uniqueid:${uid}`;
  }
  return null;
}

function resolveRecordingUrl(row: RawCdr, recordingPath: string | null): string | null {
  if (!recordingPath) return null;
  if (/^https?:\/\//i.test(recordingPath)) return recordingPath;
  if (recordingPath.startsWith('uniqueid:')) {
    return buildRecordingFetchUrl(recordingPath);
  }
  const raw = recordingPath;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = recordingsBaseUrl();
  if (!base) return stripMonitorPath(raw);

  const path = stripMonitorPath(raw);
  return `${base}/${path}`;
}

function issabelAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: '*/*' };
  const token = Deno.env.get('ISSABEL_API_TOKEN');
  const username = Deno.env.get('ISSABEL_USERNAME');
  const password = Deno.env.get('ISSABEL_PASSWORD');
  if (token) {
    headers.Authorization = toHeaderByteString(`Bearer ${token}`);
  } else if (username && password) {
    headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
  }
  return headers;
}

function extractUniqueidFromRecording(recording: string): string | null {
  const base = stripMonitorPath(recording).split('/').pop() ?? recording;
  const match = base.match(/(\d+\.\d+)(?:\.(?:wav|gsm|WAV|GSM))?$/);
  return match ? match[1] : null;
}

function buildCdrRecordingUrl(
  cdrUrl: string,
  params: { uniqueid?: string; file?: string },
): string {
  const url = new URL(cdrUrl);
  if (params.uniqueid) {
    url.searchParams.set('format', 'wav');
    url.searchParams.set('uniqueid', params.uniqueid);
  } else if (params.file) {
    url.searchParams.set('file', params.file);
  }
  return url.toString();
}

function buildRecordingFetchUrl(recording: string): string | null {
  const cdrUrl = Deno.env.get('ISSABEL_CDR_URL');

  if (recording.startsWith('uniqueid:')) {
    const uniqueid = recording.slice('uniqueid:'.length);
    const template = Deno.env.get('ISSABEL_RECORDINGS_URL');
    if (template) return template.replaceAll('{uniqueid}', uniqueid);
    if (cdrUrl) return buildCdrRecordingUrl(cdrUrl, { uniqueid });
    return null;
  }

  if (/^https?:\/\//i.test(recording)) return recording;

  const monitorFile = stripMonitorPath(recording);
  const apiUrl = Deno.env.get('ISSABEL_RECORDINGS_URL');
  if (apiUrl) {
    const url = new URL(apiUrl);
    url.searchParams.set('file', monitorFile);
    return url.toString();
  }

  if (cdrUrl) {
    const uniqueid = extractUniqueidFromRecording(monitorFile);
    if (uniqueid) return buildCdrRecordingUrl(cdrUrl, { uniqueid });
    return buildCdrRecordingUrl(cdrUrl, { file: monitorFile });
  }

  const base = recordingsBaseUrl();
  if (!base) return null;
  return `${base}/${monitorFile}`;
}

type NormalizedCall = {
  id: string;
  linked_id: string;
  direction: CallDirection;
  started_at: string;
  caller: string;
  callee: string;
  customer_phone: string;
  duration_seconds: number;
  disposition: string;
  missed_reason: 'voicemail' | 'no_answer' | 'missed' | null;
  recording_url: string | null;
  recording_path: string | null;
  /** Tramo con conversación contestada (ANSWERED + segundos). */
  answered: boolean;
};

function normalizeCall(row: RawCdr, index: number, internalExtensionPattern: RegExp): NormalizedCall {
  const destination = pick(row, ['dst', 'destination', 'callee', 'did']).toLowerCase();
  const answered = isSuccessfullyAnswered(row);
  let direction = deriveDirection(row, internalExtensionPattern);
  if (!answered && isVoicemailDestination(destination)) direction = 'missed';

  const startedAt = pick(row, ['calldate', 'started_at', 'start', 'date', 'timestamp']);
  const linkedId = pick(row, ['linkedid', 'linked_id']) || pick(row, ['uniqueid', 'id']);
  const id = pick(row, ['uniqueid', 'id']) || linkedId || `${startedAt}-${index}`;
  const customerPhone = customerPhoneForCall(row);
  const dispositionRaw = pick(row, ['disposition', 'status']);
  const missedReason = direction === 'missed'
    ? isVoicemailDestination(destination)
      ? 'voicemail'
      : dispositionRaw.toUpperCase().includes('NO ANSWER')
        ? 'no_answer'
        : 'missed'
    : null;

  let dispositionLabel = dispositionRaw;
  if (isVoicemailDestination(destination)) {
    dispositionLabel = 'Buzón de voz';
  } else if (answered) {
    dispositionLabel = dispositionRaw || 'Contestada';
  } else if (!dispositionLabel && direction === 'missed') {
    dispositionLabel = 'Perdida';
  }

  const recordingPath = resolveRecordingPath(row, { missed_reason: missedReason, id });

  return {
    id,
    linked_id: linkedId || id,
    direction,
    started_at: normalizeDate(startedAt),
    caller: pick(row, ['src', 'source', 'caller', 'callerid', 'clid']),
    callee: pick(row, ['dst', 'destination', 'callee', 'did']),
    customer_phone: customerPhone,
    duration_seconds: pickNumber(row, ['billsec', 'duration_seconds', 'duration']),
    disposition: dispositionLabel,
    missed_reason: missedReason,
    recording_url: resolveRecordingUrl(row, recordingPath),
    recording_path: recordingPath,
    answered,
  };
}

function isOutboundFromBusiness(call: NormalizedCall): boolean {
  return digitsOnly(call.caller) === BUSINESS_PHONE;
}

/** Tramo de ring group / cola: cliente externo hacia extensión, cola o buzón. */
function isInboundRingLeg(call: NormalizedCall, internalPattern: RegExp): boolean {
  if (isOutboundFromBusiness(call)) return false;
  const dst = call.callee.toLowerCase();
  if (isVoicemailDestination(dst)) return true;
  if (dst === INBOUND_DESTINATION) return true;
  const dstDigits = digitsOnly(call.callee);
  return internalPattern.test(dstDigits) || internalPattern.test(call.callee);
}

/** Agrupa tramos de la misma llamada entrante (linkedid o mismo cliente en la misma ventana). */
function callGroupKey(call: NormalizedCall): string {
  const linked = call.linked_id?.trim();
  if (linked) return `lid:${linked}`;
  if (isOutboundFromBusiness(call)) return `uid:${call.id}`;
  const phone = digitsOnly(call.customer_phone);
  if (!phone) return `uid:${call.id}`;
  const ts = Date.parse(call.started_at);
  const bucket = Number.isFinite(ts) ? Math.floor(ts / 90_000) : 0;
  return `in:${phone}:${bucket}`;
}

function pickBestAnsweredLeg(legs: NormalizedCall[]): NormalizedCall {
  return legs
    .slice()
    .sort((a, b) => b.duration_seconds - a.duration_seconds || b.id.localeCompare(a.id))[0];
}

function pickBestMissedLeg(legs: NormalizedCall[]): NormalizedCall {
  return legs
    .slice()
    .sort((a, b) => {
      const aVm = a.missed_reason === 'voicemail' ? 1 : 0;
      const bVm = b.missed_reason === 'voicemail' ? 1 : 0;
      if (bVm !== aVm) return bVm - aVm;
      return b.duration_seconds - a.duration_seconds;
    })[0];
}

function callDedupeRank(call: NormalizedCall): number {
  if (call.answered && call.direction === 'inbound') return 6;
  if (call.answered && call.direction === 'outbound') return 5;
  if (call.direction === 'inbound' && call.duration_seconds > 0) return 4;
  if (call.direction === 'outbound' && call.duration_seconds > 0) return 3;
  if (call.direction === 'inbound') return 2;
  if (call.direction === 'outbound') return 1;
  return 0;
}

function isVoicemailLeg(call: NormalizedCall): boolean {
  return call.missed_reason === 'voicemail' || isVoicemailDestination(call.callee.toLowerCase());
}

/**
 * Varias extensiones del mismo grupo generan varios CDR.
 * Si alguna contesta → una sola Recibida; si va a buzón → Buzón de voz; si todas fallan → Perdida.
 */
function aggregateCallGroups(calls: NormalizedCall[], internalPattern: RegExp): NormalizedCall[] {
  const groups = new Map<string, NormalizedCall[]>();
  for (const call of calls) {
    const key = callGroupKey(call);
    const bucket = groups.get(key) ?? [];
    bucket.push(call);
    groups.set(key, bucket);
  }

  const result: NormalizedCall[] = [];

  for (const legs of groups.values()) {
    if (legs.length === 1) {
      result.push(legs[0]);
      continue;
    }

    const voicemailLegs = legs.filter((l) => isVoicemailLeg(l));
    if (voicemailLegs.length > 0) {
      const best = pickBestMissedLeg(voicemailLegs);
      const recordingPath = best.recording_path ?? `uniqueid:${best.id}`;
      result.push({
        ...best,
        direction: 'missed',
        answered: false,
        missed_reason: 'voicemail',
        disposition: 'Buzón de voz',
        recording_path: recordingPath,
        recording_url: buildRecordingFetchUrl(recordingPath),
      });
      continue;
    }

    const ringLegs = legs.filter((l) => isInboundRingLeg(l, internalPattern));
    const answeredLegs = legs.filter((l) => l.answered && !isVoicemailLeg(l));
    const missedRingLegs = ringLegs.filter(
      (l) => l.direction === 'missed' || l.missed_reason !== null,
    );

    if (answeredLegs.length > 0) {
      const best = pickBestAnsweredLeg(answeredLegs);
      result.push({
        ...best,
        direction: 'inbound',
        answered: true,
        missed_reason: null,
        disposition: best.disposition || 'Contestada',
      });
      continue;
    }

    if (ringLegs.length > 0 && missedRingLegs.length === ringLegs.length) {
      const best = pickBestMissedLeg(missedRingLegs);
      result.push({
        ...best,
        direction: 'missed',
        answered: false,
        disposition: 'Perdida',
      });
      continue;
    }

    result.push(
      legs.slice().sort((a, b) => callDedupeRank(b) - callDedupeRank(a))[0],
    );
  }

  return result.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

async function requireUser(req: Request): Promise<AppUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

async function resolvePhoneAccess(
  admin: ReturnType<typeof createClient>,
  user: AppUser,
): Promise<PhoneAccess> {
  if (user.email) {
    const { data: superuser } = await admin
      .from('superusers')
      .select('id')
      .ilike('email', user.email)
      .eq('is_active', true)
      .maybeSingle();
    if (superuser) return 'all';
  }

  const { data: canAll } = await admin.rpc('user_has_effective_permission', {
    p_user_id: user.id,
    p_resource: 'phone',
    p_action: 'read',
  });
  if (canAll === true) return 'all';

  const { data: canMissed } = await admin.rpc('user_has_effective_permission', {
    p_user_id: user.id,
    p_resource: 'phone',
    p_action: 'read_missed',
  });
  if (canMissed === true) return 'missed';

  return 'none';
}

async function fetchNormalizedCalls(
  body: Pick<Body, 'from' | 'to' | 'direction' | 'limit'>,
  internalPattern: RegExp,
): Promise<NormalizedCall[]> {
  const cdrUrl = Deno.env.get('ISSABEL_CDR_URL');
  if (!cdrUrl) throw new Error('Falta configurar ISSABEL_CDR_URL');

  const headers = { ...issabelAuthHeaders(), Accept: 'application/json' };
  const effectiveBody = body.direction === 'missed'
    ? { ...body, from: body.from ?? yesterdayDateString(), direction: undefined, limit: body.limit ?? 500 }
    : body;

  const response = await fetch(buildIssabelUrl(cdrUrl, effectiveBody as Body), { headers });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Issabel respondió HTTP ${response.status}: ${details.slice(0, 300)}`);
  }

  const payload = await response.json();
  const rows = extractRows(payload).map((row, index) => normalizeCall(row, index, internalPattern));
  return aggregateCallGroups(rows, internalPattern);
}

async function resolveCompanyId(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string,
): Promise<string | null> {
  if (requestedCompanyId) return requestedCompanyId;

  const { data: profileByUser } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (profileByUser?.[0]?.company_id) return profileByUser[0].company_id;

  const { data: profileById } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle();
  return profileById?.company_id ?? null;
}

function buildIssabelUrl(baseUrl: string, body: Body): string {
  const url = new URL(baseUrl);
  if (body.from) url.searchParams.set('from', body.from);
  if (body.to) url.searchParams.set('to', body.to);
  if (body.direction === 'outbound' || body.direction === 'inbound' || body.direction === 'missed') {
    url.searchParams.set('direction', body.direction);
  }
  url.searchParams.set('limit', String(Math.min(Math.max(body.limit ?? 1000, 1), 2000)));
  return url.toString();
}

function extractRows(payload: unknown): RawCdr[] {
  if (Array.isArray(payload)) return payload as RawCdr[];
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['calls', 'data', 'cdr', 'records', 'rows']) {
    if (Array.isArray(record[key])) return record[key] as RawCdr[];
  }
  return [];
}

function toHeaderByteString(value: string): string {
  return String.fromCharCode(...new TextEncoder().encode(value));
}

function phoneMatches(candidate: string | null | undefined, phone: string): boolean {
  const a = digitsOnly(candidate ?? '');
  const b = digitsOnly(phone);
  if (!a || !b) return false;
  const min = Math.min(9, a.length, b.length);
  return min >= 6 && (a.endsWith(b.slice(-min)) || b.endsWith(a.slice(-min)));
}

async function loadCustomerMatches(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  calls: Array<ReturnType<typeof normalizeCall>>,
): Promise<Map<string, CustomerMatch>> {
  const phones = [...new Set(calls.map((call) => digitsOnly(call.customer_phone)).filter((phone) => phone.length >= 6))];
  const matches = new Map<string, CustomerMatch>();
  if (phones.length === 0) return matches;

  const { data, error } = await admin
    .from('customers')
    .select('id, name, phone, phone_mobile, phone_home')
    .eq('company_id', companyId)
    .limit(10000);
  if (error) throw error;

  const customers = (data ?? []) as CustomerMatch[];
  for (const phone of phones) {
    const customer = customers.find((row) =>
      phoneMatches(row.phone, phone) ||
      phoneMatches(row.phone_mobile, phone) ||
      phoneMatches(row.phone_home, phone)
    );
    if (customer) matches.set(phone, customer);
  }
  return matches;
}

function applyRecordingAccess(
  call: NormalizedCall & { display_type?: CallDisplayType; display_party?: string; customer?: CustomerMatch | null },
  phoneAccess: PhoneAccess,
) {
  let recording_path = call.recording_path;
  if (phoneAccess === 'all' && !recording_path && call.duration_seconds > 0 && call.id) {
    recording_path = `uniqueid:${call.id}`;
  }
  const recording_url = recording_path ? buildRecordingFetchUrl(recording_path) : null;
  return {
    ...call,
    recording_path,
    recording_url,
    can_listen_recording: canListenRecording({ ...call, recording_path, recording_url }, phoneAccess),
  };
}

async function enrichCallsWithCustomers(
  admin: ReturnType<typeof createClient>,
  companyId: string | null,
  calls: Array<ReturnType<typeof normalizeCall>>,
  phoneAccess: PhoneAccess,
) {
  if (!companyId) {
    return calls.map((call) => applyRecordingAccess({
      ...call,
      display_type: computeDisplayType(call),
      display_party: resolveDisplayParty(call, null),
      customer: null,
    }, phoneAccess));
  }
  const matches = await loadCustomerMatches(admin, companyId, calls);
  return calls.map((call) => {
    const customer = matches.get(digitsOnly(call.customer_phone)) ?? null;
    return applyRecordingAccess({
      ...call,
      display_type: computeDisplayType(call),
      display_party: resolveDisplayParty(call, customer),
      customer,
    }, phoneAccess);
  });
}

function yesterdayDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function syncMissedCallNotifications(
  admin: ReturnType<typeof createClient>,
  userId: string,
  companyId: string,
  calls: Awaited<ReturnType<typeof enrichCallsWithCustomers>>,
) {
  const missed = calls.filter((call) => call.direction === 'missed');
  let created = 0;

  for (const call of missed) {
    const { data: existing, error: existingError } = await admin
      .from('notifications')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('type', 'phone_missed_call')
      .contains('metadata', { issabel_call_id: call.id })
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) continue;

    const customerName = call.customer?.name;
    const phone = call.customer_phone || call.caller || 'número desconocido';
    const isVoicemail = call.missed_reason === 'voicemail';
    const message = customerName
      ? isVoicemail
        ? `${phone} dejó un mensaje en el buzón de voz.`
        : `${phone} ha llamado y no se ha respondido.`
      : isVoicemail
        ? `${phone} dejó un mensaje en el buzón de voz.`
        : `${phone} ha llamado y no se ha respondido.`;

    const { error: insertError } = await admin.from('notifications').insert({
      company_id: companyId,
      user_id: userId,
      from_user_id: userId,
      title: customerName ? `Llamada perdida de ${customerName}` : 'Llamada perdida',
      message,
      type: 'phone_missed_call',
      link: call.customer?.id ? `/clientes?customer=${call.customer.id}` : '/telefono?filter=missed',
      metadata: {
        issabel_call_id: call.id,
        call_started_at: call.started_at,
        caller: call.caller,
        callee: call.callee,
        customer_phone: call.customer_phone,
        customer_id: call.customer?.id ?? null,
        recording_url: call.recording_url ?? null,
        recording_path: call.recording_path ?? null,
      },
    });
    if (insertError) throw insertError;
    created += 1;
  }

  return { created, missed: missed.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') return err('Método no permitido', 405);

  const user = await requireUser(req);
  if (!user) return err('No autorizado', 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido');
  }

  if (
    body.action !== 'calls.list' &&
    body.action !== 'calls.sync_missed' &&
    body.action !== 'calls.recording'
  ) {
    return err('Acción no soportada');
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const phoneAccess = await resolvePhoneAccess(admin, user);
  if (phoneAccess === 'none') return err('Sin permiso para teléfono', 403);

  const internalPattern = new RegExp(Deno.env.get('ISSABEL_INTERNAL_EXTENSIONS_REGEX') ?? '^\\d{2,6}$');

  if (body.action === 'calls.recording') {
    const recording = asString(body.recording);
    if (!recording) return err('Falta recording');

    if (phoneAccess === 'missed') {
      const callId = asString(body.call_id);
      if (!callId) return err('Falta call_id', 400);
      const callDate = asString(body.from) || asString(body.to) || yesterdayDateString();
      try {
        const calls = await fetchNormalizedCalls(
          { from: callDate, to: callDate, limit: 1000 },
          internalPattern,
        );
        const call = calls.find((row) => row.id === callId);
        if (!call || call.missed_reason !== 'voicemail') {
          return err('Solo puede escuchar mensajes del buzón de voz', 403);
        }
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Error al validar la llamada', 502);
      }
    }

    const targetUrl = buildRecordingFetchUrl(recording);
    if (!targetUrl) {
      return err('Falta configurar ISSABEL_RECORDINGS_BASE_URL o ISSABEL_RECORDINGS_URL', 500);
    }
    const recordingResponse = await fetch(targetUrl, { headers: issabelAuthHeaders() });
    const contentType = recordingResponse.headers.get('Content-Type') ?? '';
    const bodyBytes = await recordingResponse.arrayBuffer();
    if (!recordingResponse.ok) {
      const details = new TextDecoder().decode(bodyBytes).slice(0, 200);
      return err(`No se pudo obtener la grabación (${recordingResponse.status}): ${details}`, 502);
    }
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      return err(
        'Issabel no devolvió audio. Hay que habilitar descarga WAV en api_cdr.php (recordingfile o format=wav).',
        502,
      );
    }
    return new Response(bodyBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType || 'audio/wav',
      },
    });
  }

  const companyId = await resolveCompanyId(admin, user.id, body.company_id);

  let listBody: Body = { ...body };
  if (phoneAccess === 'missed' && (listBody.direction === 'outbound' || listBody.direction === 'inbound')) {
    listBody.direction = undefined;
  }

  let calls: Array<ReturnType<typeof normalizeCall>>;
  try {
    const needsWideFetch = listBody.action === 'calls.sync_missed' ||
      listBody.direction === 'missed' ||
      listBody.direction === 'voicemail' ||
      !listBody.direction;
    const fetchBody = needsWideFetch
      ? { ...listBody, direction: undefined, limit: listBody.limit ?? 1000 }
      : listBody;
    calls = await fetchNormalizedCalls(fetchBody, internalPattern);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Error Issabel', 502);
  }

  let filtered = calls.filter(isCustomerFacingCall);
  if (phoneAccess === 'missed') {
    filtered = filtered.filter((call) => {
      const displayType = computeDisplayType(call);
      return displayType === 'missed' || displayType === 'voicemail';
    });
    if (listBody.direction === 'missed' || listBody.direction === 'voicemail') {
      filtered = filtered.filter((call) => matchesDirectionFilter(call, listBody.direction));
    }
  } else {
    filtered = filtered.filter((call) => matchesDirectionFilter(call, listBody.direction));
  }
  const enriched = await enrichCallsWithCustomers(admin, companyId, filtered, phoneAccess);

  if (body.action === 'calls.sync_missed') {
    if (!companyId) return err('Sin empresa activa', 400);
    const missedCalls = enriched.filter((call) =>
      call.display_type === 'missed' || call.display_type === 'voicemail'
    );
    const sync = await syncMissedCallNotifications(admin, user.id, companyId, missedCalls);
    return json({
      ok: true,
      ...sync,
      calls: missedCalls,
    });
  }

  return json({ ok: true, calls: enriched });
});
