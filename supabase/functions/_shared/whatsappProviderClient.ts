import {
  type WhatsappProvider,
  type WhatsappProviderConfig,
  type WhatsappSendMediaInput,
  type WhatsappSendResult,
  extractProviderErrorMessage,
  normalizeWhatsappProvider,
  trimSlash,
} from './whatsappProviderTypes.ts';
import { resolveOpenwaSessionId } from './whatsappProviderOpenwa.ts';

const OPENWA_VOICE_FILENAME = 'voice.ogg';

/** OpenWA/whatsapp-web.js envía notas de voz con application/ogg; audio/ogg devuelve 500. */
export function normalizeOpenwaOutgoingAudioMime(mime: string): string {
  const m = (mime ?? '').trim().toLowerCase();
  if (!m) return 'application/ogg';
  if (m.includes('ogg') || m.includes('opus') || m === 'application/ogg') return 'application/ogg';
  return mime;
}

/** OpenWA SendMediaMessageDto: campos planos (chatId, url|base64, mimetype), no objetos anidados. */
function buildOpenwaSendMediaBody(
  chatId: string,
  media: WhatsappSendMediaInput,
  rawBase64: string,
  defaultMime: string,
  opts?: { preferUrl?: boolean; forceRawBase64?: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    chatId,
    mimetype: media.mime || defaultMime,
  };
  if (media.filename) body.filename = media.filename;
  if (media.caption) body.caption = media.caption;
  const useUrl = !!media.url && opts?.preferUrl !== false && !opts?.forceRawBase64;
  if (useUrl) {
    body.url = media.url;
  } else {
    // data:...;base64, rompe atob() en whatsapp-web.js
    body.base64 = rawBase64;
  }
  return body;
}

const FETCH_TIMEOUT_MS = 25_000;
export const PROVIDER_MEDIA_TIMEOUT_MS = 55_000;

export class WhatsappProviderError extends Error {
  status: number;
  path: string;
  provider: WhatsappProvider;

  constructor(
    provider: WhatsappProvider,
    status: number,
    path: string,
    message: string,
  ) {
    super(message);
    this.provider = provider;
    this.status = status;
    this.path = path;
  }
}

function apiBaseUrl(cfg: WhatsappProviderConfig): string {
  const base = trimSlash(cfg.base_url ?? '');
  if (!base) throw new Error('WhatsApp no configurado: falta base_url');
  const provider = normalizeWhatsappProvider(cfg.provider);
  if (provider === 'openwa' && !base.endsWith('/api')) {
    return `${base}/api`;
  }
  return base;
}

function authHeaders(cfg: WhatsappProviderConfig): Headers {
  const headers = new Headers();
  if (cfg.api_key) {
    headers.set('X-Api-Key', cfg.api_key);
    headers.set('X-API-Key', cfg.api_key);
  }
  return headers;
}

function providerLabel(provider: WhatsappProvider): string {
  return provider === 'openwa' ? 'OpenWA' : 'WAHA';
}

export async function providerFetch(
  cfg: WhatsappProviderConfig,
  path: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  const headers = authHeaders(cfg);
  const incoming = new Headers(init.headers ?? {});
  incoming.forEach((v, k) => headers.set(k, v));
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const url = `${apiBaseUrl(cfg)}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error(
        `${providerLabel(provider)} no respondió en ${Math.round(timeoutMs / 1000)}s (${path})`,
      );
    }
    throw e;
  }
}

export async function providerJson<T = unknown>(
  cfg: WhatsappProviderConfig,
  path: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<T> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  const resp = await providerFetch(cfg, path, init, timeoutMs);
  const text = await resp.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new WhatsappProviderError(
      provider,
      resp.status,
      path,
      `Respuesta no JSON (HTTP ${resp.status}) en ${path}`,
    );
  }
  if (!resp.ok) {
    const msg = extractProviderErrorMessage(data, resp.status);
    throw new WhatsappProviderError(
      provider,
      resp.status,
      path,
      `${providerLabel(provider)} (${resp.status}) en ${path}: ${msg}`,
    );
  }
  return data as T;
}

export function resolveOutgoingMessageId(
  provider: WhatsappProvider,
  res: unknown,
  chatId: string,
): string | null {
  if (provider === 'openwa') {
    const r = res as { messageId?: string; id?: string };
    if (r.messageId?.trim()) return r.messageId.trim();
    if (r.id?.trim()) return r.id.trim();
    return null;
  }
  const r = res as {
    id?: { id?: string; _serialized?: string; remote?: string };
    _data?: { id?: { id?: string; _serialized?: string; remote?: string }; to?: string };
    to?: string;
  };
  const serialized = r?.id?._serialized ?? r?._data?.id?._serialized ?? null;
  if (typeof serialized === 'string' && serialized.trim()) return serialized.trim();
  const keyId = r?.id?.id ?? r?._data?.id?.id ?? null;
  const remote =
    r?.id?.remote ??
    r?._data?.id?.remote ??
    r?.to ??
    r?._data?.to ??
    chatId;
  if (keyId && typeof remote === 'string' && remote.includes('@')) {
    return `true_${remote}_${keyId}`;
  }
  return keyId;
}

function stripBase64Prefix(data: string): string {
  const m = /^data:[^;]+;base64,(.+)$/i.exec(data.trim());
  return m ? m[1] : data;
}

function parseOpenwaTimestamp(ts: unknown): number | undefined {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const d = Date.parse(ts);
    if (!Number.isNaN(d)) return Math.floor(d / 1000);
  }
  return undefined;
}

export async function providerSendText(
  cfg: WhatsappProviderConfig,
  chatId: string,
  text: string,
  opts?: { replyToMessageId?: string },
): Promise<WhatsappSendResult> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  const sessionName = cfg.session_name || 'default';

  if (provider === 'openwa') {
    const sessionId = await resolveOpenwaSessionId(cfg);
    const payload: Record<string, unknown> = { chatId, text };
    if (opts?.replyToMessageId) {
      payload.options = { quotedMessageId: opts.replyToMessageId };
    }
    const res = await providerJson<Record<string, unknown>>(
      cfg,
      `/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
    return {
      messageId: resolveOutgoingMessageId(provider, res, chatId),
      timestamp: parseOpenwaTimestamp(res.timestamp),
      raw: res,
    };
  }

  const payload: Record<string, unknown> = {
    session: sessionName,
    chatId,
    text,
  };
  if (opts?.replyToMessageId) payload.reply_to = opts.replyToMessageId;
  const res = await providerJson<Record<string, unknown>>(cfg, '/api/sendText', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    messageId: resolveOutgoingMessageId(provider, res, chatId),
    timestamp: typeof res.timestamp === 'number' ? res.timestamp : undefined,
    raw: res,
  };
}

