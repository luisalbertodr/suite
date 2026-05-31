// Edge function: whatsapp-proxy
// ---------------------------------------------------------------------------
// Pasarela autenticada entre el frontend de la suite y la instancia Waha
// (https://waha.devlike.pro/) configurada para la empresa del usuario.
//
// Cada acción tiene un campo `action` en el body JSON. Ejemplos:
//   { "action": "session.status" }
//   { "action": "session.start" }
//   { "action": "session.stop" }
//   { "action": "session.logout" }
//   { "action": "session.qr" }
//   { "action": "chats.list" }
//   { "action": "messages.list", "chat_id": "34666...@c.us", "limit": 50 }
//   { "action": "messages.send", "chat_id": "...", "type": "text",
//       "text": "hola" }
//   { "action": "messages.send", "chat_id": "...", "type": "image",
//       "media_base64": "...", "mime_type": "image/jpeg",
//       "filename": "foto.jpg", "caption": "Mira" }
//   { "action": "media.download", "url": "<urlWaha>" }
//   { "action": "chat.mark_read", "chat_id": "..." }
//
// La función:
//   * Autentica con el JWT del usuario (header Authorization)
//   * Carga whatsapp_config de la empresa del usuario
//   * Llama a Waha usando base_url + api_key + session_name
//   * Persiste estado (last_status, qr_data_url, me_jid…) y mensajes salientes
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type WhatsappConfig = {
  company_id: string;
  base_url: string | null;
  api_key: string | null;
  session_name: string;
  webhook_secret: string | null;
  default_country_code: string | null;
  enabled: boolean;
  last_status: string | null;
  last_status_message: string | null;
  qr_data_url: string | null;
  me_jid: string | null;
  me_pushname: string | null;
};

type SendBody = {
  action: 'messages.send';
  chat_id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice';
  text?: string;
  caption?: string;
  media_base64?: string;
  mime_type?: string;
  filename?: string;
  reply_to_message_id?: string;
};

type ForwardBody = {
  action: 'messages.forward';
  chat_id: string;
  message_id: string;
};

type ActionBody = {
  company_id?: string;
} & (
  | { action: 'session.status' | 'session.start' | 'session.stop' | 'session.logout' | 'session.qr' }
  | { action: 'session.configure_webhook'; webhook_url?: string }
  | { action: 'system.ping' }
  | { action: 'chats.list'; limit?: number; offset?: number }
  | { action: 'messages.list'; chat_id: string; limit?: number; download_media?: boolean }
  | {
      action: 'messages.sync_history';
      limit_per_chat?: number;
      max_chats?: number;
      offset?: number;
      refresh_chats?: boolean;
      download_media?: boolean;
    }
  | SendBody
  | ForwardBody
  | { action: 'media.download'; url?: string; chat_id?: string; message_id?: string }
  | { action: 'chat.mark_read'; chat_id: string }
  | { action: 'chat.ensure'; chat_id: string; name?: string | null }
  | {
      action: 'chat.set_link';
      chat_id: string;
      customer_id?: string | null;
      marketing_lead_id?: string | null;
    }
  | { action: 'chat.search_link'; q: string; limit?: number }
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function isExternalCdnMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes('whatsapp.net') || h.includes('fbcdn.net');
  } catch {
    return false;
  }
}

/** Convierte URL de media de Waha (incl. localhost:3000/api/files/…) en path para wahaFetch. */
function wahaMediaFetchPath(cfg: WhatsappConfig, mediaUrl: string): string {
  if (mediaUrl.startsWith('/')) return mediaUrl;
  const parsed = new URL(mediaUrl);
  if (parsed.pathname.startsWith('/api/')) {
    return parsed.pathname + parsed.search;
  }
  const base = new URL(cfg.base_url!);
  if (parsed.hostname === base.hostname) {
    return parsed.pathname + parsed.search;
  }
  throw new Error('URL fuera del host Waha configurado');
}

async function fetchWahaMediaBytes(
  cfg: WhatsappConfig,
  mediaUrl: string,
): Promise<{ buf: ArrayBuffer; contentType: string | null }> {
  const path = wahaMediaFetchPath(cfg, mediaUrl);
  const resp = await wahaFetch(cfg, path);
  if (!resp.ok) throw new Error(`Waha download: HTTP ${resp.status}`);
  return {
    buf: await resp.arrayBuffer(),
    contentType: resp.headers.get('content-type'),
  };
}

function wahaMessageKeyId(messageId: string): string | null {
  const parts = messageId.split('_');
  if (parts.length >= 3) return parts[parts.length - 1] ?? null;
  return messageId || null;
}

async function downloadMediaViaMessage(
  cfg: WhatsappConfig,
  sessionName: string,
  chatId: string,
  messageId: string,
): Promise<{ buf: ArrayBuffer; contentType: string | null }> {
  const msgPath = `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(
    chatId,
  )}/messages/${encodeURIComponent(messageId)}?downloadMedia=true`;
  const msg = await wahaJson<{ media?: { url?: string; mimetype?: string } }>(cfg, msgPath);
  if (msg.media?.url) {
    const { buf, contentType } = await fetchWahaMediaBytes(cfg, msg.media.url);
    return { buf, contentType: msg.media.mimetype ?? contentType };
  }

  const keyId = wahaMessageKeyId(messageId);
  if (keyId) {
    for (const ext of ['webp', 'png', 'jpg', 'gif']) {
      const resp = await wahaFetch(
        cfg,
        `/api/files/${encodeURIComponent(sessionName)}/${keyId}.${ext}`,
      );
      if (resp.ok) {
        return {
          buf: await resp.arrayBuffer(),
          contentType: resp.headers.get('content-type'),
        };
      }
    }
  }

  throw new Error('Waha no devolvió media para este mensaje');
}

async function wahaFetch(
  cfg: WhatsappConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!cfg.base_url) throw new Error('WhatsApp no configurado: falta base_url');
  const headers = new Headers(init.headers ?? {});
  if (cfg.api_key) headers.set('X-Api-Key', cfg.api_key);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const url = `${trimSlash(cfg.base_url)}${path}`;
  return await fetch(url, { ...init, headers });
}

class WahaError extends Error {
  status: number;
  path: string;
  bodySnippet: string;
  server: string;
  wwwAuth: string;
  constructor(
    status: number,
    path: string,
    message: string,
    bodySnippet = '',
    server = '',
    wwwAuth = '',
  ) {
    super(message);
    this.status = status;
    this.path = path;
    this.bodySnippet = bodySnippet;
    this.server = server;
    this.wwwAuth = wwwAuth;
  }
}

