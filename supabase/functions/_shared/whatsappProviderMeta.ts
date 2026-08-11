/**
 * Meta WhatsApp Cloud API (Graph).
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import {
  type WhatsappProviderConfig,
  type WhatsappSendMediaInput,
  type WhatsappSendResult,
  extractProviderErrorMessage,
  trimSlash,
} from './whatsappProviderTypes.ts';

export const META_DEFAULT_GRAPH_VERSION = 'v21.0';
export const META_GRAPH_HOST = 'https://graph.facebook.com';

const FETCH_TIMEOUT_MS = 30_000;
const MEDIA_TIMEOUT_MS = 55_000;

export type MetaCredentialFields = {
  meta_access_token?: string | null;
  meta_phone_number_id?: string | null;
  meta_waba_id?: string | null;
  meta_app_secret?: string | null;
  meta_verify_token?: string | null;
  meta_graph_version?: string | null;
};

export type MetaLiveStatus = {
  internalStatus: string;
  meJid: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
};

export class MetaCloudApiError extends Error {
  status: number;
  path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.status = status;
    this.path = path;
  }
}

export function normalizeMetaGraphVersion(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return META_DEFAULT_GRAPH_VERSION;
  return v.startsWith('v') ? v : `v${v}`;
}

export function metaGraphBaseUrl(version?: string | null): string {
  return `${META_GRAPH_HOST}/${normalizeMetaGraphVersion(version)}`;
}

/** Suite chat_id (`34666…@c.us`) → destinatario Cloud API (solo dígitos). */
export function suiteChatIdToMetaRecipient(chatId: string): string {
  const local = String(chatId ?? '').split('@')[0] ?? '';
  const digits = local.replace(/\D/g, '');
  if (!digits) {
    throw new Error(`Chat ID inválido para Meta Cloud API: ${chatId}`);
  }
  return digits;
}

/** wa_id de Cloud API → chat_id Suite. */
export function metaWaIdToSuiteChatId(waId: string): string {
  const digits = String(waId ?? '').replace(/\D/g, '');
  if (!digits) throw new Error('wa_id vacío');
  return `${digits}@c.us`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function stripBase64Prefix(data: string): string {
  const m = /^data:[^;]+;base64,(.+)$/i.exec(data.trim());
  return m ? m[1] : data;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(stripBase64Prefix(b64));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function resolveMetaAccessToken(cfg: WhatsappProviderConfig & MetaCredentialFields): string {
  const token = (cfg.meta_access_token ?? cfg.api_key ?? '').trim();
  if (!token) throw new Error('Meta Cloud API: falta el access token');
  return token;
}

export function resolveMetaPhoneNumberId(cfg: WhatsappProviderConfig & MetaCredentialFields): string {
  const id = (cfg.meta_phone_number_id ?? cfg.session_name ?? '').trim();
  if (!id || id === 'default') {
    throw new Error('Meta Cloud API: falta el Phone Number ID');
  }
  return id;
}

export async function metaGraphFetch(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  path: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const token = resolveMetaAccessToken(cfg);
  const base = trimSlash(cfg.base_url || metaGraphBaseUrl(cfg.meta_graph_version));
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error(`Meta Cloud API no respondió en ${Math.round(timeoutMs / 1000)}s (${path})`);
    }
    throw e;
  }
}

export async function metaGraphJson<T = unknown>(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  path: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<T> {
  const resp = await metaGraphFetch(cfg, path, init, timeoutMs);
  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new MetaCloudApiError(resp.status, path, `Respuesta no JSON (HTTP ${resp.status})`);
  }
  if (!resp.ok) {
    const errObj = asRecord(asRecord(data)?.error) ?? asRecord(data);
    const msg =
      (typeof errObj?.message === 'string' ? errObj.message : null) ??
      extractProviderErrorMessage(data, resp.status);
    throw new MetaCloudApiError(resp.status, path, `Meta Cloud API (${resp.status}): ${msg}`);
  }
  return data as T;
}

export async function metaGetPhoneStatus(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
): Promise<MetaLiveStatus> {
  const phoneId = resolveMetaPhoneNumberId(cfg);
  const data = await metaGraphJson<{
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
  }>(
    cfg,
    `/${encodeURIComponent(phoneId)}?fields=id,display_phone_number,verified_name,quality_rating`,
  );
  const display = data.display_phone_number?.trim() || null;
  const digits = display ? display.replace(/\D/g, '') : phoneId.replace(/\D/g, '');
  return {
    internalStatus: 'WORKING',
    meJid: digits ? `${digits}@c.us` : null,
    displayPhoneNumber: display,
    verifiedName: data.verified_name?.trim() || null,
    qualityRating: data.quality_rating?.trim() || null,
  };
}

export async function metaPing(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    await metaGetPhoneStatus(cfg);
    return { ok: true, status: 200 };
  } catch (e) {
    const status = e instanceof MetaCloudApiError ? e.status : 0;
    return {
      ok: false,
      status,
      error: e instanceof Error ? e.message : 'Error Meta Cloud API',
    };
  }
}