export async function providerSendMedia(
  cfg: WhatsappProviderConfig,
  chatId: string,
  type: 'image' | 'video' | 'audio' | 'document' | 'voice',
  media: WhatsappSendMediaInput,
): Promise<WhatsappSendResult> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  const sessionName = cfg.session_name || 'default';
  const base64 = stripBase64Prefix(media.base64);

  if (provider === 'openwa') {
    const sessionId = await resolveOpenwaSessionId(cfg);
    let path = '';
    let body: Record<string, unknown>;
    const isAudio = type === 'audio' || type === 'voice';
    const audioMime = isAudio ? normalizeOpenwaOutgoingAudioMime(media.mime) : media.mime;

    switch (type) {
      case 'image':
        path = `/sessions/${encodeURIComponent(sessionId)}/messages/send-image`;
        body = buildOpenwaSendMediaBody(chatId, media, base64, 'image/jpeg', {
          preferUrl: !!media.url,
        });
        break;
      case 'video':
        path = `/sessions/${encodeURIComponent(sessionId)}/messages/send-video`;
        body = buildOpenwaSendMediaBody(chatId, media, base64, 'video/mp4', {
          preferUrl: !!media.url,
        });
        break;
      case 'audio':
      case 'voice':
        path = `/sessions/${encodeURIComponent(sessionId)}/messages/send-audio`;
        body = buildOpenwaSendMediaBody(
          chatId,
          {
            ...media,
            mime: audioMime,
            filename: media.filename?.trim() || OPENWA_VOICE_FILENAME,
          },
          base64,
          'application/ogg',
          { forceRawBase64: true },
        );
        break;
      default:
        path = `/sessions/${encodeURIComponent(sessionId)}/messages/send-document`;
        body = buildOpenwaSendMediaBody(chatId, media, base64, 'application/octet-stream', {
          preferUrl: !!media.url,
        });
        break;
    }

    const res = await providerJson<Record<string, unknown>>(cfg, path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return {
      messageId: resolveOutgoingMessageId(provider, res, chatId),
      timestamp: parseOpenwaTimestamp(res.timestamp),
      raw: res,
    };
  }

  let endpoint = '/api/sendFile';
  if (type === 'image') endpoint = '/api/sendImage';
  else if (type === 'video') endpoint = '/api/sendVideo';
  else if (type === 'voice') endpoint = '/api/sendVoice';

  const payload: Record<string, unknown> = {
    session: sessionName,
    chatId,
    file: {
      mimetype: media.mime,
      filename: media.filename,
      data: base64,
    },
  };
  if (media.caption) payload.caption = media.caption;
  if (type === 'voice') {
    const lowerMime = media.mime.toLowerCase();
    payload.convert = !(lowerMime.includes('ogg') || lowerMime.includes('opus'));
  }

  const res = await providerJson<Record<string, unknown>>(cfg, endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    messageId: resolveOutgoingMessageId(provider, res, chatId),
    timestamp: typeof res.timestamp === 'number' ? res.timestamp : undefined,
    raw: res,
  };
}

export async function providerPing(cfg: WhatsappProviderConfig): Promise<{ ok: boolean; status?: number }> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  if (provider === 'openwa') {
    try {
      await providerJson(cfg, '/health');
      return { ok: true };
    } catch (e) {
      const status = e instanceof WhatsappProviderError ? e.status : 0;
      return { ok: false, status };
    }
  }
  const resp = await providerFetch(cfg, '/ping');
  return { ok: resp.ok, status: resp.status };
}

export async function providerListSessions(
  cfg: WhatsappProviderConfig,
): Promise<Array<{ name?: string; id?: string; status?: string }>> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  if (provider === 'openwa') {
    const data = await providerJson<Array<{ id?: string; name?: string; status?: string }>>(cfg, '/sessions');
    return Array.isArray(data) ? data : [];
  }
  const data = await providerJson<Array<{ name?: string; status?: string }>>(cfg, '/api/sessions');
  return Array.isArray(data) ? data : [];
}
