import {
  OPENWA_WEBHOOK_EVENTS,
  mapOpenwaStatusToInternal,
  type WhatsappProviderConfig,
} from './whatsappProviderTypes.ts';
import { PROVIDER_MEDIA_TIMEOUT_MS, providerJson } from './whatsappProviderClient.ts';

export type OpenwaMediaMeta = {
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_size: number | null;
};

type OpenwaSessionRow = {
  id: string;
  name?: string;
  status?: string;
  phoneNumber?: string;
  phone?: string;
  qr?: string | null;
};

export type OpenwaWebhookRow = {
  id: string;
  sessionId?: string;
  url: string;
  events?: string[];
  active?: boolean;
  retryCount?: number;
};

const sessionIdCache = new Map<string, string>();

function cacheKey(cfg: WhatsappProviderConfig): string {
  return `${cfg.company_id}:${cfg.session_name}`;
}

export async function resolveOpenwaSessionId(cfg: WhatsappProviderConfig): Promise<string> {
  const key = cacheKey(cfg);
  const cached = sessionIdCache.get(key);
  if (cached) return cached;

  const name = cfg.session_name || 'default';
  const sessions = await providerJson<OpenwaSessionRow[]>(cfg, '/sessions');
  const list = Array.isArray(sessions) ? sessions : [];
  const byName = list.find((s) => s.name === name);
  const byId = list.find((s) => s.id === name);
  const found = byName ?? byId;
  if (found?.id) {
    sessionIdCache.set(key, found.id);
    return found.id;
  }

  const created = await providerJson<OpenwaSessionRow>(cfg, '/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!created?.id) throw new Error('OpenWA no devolvió id de sesión al crear');
  sessionIdCache.set(key, created.id);
  return created.id;
}

export function clearOpenwaSessionCache(cfg: WhatsappProviderConfig): void {
  sessionIdCache.delete(cacheKey(cfg));
}

export function openwaSessionPath(cfg: WhatsappProviderConfig, sessionId: string, suffix = ''): string {
  const s = suffix.startsWith('/') ? suffix : suffix ? `/${suffix}` : '';
  return `/sessions/${encodeURIComponent(sessionId)}${s}`;
}

export async function openwaGetSession(
  cfg: WhatsappProviderConfig,
): Promise<{
  id: string;
  status: string;
  internalStatus: string;
  phoneNumber?: string | null;
  meJid?: string | null;
}> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const data = await providerJson<OpenwaSessionRow>(
    cfg,
    openwaSessionPath(cfg, sessionId),
  );
  const status = data.status ?? 'UNKNOWN';
  const phone = data.phoneNumber ?? data.phone ?? null;
  return {
    id: sessionId,
    status,
    internalStatus: mapOpenwaStatusToInternal(status),
    phoneNumber: phone,
    meJid: phone ? `${String(phone).replace(/\D/g, '')}@c.us` : null,
  };
}

export async function openwaStartSession(cfg: WhatsappProviderConfig): Promise<void> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  await providerJson(cfg, openwaSessionPath(cfg, sessionId, '/start'), {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => undefined);
}

export async function openwaStopSession(cfg: WhatsappProviderConfig): Promise<void> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  await providerJson(cfg, openwaSessionPath(cfg, sessionId, '/stop'), {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => undefined);
}

export async function openwaLogoutSession(cfg: WhatsappProviderConfig): Promise<void> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  clearOpenwaSessionCache(cfg);
  await providerJson(cfg, openwaSessionPath(cfg, sessionId, '/logout'), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function openwaGetQr(cfg: WhatsappProviderConfig): Promise<string | null> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const data = await providerJson<{ image?: string; code?: string }>(
    cfg,
    openwaSessionPath(cfg, sessionId, '/qr'),
  );
  if (data.image?.startsWith('data:')) return data.image;
  if (data.image) return `data:image/png;base64,${data.image}`;
  return null;
}

export async function openwaListWebhooks(cfg: WhatsappProviderConfig): Promise<OpenwaWebhookRow[]> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const data = await providerJson<OpenwaWebhookRow[]>(
    cfg,
    openwaSessionPath(cfg, sessionId, '/webhooks'),
  );
  return Array.isArray(data) ? data : [];
}

function isSuiteWebhookUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/functions/v1/whatsapp-webhook') || url.includes('lipoout.com');
}

function webhookUrlsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.origin === ub.origin &&
      ua.pathname === ub.pathname &&
      ua.searchParams.get('company_id') === ub.searchParams.get('company_id') &&
      ua.searchParams.get('secret') === ub.searchParams.get('secret')
    );
  } catch {
    return false;
  }
}

export function openwaWebhooksConfigured(
  webhooks: OpenwaWebhookRow[],
  webhookUrl: string,
): boolean {
  return webhooks.some(
    (wh) => wh.active !== false && webhookUrlsMatch(wh.url, webhookUrl),
  );
}

function eventsCoverAll(
  subscribed: string[] | undefined,
  required: readonly string[],
): boolean {
  if (!subscribed?.length) return false;
  if (subscribed.includes('*')) return true;
  return required.every((e) => subscribed.includes(e));
}

/** POST /api/sessions/{id}/webhooks según OpenWA API docs. */
export async function openwaConfigureWebhook(
  cfg: WhatsappProviderConfig,
  webhookUrl: string,
): Promise<{ id: string; url: string; events: string[] }> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const secret = cfg.webhook_secret?.trim() || undefined;
  const events = [...OPENWA_WEBHOOK_EVENTS];
  const customHeaders: Record<string, string> = {};
  if (secret) customHeaders['X-Webhook-Secret'] = secret;

  // OpenWA rechaza `active` en POST (400). PUT es frágil con url/headers → delete + POST.
  const createPayload: Record<string, unknown> = {
    url: webhookUrl,
    events,
    retryCount: 3,
  };
  if (secret) {
    createPayload.secret = secret;
    createPayload.headers = customHeaders;
  }

  const existing = await openwaListWebhooks(cfg).catch(() => [] as OpenwaWebhookRow[]);
  const keeper = existing.find(
    (wh) =>
      webhookUrlsMatch(wh.url, webhookUrl) &&
      wh.active !== false &&
      eventsCoverAll(wh.events, events),
  );

  if (keeper?.id) {
    for (const wh of existing) {
      if (wh.id && wh.id !== keeper.id && isSuiteWebhookUrl(wh.url)) {
        await providerJson(
          cfg,
          openwaSessionPath(cfg, sessionId, `/webhooks/${encodeURIComponent(wh.id)}`),
          { method: 'DELETE' },
        ).catch(() => undefined);
      }
    }
    return {
      id: keeper.id,
      url: keeper.url,
      events: keeper.events ?? events,
    };
  }

  for (const wh of existing) {
    if (wh.id && isSuiteWebhookUrl(wh.url)) {
      await providerJson(
        cfg,
        openwaSessionPath(cfg, sessionId, `/webhooks/${encodeURIComponent(wh.id)}`),
        { method: 'DELETE' },
      ).catch(() => undefined);
    }
  }

  const created = await providerJson<OpenwaWebhookRow>(
    cfg,
    openwaSessionPath(cfg, sessionId, '/webhooks'),
    { method: 'POST', body: JSON.stringify(createPayload) },
  );
  if (!created?.id) throw new Error('OpenWA no devolvió id al crear webhook');
  return {
    id: created.id,
    url: created.url ?? webhookUrl,
    events: created.events ?? events,
  };
}