function authHint(status: number, server: string, wwwAuth: string): string {
  if (status !== 401 && status !== 403) return '';
  const hints: string[] = [];
  if (wwwAuth) hints.push(`WWW-Authenticate: ${wwwAuth}`);
  if (server) hints.push(`Server: ${server}`);
  hints.push(
    'Revisa X-Api-Key en Configuración → WhatsApp. ' +
      'Si Waha se reinició, puede haber rotado la key (variable WHATSAPP_API_KEY / WAHA_API_KEY).',
  );
  return ` [${hints.join(' | ')}]`;
}

async function wahaJson<T = unknown>(
  cfg: WhatsappConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const resp = await wahaFetch(cfg, path, init);
  const text = await resp.text();
  const server = resp.headers.get('server') ?? '';
  const wwwAuth = resp.headers.get('www-authenticate') ?? '';
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new WahaError(
      resp.status,
      path,
      `Respuesta no JSON de Waha (HTTP ${resp.status}) en ${path}: ${text.slice(0, 200)}${authHint(resp.status, server, wwwAuth)}`,
      text.slice(0, 200),
      server,
      wwwAuth,
    );
  }
  if (!resp.ok) {
    const msg =
      (data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).message)
        : null) ?? `HTTP ${resp.status}`;
    throw new WahaError(
      resp.status,
      path,
      `Waha (${resp.status}) en ${path}: ${msg}${authHint(resp.status, server, wwwAuth)}`,
      text.slice(0, 200),
      server,
      wwwAuth,
    );
  }
  return data as T;
}

function normalizeChatId(raw: string, defaultCountryCode: string | null): string {
  let s = String(raw ?? '').trim();
  if (!s) return s;
  if (s.includes('@')) return s;
  s = s.replace(/[^0-9]/g, '');
  if (!s) return raw;
  if (defaultCountryCode && s.length <= 9) s = `${defaultCountryCode}${s}`;
  return `${s}@c.us`;
}

function isGroupJid(jid: string | null | undefined): boolean {
  return !!jid && /@g\.us$/i.test(jid);
}

function isSystemChatJid(jid: string | null | undefined): boolean {
  if (!jid) return false;
  const j = jid.toLowerCase();
  if (j === 'status@broadcast') return true;
  if (j.endsWith('@broadcast')) return true;
  if (j.endsWith('@newsletter')) return true;
  return false;
}

function isPhoneJid(jid: string | null | undefined): boolean {
  return !!jid && /@(c\.us|s\.whatsapp\.net)$/i.test(jid);
}

function isLidJid(jid: string | null | undefined): boolean {
  return !!jid && /@lid$/i.test(jid);
}

function normalizeWhatsappJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/i, '@c.us');
}

function pickBestSenderJid(...candidates: (string | null | undefined)[]): string | null {
  const list = candidates
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((j) => (isPhoneJid(j) ? normalizeWhatsappJid(j) : j));
  const phone = list.find(isPhoneJid);
  if (phone) return phone;
  const nonGroupNonLid = list.find((j) => !isGroupJid(j) && !isLidJid(j));
  if (nonGroupNonLid) return nonGroupNonLid;
  const nonGroup = list.find((j) => !isGroupJid(j));
  return nonGroup ?? list[0] ?? null;
}

function extractMessageKey(raw: unknown): {
  participant?: string;
  participantAlt?: string;
  remoteJidAlt?: string;
  remoteJid?: string;
  fromMe?: boolean;
} | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  const top = r.key as Record<string, unknown> | undefined;
  if (top?.remoteJid) return top as ReturnType<typeof extractMessageKey>;
  const data = r._data as Record<string, unknown> | undefined;
  const nested = data?.key as Record<string, unknown> | undefined;
  if (nested?.remoteJid) return nested as ReturnType<typeof extractMessageKey>;
  return (top as ReturnType<typeof extractMessageKey>) ?? null;
}

function resolveGroupSenderJid(raw: unknown, fallbackFrom?: string | null): string | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const key = extractMessageKey(raw);
  const data = r?._data as Record<string, unknown> | undefined;
  return pickBestSenderJid(
    key?.participantAlt,
    key?.participant,
    data?.author as string,
    r?.author as string,
    fallbackFrom && isPhoneJid(fallbackFrom) ? fallbackFrom : null,
    fallbackFrom && !isGroupJid(fallbackFrom) ? fallbackFrom : null,
  );
}

function resolveIncomingFromJid(
  chatId: string,
  fromMe: boolean,
  rawFrom: string | null | undefined,
  raw: unknown,
  key?: { participant?: string; participantAlt?: string; remoteJidAlt?: string } | null,
): string | null {
  if (fromMe) return null;
  const isGroup = isGroupJid(chatId);
  if (isGroup) return resolveGroupSenderJid(raw, rawFrom ?? null);
  return pickBestSenderJid(
    key?.remoteJidAlt,
    key?.participantAlt,
    rawFrom && !isGroupJid(rawFrom) ? rawFrom : null,
  );
}

function extractPhoneDigits(jid: string | null | undefined): string | null {
  if (!jid || isLidJid(jid) || isGroupJid(jid)) return null;
  const local = jid.split('@')[0] ?? '';
  const digits = local.replace(/[^0-9]/g, '');
  return digits.length >= 6 ? digits : null;
}

function jidsSameContact(a: string, b: string): boolean {
  if (a === b) return true;
  const da = extractPhoneDigits(a);
  const db = extractPhoneDigits(b);
  return !!(da && db && da === db);
}

function resolveCanonicalChatId(
  remoteJid: string,
  isGroup = false,
): string {
  if (isGroup) return remoteJid;
  if (isLidJid(remoteJid)) return remoteJid;
  if (isPhoneJid(remoteJid)) return normalizeWhatsappJid(remoteJid);
  return remoteJid;
}

