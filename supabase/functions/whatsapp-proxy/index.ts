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
import {
  mapOpenwaStatusToInternal,
  normalizeWhatsappProvider,
  providerLabel,
  resolveWhatsappCredentials,
  extractProviderErrorMessage,
  type WhatsappProvider,
  type WhatsappProviderConfig,
} from '../_shared/whatsappProviderTypes.ts';
import {
  providerListSessions,
  providerPing,
  providerSendMedia,
  providerSendText,
  resolveOutgoingMessageId,
  WhatsappProviderError,
} from '../_shared/whatsappProviderClient.ts';
import {
  openwaConfigureWebhook,
  openwaDownloadMedia,
  openwaCollectRecentMedia,
  openwaGetQr,
  openwaGetSession,
  openwaListChats,
  openwaListChatMessages,
  openwaListWebhooks,
  openwaLogoutSession,
  openwaMessageFromMe,
  openwaMessageSerializedId,
  openwaStartSession,
  openwaStopSession,
  openwaWebhooksConfigured,
  normalizeOpenwaMessageToWahaShape,
  buildOpenwaMessageUpsertRow,
} from '../_shared/whatsappProviderOpenwa.ts';
import { OPENWA_WEBHOOK_EVENTS } from '../_shared/whatsappProviderTypes.ts';
import {
  openwaMediaRequiresPublicUrl,
  isOggOpusBase64,
  openwaVoiceNoteFormatError,
  normalizeOutgoingStorageMime,
  stripMediaBase64,
  uploadWhatsappOutgoingMedia,
} from '../_shared/whatsappOutgoingMediaStorage.ts';
import { whatsappMediaPreviewLabel } from '../_shared/whatsappMessageType.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Evita colgar hasta que Kong/runtime devuelva 504 sin cabeceras CORS. */
const WAHA_FETCH_TIMEOUT_MS = 25_000;

// deno-lint-ignore no-explicit-any
const edgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined =
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime;

type WhatsappConfig = {
  company_id: string;
  provider?: string | null;
  base_url: string | null;
  api_key: string | null;
  session_name: string;
  waha_base_url?: string | null;
  waha_api_key?: string | null;
  waha_session_name?: string | null;
  openwa_base_url?: string | null;
  openwa_api_key?: string | null;
  openwa_session_name?: string | null;
  webhook_secret: string | null;
  default_country_code: string | null;
  enabled: boolean;
  last_status: string | null;
  last_status_message: string | null;
  qr_data_url: string | null;
  me_jid: string | null;
  me_pushname: string | null;
};

function proxyProvider(cfg: WhatsappConfig): WhatsappProvider {
  return normalizeWhatsappProvider(cfg.provider);
}

function proxyToProviderCfg(cfg: WhatsappConfig): WhatsappProviderConfig {
  return resolveWhatsappCredentials(cfg);
}

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

type DeleteMessageBody = {
  action: 'messages.delete';
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
  | {
      action: 'messages.list';
      chat_id: string;
      limit?: number;
      offset?: number;
      download_media?: boolean;
    }
  | {
      action: 'messages.sync_history';
      limit_per_chat?: number;
      max_chats?: number;
      offset?: number;
      message_offset?: number;
      refresh_chats?: boolean;
      download_media?: boolean;
    }
  | {
      action: 'messages.sync_chat_history';
      chat_id: string;
      force?: boolean;
      offset?: number;
      download_media?: boolean;
    }
  | SendBody
  | ForwardBody
  | DeleteMessageBody
  | { action: 'media.download'; url?: string; chat_id?: string; message_id?: string; alt_chat_ids?: string[] }
  | { action: 'messages.prefetch_media'; chat_id: string; limit?: number; alt_chat_ids?: string[] }
  | { action: 'chat.mark_read'; chat_id: string }
  | { action: 'chat.ensure'; chat_id: string; name?: string | null; marketing_lead_id?: string | null }
  | {
      action: 'marketing.send_campaign_audio';
      chat_id: string;
      marketing_lead_id?: string | null;
      customer_id?: string | null;
      chat_display_name?: string | null;
    }
  | {
      action: 'chat.set_link';
      chat_id: string;
      customer_id?: string | null;
      marketing_lead_id?: string | null;
    }
  | { action: 'chat.search_link'; q: string; limit?: number }
  | { action: 'pictures.sync_batch'; chat_ids?: string[]; limit?: number }
  | { action: 'data.purge'; logout_waha?: boolean }
  | { action: 'data.purge_openwa' }
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

function mapWhatsappProviderFailure(message: string, status: number): Response {
  const lower = message.toLowerCase();
  if (/detached frame/i.test(message)) {
    return err(
      'OpenWA perdió la conexión con WhatsApp Web. Ve a Configuración → WhatsApp, detén la sesión e iníciala de nuevo.',
      422,
    );
  }
  if (
    status >= 500 &&
    (/send-audio|send-image|send-video|send-document|internal server error/i.test(lower))
  ) {
    return err(
      'OpenWA no pudo enviar el archivo (fallo del motor WhatsApp Web, habitual con whatsapp-web.js 1.34.7). ' +
        'Detén e inicia la sesión en Configuración → WhatsApp. Si sigue fallando, avisa al administrador (scripts/fix-openwa-media.ps1).',
      502,
    );
  }
  const sessionNotReady =
    status === 422 &&
    (/session status/i.test(message) ||
      /status.*FAILED/i.test(message) ||
      /expected.*WORKING/i.test(message));
  if (sessionNotReady) {
    return err(
      'La sesión de WhatsApp no está conectada. Ve a Configuración → WhatsApp, detén la sesión, iníciala de nuevo y escanea el QR si hace falta.',
      422,
    );
  }
  if (status === 401 || status === 403) return err(message, 401);
  if (status === 422) return err(message, 422);
  if (status >= 400 && status < 500) return err(message, status);
  return err(message, 502);
}

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
  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(WAHA_FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error(
        `Waha no respondió en ${Math.round(WAHA_FETCH_TIMEOUT_MS / 1000)}s (${path}). Compruebe que el servicio WAHA está activo.`,
      );
    }
    throw e;
  }
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
    const msg = extractProviderErrorMessage(data, resp.status);
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
        history_synced_at: source.history_synced_at ?? target.history_synced_at,
        oldest_message_at: (() => {
          const a = source.oldest_message_at
            ? new Date(source.oldest_message_at).getTime()
            : null;
          const b = target.oldest_message_at
            ? new Date(target.oldest_message_at).getTime()
            : null;
          if (a != null && b != null) {
            return new Date(Math.min(a, b)).toISOString();
          }
          return source.oldest_message_at ?? target.oldest_message_at;
        })(),
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

/** IDs alternativos para pedir mensajes a Waha (Business suele usar @lid). */
async function resolveWahaMessageFetchChatIds(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  chatId: string,
): Promise<string[]> {
  const ids = new Set<string>([chatId]);
  if (isPhoneJid(chatId)) ids.add(normalizeWhatsappJid(chatId));

  const { data: row } = await admin
    .from('whatsapp_chats')
    .select('raw')
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .maybeSingle();
  const raw = row?.raw as Record<string, unknown> | null;
  const lastMessage = raw?.lastMessage as Record<string, unknown> | undefined;
  const key = (lastMessage?.key ?? raw?.key) as Record<string, unknown> | undefined;
  for (const k of ['remoteJidAlt', 'remoteJid', 'participant', 'participantAlt']) {
    const v = key?.[k];
    if (typeof v === 'string' && v.includes('@')) ids.add(v);
  }

  const { data: siblings } = await admin
    .from('whatsapp_chats')
    .select('chat_id')
    .eq('company_id', companyId)
    .limit(500);
  for (const s of siblings ?? []) {
    if (jidsSameContact(s.chat_id, chatId)) ids.add(s.chat_id);
  }

  return [...ids];
}