function extractOutboundMessageId(res: unknown): string | null {
  const r = asRecord(res);
  const messages = r?.messages;
  if (Array.isArray(messages) && messages[0]) {
    const id = asRecord(messages[0])?.id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

export async function metaSendText(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  chatId: string,
  text: string,
  opts?: { replyToMessageId?: string },
): Promise<WhatsappSendResult> {
  const phoneId = resolveMetaPhoneNumberId(cfg);
  const to = suiteChatIdToMetaRecipient(chatId);
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };
  if (opts?.replyToMessageId) {
    payload.context = { message_id: opts.replyToMessageId };
  }
  const res = await metaGraphJson(cfg, `/${encodeURIComponent(phoneId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    messageId: extractOutboundMessageId(res),
    timestamp: Math.floor(Date.now() / 1000),
    raw: res,
  };
}

async function metaUploadMedia(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  media: WhatsappSendMediaInput,
  type: 'image' | 'video' | 'audio' | 'document' | 'voice',
): Promise<string> {
  const phoneId = resolveMetaPhoneNumberId(cfg);
  const token = resolveMetaAccessToken(cfg);
  const base = trimSlash(cfg.base_url || metaGraphBaseUrl(cfg.meta_graph_version));
  const bytes = base64ToUint8Array(media.base64);
  const mime =
    type === 'voice'
      ? 'audio/ogg; codecs=opus'
      : media.mime || 'application/octet-stream';
  const filename =
    media.filename ||
    (type === 'voice'
      ? 'voice.ogg'
      : type === 'image'
        ? 'image.jpg'
        : type === 'video'
          ? 'video.mp4'
          : type === 'audio'
            ? 'audio.ogg'
            : 'file.bin');

  const form = new FormData();
  form.set('messaging_product', 'whatsapp');
  form.set('type', type === 'voice' ? 'audio' : type);
  form.set('file', new Blob([bytes], { type: mime }), filename);

  const resp = await fetch(`${base}/${encodeURIComponent(phoneId)}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new MetaCloudApiError(resp.status, '/media', `Subida media no JSON (HTTP ${resp.status})`);
  }
  if (!resp.ok) {
    const errObj = asRecord(asRecord(data)?.error) ?? asRecord(data);
    const msg =
      (typeof errObj?.message === 'string' ? errObj.message : null) ??
      extractProviderErrorMessage(data, resp.status);
    throw new MetaCloudApiError(resp.status, '/media', `Subida media fallida: ${msg}`);
  }
  const id = asRecord(data)?.id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new MetaCloudApiError(resp.status, '/media', 'Meta no devolvió media id');
  }
  return id.trim();
}

export async function metaSendMedia(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  chatId: string,
  type: 'image' | 'video' | 'audio' | 'document' | 'voice',
  media: WhatsappSendMediaInput,
): Promise<WhatsappSendResult> {
  const phoneId = resolveMetaPhoneNumberId(cfg);
  const to = suiteChatIdToMetaRecipient(chatId);
  const graphType = type === 'voice' ? 'audio' : type;

  let mediaBody: Record<string, unknown>;
  if (media.url && /^https?:\/\//i.test(media.url)) {
    mediaBody = { link: media.url };
  } else {
    const mediaId = await metaUploadMedia(cfg, media, type);
    mediaBody = { id: mediaId };
  }
  if (media.caption && (type === 'image' || type === 'video' || type === 'document')) {
    mediaBody.caption = media.caption;
  }
  if (type === 'document' && media.filename) {
    mediaBody.filename = media.filename;
  }
  if (type === 'voice') {
    mediaBody.voice = true;
  }

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: graphType,
    [graphType]: mediaBody,
  };

  const res = await metaGraphJson(cfg, `/${encodeURIComponent(phoneId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    messageId: extractOutboundMessageId(res),
    timestamp: Math.floor(Date.now() / 1000),
    raw: res,
  };
}

/** Descarga binario de un media_id de Cloud API. */
export async function metaDownloadMediaById(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  mediaId: string,
): Promise<{ bytes: Uint8Array; mime: string | null }> {
  const meta = await metaGraphJson<{ url?: string; mime_type?: string }>(
    cfg,
    `/${encodeURIComponent(mediaId)}`,
  );
  if (!meta.url) throw new MetaCloudApiError(404, `/${mediaId}`, 'Media sin URL');
  const token = resolveMetaAccessToken(cfg);
  const resp = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new MetaCloudApiError(resp.status, meta.url, `Descarga media HTTP ${resp.status}`);
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  return {
    bytes: buf,
    mime: meta.mime_type ?? resp.headers.get('content-type'),
  };
}

export async function metaMarkRead(
  cfg: WhatsappProviderConfig & MetaCredentialFields,
  messageId: string,
): Promise<void> {
  const phoneId = resolveMetaPhoneNumberId(cfg);
  await metaGraphJson(cfg, `/${encodeURIComponent(phoneId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });
}