async function migrateChatIfNeeded(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  targetChatId: string,
  sourceChatId: string,
): Promise<void> {
  if (targetChatId === sourceChatId) return;

  const { data: source } = await admin
    .from('whatsapp_chats')
    .select('*')
    .eq('company_id', companyId)
    .eq('chat_id', sourceChatId)
    .maybeSingle();
  if (!source) {
    await admin
      .from('whatsapp_messages')
      .update({ chat_id: targetChatId })
      .eq('company_id', companyId)
      .eq('chat_id', sourceChatId);
    return;
  }

  const { data: target } = await admin
    .from('whatsapp_chats')
    .select('*')
    .eq('company_id', companyId)
    .eq('chat_id', targetChatId)
    .maybeSingle();

  await admin
    .from('whatsapp_messages')
    .update({ chat_id: targetChatId })
    .eq('company_id', companyId)
    .eq('chat_id', sourceChatId);

  if (target) {
    const sourceTime = source.last_message_at
      ? new Date(source.last_message_at).getTime()
      : 0;
    const targetTime = target.last_message_at
      ? new Date(target.last_message_at).getTime()
      : 0;
    const useSourcePreview = sourceTime >= targetTime;
    await admin
      .from('whatsapp_chats')
      .update({
        name: target.name ?? source.name,
        customer_id: target.customer_id ?? source.customer_id,
        marketing_lead_id: target.marketing_lead_id ?? source.marketing_lead_id,
        profile_picture_url: target.profile_picture_url ?? source.profile_picture_url,
        unread_count: (Number(target.unread_count ?? 0) + Number(source.unread_count ?? 0)) || 0,
        last_message_preview: useSourcePreview
          ? source.last_message_preview ?? target.last_message_preview
          : target.last_message_preview ?? source.last_message_preview,
        last_message_at: useSourcePreview
          ? source.last_message_at ?? target.last_message_at
          : target.last_message_at ?? source.last_message_at,
        last_message_from_me: useSourcePreview
          ? source.last_message_from_me
          : target.last_message_from_me,
      })
      .eq('id', target.id);
    await admin.from('whatsapp_chats').delete().eq('id', source.id);
  } else {
    await admin
      .from('whatsapp_chats')
      .update({ chat_id: targetChatId })
      .eq('id', source.id);
  }
}

async function resolveChatIdForStorage(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  remoteJid: string,
  key?: { remoteJidAlt?: string } | null,
  isGroup = false,
): Promise<string> {
  let canonical = resolveCanonicalChatId(remoteJid, isGroup);
  if (isGroup) return canonical;

  const altPhone = key?.remoteJidAlt;
  if (isLidJid(canonical) && altPhone && isPhoneJid(altPhone)) {
    await migrateChatIfNeeded(admin, companyId, canonical, normalizeWhatsappJid(altPhone));
  }

  const { data: siblings } = await admin
    .from('whatsapp_chats')
    .select('chat_id')
    .eq('company_id', companyId)
    .neq('chat_id', canonical)
    .limit(500);
  for (const row of siblings ?? []) {
    if (jidsSameContact(row.chat_id, canonical)) {
      await migrateChatIfNeeded(admin, companyId, canonical, row.chat_id);
      continue;
    }
    if (
      isPhoneJid(canonical) &&
      isLidJid(row.chat_id) &&
      altPhone &&
      jidsSameContact(normalizeWhatsappJid(altPhone), canonical)
    ) {
      await migrateChatIfNeeded(admin, companyId, row.chat_id, canonical);
      canonical = row.chat_id;
    }
  }

  return canonical;
}

type WahaMsg = {
  id: string;
  from?: string;
  fromMe?: boolean;
  body?: string;
  caption?: string;
  timestamp?: number;
  type?: string;
  ack?: number;
  hasMedia?: boolean;
  author?: string;
  pushName?: string;
  key?: {
    participant?: string;
    participantAlt?: string;
    remoteJidAlt?: string;
  };
  _data?: { author?: string; notifyName?: string };
  media?: {
    url?: string;
    mimetype?: string;
    filename?: string;
    size?: number;
  };
  quotedMsg?: { id?: string } | null;
};

async function fetchWahaChatMessages(
  cfg: WhatsappConfig,
  sessionName: string,
  chatId: string,
  limit: number,
  downloadMedia: boolean,
): Promise<WahaMsg[]> {
  const dlFlag = downloadMedia ? 'true' : 'false';
  const newPath = `/api/messages?session=${encodeURIComponent(
    sessionName,
  )}&chatId=${encodeURIComponent(chatId)}&limit=${limit}&downloadMedia=${dlFlag}`;
  const oldPath = `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(
    chatId,
  )}/messages?limit=${limit}&downloadMedia=${dlFlag}`;

  try {
    return await wahaJson<WahaMsg[]>(cfg, newPath);
  } catch (e1) {
    if (!(e1 instanceof WahaError)) throw e1;
    try {
      return await wahaJson<WahaMsg[]>(cfg, oldPath);
    } catch (e2) {
      if (!(e2 instanceof WahaError)) throw e2;
      const pick =
        e1.status === 401 || e1.status === 403
          ? e1
          : e2.status === 401 || e2.status === 403
            ? e2
            : e2;
      throw pick;
    }
  }
}

async function syncChatMessagesFromWaha(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  companyId: string,
  sessionName: string,
  chatId: string,
  limit: number,
  downloadMedia = false,
): Promise<number> {
  if (isSystemChatJid(chatId)) return 0;
  let data: WahaMsg[] = [];
  try {
    data = await fetchWahaChatMessages(cfg, sessionName, chatId, limit, downloadMedia);
  } catch (e) {
    if (!(e instanceof WahaError)) throw e;
    if (e.status === 401 || e.status === 403) throw e;

    let warmupOk = false;
    try {
      await wahaJson(
        cfg,
        `/api/${encodeURIComponent(sessionName)}/chats?limit=20`,
      );
      warmupOk = true;
    } catch {
      // ignore
    }

    if (warmupOk) {
      try {
        data = await fetchWahaChatMessages(cfg, sessionName, chatId, limit, downloadMedia);
      } catch (e3) {
        if (e3 instanceof WahaError && (e3.status === 401 || e3.status === 403)) {
          throw e3;
        }
        console.warn('syncChatMessagesFromWaha non-fatal failure:', e3);
        return 0;
      }
    } else {
      console.warn('syncChatMessagesFromWaha non-fatal failure:', e);
      return 0;
    }
  }

  if (!Array.isArray(data) || data.length === 0) return 0;

  const isGroupChat = isGroupJid(chatId);
  const sampleKey = data.find((m) => extractMessageKey(m));
  const storageChatId = await resolveChatIdForStorage(
    admin,
    companyId,
    chatId,
    sampleKey ? extractMessageKey(sampleKey) : null,
    isGroupChat,
  );
  const rows = data.map((m) => ({
    company_id: companyId,
    chat_id: storageChatId,
    waha_message_id: m.id,
    from_jid: resolveIncomingFromJid(
      chatId,
      !!m.fromMe,
      m.from ?? null,
      m,
      extractMessageKey(m),
    ),
    from_me: !!m.fromMe,
    type: m.type ?? 'text',
    body: m.body ?? null,
    caption: m.caption ?? null,
    media_url: m.media?.url ?? null,
    media_mime_type: m.media?.mimetype ?? null,
    media_filename: m.media?.filename ?? null,
    media_size: m.media?.size ?? null,
    ack: Number(m.ack ?? 0) || 0,
    quoted_message_id: m.quotedMsg?.id ?? null,
    timestamp: m.timestamp
      ? new Date(m.timestamp * 1000).toISOString()
      : new Date().toISOString(),
    raw: m as unknown,
  }));
  await admin
    .from('whatsapp_messages')
    .upsert(rows, {
      onConflict: 'company_id,waha_message_id',
      ignoreDuplicates: false,
    });
  return data.length;
}