export async function openwaTestWebhook(
  cfg: WhatsappProviderConfig,
  webhookId: string,
): Promise<{ success?: boolean; statusCode?: number; error?: string }> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  return providerJson(
    cfg,
    openwaSessionPath(cfg, sessionId, `/webhooks/${encodeURIComponent(webhookId)}/test`),
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function openwaListChats(
  cfg: WhatsappProviderConfig,
  limit = 100,
  offset = 0,
): Promise<Array<Record<string, unknown>>> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const data = await providerJson<
    Array<Record<string, unknown>> | { chats?: Array<Record<string, unknown>> }
  >(cfg, `${openwaSessionPath(cfg, sessionId)}/chats?${q.toString()}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.chats)) return data.chats;
  return [];
}

export async function openwaListChatMessages(
  cfg: WhatsappProviderConfig,
  chatId: string,
  limit = 50,
  offset = 0,
): Promise<Array<Record<string, unknown>>> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const q = new URLSearchParams({
    chatId,
    limit: String(limit),
    offset: String(offset),
  });
  const data = await providerJson<
    { messages?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
  >(cfg, `${openwaSessionPath(cfg, sessionId)}/messages?${q.toString()}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  return [];
}

export function openwaMessageSerializedId(msg: Record<string, unknown>): string {
  const wa = msg.waMessageId;
  if (typeof wa === 'string' && wa.trim()) return wa.trim();
  const id = msg.id ?? msg.messageId;
  if (typeof id === 'string' && id.trim()) return id.trim();
  return '';
}

export function openwaMessageFromMe(msg: Record<string, unknown>): boolean {
  if (typeof msg.fromMe === 'boolean') return msg.fromMe;
  return msg.direction === 'outgoing';
}

function defaultMimeForOpenwaType(type: string): string | null {
  switch (type.toLowerCase()) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'sticker':
      return 'image/webp';
    case 'audio':
    case 'voice':
    case 'ptt':
      return 'audio/ogg';
    default:
      return null;
  }
}

export function openwaExtractMediaMeta(msg: Record<string, unknown>): OpenwaMediaMeta {
  const media = msg.media;
  if (media && typeof media === 'object') {
    const m = media as Record<string, unknown>;
    return {
      media_url: typeof m.url === 'string' ? m.url : null,
      media_mime_type: typeof m.mimetype === 'string' ? m.mimetype : null,
      media_filename: typeof m.filename === 'string' ? m.filename : null,
      media_size: typeof m.size === 'number' ? m.size : null,
    };
  }
  const type = String(msg.type ?? 'text').toLowerCase();
  const isMediaType = ['image', 'video', 'sticker', 'audio', 'document', 'ptt', 'voice'].includes(
    type,
  );
  return {
    media_url: null,
    media_mime_type:
      (typeof msg.mimetype === 'string' ? msg.mimetype : null) ??
      (isMediaType ? defaultMimeForOpenwaType(type) : null),
    media_filename: typeof msg.filename === 'string' ? msg.filename : null,
    media_size: typeof msg.filesize === 'number' ? msg.filesize : null,
  };
}

export function openwaIdsMatch(storedId: string, candidate: string): boolean {
  if (!storedId || !candidate) return false;
  if (storedId === candidate) return true;
  const a = storedId.split('_').pop();
  const b = candidate.split('_').pop();
  return !!(a && b && a.length >= 8 && a === b);
}

function stripBase64DataUrl(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const cleaned = stripBase64DataUrl(b64);
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function openwaChatIdFromMessageId(messageId: string): string | null {
  const parts = messageId.split('_');
  if (parts.length >= 3 && parts[1]?.includes('@')) return parts[1];
  return null;
}

function pickOpenwaMediaChatCandidates(
  chatId: string,
  messageId: string,
  altChatIds: string[] = [],
): string[] {
  const fromMsg = openwaChatIdFromMessageId(messageId);
  const out: string[] = [];
  for (const id of [fromMsg, chatId, ...altChatIds]) {
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= 2) break;
  }
  return out;
}

function extractOpenwaMediaFromMessage(
  raw: Record<string, unknown>,
): { buf: ArrayBuffer; contentType: string | null } | 'expired' | null {
  const media = raw.media;
  if (!media || typeof media !== 'object') return null;
  const m = media as Record<string, unknown>;
  const dataB64 = m.data;
  if (typeof dataB64 === 'string' && dataB64.length > 0) {
    return {
      buf: base64ToArrayBuffer(dataB64),
      contentType: typeof m.mimetype === 'string' ? m.mimetype : null,
    };
  }
  const hasMedia =
    raw.hasMedia === true ||
    ['image', 'video', 'sticker', 'audio', 'document', 'ptt', 'voice'].includes(
      String(raw.type ?? '').toLowerCase(),
    );
  return hasMedia ? 'expired' : null;
}