async function fetchWahaChatMessages(
  cfg: WhatsappConfig,
  sessionName: string,
  chatId: string,
  limit: number,
  downloadMedia: boolean,
  offset = 0,
): Promise<WahaMsg[]> {
  const dlFlag = downloadMedia ? 'true' : 'false';
  const offsetParam = offset > 0 ? `&offset=${offset}` : '';
  const newPath = `/api/messages?session=${encodeURIComponent(
    sessionName,
  )}&chatId=${encodeURIComponent(chatId)}&limit=${limit}&downloadMedia=${dlFlag}${offsetParam}`;
  const oldPath = `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(
    chatId,
  )}/messages?limit=${limit}&downloadMedia=${dlFlag}${offsetParam}`;

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

function resolveWahaChatName(c: Record<string, unknown>): string | null {
  for (const key of ['name', 'subject', 'formattedTitle']) {
    const v = c[key];
    if (typeof v === 'string' && v.trim() && !v.includes('@')) return v.trim();
  }
  for (const nestedKey of ['_chat', 'groupMetadata', 'chat']) {
    const nested = c[nestedKey];
    if (!nested || typeof nested !== 'object') continue;
    const n = nested as Record<string, unknown>;
    for (const key of ['subject', 'name', 'formattedTitle']) {
      const v = n[key];
      if (typeof v === 'string' && v.trim() && !v.includes('@')) return v.trim();
    }
  }
  return null;
}

function isGoodChatDisplayName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name.trim();
  if (n.includes('@')) return false;
  if (/^\+?\d{10,}$/.test(n)) return false;
  if (n === 'Grupo') return false;
  return true;
}

async function fetchWahaGroupSubject(
  cfg: WhatsappConfig,
  sessionName: string,
  groupId: string,
): Promise<string | null> {
  try {
    const data = await wahaJson<Record<string, unknown>>(
      cfg,
      `/api/${encodeURIComponent(sessionName)}/groups/${encodeURIComponent(groupId)}`,
    );
    for (const key of ['subject', 'name', 'formattedTitle']) {
      const v = data[key];
      if (typeof v === 'string' && isGoodChatDisplayName(v)) return v.trim();
    }
    const group = data.group;
    if (group && typeof group === 'object') {
      const g = group as Record<string, unknown>;
      for (const key of ['subject', 'name', 'formattedTitle']) {
        const v = g[key];
        if (typeof v === 'string' && isGoodChatDisplayName(v)) return v.trim();
      }
    }
  } catch (e) {
    if (e instanceof WahaError && (e.status === 404 || e.status === 400)) return null;
    console.warn('fetchWahaGroupSubject:', groupId, e);
  }
  return null;
}

const WAHA_AVATAR_BUCKET = 'whatsapp-avatars';
const WA_MEDIA_BUCKET = 'whatsapp-media';
const WAHA_PICTURES_PER_REQUEST = 1;

function edgePublicSupabaseBase(): string {
  const keys = [
    'SUPABASE_WEBHOOK_PUBLIC_URL',
    'SUPABASE_PUBLIC_URL',
    'API_EXTERNAL_URL',
    'SUPABASE_URL',
  ];
  for (const key of keys) {
    const raw = Deno.env.get(key)?.trim();
    if (!raw) continue;
    try {
      const u = new URL(raw.replace(/\/+$/, ''));
      const h = u.hostname.toLowerCase();
      if (
        h !== 'localhost' &&
        h !== 'kong' &&
        h !== '127.0.0.1' &&
        !h.endsWith('.local') &&
        !h.startsWith('192.168.') &&
        !h.startsWith('10.') &&
        !/^172\.(1[6-9]|2\d|3[01])\./.test(h)
      ) {
        return u.origin;
      }
    } catch {
      continue;
    }
  }
  return 'https://supabase.lipoout.com';
}

/** URL accesible desde el navegador (no http://kong:8000). */
function buildStoragePublicUrl(bucket: string, objectPath: string): string {
  const base = edgePublicSupabaseBase();
  const clean = objectPath.replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}

function normalizeStoragePublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes('/storage/v1/object/public/')) return url;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (
      h === 'kong' ||
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h.startsWith('192.168.') ||
      h.startsWith('10.')
    ) {
      return `${edgePublicSupabaseBase()}${u.pathname}${u.search}`;
    }
  } catch {
    // mantener url original
  }
  return url;
}

function isPersistedMediaUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(`/storage/v1/object/public/${WA_MEDIA_BUCKET}/`);
}

function safeMessageStorageKey(messageId: string): string {
  return messageId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}

function mimeToMediaExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webp')) return 'webp';
  if (m.includes('png')) return 'png';
  if (m.includes('gif')) return 'gif';
  if (m.includes('video')) return 'mp4';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg')) return 'mp3';
  if (m.includes('webm')) return 'webm';
  return 'jpg';
}

function mediaStoragePath(companyId: string, messageId: string, mime: string): string {
  return `${companyId}/media/${safeMessageStorageKey(messageId)}.${mimeToMediaExt(mime)}`;
}

async function tryDownloadStoredMessageMedia(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  messageId: string,
): Promise<{ buf: ArrayBuffer; contentType: string | null } | null> {
  const base = `${companyId}/media/${safeMessageStorageKey(messageId)}`;
  const extToMime: Record<string, string> = {
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
    ogg: 'audio/ogg',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
  };
  for (const ext of Object.keys(extToMime)) {
    const { data, error } = await admin.storage
      .from(WA_MEDIA_BUCKET)
      .download(`${base}.${ext}`);
    if (data && !error) {
      return {
        buf: await data.arrayBuffer(),
        contentType: extToMime[ext] ?? null,
      };
    }
  }
  return null;
}

async function persistWhatsappMessageMedia(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  messageId: string,
  buf: ArrayBuffer,
  mime: string,
): Promise<string | null> {
  if (!buf.byteLength) return null;
  const storageMime = normalizeOutgoingStorageMime(mime);
  const path = mediaStoragePath(companyId, messageId, storageMime);
  const { error } = await admin.storage.from(WA_MEDIA_BUCKET).upload(path, buf, {
    contentType: storageMime,
    upsert: true,
  });
  if (error) {
    console.warn('persistWhatsappMessageMedia:', messageId.slice(0, 40), error.message);
    return null;
  }
  const url = buildStoragePublicUrl(WA_MEDIA_BUCKET, path);
  if (url) {
    await admin
      .from('whatsapp_messages')
      .update({ media_url: url, media_mime_type: storageMime })
      .eq('company_id', companyId)
      .eq('waha_message_id', messageId)
      .then(() => undefined)
      .catch(() => undefined);
  }
  return url;
}

function base64MediaToArrayBuffer(b64: string): ArrayBuffer {
  const cleaned = stripMediaBase64(b64);
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function outgoingPersistMime(
  provider: WhatsappProvider,
  type: SendBody['type'],
  mime: string,
): string {
  if (provider === 'openwa' && (type === 'audio' || type === 'voice')) {
    return 'audio/ogg';
  }
  return normalizeOutgoingStorageMime(mime);
}

async function persistOutgoingSentMedia(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  wahaId: string,
  mediaBase64: string,
  mime: string,
  provider: WhatsappProvider,
  type: SendBody['type'],
): Promise<string | null> {
  try {
    return await persistWhatsappMessageMedia(
      admin,
      companyId,
      wahaId,
      base64MediaToArrayBuffer(mediaBase64),
      outgoingPersistMime(provider, type, mime),
    );
  } catch (e) {
    console.warn('persistOutgoingSentMedia:', e instanceof Error ? e.message : e);
    return null;
  }
}

function isPersistedWhatsappMediaUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(`/storage/v1/object/public/${WA_MEDIA_BUCKET}/`);
}