const WEBHOOK_EVENTS = [
  'message',
  'message.any',
  'message.ack',
  'message.reaction',
  'state.change',
  'session.status',
  'engine.event',
  'chat.archive',
];

function buildWebhookUrl(
  supabaseUrl: string,
  companyId: string,
  webhookSecret: string,
): string {
  const params = new URLSearchParams({
    company_id: companyId,
    secret: webhookSecret,
  });
  const base = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/whatsapp-webhook`;
  return `${base}?${params.toString()}`;
}

/** Config mínima de sesión Waha: store NOWEB + webhook hacia Supabase. */
function buildWahaSessionConfig(
  supabaseUrl: string,
  companyId: string,
  cfg: WhatsappConfig,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    noweb: {
      store: { enabled: true, fullSync: false },
    },
  };
  if (cfg.webhook_secret) {
    config.webhooks = [
      {
        url: buildWebhookUrl(supabaseUrl, companyId, cfg.webhook_secret),
        events: WEBHOOK_EVENTS,
        retries: { policy: 'linear', delaySeconds: 2, attempts: 3 },
        customHeaders: [{ name: 'X-Webhook-Secret', value: cfg.webhook_secret }],
      },
    ];
  }
  return config;
}

type WahaSessionSnapshot = {
  config?: {
    webhooks?: unknown[];
    noweb?: { store?: { enabled?: boolean } };
  };
};

function readWahaSessionHealth(session: WahaSessionSnapshot | null): {
  webhooksConfigured: boolean;
  nowebStoreEnabled: boolean;
} {
  const webhooks = session?.config?.webhooks;
  return {
    webhooksConfigured: Array.isArray(webhooks) && webhooks.length > 0,
    nowebStoreEnabled: !!session?.config?.noweb?.store?.enabled,
  };
}

async function fetchWahaSession(
  cfg: WhatsappConfig,
  sessionName: string,
): Promise<WahaSessionSnapshot | null> {
  try {
    return await wahaJson<WahaSessionSnapshot>(
      cfg,
      `/api/sessions/${encodeURIComponent(sessionName)}`,
    );
  } catch {
    return null;
  }
}

/** Aplica store NOWEB + webhook si faltan (sin esto no entran mensajes). */
async function ensureWahaSessionConfig(
  cfg: WhatsappConfig,
  supabaseUrl: string,
  companyId: string,
  sessionName: string,
): Promise<{ webhooksConfigured: boolean; nowebStoreEnabled: boolean }> {
  let session = await fetchWahaSession(cfg, sessionName);
  let health = readWahaSessionHealth(session);
  if (health.webhooksConfigured && health.nowebStoreEnabled) return health;

  const sessionConfig = buildWahaSessionConfig(supabaseUrl, companyId, cfg);
  try {
    await wahaJson(cfg, `/api/sessions/${encodeURIComponent(sessionName)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: sessionName, config: sessionConfig }),
    });
  } catch (e) {
    console.warn('ensureWahaSessionConfig PUT failed:', e);
  }

  session = await fetchWahaSession(cfg, sessionName);
  health = readWahaSessionHealth(session);
  return health;
}

function resolveOutgoingWahaId(
  res: {
    id?: { id?: string; _serialized?: string; remote?: string };
    _data?: { id?: { id?: string; _serialized?: string; remote?: string }; to?: string };
    to?: string;
  },
  chatId: string,
): string | null {
  const serialized =
    res?.id?._serialized ??
    res?._data?.id?._serialized ??
    null;
  if (typeof serialized === 'string' && serialized.trim()) return serialized.trim();
  const keyId = res?.id?.id ?? res?._data?.id?.id ?? null;
  const remote =
    res?.id?.remote ??
    res?._data?.id?.remote ??
    res?.to ??
    res?._data?.to ??
    chatId;
  if (keyId && typeof remote === 'string' && remote.includes('@')) {
    return `true_${remote}_${keyId}`;
  }
  return keyId;
}

function wahaIdSuffix(id: string | null | undefined): string | null {
  if (!id) return null;
  const parts = id.split('_');
  return parts.length >= 3 ? parts[parts.length - 1] ?? null : id;
}