async function openwaFetchChatHistory(
  cfg: WhatsappProviderConfig,
  sessionId: string,
  chatId: string,
  limit: number,
  includeMedia: boolean,
): Promise<Array<Record<string, unknown>>> {
  const encChat = encodeURIComponent(chatId);
  const q = new URLSearchParams({
    limit: String(limit),
    includeMedia: includeMedia ? 'true' : 'false',
  });
  const path = `${openwaSessionPath(cfg, sessionId)}/messages/${encChat}/history?${q.toString()}`;
  const data = await providerJson<
    Array<Record<string, unknown>> | { messages?: Array<Record<string, unknown>> }
  >(cfg, path, {}, PROVIDER_MEDIA_TIMEOUT_MS);
  return Array.isArray(data) ? data : data.messages ?? [];
}

/** Descarga media probando el chat id del mensaje (@lid) y como mucho un alternativo. */
export async function openwaDownloadMedia(
  cfg: WhatsappProviderConfig,
  chatId: string,
  messageId: string,
  altChatIds: string[] = [],
): Promise<{ buf: ArrayBuffer; contentType: string | null }> {
  const candidates = pickOpenwaMediaChatCandidates(chatId, messageId, altChatIds);

  let lastError: Error | null = null;
  for (const cid of candidates) {
    try {
      return await openwaDownloadMediaForChat(cfg, cid, messageId);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (lastError.message.includes('expirado')) break;
    }
  }
  throw lastError ?? new Error('OpenWA no devolvió media para este mensaje');
}

async function openwaDownloadMediaForChat(
  cfg: WhatsappProviderConfig,
  chatId: string,
  messageId: string,
): Promise<{ buf: ArrayBuffer; contentType: string | null }> {
  const sessionId = await resolveOpenwaSessionId(cfg);

  // 1) Mensajes recientes con media (rápido, cubre lo de hoy)
  for (const limit of [15, 40]) {
    const items = await openwaFetchChatHistory(cfg, sessionId, chatId, limit, true);
    for (const raw of items) {
      const id = String(raw.id ?? raw.waMessageId ?? openwaMessageSerializedId(raw) ?? '');
      if (!openwaIdsMatch(messageId, id)) continue;
      const extracted = extractOpenwaMediaFromMessage(raw);
      if (extracted && extracted !== 'expired') return extracted;
      throw new Error(
        'OpenWA: media expirada en servidores de WhatsApp (mensaje demasiado antiguo)',
      );
    }
    if (items.length < limit) break;
  }

  // 2) Comprobar si el mensaje existe más atrás (sin descargar media aún)
  const metaItems = await openwaFetchChatHistory(cfg, sessionId, chatId, 80, false);
  const metaMatch = metaItems.find((raw) => {
    const id = String(raw.id ?? raw.waMessageId ?? openwaMessageSerializedId(raw) ?? '');
    return openwaIdsMatch(messageId, id);
  });
  if (!metaMatch) {
    throw new Error(`OpenWA: mensaje no encontrado en historial de ${chatId}`);
  }

  // 3) El mensaje existe pero sin media embebida → expirada (evita history 80+media)
  const metaType = String(metaMatch.type ?? '').toLowerCase();
  if (
    ['image', 'video', 'sticker', 'audio', 'document', 'ptt', 'voice'].includes(metaType)
  ) {
    throw new Error(
      'OpenWA: media expirada en servidores de WhatsApp (mensaje demasiado antiguo)',
    );
  }

  throw new Error(`OpenWA: mensaje no encontrado con media en ${chatId}`);
}

export type OpenwaCollectedMedia = {
  message_id: string;
  mime: string;
  buf: ArrayBuffer;
  type: string;
};

const PREFETCH_MEDIA_TYPES = new Set(['image', 'sticker']);