async function listDbStoredMediaForChat(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  chatId: string,
  limit: number,
): Promise<Array<{ message_id: string; url: string; mime: string }>> {
  const { data } = await admin
    .from('whatsapp_messages')
    .select('waha_message_id, media_url, media_mime_type')
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .not('waha_message_id', 'is', null)
    .not('media_url', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(limit);
  const items: Array<{ message_id: string; url: string; mime: string }> = [];
  for (const row of data ?? []) {
    const url = row.media_url as string | null;
    const messageId = row.waha_message_id as string | null;
    if (!messageId || !isPersistedWhatsappMediaUrl(url)) continue;
    const publicUrl = normalizeStoragePublicUrl(url);
    if (!publicUrl) continue;
    items.push({
      message_id: messageId,
      url: publicUrl,
      mime: (row.media_mime_type as string | null) ?? 'image/jpeg',
    });
  }
  return items;
}

async function prefetchOpenwaMediaToStorage(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  providerCfg: WhatsappProviderConfig,
  chatId: string,
  limit: number,
): Promise<Array<{ message_id: string; url: string; mime: string }>> {
  const safeLimit = Math.min(Math.max(limit, 3), 8);
  const items = await listDbStoredMediaForChat(admin, companyId, chatId, safeLimit);
  if (items.length >= 3) return items;

  const skipIds = new Set(items.map((i) => i.message_id));
  const collected = await openwaCollectRecentMedia(providerCfg, chatId, 5, {
    skipVideo: true,
    maxItems: 2,
    imagesOnly: true,
    skipMessageIds: skipIds,
  });
  for (const c of collected) {
    const url = await persistWhatsappMessageMedia(
      admin,
      companyId,
      c.message_id,
      c.buf,
      c.mime,
    );
    if (url) items.push({ message_id: c.message_id, url, mime: c.mime });
  }
  return items;
}

function isPersistedAvatarUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(`/storage/v1/object/public/${WAHA_AVATAR_BUCKET}/`);
}

