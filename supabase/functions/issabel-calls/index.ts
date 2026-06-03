import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CallDirection = 'outbound' | 'inbound' | 'missed';

type Body = {
  action: 'calls.list' | 'calls.sync_missed';
  company_id?: string;
  from?: string;
  to?: string;
  direction?: CallDirection;
  limit?: number;
};

type RawCdr = Record<string, unknown>;

type AppUser = {
  id: string;
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

function normalizeDate(value: string): string {
  if (!value) return new Date().toISOString();
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

const BUSINESS_PHONE = '881242909';
const INBOUND_DESTINATION = '100';
const VOICEMAIL_DESTINATION = 'vms102';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function customerPhoneForCall(row: RawCdr): string {
  const source = pick(row, ['src', 'source', 'caller', 'callerid', 'clid']);
  const destination = pick(row, ['dst', 'destination', 'callee', 'did']);
  if (digitsOnly(source) === BUSINESS_PHONE) return destination;
  return source;
}

function deriveDirection(row: RawCdr, internalExtensionPattern: RegExp): CallDirection {
  const explicit = pick(row, ['direction', 'call_direction', 'type', 'call_type']).toLowerCase();
  if (['outbound', 'saliente', 'realizada'].includes(explicit)) return 'outbound';
  if (['inbound', 'entrante', 'recibida'].includes(explicit)) return 'inbound';
  if (['missed', 'perdida', 'lost'].includes(explicit)) return 'missed';

  const destination = pick(row, ['dst', 'destination', 'callee', 'did']).toLowerCase();
  const source = pick(row, ['src', 'source', 'caller', 'callerid', 'clid']);
  const disposition = pick(row, ['disposition', 'status', 'dstchannel']).toUpperCase();
  if (disposition.includes('NO ANSWER')) return 'missed';
  if (digitsOnly(source) === BUSINESS_PHONE) return 'outbound';
  if (destination === VOICEMAIL_DESTINATION) return 'missed';
  if (destination === INBOUND_DESTINATION) return 'inbound';

  const billsec = pickNumber(row, ['billsec', 'answered_seconds']);
  if ((disposition.includes('BUSY') || disposition.includes('FAILED')) && billsec === 0) {
    return 'missed';
  }

  return internalExtensionPattern.test(source) ? 'outbound' : 'inbound';
}

function normalizeCall(row: RawCdr, index: number, internalExtensionPattern: RegExp) {
  const direction = deriveDirection(row, internalExtensionPattern);
  const startedAt = pick(row, ['calldate', 'started_at', 'start', 'date', 'timestamp']);
  const id = pick(row, ['uniqueid', 'linkedid', 'id']) || `${startedAt}-${index}`;
  const customerPhone = customerPhoneForCall(row);
  const disposition = pick(row, ['disposition', 'status']);
  const destination = pick(row, ['dst', 'destination', 'callee', 'did']).toLowerCase();
  const missedReason = direction === 'missed'
    ? destination === VOICEMAIL_DESTINATION
      ? 'voicemail'
      : disposition.toUpperCase().includes('NO ANSWER')
        ? 'no_answer'
        : 'missed'
    : null;

  return {
    id,
    direction,
    started_at: normalizeDate(startedAt),
    caller: pick(row, ['src', 'source', 'caller', 'callerid', 'clid']),
    callee: pick(row, ['dst', 'destination', 'callee', 'did']),
    customer_phone: customerPhone,
    duration_seconds: pickNumber(row, ['billsec', 'duration_seconds', 'duration']),
    disposition: disposition || (direction === 'missed' ? 'Perdida' : ''),
    missed_reason: missedReason,
    recording_url: pick(row, ['recording_url', 'recordingfile', 'recording']) || null,
  };
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
  return data.user;
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
  if (body.direction) url.searchParams.set('direction', body.direction);
  url.searchParams.set('limit', String(Math.min(Math.max(body.limit ?? 300, 1), 1000)));
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

async function enrichCallsWithCustomers(
  admin: ReturnType<typeof createClient>,
  companyId: string | null,
  calls: Array<ReturnType<typeof normalizeCall>>,
) {
  if (!companyId) return calls.map((call) => ({ ...call, customer: null }));
  const matches = await loadCustomerMatches(admin, companyId, calls);
  return calls.map((call) => ({
    ...call,
    customer: matches.get(digitsOnly(call.customer_phone)) ?? null,
  }));
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

  if (body.action !== 'calls.list' && body.action !== 'calls.sync_missed') return err('Acción no soportada');

  const cdrUrl = Deno.env.get('ISSABEL_CDR_URL');
  if (!cdrUrl) {
    return err('Falta configurar ISSABEL_CDR_URL en la función issabel-calls', 500);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = Deno.env.get('ISSABEL_API_TOKEN');
  const username = Deno.env.get('ISSABEL_USERNAME');
  const password = Deno.env.get('ISSABEL_PASSWORD');
  if (token) {
    headers.Authorization = toHeaderByteString(`Bearer ${token}`);
  } else if (username && password) {
    headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const companyId = await resolveCompanyId(admin, user.id, body.company_id);
  const effectiveBody = body.action === 'calls.sync_missed' || body.direction === 'missed'
    ? { ...body, from: body.from ?? yesterdayDateString(), direction: undefined, limit: body.limit ?? 500 }
    : body;

  const response = await fetch(buildIssabelUrl(cdrUrl, effectiveBody), { headers });
  if (!response.ok) {
    const details = await response.text();
    return err(`Issabel respondió HTTP ${response.status}: ${details.slice(0, 300)}`, 502);
  }

  const payload = await response.json();
  const internalPattern = new RegExp(Deno.env.get('ISSABEL_INTERNAL_EXTENSIONS_REGEX') ?? '^\\d{2,6}$');
  const calls = extractRows(payload).map((row, index) => normalizeCall(row, index, internalPattern));
  const filtered = body.direction ? calls.filter((call) => call.direction === body.direction) : calls;
  const enriched = await enrichCallsWithCustomers(admin, companyId, filtered);

  if (body.action === 'calls.sync_missed') {
    if (!companyId) return err('Sin empresa activa', 400);
    const sync = await syncMissedCallNotifications(admin, user.id, companyId, enriched);
    return json({ ok: true, ...sync, calls: enriched.filter((call) => call.direction === 'missed') });
  }

  return json({ ok: true, calls: enriched });
});