/** Verifica firma X-Hub-Signature-256 (HMAC-SHA256 hex del body). */
export async function verifyMetaHubSignature(
  rawBody: string,
  appSecret: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!appSecret || !signatureHeader) return false;
  const expected = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length).trim()
    : signatureHeader.trim();
  if (!expected) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hex.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < hex.length; i++) {
    ok |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return ok === 0;
}

export function isMetaCloudWebhookBody(body: unknown): boolean {
  const r = asRecord(body);
  if (!r) return false;
  if (r.object === 'whatsapp_business_account') return true;
  if (Array.isArray(r.entry) && r.object) return true;
  return false;
}

type WahaLikeEnvelope = {
  event?: string;
  session?: string;
  payload?: unknown;
  me?: { id?: string; pushName?: string } | null;
};

/**
 * Convierte webhooks Cloud API a envelopes estilo WAHA para reutilizar handleMessage.
 * Emite un envelope por mensaje/status (el caller puede iterar).
 */
export function metaCloudWebhookToWahaEnvelopes(body: unknown): WahaLikeEnvelope[] {
  const root = asRecord(body);
  if (!root || !Array.isArray(root.entry)) return [];

  const out: WahaLikeEnvelope[] = [];

  for (const entry of root.entry) {
    const e = asRecord(entry);
    const changes = e?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const ch = asRecord(change);
      const value = asRecord(ch?.value);
      if (!value) continue;

      const metadata = asRecord(value.metadata);
      const displayPhone =
        typeof metadata?.display_phone_number === 'string'
          ? metadata.display_phone_number.replace(/\D/g, '')
          : null;
      const me =
        displayPhone
          ? { id: `${displayPhone}@c.us`, pushName: null as string | null }
          : null;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactNameByWa = new Map<string, string>();
      for (const c of contacts) {
        const cr = asRecord(c);
        const wa = asRecord(cr?.profile)?.name;
        const waId = typeof asRecord(cr)?.wa_id === 'string' ? String(asRecord(cr)!.wa_id) : '';
        if (waId && typeof wa === 'string' && wa.trim()) contactNameByWa.set(waId, wa.trim());
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const m = asRecord(msg);
        if (!m) continue;
        const from = typeof m.from === 'string' ? m.from : '';
        const id = typeof m.id === 'string' ? m.id : null;
        const ts = typeof m.timestamp === 'string' || typeof m.timestamp === 'number'
          ? Number(m.timestamp)
          : Math.floor(Date.now() / 1000);
        const type = typeof m.type === 'string' ? m.type : 'text';
        const textBody =
          typeof asRecord(m.text)?.body === 'string'
            ? String(asRecord(m.text)!.body)
            : null;

        let bodyText = textBody;
        let caption: string | null = null;
        let hasMedia = false;
        let media: { url?: string; mimetype?: string; filename?: string; id?: string } | null =
          null;

        const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'] as const;
        for (const mt of mediaTypes) {
          const block = asRecord(m[mt]);
          if (!block) continue;
          hasMedia = true;
          caption = typeof block.caption === 'string' ? block.caption : null;
          media = {
            id: typeof block.id === 'string' ? block.id : undefined,
            mimetype: typeof block.mime_type === 'string' ? block.mime_type : undefined,
            filename: typeof block.filename === 'string' ? block.filename : undefined,
          };
          if (!bodyText && caption) bodyText = caption;
          break;
        }

        if (type === 'button' || type === 'interactive') {
          const btn = asRecord(m.button);
          const interactive = asRecord(m.interactive);
          bodyText =
            bodyText ??
            (typeof btn?.text === 'string' ? btn.text : null) ??
            (typeof asRecord(interactive?.button_reply)?.title === 'string'
              ? String(asRecord(interactive!.button_reply)!.title)
              : null);
        }

        const chatId = from ? metaWaIdToSuiteChatId(from) : '';
        if (!chatId || !id) continue;

        out.push({
          event: 'message',
          me,
          payload: {
            id,
            from: chatId,
            to: me?.id ?? null,
            fromMe: false,
            body: bodyText,
            caption,
            type: type === 'audio' && asRecord(m.audio)?.voice ? 'voice' : type,
            timestamp: ts,
            hasMedia,
            media,
            mediaId: media?.id ?? null,
            mimetype: media?.mimetype ?? null,
            notifyName: contactNameByWa.get(from) ?? null,
            pushName: contactNameByWa.get(from) ?? null,
            _data: m,
            source: 'meta',
          },
        });
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        const s = asRecord(st);
        if (!s) continue;
        const id = typeof s.id === 'string' ? s.id : null;
        if (!id) continue;
        const status = typeof s.status === 'string' ? s.status.toLowerCase() : '';
        // WAHA ack: 0 pending, 1 server, 2 device, 3 read, -1 error
        let ack = 1;
        if (status === 'sent') ack = 1;
        else if (status === 'delivered') ack = 2;
        else if (status === 'read') ack = 3;
        else if (status === 'failed') ack = -1;
        out.push({
          event: 'message.ack',
          me,
          payload: { id, ack, status, _data: s },
        });
      }
    }
  }

  return out;
}