function safeChatStorageKey(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveWahaChatPicture(c: Record<string, unknown>): string | null {
  const direct = c.picture;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  for (const nestedKey of ['_chat', 'groupMetadata']) {
    const nested = c[nestedKey];
    if (!nested || typeof nested !== 'object') continue;
    const n = nested as Record<string, unknown>;
    for (const key of ['picture', 'imgUrl', 'profilePictureUrl']) {
      const v = n[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

async function fetchWahaChatPictureUrl(
  cfg: WhatsappConfig,
  sessionName: string,
  chatId: string,
): Promise<string | null> {
  const path = `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(
    chatId,
  )}/picture`;
  try {
    const data = await wahaJson<{ url?: string | null }>(cfg, path);
    if (typeof data.url === 'string' && data.url.trim()) return data.url.trim();
  } catch (e) {
    if (e instanceof WahaError && (e.status === 404 || e.status === 400)) return null;
    console.warn('fetchWahaChatPictureUrl:', chatId, e);
  }
  return null;
}

async function downloadPictureBytes(
  cfg: WhatsappConfig,
  pictureUrl: string,
): Promise<{ buf: ArrayBuffer; contentType: string | null } | null> {
  try {
    if (isExternalCdnMediaUrl(pictureUrl)) {
      const resp = await fetch(pictureUrl);
      if (!resp.ok) return null;
      return {
        buf: await resp.arrayBuffer(),
        contentType: resp.headers.get('content-type'),
      };
    }
    return await fetchWahaMediaBytes(cfg, pictureUrl);
  } catch {
    return null;
  }
}

async function persistChatProfilePicture(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  companyId: string,
  sessionName: string,
  chatId: string,
  hintUrl?: string | null,
): Promise<string | null> {
  if (isPersistedAvatarUrl(hintUrl)) return hintUrl ?? null;

  let pictureUrl = await fetchWahaChatPictureUrl(cfg, sessionName, chatId);
  if (!pictureUrl && hintUrl?.trim()) pictureUrl = hintUrl.trim();
  if (!pictureUrl) return null;

  const downloaded = await downloadPictureBytes(cfg, pictureUrl);
  if (!downloaded || downloaded.buf.byteLength === 0) {
    return isExternalCdnMediaUrl(pictureUrl) ? null : pictureUrl;
  }

  const ct = (downloaded.contentType ?? '').toLowerCase();
  const ext = ct.includes('png')
    ? 'png'
    : ct.includes('webp')
      ? 'webp'
      : ct.includes('gif')
        ? 'gif'
        : 'jpg';
  const path = `${companyId}/${safeChatStorageKey(chatId)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(WAHA_AVATAR_BUCKET)
    .upload(path, downloaded.buf, {
      contentType: downloaded.contentType ?? 'image/jpeg',
      upsert: true,
    });
  if (upErr) {
    console.warn('persistChatProfilePicture upload:', chatId, upErr.message);
    return null;
  }

  return normalizeStoragePublicUrl(buildStoragePublicUrl(WAHA_AVATAR_BUCKET, path));
}

async function syncChatProfilePictures(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  companyId: string,
  sessionName: string,
  chatIds: string[],
  maxCount = WAHA_PICTURES_PER_REQUEST,
): Promise<number> {
  let synced = 0;
  for (const chatId of chatIds) {
    if (synced >= maxCount) break;
    if (isSystemChatJid(chatId)) continue;

    const { data: row } = await admin
      .from('whatsapp_chats')
      .select('profile_picture_url')
      .eq('company_id', companyId)
      .eq('chat_id', chatId)
      .maybeSingle();
    if (isPersistedAvatarUrl(row?.profile_picture_url)) continue;

    try {
      const url = await persistChatProfilePicture(
        admin,
        cfg,
        companyId,
        sessionName,
        chatId,
        row?.profile_picture_url,
      );
      if (!url) continue;

      await admin
        .from('whatsapp_chats')
        .update({ profile_picture_url: url, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('chat_id', chatId);
      if (isPersistedAvatarUrl(url)) synced += 1;
    } catch (e) {
      console.warn('syncChatProfilePictures:', chatId, e);
    }
  }
  return synced;
}

async function fetchWahaChatsOverview(
  cfg: WhatsappConfig,
  sessionName: string,
  limit: number,
  offset: number,
): Promise<Array<Record<string, unknown>>> {
  const paths = [
    `/api/${encodeURIComponent(sessionName)}/chats/overview?limit=${limit}&offset=${offset}`,
    `/api/${encodeURIComponent(sessionName)}/chats?limit=${limit}&offset=${offset}`,
  ];
  let lastErr: unknown;
  for (const path of paths) {
    try {
      const data = await wahaJson<Array<Record<string, unknown>>>(cfg, path);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function fetchWahaChatMessagesWithFallback(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  companyId: string,
  sessionName: string,
  chatId: string,
  limit: number,
  downloadMedia: boolean,
  offset: number,
): Promise<WahaMsg[]> {
  const fetchIds = await resolveWahaMessageFetchChatIds(admin, companyId, chatId);
  let lastError: unknown = null;

  const tryFetch = async (id: string): Promise<WahaMsg[]> => {
    return await fetchWahaChatMessages(cfg, sessionName, id, limit, downloadMedia, offset);
  };

  for (const fetchChatId of fetchIds) {
    try {
      const batch = await tryFetch(fetchChatId);
      if (batch.length > 0) return batch;
    } catch (e) {
      lastError = e;
      if (e instanceof WahaError && (e.status === 401 || e.status === 403)) throw e;
    }
  }

  try {
    return await tryFetch(chatId);
  } catch (e) {
    if (!(e instanceof WahaError)) throw e;
    if (e.status === 401 || e.status === 403) throw e;

    let warmupOk = false;
    try {
      await wahaJson(cfg, `/api/${encodeURIComponent(sessionName)}/chats?limit=20`);
      warmupOk = true;
    } catch {
      // ignore
    }

    if (warmupOk) {
      for (const fetchChatId of fetchIds) {
        try {
          const batch = await tryFetch(fetchChatId);
          if (batch.length > 0) return batch;
        } catch (e3) {
          if (e3 instanceof WahaError && (e3.status === 401 || e3.status === 403)) throw e3;
        }
      }
      console.warn('syncChatMessagesFromWaha non-fatal failure after warmup:', lastError ?? e);
      return [];
    }
    console.warn('syncChatMessagesFromWaha non-fatal failure:', e);
    return [];
  }
}

async function countStoredMessagesForChat(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  chatId: string,
): Promise<number> {
  const fetchIds = await resolveWahaMessageFetchChatIds(admin, companyId, chatId);
  const { count, error } = await admin
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('chat_id', fetchIds);
  if (error) throw error;
  return count ?? 0;
}

async function syncChatMessagesFromWaha(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  companyId: string,
  sessionName: string,
  chatId: string,
  limit: number,
  downloadMedia = false,
  offset = 0,
): Promise<number> {
  if (isSystemChatJid(chatId)) return 0;

  const data = await fetchWahaChatMessagesWithFallback(
    admin,
    cfg,
    companyId,
    sessionName,
    chatId,
    limit,
    downloadMedia,
    offset,
  );

  if (!Array.isArray(data) || data.length === 0) return 0;

  const isGroupChat = isGroupJid(chatId);
  const sampleKey = data.find((m) => extractMessageKey(m));
  await resolveChatIdForStorage(
    admin,
    companyId,
    chatId,
    sampleKey ? extractMessageKey(sampleKey) : null,
    isGroupChat,
  );
  // Guardar bajo el chat_id de la UI (lista lateral) para que coincida al abrir la conversación.
  const rowChatId = chatId;
  const rows = data.map((m) => ({
    company_id: companyId,
    chat_id: rowChatId,
    source_provider: 'waha',
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
  const { error: upsertError } = await admin
    .from('whatsapp_messages')
    .upsert(rows, {
      onConflict: 'company_id,waha_message_id',
      ignoreDuplicates: false,
    });
  if (upsertError) {
    console.error('whatsapp_messages upsert failed:', upsertError.message, {
      chatId: rowChatId,
      rows: rows.length,
    });
    throw new Error(`No se pudieron guardar mensajes: ${upsertError.message}`);
  }
  return data.length;
}

async function syncChatMessagesFromOpenwa(
  admin: ReturnType<typeof createClient>,
  providerCfg: WhatsappProviderConfig,
  companyId: string,
  chatId: string,
  limit: number,
  offset = 0,
): Promise<number> {
  if (isSystemChatJid(chatId)) return 0;

  const rawMessages = await openwaListChatMessages(providerCfg, chatId, limit, offset);
  if (!rawMessages.length) return 0;

  const rows = rawMessages.map((raw) =>
    buildOpenwaMessageUpsertRow(raw, chatId, companyId)
  );

  const { error: upsertError } = await admin
    .from('whatsapp_messages')
    .upsert(rows, {
      onConflict: 'company_id,waha_message_id',
      ignoreDuplicates: false,
    });
  if (upsertError) {
    console.error('whatsapp_messages upsert failed (OpenWA):', upsertError.message, {
      chatId,
      rows: rows.length,
    });
    throw new Error(`No se pudieron guardar mensajes: ${upsertError.message}`);
  }
  return rawMessages.length;
}

async function syncChatMessagesFromProvider(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  providerCfg: WhatsappProviderConfig,
  companyId: string,
  sessionName: string,
  chatId: string,
  limit: number,
  downloadMedia = false,
  offset = 0,
): Promise<number> {
  if (normalizeWhatsappProvider(cfg.provider) === 'openwa') {
    return syncChatMessagesFromOpenwa(
      admin,
      providerCfg,
      companyId,
      chatId,
      limit,
      offset,
    );
  }
  return syncChatMessagesFromWaha(
    admin,
    cfg,
    companyId,
    sessionName,
    chatId,
    limit,
    downloadMedia,
    offset,
  );
}

const WAHA_HISTORY_PAGE_SIZE = 200;
/** Páginas por petición HTTP (evita 504 del gateway ~60s). */
const WAHA_HISTORY_PAGES_PER_REQUEST = 2;
const WAHA_HISTORY_MAX_PAGES = 50;

type SyncHistoryChunkResult = {
  count: number;
  offset: number;
  has_more: boolean;
  synced: boolean;
};

async function markChatHistorySynced(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  chatId: string,
  storageChatId?: string | null,
): Promise<void> {
  const chatIds = Array.from(
    new Set([chatId, storageChatId].filter((id): id is string => !!id)),
  );
  const { data: oldest } = await admin
    .from('whatsapp_messages')
    .select('timestamp')
    .eq('company_id', companyId)
    .in('chat_id', chatIds)
    .order('timestamp', { ascending: true })
    .limit(1)
    .maybeSingle();

  const payload = {
    history_synced_at: new Date().toISOString(),
    oldest_message_at: oldest?.timestamp ?? null,
    updated_at: new Date().toISOString(),
  };

  for (const id of chatIds) {
    await admin
      .from('whatsapp_chats')
      .update(payload)
      .eq('company_id', companyId)
      .eq('chat_id', id);
  }
}

async function syncFullChatHistoryFromProvider(
  admin: ReturnType<typeof createClient>,
  cfg: WhatsappConfig,
  providerCfg: WhatsappProviderConfig,
  companyId: string,
  sessionName: string,
  chatId: string,
  downloadMedia = false,
  startOffset = 0,
  maxPages = WAHA_HISTORY_PAGES_PER_REQUEST,
): Promise<SyncHistoryChunkResult> {
  if (isSystemChatJid(chatId)) {
    return { count: 0, offset: startOffset, has_more: false, synced: true };
  }

  let total = 0;
  let offset = Math.max(startOffset, 0);
  let hasMore = false;

  for (let page = 0; page < maxPages && page < WAHA_HISTORY_MAX_PAGES; page++) {
    const count = await syncChatMessagesFromProvider(
      admin,
      cfg,
      providerCfg,
      companyId,
      sessionName,
      chatId,
      WAHA_HISTORY_PAGE_SIZE,
      downloadMedia,
      offset,
    );
    total += count;
    if (count === 0 || count < WAHA_HISTORY_PAGE_SIZE) {
      hasMore = false;
      break;
    }
    offset += WAHA_HISTORY_PAGE_SIZE;
    hasMore = true;
    if (page + 1 >= maxPages) break;
  }

  const synced = !hasMore;
  if (synced && total > 0) {
    const storageChatId = await resolveChatIdForStorage(
      admin,
      companyId,
      chatId,
      null,
      isGroupJid(chatId),
    );
    await markChatHistorySynced(admin, companyId, chatId, storageChatId);
  } else if (synced && total === 0) {
    // Marcar como sincronizado aunque no haya mensajes (evita bucle de reintentos en bg sync).
    await admin
      .from('whatsapp_chats')
      .update({
        history_synced_at: new Date().toISOString(),
        oldest_message_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('chat_id', chatId);
  }

  return { count: total, offset, has_more: hasMore, synced };
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
  'group.v2.update',
  'group.v2.join',
];

/** Body PUT sesión WAHA (documentación oficial: solo `config` en el cuerpo). */
function buildWahaSessionPutBody(sessionConfig: Record<string, unknown>): string {
  return JSON.stringify({ config: sessionConfig });
}

async function putWahaSessionConfig(
  cfg: WhatsappConfig,
  sessionName: string,
  sessionConfig: Record<string, unknown>,
): Promise<void> {
  const putPath = `/api/sessions/${encodeURIComponent(sessionName)}`;
  const putBody = buildWahaSessionPutBody(sessionConfig);
  try {
    await wahaJson(cfg, putPath, { method: 'PUT', body: putBody });
    return;
  } catch (e1) {
    // Versiones antiguas aceptaban también `name` en el body.
    if (!(e1 instanceof WahaError)) throw e1;
    await wahaJson(cfg, putPath, {
      method: 'PUT',
      body: JSON.stringify({ name: sessionName, config: sessionConfig }),
    });
  }
}

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

/** URL pública para webhooks externos (OpenWA/WAHA no aceptan http://kong:8000). */
function isInternalSupabaseHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === 'kong' ||
    h === '127.0.0.1' ||
    h.endsWith('.local') ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

function resolvePublicSupabaseUrl(): string {
  const keys = [
    'SUPABASE_WEBHOOK_PUBLIC_URL',
    'SUPABASE_PUBLIC_URL',
    'API_EXTERNAL_URL',
    'SUPABASE_URL',
  ];
  for (const key of keys) {
    const raw = Deno.env.get(key)?.trim();
    if (!raw) continue;
    const url = raw.replace(/\/+$/, '');
    try {
      if (!isInternalSupabaseHost(new URL(url).hostname)) return url;
    } catch {
      continue;
    }
  }
  throw new Error(
    'Falta URL pública de Supabase para webhooks (OpenWA/WAHA rechazan http://kong:8000). ' +
      'Define SUPABASE_PUBLIC_URL=https://supabase.lipoout.com en el contenedor edge.',
  );
}

/** URL pública para registrar webhooks (OpenWA/WAHA). */
function resolvePublicSupabaseUrlOrFallback(): string {
  try {
    return resolvePublicSupabaseUrl();
  } catch {
    return 'https://supabase.lipoout.com';
  }
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
    await putWahaSessionConfig(cfg, sessionName, sessionConfig);
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

async function purgeWhatsappStorageAvatars(
  admin: ReturnType<typeof createClient>,
  companyId: string,
): Promise<number> {
  let removed = 0;
  try {
    const { data: files, error } = await admin.storage
      .from(WAHA_AVATAR_BUCKET)
      .list(companyId, { limit: 1000 });
    if (error || !files?.length) return 0;
    const paths = files
      .filter((f) => f.name && f.id !== null)
      .map((f) => `${companyId}/${f.name}`);
    if (!paths.length) return 0;
    const { error: rmErr } = await admin.storage.from(WAHA_AVATAR_BUCKET).remove(paths);
    if (!rmErr) removed = paths.length;
  } catch (e) {
    console.warn('purgeWhatsappStorageAvatars:', e);
  }
  return removed;
}

async function purgeWhatsappCompanyData(
  admin: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ messages_deleted: number; chats_deleted: number; avatars_removed: number }> {
  const { count: msgCount } = await admin
    .from('whatsapp_messages')
    .delete({ count: 'exact' })
    .eq('company_id', companyId);
  const { count: chatCount } = await admin
    .from('whatsapp_chats')
    .delete({ count: 'exact' })
    .eq('company_id', companyId);

  await admin
    .from('whatsapp_config')
    .update({
      last_status: 'STOPPED',
      last_status_message: null,
      last_status_at: new Date().toISOString(),
      qr_data_url: null,
      qr_updated_at: null,
      me_jid: null,
      me_pushname: null,
    })
    .eq('company_id', companyId);

  const avatars_removed = await purgeWhatsappStorageAvatars(admin, companyId);

  return {
    messages_deleted: msgCount ?? 0,
    chats_deleted: chatCount ?? 0,
    avatars_removed,
  };
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
    if (!cfgRow) {
      return err(
        'WhatsApp no configurado. Configura Waha en Configuración → WhatsApp.',
      );
    }
    const cfg = {
      ...(cfgRow as WhatsappConfig),
      ...resolveWhatsappCredentials(cfgRow as WhatsappConfig),
    };
    if (!cfg.base_url) {
      return err(`Falta la URL base de ${providerLabel(proxyProvider(cfg))} en la configuración.`);
    }

    const sessionName = cfg.session_name || 'default';
    const provider = proxyProvider(cfg);
    const providerCfg = proxyToProviderCfg(cfg);
    const publicSupabaseUrl = resolvePublicSupabaseUrlOrFallback();
    const updateCfg = async (values: Partial<WhatsappConfig>) => {
      await admin
        .from('whatsapp_config')
        .update(values as Record<string, unknown>)
        .eq('company_id', companyId);
    };

    switch (body.action) {
      case 'session.status': {
        if (provider === 'openwa') {
          try {
            const s = await openwaGetSession(providerCfg);
            const webhookUrl = cfg.webhook_secret
              ? buildWebhookUrl(publicSupabaseUrl, companyId, cfg.webhook_secret)
              : '';
            const webhooks = webhookUrl
              ? await openwaListWebhooks(providerCfg).catch(() => [])
              : [];
            const hooksOk = webhookUrl
              ? openwaWebhooksConfigured(webhooks, webhookUrl)
              : false;
            await updateCfg({
              last_status: s.internalStatus,
              last_status_message: null,
              last_status_at: new Date().toISOString(),
              me_jid: s.meJid,
            });
            return json({
              ok: true,
              status: s.internalStatus,
              me: s.meJid ? { id: s.meJid } : null,
              webhooks_configured: hooksOk,
              noweb_store_enabled: false,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error consultando sesión OpenWA';
            await updateCfg({
              last_status: 'UNKNOWN',
              last_status_message: msg,
              last_status_at: new Date().toISOString(),
            });
            return json({ ok: false, status: 'UNKNOWN', error: msg });
          }
        }
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
        if (provider === 'openwa') {
          await openwaStartSession(providerCfg);
          let webhooksConfigured = false;
          if (cfg.webhook_secret) {
            try {
              const webhookUrl = buildWebhookUrl(publicSupabaseUrl, companyId, cfg.webhook_secret);
              await openwaConfigureWebhook(
                { ...providerCfg, webhook_secret: cfg.webhook_secret },
                webhookUrl,
              );
              webhooksConfigured = true;
            } catch (e) {
              console.warn('OpenWA webhook auto-config failed:', e);
            }
          }
          await updateCfg({
            last_status: 'STARTING',
            last_status_message: null,
            last_status_at: new Date().toISOString(),
          });
          return json({
            ok: true,
            webhooks_configured: webhooksConfigured,
            noweb_store_enabled: false,
          });
        }
        const health = await ensureWahaSessionConfig(
          cfg,
          publicSupabaseUrl,
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
        if (provider === 'openwa') {
          await openwaStopSession(providerCfg);
          await updateCfg({
            last_status: 'STOPPED',
            last_status_at: new Date().toISOString(),
          });
          return json({ ok: true });
        }
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
        if (provider === 'openwa') {
          try {
            await openwaLogoutSession(providerCfg);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error en logout OpenWA';
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
        if (provider === 'openwa') {
          try {
            const qr = await openwaGetQr(providerCfg);
            if (!qr) return err('OpenWA no devolvió QR (sesión ya conectada o no lista)');
            await updateCfg({
              qr_data_url: qr,
              qr_updated_at: new Date().toISOString(),
            });
            return json({ ok: true, qr_data_url: qr });
          } catch (e) {
            return err(e instanceof Error ? e.message : 'Error obteniendo QR OpenWA');
          }
        }
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
        const webhookUrl = buildWebhookUrl(publicSupabaseUrl, companyId, cfg.webhook_secret);
        if (provider === 'openwa') {
          const configured = await openwaConfigureWebhook(
            { ...providerCfg, webhook_secret: cfg.webhook_secret },
            webhookUrl,
          );
          return json({
            ok: true,
            webhook_url: webhookUrl,
            webhook_id: configured.id,
            events: configured.events.length ? configured.events : [...OPENWA_WEBHOOK_EVENTS],
            webhooks_configured: true,
            noweb_store_enabled: false,
          });
        }
        const sessionConfig = buildWahaSessionConfig(publicSupabaseUrl, companyId, cfg);
        const putPath = `/api/sessions/${encodeURIComponent(sessionName)}`;

        let configured = false;
        let lastError: WahaError | null = null;
        try {
          await putWahaSessionConfig(cfg, sessionName, sessionConfig);
          configured = true;
        } catch (e1) {
          if (e1 instanceof WahaError) lastError = e1;
          else throw e1;
        }
        if (!configured) {
          try {
            await wahaJson(cfg, putPath, {
              method: 'POST',
              body: buildWahaSessionPutBody(sessionConfig),
            });
            configured = true;
          } catch (e2) {
            if (e2 instanceof WahaError) lastError = e2;
            else throw e2;
          }
        }
        if (!configured && lastError) {
          return err(lastError.message, lastError.status === 401 || lastError.status === 403 ? 401 : 502);
        }
        const health = await ensureWahaSessionConfig(cfg, publicSupabaseUrl, companyId, sessionName);
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
        let data: Array<Record<string, unknown>> = [];

        if (provider === 'openwa') {
          try {
            data = await openwaListChats(providerCfg, limit, offset);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error listando chats OpenWA';
            console.warn('chats.list openwa non-fatal failure:', e);
            return json({ ok: true, count: 0, warning: msg });
          }
        } else {
          try {
            data = await fetchWahaChatsOverview(cfg, sessionName, limit, offset);
          } catch (e) {
            if (e instanceof WahaError) {
              if (e.status === 401 || e.status === 403) {
                return err(e.message, 401);
              }
              console.warn('chats.list non-fatal failure:', e);
              return json({ ok: true, count: 0, warning: e.message });
            }
            throw e;
          }
        }

        if (Array.isArray(data) && data.length > 0) {
          data = data.filter((c) => !isSystemChatJid(String(c.id ?? '')));
          const chatIds = data.map((c) => String(c.id ?? ''));
          const existingById = new Map<string, string | null>();
          if (chatIds.length > 0) {
            const { data: existingRows } = await admin
              .from('whatsapp_chats')
              .select('chat_id, name')
              .eq('company_id', companyId)
              .in('chat_id', chatIds);
            for (const row of existingRows ?? []) {
              existingById.set(row.chat_id, row.name);
            }
          }

          const rows = data.map((c) => {
            const id = String(c.id ?? '');
            const isOpenwa = provider === 'openwa';
            const resolvedName = isOpenwa
              ? (typeof c.name === 'string' && isGoodChatDisplayName(c.name) ? c.name.trim() : null)
              : resolveWahaChatName(c);
            const lastMessage = c.lastMessage as Record<string, unknown> | undefined;
            let chatName =
              resolvedName ??
              (typeof c.name === 'string' && isGoodChatDisplayName(c.name) ? c.name.trim() : null);
            if (!chatName) {
              const prev = existingById.get(id);
              if (isGoodChatDisplayName(prev)) chatName = prev!.trim();
            }
            const ts = c.timestamp ?? lastMessage?.timestamp;
            const tsNum = typeof ts === 'number' ? ts : Number(ts ?? 0);
            const row: Record<string, unknown> = {
              company_id: companyId,
              chat_id: id,
              is_group: !!c.isGroup || /@g\.us$/i.test(id),
              profile_picture_url: isOpenwa
                ? null
                : resolveWahaChatPicture(c) ??
                  (typeof c.picture === 'string' ? c.picture : null),
              last_message_preview:
                typeof lastMessage?.body === 'string'
                  ? lastMessage.body
                  : typeof c.lastMessage === 'string'
                    ? c.lastMessage
                    : null,
              last_message_at: tsNum
                ? new Date(tsNum * 1000).toISOString()
                : lastMessage?.timestamp
                  ? new Date(Number(lastMessage.timestamp) * 1000).toISOString()
                  : null,
              last_message_from_me: isOpenwa
                ? false
                : !!lastMessage?.fromMe,
              unread_count: Number(c.unreadCount ?? c.unread_count ?? 0) || 0,
              pinned: !!c.pinned,
              archived: !!c.archived,
              raw: c as unknown,
            };
            if (chatName) row.name = chatName;
            return row;
          });
          await admin
            .from('whatsapp_chats')
            .upsert(rows, { onConflict: 'company_id,chat_id' });

          const linkIds = data
            .map((c) => String(c.id ?? ''))
            .filter((id) => !isSystemChatJid(id))
            .slice(0, 10);
          if (linkIds.length > 0) {
            const linkTask = (async () => {
              for (const chatId of linkIds) {
                try {
                  await admin.rpc('whatsapp_auto_link_chat', {
                    p_company_id: companyId,
                    p_chat_id: chatId,
                  });
                } catch {
                  // opcional
                }
              }
            })();
            if (edgeRuntime?.waitUntil) {
              edgeRuntime.waitUntil(linkTask);
            } else {
              linkTask.catch(() => undefined);
            }
          }
        }
        return json({ ok: true, count: Array.isArray(data) ? data.length : 0 });
      }

      case 'messages.list': {
        const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 200);
        const offset = Math.max(Number(body.offset ?? 0), 0);
        const chatId = body.chat_id;
        if (!chatId) return err('Falta chat_id');
        if (provider === 'openwa') {
          const rawMessages = await openwaListChatMessages(providerCfg, chatId, limit, offset);
          const rows = rawMessages.map((raw) =>
            buildOpenwaMessageUpsertRow(raw, chatId, companyId)
          );
          if (rows.length > 0) {
            await admin.from('whatsapp_messages').upsert(rows, {
              onConflict: 'company_id,waha_message_id',
              ignoreDuplicates: false,
            });
          }
          return json({ ok: true, count: rows.length, offset, has_more: rows.length >= limit });
        }
        const count = await syncChatMessagesFromProvider(
          admin,
          cfg,
          providerCfg,
          companyId,
          sessionName,
          chatId,
          limit,
          !!body.download_media,
          offset,
        );
        return json({ ok: true, count, offset, has_more: count >= limit });
      }

      case 'messages.sync_chat_history': {
        const chatId = body.chat_id;
        if (!chatId) return err('Falta chat_id');
        const force = !!body.force;
        const startOffset = Math.max(Number(body.offset ?? 0), 0);

        if (!force && startOffset === 0) {
          const { data: chatRow } = await admin
            .from('whatsapp_chats')
            .select('history_synced_at')
            .eq('company_id', companyId)
            .eq('chat_id', chatId)
            .maybeSingle();
          if (chatRow?.history_synced_at) {
            const stored = await countStoredMessagesForChat(admin, companyId, chatId);
            if (stored === 0) {
              await admin
                .from('whatsapp_chats')
                .update({ history_synced_at: null, oldest_message_at: null })
                .eq('company_id', companyId)
                .eq('chat_id', chatId);
            } else {
              const count = await syncChatMessagesFromProvider(
                admin,
                cfg,
                providerCfg,
                companyId,
                sessionName,
                chatId,
                WAHA_HISTORY_PAGE_SIZE,
                !!body.download_media,
                0,
              );
              return json({
                ok: true,
                count,
                offset: 0,
                has_more: false,
                synced: true,
                already_synced: true,
              });
            }
          }
        }

        const result = await syncFullChatHistoryFromProvider(
          admin,
          cfg,
          providerCfg,
          companyId,
          sessionName,
          chatId,
          !!body.download_media,
          startOffset,
        );
        return json({ ok: true, ...result, synced: result.synced });
      }

      case 'messages.sync_history': {
        const messageOffset = Math.max(Number(body.message_offset ?? 0), 0);
        const refreshChats = body.refresh_chats !== false;

        if (refreshChats && messageOffset === 0) {
          try {
            let chatData: Array<Record<string, unknown>> = [];
            if (provider === 'openwa') {
              chatData = await openwaListChats(providerCfg, 150, 0);
            } else {
              chatData = await fetchWahaChatsOverview(cfg, sessionName, 150, 0);
            }
            if (chatData.length > 0) {
              const rows = chatData.map((c) => ({
                company_id: companyId,
                chat_id: String(c.id ?? ''),
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
          .is('history_synced_at', null)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(1);
        if (chatErr) throw chatErr;

        const row = chatRows?.[0];
        if (!row || isSystemChatJid(row.chat_id)) {
          return json({
            ok: true,
            messages: 0,
            chats_processed: 0,
            chats_synced: 0,
            chats_with_messages: 0,
            next_offset: null,
            message_offset: null,
          });
        }

        const warnings: string[] = [];
        try {
          const result = await syncFullChatHistoryFromProvider(
            admin,
            cfg,
            providerCfg,
            companyId,
            sessionName,
            row.chat_id,
            !!body.download_media,
            messageOffset,
          );

          if (result.has_more) {
            return json({
              ok: true,
              messages: result.count,
              chats_processed: 1,
              chats_synced: 0,
              chats_with_messages: result.count > 0 ? 1 : 0,
              next_offset: 0,
              message_offset: result.offset,
              warnings: warnings.length ? warnings : undefined,
            });
          }

          const { count: remaining } = await admin
            .from('whatsapp_chats')
            .select('chat_id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('archived', false)
            .is('history_synced_at', null);

          return json({
            ok: true,
            messages: result.count,
            chats_processed: 1,
            chats_synced: 1,
            chats_with_messages: result.count > 0 ? 1 : 0,
            next_offset: (remaining ?? 0) > 0 ? 0 : null,
            message_offset: null,
            warnings: warnings.length ? warnings : undefined,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'error';
          warnings.push(`${row.chat_id}: ${msg}`);
          return json({
            ok: true,
            messages: 0,
            chats_processed: 0,
            chats_synced: 0,
            chats_with_messages: 0,
            next_offset: null,
            message_offset: null,
            warnings,
          });
        }
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

        let sendResult: { messageId: string | null; timestamp?: number; raw: unknown };
        let outgoingMime: string | null = null;
        if (type === 'text') {
          if (!sendBody.text) return err('Falta `text`');
          sendResult = await providerSendText(providerCfg, chatId, sendBody.text, {
            replyToMessageId: sendBody.reply_to_message_id?.trim(),
          });
        } else if (
          type === 'image' ||
          type === 'video' ||
          type === 'document' ||
          type === 'audio' ||
          type === 'voice'
        ) {
          if (!sendBody.media_base64) return err('Falta `media_base64`');
          outgoingMime = sendBody.mime_type ?? 'application/octet-stream';
          const mime = outgoingMime;
          const mediaType = type === 'document' ? 'document' : type;
          if (
            provider === 'openwa' &&
            (mediaType === 'audio' || mediaType === 'voice') &&
            /webm|mpeg|mp3|mp4|wav/i.test(mime)
          ) {
            return err(
              'OpenWA solo admite notas de voz en OGG/Opus. Adjunta un archivo .ogg.',
            );
          }
          if (
            provider === 'openwa' &&
            (mediaType === 'audio' || mediaType === 'voice') &&
            (/ogg|opus/i.test(mime) || /\.ogg$/i.test(sendBody.filename ?? '')) &&
            !isOggOpusBase64(sendBody.media_base64)
          ) {
            return err(openwaVoiceNoteFormatError());
          }
          const mediaInput = {
            base64: sendBody.media_base64,
            mime,
            filename: sendBody.filename ?? 'file',
            caption: sendBody.caption,
          };
          if (provider === 'openwa' && openwaMediaRequiresPublicUrl(mediaType)) {
            mediaInput.url = await uploadWhatsappOutgoingMedia(
              admin,
              companyId,
              sendBody.media_base64,
              mime,
              buildStoragePublicUrl,
              sendBody.filename,
            );
          }
          sendResult = await providerSendMedia(
            providerCfg,
            chatId,
            mediaType,
            mediaInput,
          );
        } else {
          return err(`Tipo no soportado: ${type}`);
        }

        const res = sendResult.raw as {
          id?: { id?: string; _serialized?: string; remote?: string };
          _data?: {
            id?: { _serialized?: string; remote?: string };
            to?: string;
          };
          to?: string;
          timestamp?: number;
        };
        const wahaId = sendResult.messageId ?? resolveOutgoingMessageId(provider, res, chatId);
        const ts = sendResult.timestamp
          ? new Date(sendResult.timestamp * 1000).toISOString()
          : res?.timestamp
            ? new Date(res.timestamp * 1000).toISOString()
            : new Date().toISOString();
        const outgoingBody = type === 'text' ? sendBody.text ?? null : null;

        let outgoingMediaUrl: string | null = null;
        if (wahaId && sendBody.media_base64 && type !== 'text' && outgoingMime) {
          outgoingMediaUrl = await persistOutgoingSentMedia(
            admin,
            companyId,
            wahaId,
            sendBody.media_base64,
            outgoingMime,
            provider,
            type,
          );
        }

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
            source_provider: provider,
            waha_message_id: wahaId,
            from_jid: cfg.me_jid ?? null,
            from_me: true,
            type,
            body: outgoingBody,
            caption: type !== 'text' ? sendBody.caption ?? null : null,
            media_url: outgoingMediaUrl,
            media_mime_type: type !== 'text' ? sendBody.mime_type ?? null : null,
            media_filename: type !== 'text'
              ? (sendBody.filename?.trim() ||
                ((type === 'audio' || type === 'voice') ? 'voice.ogg' : 'file'))
              : null,
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
                : whatsappMediaPreviewLabel(type),
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

      case 'messages.delete': {
        const deleteBody = body as DeleteMessageBody;
        if (!deleteBody.chat_id) return err('Falta chat_id');
        const wahaMessageId = deleteBody.message_id?.trim();
        if (!wahaMessageId) return err('Falta message_id');

        const chatId = normalizeChatId(
          deleteBody.chat_id,
          cfg.default_country_code,
        );
        const deletePath =
          `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(
            chatId,
          )}/messages/${encodeURIComponent(wahaMessageId)}`;

        await wahaJson(cfg, deletePath, { method: 'DELETE' });

        const revokedPreview = 'Eliminaste este mensaje';
        const { error: markErr } = await admin
          .from('whatsapp_messages')
          .update({
            type: 'revoked',
            body: null,
            caption: null,
            media_url: null,
            media_mime_type: null,
            media_filename: null,
            media_size: null,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId)
          .eq('waha_message_id', wahaMessageId);

        if (markErr) {
          console.warn('messages.delete mark revoked failed:', markErr.message);
        }

        const { data: lastMsg } = await admin
          .from('whatsapp_messages')
          .select('waha_message_id')
          .eq('company_id', companyId)
          .eq('chat_id', chatId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMsg?.waha_message_id === wahaMessageId) {
          await admin
            .from('whatsapp_chats')
            .update({
              last_message_preview: revokedPreview,
              last_message_from_me: true,
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', companyId)
            .eq('chat_id', chatId);
        }

        return json({ ok: true, chat_id: chatId, waha_message_id: wahaMessageId });
      }

      case 'groups.sync_name': {
        const chatId = typeof body.chat_id === 'string' ? body.chat_id.trim() : '';
        if (!chatId || !isGroupJid(chatId)) {
          return json({ ok: true, updated: false });
        }
        const subject = await fetchWahaGroupSubject(cfg, sessionName, chatId);
        if (!subject) {
          return json({ ok: true, updated: false });
        }
        await admin
          .from('whatsapp_chats')
          .update({ name: subject, updated_at: new Date().toISOString() })
          .eq('company_id', companyId)
          .eq('chat_id', chatId);
        return json({ ok: true, updated: true, name: subject });
      }

      case 'pictures.sync_batch': {
        const limit = Math.min(Math.max(Number(body.limit ?? 1), 1), 3);
        let chatIds: string[] = Array.isArray(body.chat_ids)
          ? body.chat_ids.filter((id): id is string => typeof id === 'string' && !!id)
          : [];

        if (chatIds.length === 0) {
          const { data: rows, error: qErr } = await admin
            .from('whatsapp_chats')
            .select('chat_id, profile_picture_url')
            .eq('company_id', companyId)
            .eq('archived', false)
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(limit * 2);
          if (qErr) throw qErr;
          chatIds = (rows ?? [])
            .filter((r) => !isPersistedAvatarUrl(r.profile_picture_url))
            .slice(0, limit)
            .map((r) => r.chat_id);
        }

        const count = await syncChatProfilePictures(
          admin,
          cfg,
          companyId,
          sessionName,
          chatIds,
          limit,
        );
        return json({ ok: true, count, requested: chatIds.length });
      }

      case 'messages.prefetch_media': {
        const chatId = body.chat_id;
        if (!chatId) return err('Falta chat_id');
        const limit = Math.min(Math.max(Number(body.limit ?? 6), 3), 8);
        if (provider !== 'openwa') {
          return json({ ok: true, items: [], chat_id: chatId });
        }
        const altIds = body.alt_chat_ids ?? [];
        const candidates = [chatId, ...altIds].filter(
          (id, i, arr) => !!id && arr.indexOf(id) === i,
        ).slice(0, 2);
        for (const cid of candidates) {
          try {
            const items = await prefetchOpenwaMediaToStorage(
              admin,
              companyId,
              providerCfg,
              cid,
              limit,
            );
            return json({ ok: true, chat_id: cid, items });
          } catch (e) {
            console.warn('prefetch_media failed for', cid, e);
          }
        }
        return json({ ok: true, items: [], chat_id: chatId });
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
            const stored = await tryDownloadStoredMessageMedia(
              admin,
              companyId,
              body.message_id,
            );
            if (stored) {
              return respondBytes(stored.buf, stored.contentType);
            }

            const result =
              provider === 'openwa'
                ? await openwaDownloadMedia(
                    providerCfg,
                    body.chat_id,
                    body.message_id,
                    body.alt_chat_ids ?? [],
                  )
                : await downloadMediaViaMessage(
                    cfg,
                    sessionName,
                    body.chat_id,
                    body.message_id,
                  );

            if (provider === 'openwa' && body.message_id) {
              const mime = result.contentType ?? 'application/octet-stream';
              await persistWhatsappMessageMedia(
                admin,
                companyId,
                body.message_id,
                result.buf,
                mime,
              );
            }

            return respondBytes(result.buf, result.contentType);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'No se pudo descargar media';
            console.error('media.download failed:', msg, {
              provider,
              chat_id: body.chat_id,
              message_id: body.message_id?.slice(0, 48),
            });
            const expired = /expirad/i.test(msg);
            const openwaHistoryBroken =
              provider === 'openwa' &&
              (/internal server error/i.test(msg) || /history\?/i.test(msg));
            const status = expired || openwaHistoryBroken ? 410 : 502;
            if (provider === 'openwa' || !body.url || isExternalCdnMediaUrl(body.url)) {
              return err(msg, status);
            }
          }
        }

        if (provider === 'openwa') {
          return err('OpenWA requiere chat_id y message_id para descargar media', 400);
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
          .select('id, name, marketing_lead_id')
          .eq('company_id', companyId)
          .eq('chat_id', chatId)
          .maybeSingle();

        const leadId =
          typeof body.marketing_lead_id === 'string' && body.marketing_lead_id.trim()
            ? body.marketing_lead_id.trim()
            : null;

        if (!existing) {
          await admin.from('whatsapp_chats').insert({
            company_id: companyId,
            chat_id: chatId,
            name: body.name ?? null,
            is_group: isGroup,
            marketing_lead_id: leadId,
          });
        } else {
          const patch: Record<string, unknown> = {};
          if (body.name && !existing.name) patch.name = body.name;
          if (leadId && !existing.marketing_lead_id) patch.marketing_lead_id = leadId;
          if (Object.keys(patch).length > 0) {
            await admin.from('whatsapp_chats').update(patch).eq('id', existing.id);
          }
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

      case 'marketing.send_campaign_audio': {
        if (!body.chat_id?.trim()) return err('Falta chat_id');
        try {
          const { sendManualCampaignAudioForChat } = await import(
            '../_shared/marketingWhatsappAutomation.ts'
          );
          const result = await sendManualCampaignAudioForChat(
            admin,
            companyId,
            body.chat_id.trim(),
            {
              marketing_lead_id: body.marketing_lead_id ?? null,
              customer_id: body.customer_id ?? null,
              chat_display_name: body.chat_display_name ?? null,
            },
          );
          if (!result.ok) return err(result.error ?? 'No se pudo enviar el audio', 400);
          return json({ ok: true, ...result });
        } catch (e) {
          return err(e instanceof Error ? e.message : 'No se pudo enviar el audio', 500);
        }
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

      case 'data.purge': {
        const logoutWaha = body.logout_waha !== false;
        const purged = await purgeWhatsappCompanyData(admin, companyId);

        if (logoutWaha && cfg.base_url) {
          try {
            await wahaJson(cfg, `/api/sessions/${encodeURIComponent(sessionName)}/logout`, {
              method: 'POST',
              body: JSON.stringify({}),
            });
          } catch {
            await wahaJson(cfg, `/api/sessions/logout`, {
              method: 'POST',
              body: JSON.stringify({ name: sessionName }),
            }).catch(() => undefined);
          }
        }

        return json({ ok: true, ...purged, waha_logout_attempted: logoutWaha });
      }

      case 'data.purge_openwa': {
        const { data: purged, error: purgeErr } = await admin.rpc(
          'whatsapp_purge_openwa_data_internal',
          { p_company_id: companyId },
        );
        if (purgeErr) throw purgeErr;
        return json(purged ?? { ok: true });
      }

      default: {
        return err(`Acción no soportada: ${(body as { action: string }).action}`);
      }
    }
  } catch (e) {
    if (e instanceof WahaError) {
      return mapWhatsappProviderFailure(e.message, e.status);
    }
    if (e instanceof WhatsappProviderError) {
      return mapWhatsappProviderFailure(e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : 'Error inesperado';
    console.error('whatsapp-proxy unhandled error:', msg, e);
    const status =
      msg.includes('no respondió en') || /timeout/i.test(msg) ? 504 : 500;
    return err(msg, status);
  }
});