/** Media reciente (máx. 2 ítems, history pequeño) para no agotar memoria del edge. */
export async function openwaCollectRecentMedia(
  cfg: WhatsappProviderConfig,
  chatId: string,
  limit = 5,
  options?: {
    skipVideo?: boolean;
    maxItems?: number;
    imagesOnly?: boolean;
    skipMessageIds?: Set<string>;
  },
): Promise<OpenwaCollectedMedia[]> {
  const sessionId = await resolveOpenwaSessionId(cfg);
  const safeLimit = Math.min(Math.max(limit, 3), 6);
  const maxItems = Math.min(options?.maxItems ?? 2, 2);
  const skipIds = options?.skipMessageIds ?? new Set<string>();

  // Historial ligero: identificar candidatos sin descargar base64 aún.
  const lite = await openwaFetchChatHistory(cfg, sessionId, chatId, safeLimit, false);
  const candidateIds: string[] = [];
  for (const raw of lite) {
    const type = String(raw.type ?? 'unknown').toLowerCase();
    if (options?.skipVideo && type === 'video') continue;
    if (options?.imagesOnly && !PREFETCH_MEDIA_TYPES.has(type)) continue;
    if (!['image', 'video', 'sticker', 'audio', 'document', 'ptt', 'voice'].includes(type)) {
      continue;
    }
    const id = String(raw.id ?? raw.waMessageId ?? openwaMessageSerializedId(raw) ?? '');
    if (!id || skipIds.has(id)) continue;
    candidateIds.push(id);
    if (candidateIds.length >= maxItems) break;
  }
  if (candidateIds.length === 0) return [];

  // Una sola petición con media; subir en cuanto se decodifica (sin acumular buffers).
  const withMedia = await openwaFetchChatHistory(cfg, sessionId, chatId, safeLimit, true);
  const out: OpenwaCollectedMedia[] = [];
  for (const messageId of candidateIds) {
    if (out.length >= maxItems) break;
    for (const raw of withMedia) {
      const id = String(raw.id ?? raw.waMessageId ?? openwaMessageSerializedId(raw) ?? '');
      if (!openwaIdsMatch(messageId, id)) continue;
      const type = String(raw.type ?? 'unknown').toLowerCase();
      const extracted = extractOpenwaMediaFromMessage(raw);
      if (!extracted || extracted === 'expired') break;
      out.push({
        message_id: id,
        mime: extracted.contentType ?? 'application/octet-stream',
        buf: extracted.buf,
        type,
      });
      break;
    }
  }
  return out;
}

export function buildOpenwaMessageUpsertRow(
  raw: Record<string, unknown>,
  chatId: string,
  companyId: string,
): Record<string, unknown> {
  const m = normalizeOpenwaMessageToWahaShape(raw, chatId);
  const id = openwaMessageSerializedId(raw) ||
    String((m.id as { _serialized?: string })?._serialized ?? '');
  const tsNum = Number(m.timestamp ?? raw.timestamp ?? 0);
  const media = openwaExtractMediaMeta(raw);
  return {
    company_id: companyId,
    chat_id: chatId,
    source_provider: 'openwa',
    waha_message_id: id,
    from_jid: String(raw.from ?? m.from ?? chatId),
    from_me: openwaMessageFromMe(raw),
    type: String(raw.type ?? m.type ?? 'text'),
    body: typeof raw.body === 'string' ? raw.body : (typeof m.body === 'string' ? m.body : null),
    caption: typeof m.caption === 'string' ? m.caption : null,
    media_url: media.media_url,
    media_mime_type: media.media_mime_type,
    media_filename: media.media_filename,
    media_size: media.media_size,
    ack: 0,
    quoted_message_id: null,
    timestamp: tsNum
      ? new Date(tsNum * 1000).toISOString()
      : new Date().toISOString(),
    raw: m as unknown,
  };
}

export function normalizeOpenwaMessageToWahaShape(
  msg: Record<string, unknown>,
  chatId: string,
): Record<string, unknown> {
  const id = openwaMessageSerializedId(msg) || String(msg.id ?? msg.messageId ?? '');
  const from = String(msg.from ?? msg.chatId ?? chatId);
  const body = typeof msg.body === 'string' ? msg.body : '';
  const ts = msg.waTimestamp ?? msg.timestamp;
  let timestamp = 0;
  if (typeof ts === 'number') timestamp = ts > 1e12 ? Math.floor(ts / 1000) : ts;
  else if (typeof ts === 'string') timestamp = Math.floor(Date.parse(ts) / 1000);

  return {
    id: { _serialized: id, id: id.split('_').pop(), remote: from },
    from,
    to: msg.to ?? null,
    fromMe: openwaMessageFromMe(msg),
    body,
    caption: msg.caption ?? null,
    type: msg.type ?? 'text',
    timestamp,
    hasMedia: !!msg.hasMedia,
    media: msg.media ?? null,
    notifyName: (msg.contact as { pushName?: string } | undefined)?.pushName ?? null,
    pushName: (msg.contact as { pushName?: string } | undefined)?.pushName ?? null,
  };
}