async function findExistingOutgoingMessage(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  chatId: string,
  wahaId: string | null,
  body: string | null,
): Promise<Record<string, unknown> | null> {
  if (wahaId) {
    const { data } = await admin
      .from('whatsapp_messages')
      .select('*')
      .eq('company_id', companyId)
      .eq('waha_message_id', wahaId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
    const suffix = wahaIdSuffix(wahaId);
    if (suffix) {
      const { data: rows } = await admin
        .from('whatsapp_messages')
        .select('*')
        .eq('company_id', companyId)
        .eq('chat_id', chatId)
        .eq('from_me', true)
        .like('waha_message_id', `%_${suffix}`)
        .limit(1);
      if (rows?.[0]) return rows[0] as Record<string, unknown>;
    }
  }
  if (body) {
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data } = await admin
      .from('whatsapp_messages')
      .select('*')
      .eq('company_id', companyId)
      .eq('chat_id', chatId)
      .eq('from_me', true)
      .eq('body', body)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

async function deleteGhostOutgoingMessages(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  chatId: string,
  body: string | null,
): Promise<void> {
  const since = new Date(Date.now() - 120_000).toISOString();
  let q = admin
    .from('whatsapp_messages')
    .delete()
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .eq('from_me', true)
    .is('waha_message_id', null)
    .gte('timestamp', since);
  if (body) q = q.eq('body', body);
  await q;
}

/** Resuelve la empresa activa (multi-empresa) igual que meta-sync-leads. */
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
  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return err('Faltan variables de entorno de Supabase', 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return err('Falta token de autenticación', 401);

    const admin = createClient(supabaseUrl, serviceKey);

    let body: ActionBody;
    try {
      body = (await req.json()) as ActionBody;
    } catch {
      return err('Body JSON inválido');
    }
    if (!body || typeof body !== 'object' || !('action' in body)) {
      return err('Falta `action`');
    }

    const isServiceSync =
      token === serviceKey && body.action === 'messages.sync_history';

    let companyId: string | null = null;
    if (isServiceSync) {
      if (typeof body.company_id !== 'string' || !body.company_id) {
        return err('Falta company_id');
      }
      companyId = body.company_id;
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return err('Usuario no autenticado', 401);

      companyId = await resolveCompanyId(
        admin,
        userData.user.id,
        typeof body.company_id === 'string' ? body.company_id : undefined,
      );
      if (!companyId) {
        return err('No se encontró empresa para el usuario');
      }
    }

    const { data: cfgRow, error: cfgErr } = await admin
      .from('whatsapp_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    const cfg = cfgRow as WhatsappConfig | null;
    if (!cfg) {
      return err(
        'WhatsApp no configurado. Configura Waha en Configuración → WhatsApp.',
      );
    }
    if (!cfg.base_url) {
      return err('Falta la URL base de Waha en la configuración.');
    }

    const sessionName = cfg.session_name || 'default';
    const updateCfg = async (values: Partial<WhatsappConfig>) => {
      await admin
        .from('whatsapp_config')
        .update(values as Record<string, unknown>)
        .eq('company_id', companyId);
    };

    switch (body.action) {
      case 'session.status': {
        try {
          const data = await wahaJson<{
            name?: string;
            status?: string;
            engine?: unknown;
            me?: { id?: string; pushName?: string } | null;
            config?: WahaSessionSnapshot['config'];
          }>(cfg, `/api/sessions/${encodeURIComponent(sessionName)}`);
          const health = readWahaSessionHealth(data);
          await updateCfg({
            last_status: data.status ?? null,
            last_status_message: null,
            last_status_at: new Date().toISOString(),
            me_jid: data.me?.id ?? null,
            me_pushname: data.me?.pushName ?? null,
          });
          return json({
            ok: true,
            status: data.status,
            me: data.me ?? null,
            webhooks_configured: health.webhooksConfigured,
            noweb_store_enabled: health.nowebStoreEnabled,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error consultando sesión';
          await updateCfg({
            last_status: 'UNKNOWN',
            last_status_message: msg,
            last_status_at: new Date().toISOString(),
          });
          return json({ ok: false, status: 'UNKNOWN', error: msg });
        }
      }

      case 'session.start': {
        const health = await ensureWahaSessionConfig(
          cfg,
          supabaseUrl,
          companyId,
          sessionName,
        );
        try {
          await wahaJson(cfg, `/api/sessions/${encodeURIComponent(sessionName)}/start`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
        } catch {
          // Fallback para versiones que aceptan {name} en /api/sessions/start
          await wahaJson(cfg, `/api/sessions/start`, {
            method: 'POST',
            body: JSON.stringify({ name: sessionName }),
          }).catch(() => undefined);
        }
        await updateCfg({
          last_status: 'STARTING',
          last_status_message: null,
          last_status_at: new Date().toISOString(),
        });
        return json({ ok: true, ...health });
      }

      case 'session.stop': {
        try {
          await wahaJson(cfg, `/api/sessions/${encodeURIComponent(sessionName)}/stop`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
        } catch {
          await wahaJson(cfg, `/api/sessions/stop`, {
            method: 'POST',
            body: JSON.stringify({ name: sessionName }),
          }).catch(() => undefined);
        }
        await updateCfg({
          last_status: 'STOPPED',
          last_status_at: new Date().toISOString(),
        });
        return json({ ok: true });
      }

      case 'session.logout': {
        try {
          await wahaJson(cfg, `/api/sessions/${encodeURIComponent(sessionName)}/logout`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error en logout';
          return err(msg);
        }
        await updateCfg({
          last_status: 'STOPPED',
          me_jid: null,
          me_pushname: null,
          qr_data_url: null,
          last_status_at: new Date().toISOString(),
        });
        return json({ ok: true });
      }

      case 'session.qr': {
        // Waha expone /api/{session}/auth/qr?format=image (devuelve PNG) o
        // ?format=raw (devuelve el código de texto). Probamos image primero.
        const resp = await wahaFetch(
          cfg,
          `/api/${encodeURIComponent(sessionName)}/auth/qr?format=image`,
        );
        if (!resp.ok) {
          const text = await resp.text();
          return err(`Waha QR: HTTP ${resp.status} ${text.slice(0, 200)}`);
        }
        const buf = new Uint8Array(await resp.arrayBuffer());
        // Codifica a base64 manualmente (chunks para no romper la pila de
        // String.fromCharCode con buffers grandes).
        let binary = '';
        for (let i = 0; i < buf.length; i += 0x8000) {
          binary += String.fromCharCode(
            ...buf.subarray(i, Math.min(buf.length, i + 0x8000)),
          );
        }
        const dataUrl = `data:image/png;base64,${btoa(binary)}`;
        await updateCfg({
          qr_data_url: dataUrl,
          qr_updated_at: new Date().toISOString(),
        });
        return json({ ok: true, qr_data_url: dataUrl });
      }

      case 'system.ping': {
        // Diagnóstico paso a paso para diferenciar entre:
        //   1) Waha inalcanzable
        //   2) Waha alcanzable pero API key inválida
        //   3) API key OK pero session_name no existe
        const result: {
          base_url: string;
          session_name: string;
          public_ok: boolean;
          public_status?: number;
          public_error?: string;
          public_body_snippet?: string;
          auth_ok: boolean;
          auth_status?: number;
          auth_error?: string;
          auth_server?: string;
          auth_www_auth?: string;
          sessions?: Array<{ name?: string; status?: string }>;
          session_in_list?: boolean;
        } = {
          base_url: cfg.base_url ?? '',
          session_name: sessionName,
          public_ok: false,
          auth_ok: false,
        };

        // 1) Endpoint público (sin X-Api-Key)
        try {
          const r = await fetch(`${trimSlash(cfg.base_url!)}/ping`);
          result.public_status = r.status;
          const t = await r.text();
          result.public_body_snippet = t.slice(0, 200);
          result.public_ok = r.ok;
        } catch (e) {
          result.public_error = e instanceof Error ? e.message : 'fetch failed';
        }

        // 2) Endpoint autenticado: /api/sessions devuelve lista de sesiones
        try {
          const sessions = await wahaJson<Array<{ name?: string; status?: string }>>(
            cfg,
            `/api/sessions`,
          );
          result.auth_ok = true;
          result.sessions = sessions.map((s) => ({
            name: s.name,
            status: s.status,
          }));
          result.session_in_list = !!sessions.find((s) => s.name === sessionName);
        } catch (e) {
          if (e instanceof WahaError) {
            result.auth_status = e.status;
            result.auth_error = e.message;
            result.auth_server = e.server;
            result.auth_www_auth = e.wwwAuth;
          } else {
            result.auth_error = e instanceof Error ? e.message : 'error';
          }
        }

        return json({ ok: true, diagnostics: result });
      }

      case 'session.configure_webhook': {
        if (!cfg.webhook_secret) {
          return err(
            'Falta el secreto del webhook. Genera uno en Configuración → WhatsApp.',
          );
        }
        const webhookUrl = buildWebhookUrl(supabaseUrl, companyId, cfg.webhook_secret);
        const sessionConfig = buildWahaSessionConfig(supabaseUrl, companyId, cfg);
        const putPath = `/api/sessions/${encodeURIComponent(sessionName)}`;
        const altPath = `/api/sessions`;
        const putBody = JSON.stringify({ name: sessionName, config: sessionConfig });

        let configured = false;
        let lastError: WahaError | null = null;
        try {
          await wahaJson(cfg, putPath, { method: 'PUT', body: putBody });
          configured = true;
        } catch (e1) {
          if (e1 instanceof WahaError) lastError = e1;
          else throw e1;
        }
        if (!configured) {
          try {
            await wahaJson(cfg, altPath, { method: 'POST', body: putBody });
            configured = true;
          } catch (e2) {
            if (e2 instanceof WahaError) lastError = e2;
            else throw e2;
          }
        }
        if (!configured && lastError) {
          return err(lastError.message, lastError.status === 401 || lastError.status === 403 ? 401 : 502);
        }
        const health = await ensureWahaSessionConfig(cfg, supabaseUrl, companyId, sessionName);
        return json({
          ok: true,
          webhook_url: webhookUrl,
          events: WEBHOOK_EVENTS,
          ...health,
        });
      }

      case 'chats.list': {
        const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 200);
        const offset = Math.max(Number(body.offset ?? 0), 0);
        let data: Array<{
          id: string;
          name?: string;
          isGroup?: boolean;
          unreadCount?: number;
          archived?: boolean;
          pinned?: boolean;
          timestamp?: number;
          lastMessage?: {
            body?: string;
            fromMe?: boolean;
            timestamp?: number;
            type?: string;
          };
          picture?: string | null;
        }> = [];
        try {
          data = await wahaJson<typeof data>(
            cfg,
            `/api/${encodeURIComponent(sessionName)}/chats?limit=${limit}&offset=${offset}`,
          );
        } catch (e) {
          if (e instanceof WahaError) {
            // Auth: error real
            if (e.status === 401 || e.status === 403) {
              return err(e.message, 401);
            }
            // Otros errores (bug de webjs, sesión inestable…) no son fatales:
            // los chats van llegando vía webhook. Devolvemos OK con warning.
            console.warn('chats.list non-fatal failure:', e);
            return json({ ok: true, count: 0, warning: e.message });
          }
          throw e;
        }

        if (Array.isArray(data) && data.length > 0) {
          data = data.filter((c) => !isSystemChatJid(c.id));
          const rows = data.map((c) => ({
            company_id: companyId,
            chat_id: c.id,
            name: c.name ?? null,
            is_group: !!c.isGroup || /@g\.us$/i.test(c.id),
            profile_picture_url: c.picture ?? null,
            last_message_preview: c.lastMessage?.body ?? null,
            last_message_at: c.lastMessage?.timestamp
              ? new Date(c.lastMessage.timestamp * 1000).toISOString()
              : c.timestamp
                ? new Date(c.timestamp * 1000).toISOString()
                : null,
            last_message_from_me: !!c.lastMessage?.fromMe,
            unread_count: Number(c.unreadCount ?? 0) || 0,
            pinned: !!c.pinned,
            archived: !!c.archived,
            raw: c as unknown,
          }));
          await admin
            .from('whatsapp_chats')
            .upsert(rows, { onConflict: 'company_id,chat_id' });

          // Intentamos auto-vincular cada chat con cliente/lead. Lo hacemos en
          // serie para no saturar PG, pero sin frenar la respuesta más de unos
          // milisegundos por chat.
          for (const c of data) {
            if (isSystemChatJid(c.id)) continue;
            try {
              await admin.rpc('whatsapp_auto_link_chat', {
                p_company_id: companyId,
                p_chat_id: c.id,
              });
            } catch {
              // Ignorar: solo es una mejora opcional
            }
          }
        }
        return json({ ok: true, count: Array.isArray(data) ? data.length : 0 });
      }

      case 'messages.list': {
        const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 200);
        const chatId = body.chat_id;
        if (!chatId) return err('Falta chat_id');
        const count = await syncChatMessagesFromWaha(
          admin,
          cfg,
          companyId,
          sessionName,
          chatId,
          limit,
          !!body.download_media,
        );
        return json({ ok: true, count });
      }

      case 'messages.sync_history': {
        const limitPerChat = Math.min(
          Math.max(Number(body.limit_per_chat ?? 200), 1),
          200,
        );
        const maxChats = Math.min(Math.max(Number(body.max_chats ?? 30), 1), 80);
        const offset = Math.max(Number(body.offset ?? 0), 0);
        const refreshChats = body.refresh_chats !== false;

        if (refreshChats && offset === 0) {
          try {
            const chatData = await wahaJson<Array<{ id: string }>>(
              cfg,
              `/api/${encodeURIComponent(sessionName)}/chats?limit=150&offset=0`,
            );
            if (Array.isArray(chatData) && chatData.length > 0) {
              const rows = chatData.map((c) => ({
                company_id: companyId,
                chat_id: c.id,
              }));
              await admin
                .from('whatsapp_chats')
                .upsert(rows, { onConflict: 'company_id,chat_id', ignoreDuplicates: true });
            }
          } catch (e) {
            console.warn('messages.sync_history chats refresh:', e);
          }
        }

        const { data: chatRows, error: chatErr } = await admin
          .from('whatsapp_chats')
          .select('chat_id')
          .eq('company_id', companyId)
          .eq('archived', false)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .range(offset, offset + maxChats - 1);
        if (chatErr) throw chatErr;

        let totalMessages = 0;
        let chatsWithMessages = 0;
        const warnings: string[] = [];

        for (const row of chatRows ?? []) {
          if (isSystemChatJid(row.chat_id)) continue;
          try {
            const count = await syncChatMessagesFromWaha(
              admin,
              cfg,
              companyId,
              sessionName,
              row.chat_id,
              limitPerChat,
              !!body.download_media,
            );
            totalMessages += count;
            if (count > 0) chatsWithMessages += 1;
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'error';
            if (warnings.length < 15) warnings.push(`${row.chat_id}: ${msg}`);
          }
        }

        const processed = chatRows?.length ?? 0;
        const nextOffset =
          processed >= maxChats ? offset + maxChats : null;

        return json({
          ok: true,
          messages: totalMessages,
          chats_processed: processed,
          chats_with_messages: chatsWithMessages,
          next_offset: nextOffset,
          warnings: warnings.length ? warnings : undefined,
        });
      }

      case 'messages.send': {
        const sendBody = body as SendBody;
        if (!sendBody.chat_id) return err('Falta chat_id');
        const requestedChatId = normalizeChatId(
          sendBody.chat_id,
          cfg.default_country_code,
        );
        // chatId final puede cambiar tras enviar (WhatsApp usa @lid en muchos
        // chats modernos). Lo iremos ajustando si Waha lo expone.
        let chatId = requestedChatId;
        const type = sendBody.type ?? 'text';
        let endpoint = '';
        let payload: Record<string, unknown> = { session: sessionName, chatId };

        if (sendBody.reply_to_message_id?.trim()) {
          payload.reply_to = sendBody.reply_to_message_id.trim();
        }

        if (type === 'text') {
          if (!sendBody.text) return err('Falta `text`');
          endpoint = '/api/sendText';
          payload = { ...payload, text: sendBody.text };
        } else if (type === 'image' || type === 'video' || type === 'document' || type === 'audio' || type === 'voice') {
          if (!sendBody.media_base64) return err('Falta `media_base64`');
          if (type === 'image') endpoint = '/api/sendImage';
          else if (type === 'video') endpoint = '/api/sendVideo';
          else if (type === 'voice') endpoint = '/api/sendVoice';
          else if (type === 'audio') endpoint = '/api/sendFile';
          else endpoint = '/api/sendFile';
          const mime = sendBody.mime_type ?? 'application/octet-stream';
          payload = {
            ...payload,
            caption: sendBody.caption ?? undefined,
            file: {
              mimetype: mime,
              filename: sendBody.filename ?? 'file',
              data: sendBody.media_base64,
            },
          };
          if (type === 'voice') {
            const lowerMime = mime.toLowerCase();
            payload.convert = !(
              lowerMime.includes('ogg') || lowerMime.includes('opus')
            );
          }
        } else {
          return err(`Tipo no soportado: ${type}`);
        }

        const res = await wahaJson<{
          id?: { id?: string; _serialized?: string; remote?: string };
          _data?: {
            id?: { _serialized?: string; remote?: string };
            to?: string;
          };
          to?: string;
          timestamp?: number;
        }>(cfg, endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const wahaId = resolveOutgoingWahaId(res, chatId);
        const ts = res?.timestamp
          ? new Date(res.timestamp * 1000).toISOString()
          : new Date().toISOString();
        const outgoingBody = type === 'text' ? sendBody.text ?? null : null;

        // Detectar el JID real del destinatario que devuelve Waha. WhatsApp
        // moderno usa @lid en lugar de @c.us para muchos chats; si Waha nos
        // dice cuál es, lo adoptamos como chat_id canónico (consolidará los
        // mensajes salientes con los entrantes que vendrán por webhook).
        const detectedRemote =
          res?.id?.remote ??
          res?._data?.id?.remote ??
          res?.to ??
          res?._data?.to ??
          null;
        // Si _serialized es `true_<jid>_<id>`, podemos extraer el jid también.
        const fromSerialized = (() => {
          const s = res?.id?._serialized ?? res?._data?.id?._serialized;
          if (!s) return null;
          const m = /^(?:true|false)_(.+?)_/.exec(s);
          return m ? m[1] : null;
        })();
        const realRemote = detectedRemote ?? fromSerialized ?? null;
        if (
          realRemote &&
          realRemote.includes('@') &&
          realRemote !== chatId
        ) {
          // Migrar fila de chat (si existe) al nuevo chat_id y mover mensajes
          // ya almacenados con el chat_id antiguo. Usamos UPSERT por seguridad.
          const { data: oldChat } = await admin
            .from('whatsapp_chats')
            .select('id, name, customer_id, marketing_lead_id, unread_count, raw')
            .eq('company_id', companyId)
            .eq('chat_id', chatId)
            .maybeSingle();
          if (oldChat) {
            // Migrar mensajes históricos (cualquier mensaje guardado bajo el
            // chat_id "viejo" @c.us pasará al nuevo @lid)
            await admin
              .from('whatsapp_messages')
              .update({ chat_id: realRemote })
              .eq('company_id', companyId)
              .eq('chat_id', chatId);
            // Renombrar el chat (UPDATE del campo chat_id)
            await admin
              .from('whatsapp_chats')
              .update({ chat_id: realRemote })
              .eq('id', oldChat.id);
          }
          chatId = realRemote;
        }

        let insertedRow: Record<string, unknown> | null = await findExistingOutgoingMessage(
          admin,
          companyId,
          chatId,
          wahaId,
          outgoingBody,
        );

        if (!insertedRow) {
          const insertRow = {
            company_id: companyId,
            chat_id: chatId,
            waha_message_id: wahaId,
            from_jid: cfg.me_jid ?? null,
            from_me: true,
            type,
            body: outgoingBody,
            caption: type !== 'text' ? sendBody.caption ?? null : null,
            media_url: null,
            media_mime_type: type !== 'text' ? sendBody.mime_type ?? null : null,
            media_filename: type !== 'text' ? sendBody.filename ?? null : null,
            quoted_message_id: sendBody.reply_to_message_id?.trim() || null,
            ack: 0,
            timestamp: ts,
            raw: res as unknown,
          };

          if (wahaId) {
            const { data: upserted, error: upErr } = await admin
              .from('whatsapp_messages')
              .upsert(insertRow, {
                onConflict: 'company_id,waha_message_id',
                ignoreDuplicates: false,
              })
              .select('*')
              .maybeSingle();
            if (upErr) {
              console.error('messages.send upsert failed:', upErr, 'row:', insertRow);
              insertedRow = await findExistingOutgoingMessage(
                admin,
                companyId,
                chatId,
                wahaId,
                outgoingBody,
              );
            } else {
              insertedRow = (upserted as Record<string, unknown> | null) ?? null;
            }
          }
          // Sin waha_message_id: el webhook (eco saliente) ya habrá persistido la fila.
        }

        if (insertedRow) {
          await deleteGhostOutgoingMessages(
            admin,
            companyId,
            chatId,
            outgoingBody,
          );
        }

        await admin.from('whatsapp_chats').upsert(
          {
            company_id: companyId,
            chat_id: chatId,
            is_group: /@g\.us$/i.test(chatId),
            last_message_preview:
              type === 'text'
                ? sendBody.text?.slice(0, 200) ?? null
                : `[${type}]`,
            last_message_at: ts,
            last_message_from_me: true,
          },
          { onConflict: 'company_id,chat_id', ignoreDuplicates: false },
        );

        try {
          await admin.rpc('whatsapp_auto_link_chat', {
            p_company_id: companyId,
            p_chat_id: chatId,
          });
        } catch {
          // ignore
        }

        return json({
          ok: true,
          waha_message_id: wahaId,
          timestamp: ts,
          chat_id: chatId,
          chat_id_was_migrated: chatId !== requestedChatId,
          message: insertedRow,
        });
      }

      case 'messages.forward': {
        const forwardBody = body as ForwardBody;
        if (!forwardBody.chat_id) return err('Falta chat_id');
        if (!forwardBody.message_id?.trim()) return err('Falta message_id');
        const chatId = normalizeChatId(
          forwardBody.chat_id,
          cfg.default_country_code,
        );
        const res = await wahaJson<{
          id?: { _serialized?: string };
          timestamp?: number;
        }>(cfg, '/api/forwardMessage', {
          method: 'POST',
          body: JSON.stringify({
            session: sessionName,
            chatId,
            messageId: forwardBody.message_id.trim(),
          }),
        });
        const wahaId = resolveOutgoingWahaId(res, chatId);
        const ts = res?.timestamp
          ? new Date(res.timestamp * 1000).toISOString()
          : new Date().toISOString();
        await admin.from('whatsapp_chats').upsert(
          {
            company_id: companyId,
            chat_id: chatId,
            is_group: /@g\.us$/i.test(chatId),
            last_message_preview: '[reenviado]',
            last_message_at: ts,
            last_message_from_me: true,
          },
          { onConflict: 'company_id,chat_id', ignoreDuplicates: false },
        );
        return json({
          ok: true,
          waha_message_id: wahaId,
          chat_id: chatId,
          timestamp: ts,
        });
      }

      case 'media.download': {
        const respondBytes = (buf: ArrayBuffer, contentType?: string | null) =>
          new Response(buf, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': contentType ?? 'application/octet-stream',
              'Cache-Control': 'private, max-age=86400',
            },
          });

        if (body.chat_id && body.message_id) {
          try {
            const result = await downloadMediaViaMessage(
              cfg,
              sessionName,
              body.chat_id,
              body.message_id,
            );
            return respondBytes(result.buf, result.contentType);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'No se pudo descargar media';
            if (!body.url || isExternalCdnMediaUrl(body.url)) {
              return err(msg, 502);
            }
          }
        }

        if (body.url && !isExternalCdnMediaUrl(body.url)) {
          try {
            const { buf, contentType } = await fetchWahaMediaBytes(cfg, body.url);
            return respondBytes(buf, contentType);
          } catch (e) {
            return err(e instanceof Error ? e.message : 'URL inválida', 400);
          }
        }

        return err('Falta url de Waha o chat_id+message_id', 400);
      }

      case 'chat.mark_read': {
        if (!body.chat_id) return err('Falta chat_id');
        try {
          await wahaJson(
            cfg,
            `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(
              body.chat_id,
            )}/messages/read`,
            { method: 'POST', body: JSON.stringify({}) },
          );
        } catch {
          // En algunas versiones es sendSeen
          await wahaJson(cfg, '/api/sendSeen', {
            method: 'POST',
            body: JSON.stringify({ session: sessionName, chatId: body.chat_id }),
          }).catch(() => undefined);
        }
        await admin
          .from('whatsapp_chats')
          .update({ unread_count: 0 })
          .eq('company_id', companyId)
          .eq('chat_id', body.chat_id);
        return json({ ok: true });
      }

      case 'chat.ensure': {
        if (!body.chat_id) return err('Falta chat_id');
        const chatId = normalizeChatId(body.chat_id, cfg.default_country_code);
        const isGroup = /@g\.us$/i.test(chatId);

        // Si ya existe lo dejamos como está, solo refrescamos `name` si nos
        // pasan uno mejor; si no existe, lo creamos vacío.
        const { data: existing } = await admin
          .from('whatsapp_chats')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('chat_id', chatId)
          .maybeSingle();

        if (!existing) {
          await admin.from('whatsapp_chats').insert({
            company_id: companyId,
            chat_id: chatId,
            name: body.name ?? null,
            is_group: isGroup,
          });
        } else if (body.name && !existing.name) {
          await admin
            .from('whatsapp_chats')
            .update({ name: body.name })
            .eq('id', existing.id);
        }

        // Lanzamos auto-vinculación por si era nuevo (no rompe si falla)
        try {
          await admin.rpc('whatsapp_auto_link_chat', {
            p_company_id: companyId,
            p_chat_id: chatId,
          });
        } catch {
          // ignore
        }

        return json({ ok: true, chat_id: chatId });
      }

      case 'chat.set_link': {
        if (!body.chat_id) return err('Falta chat_id');
        const updates: Record<string, unknown> = {};
        if ('customer_id' in body) updates.customer_id = body.customer_id ?? null;
        if ('marketing_lead_id' in body)
          updates.marketing_lead_id = body.marketing_lead_id ?? null;
        if (Object.keys(updates).length === 0) {
          return err('Nada que actualizar');
        }
        const { error: upErr } = await admin
          .from('whatsapp_chats')
          .update(updates)
          .eq('company_id', companyId)
          .eq('chat_id', body.chat_id);
        if (upErr) throw upErr;
        return json({ ok: true });
      }

      case 'chat.search_link': {
        const q = (body.q ?? '').trim();
        const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 25);
        if (!q) return json({ ok: true, customers: [], leads: [] });
        const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
        const digits = q.replace(/[^0-9]/g, '');
        const phoneLike = digits.length >= 4 ? `%${digits.slice(-9)}%` : null;

        const { data: customers, error: cErr } = await admin
          .from('customers')
          .select('id, name, phone, phone_mobile, phone_home, email')
          .eq('company_id', companyId)
          .or(
            phoneLike
              ? `name.ilike.${like},phone.ilike.${phoneLike},phone_mobile.ilike.${phoneLike},phone_home.ilike.${phoneLike}`
              : `name.ilike.${like}`,
          )
          .limit(limit);
        if (cErr) throw cErr;

        const { data: leads, error: lErr } = await admin
          .from('marketing_leads')
          .select('id, first_name, last_name, phone, email')
          .eq('company_id', companyId)
          .or(
            phoneLike
              ? `first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${phoneLike}`
              : `first_name.ilike.${like},last_name.ilike.${like}`,
          )
          .limit(limit);
        if (lErr) throw lErr;

        return json({
          ok: true,
          customers: customers ?? [],
          leads: leads ?? [],
        });
      }

      default: {
        return err(`Acción no soportada: ${(body as { action: string }).action}`);
      }
    }
  } catch (e) {
    if (e instanceof WahaError) {
      return err(e.message, e.status === 401 || e.status === 403 ? 401 : 502);
    }
    const msg = e instanceof Error ? e.message : 'Error inesperado';
    console.error('whatsapp-proxy unhandled error:', msg, e);
    return err(msg, 500);
  }
});
