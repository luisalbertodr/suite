// Edge function: whatsapp-webhook
// ---------------------------------------------------------------------------
// Endpoint público (sin JWT) que recibe los webhooks de Waha y los persiste
// en whatsapp_chats / whatsapp_messages / whatsapp_config.
//
// Para autenticar la llamada usamos el header `X-Webhook-Secret`:
//   * Si la URL trae ?company_id=<uuid>, buscamos esa fila y comparamos
//     con whatsapp_config.webhook_secret.
//   * Si no, recorremos todas las configs activas con webhook_secret no nulo
//     y aceptamos la primera que coincida (útil cuando solo hay una empresa).
//
// Eventos soportados (los más comunes de Waha):
//   * "message", "message.any"    → mensaje entrante o salirte (otro disp.)
//   * "message.ack"               → cambio de estado de entrega/lectura
//   * "session.status", "state.change", "engine.event" → estado de sesión
//   * "chat.archive"              → cambio de archivado
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processAutomationReply } from '../_shared/marketingWhatsappAutomation.ts';
import { mapOpenwaStatusToInternal } from '../_shared/whatsappProviderTypes.ts';
import {
  isMetaCloudWebhookBody,
  metaCloudWebhookToWahaEnvelopes,
  verifyMetaHubSignature,
} from '../_shared/whatsappProviderMeta.ts';
import {
  sanitizeWhatsappMessageType,
  whatsappMediaPreviewLabel,
  inferWhatsappMediaFromRaw,
  isWeakWhatsappMessageType,
} from '../_shared/whatsappMessageType.ts';
import { isoFromUnixSecondsLive } from '../_shared/whatsappMessageOrder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type WahaMessagePayload = {
  id?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  body?: string;
  caption?: string;
  hasMedia?: boolean;
  type?: string;
  timestamp?: number;
  ack?: number;
  media?: {
    url?: string;
    mimetype?: string;
    filename?: string;
    size?: number;
  };
  _data?: { notifyName?: string; pushName?: string };
  notifyName?: string;
  pushName?: string;
  // Formato Baileys (NOWEB)
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
    participant?: string;
    participantAlt?: string;
    remoteJidAlt?: string;
  };
  message?: Record<string, unknown>;
  messageTimestamp?: number | string;
};

type WahaEnvelope = {
  event?: string;
  session?: string;
  payload?: unknown;
  me?: { id?: string; pushName?: string } | null;
  engine?: unknown;
};

type OpenwaWebhookEnvelope = {
  event?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
};

function isOpenwaWebhookBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.event === 'string' && 'data' in b && !('payload' in b);
}

function openwaToWahaEnvelope(body: OpenwaWebhookEnvelope): WahaEnvelope {
  const event = (body.event ?? '').toLowerCase();
  const data = body.data ?? {};

  if (event === 'test') {
    return { event: 'test', payload: data };
  }

  if (event === 'message.received' || event === 'message.sent') {
    const fromMe = !!data.fromMe;
    const inferred = inferWhatsappMediaFromRaw(data);
    const declaredType = data.type ?? 'text';
    const type = isWeakWhatsappMessageType(declaredType) && inferred
      ? inferred.type
      : declaredType;
    const dataKey = asRecord(asRecord(data._data)?.key) ?? asRecord(data.key);
    const dataMessage =
      asRecord(asRecord(data._data)?.message) ??
      asRecord(data.message) ??
      null;
    return {
      event: fromMe ? 'message.any' : 'message',
      payload: {
        id: data.id ?? data.messageId,
        from: data.from,
        to: data.to,
        fromMe,
        body: data.body ?? inferred?.body ?? null,
        caption: data.caption ?? inferred?.caption ?? null,
        type,
        timestamp: data.waTimestamp ?? data.timestamp,
        hasMedia: data.hasMedia ?? !!inferred,
        media: data.media ??
          (inferred?.mediaUrl
            ? {
                url: inferred.mediaUrl,
                mimetype: inferred.mediaMime,
                filename: inferred.mediaFilename,
                size: inferred.mediaSize,
              }
            : null),
        mimetype: data.mimetype ?? inferred?.mediaMime ?? null,
        notifyName: (data.contact as { pushName?: string } | undefined)?.pushName,
        pushName: (data.contact as { pushName?: string } | undefined)?.pushName,
        // Permite el camino Baileys en normalizeMessage.
        key: dataKey,
        message: dataMessage ?? undefined,
        messageTimestamp: data.waTimestamp ?? data.timestamp,
        _data: data._data ?? data,
      },
    };
  }

  if (event === 'message.ack') {
    const ackMap: Record<string, number> = {
      pending: 0,
      sent: 1,
      delivered: 2,
      read: 3,
      failed: -1,
    };
    const status = String(data.status ?? '');
    return {
      event: 'message.ack',
      payload: {
        id: data.id ?? data.messageId,
        ack: typeof data.ack === 'number' ? data.ack : ackMap[status] ?? 0,
      },
    };
  }

  if (event === 'session.status' || event === 'session.authenticated' || event === 'session.disconnected') {
    const phoneRaw = data.phoneNumber ?? data.phone ?? '';
    const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, '') : '';
    const statusRaw = event === 'session.authenticated'
      ? 'CONNECTED'
      : event === 'session.disconnected'
        ? 'DISCONNECTED'
        : String(data.status ?? '');
    return {
      event: 'session.status',
      payload: {
        status: mapOpenwaStatusToInternal(statusRaw),
        message: data.message ?? null,
      },
      me: phone ? { id: `${phone}@c.us`, pushName: undefined } : null,
    };
  }

  if (event === 'session.qr') {
    const qr = typeof data.qr === 'string'
      ? data.qr
      : typeof data.image === 'string'
        ? data.image
        : null;
    return {
      event: 'session.status',
      payload: {
        status: 'SCAN_QR_CODE',
        qr,
        message: null,
      },
    };
  }

  if (event === 'message.failed') {
    return {
      event: 'message.ack',
      payload: {
        id: data.id ?? data.messageId,
        ack: -1,
      },
    };
  }

  return { event, payload: data };
}

/**
 * Estructura interna normalizada a partir de cualquiera de los dos formatos
 * de Waha (WEBJS plano o NOWEB/Baileys anidado).
 */
type NormalizedMessage = {
  id: string | null;
  chatId: string;
  fromJid: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
  ack: number;
  timestamp: string;
  pushName: string | null;
  isGroup: boolean;
  raw: unknown;
};

const BAILEYS_SKIP = new Set([
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'protocolMessage',
  'deviceSentMessage',
]);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Waha NOWEB suele anidar `key` y `pushName` del contacto dentro de `_data`. */
function extractMessageKey(raw: unknown): WahaMessagePayload['key'] | undefined {
  const r = asRecord(raw);
  if (!r) return undefined;
  const top = r.key as WahaMessagePayload['key'] | undefined;
  if (top?.remoteJid) return top;
  const data = asRecord(r._data);
  const nested = data?.key as WahaMessagePayload['key'] | undefined;
  if (nested?.remoteJid) return nested;
  return top;
}

/** Nombre del contacto remitente; ignora el pushName de la cuenta conectada. */
function extractContactPushName(
  payload: WahaMessagePayload,
  mePushName?: string | null,
): string | null {
  const data = asRecord(payload._data);
  const me = mePushName?.trim().toLowerCase() ?? '';
  const candidates = [
    data?.pushName,
    data?.notifyName,
    payload.pushName,
    payload.notifyName,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const name = c.trim();
    if (me && name.toLowerCase() === me) continue;
    return name;
  }
  return null;
}

function extractGroupNameFromPayload(payload: WahaMessagePayload): string | null {
  const r = payload as Record<string, unknown>;
  const data = asRecord(payload._data);
  for (const v of [
    r.subject,
    r.name,
    data?.subject,
    data?.name,
    data?.formattedTitle,
  ]) {
    if (typeof v === 'string' && v.trim() && !v.includes('@')) return v.trim();
  }
  for (const nestedKey of ['_chat', 'groupMetadata', 'chat']) {
    const nested = asRecord(r[nestedKey] ?? data?.[nestedKey]);
    if (!nested) continue;
    for (const key of ['subject', 'name', 'formattedTitle']) {
      const v = nested[key];
      if (typeof v === 'string' && v.trim() && !v.includes('@')) return v.trim();
    }
  }
  return null;
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

function isWhatsappSystemOrNotificationMessage(m: NormalizedMessage): boolean {
  if (isSystemChatJid(m.chatId)) return true;
  const text = (m.body ?? m.caption ?? '').trim();
  if (!text) return false;
  return (
    /^10 mensajes sin leer$/i.test(text) ||
    /^Abre la app para visualizar el contenido$/i.test(text) ||
    /^Notificación$/i.test(text) ||
    /^Whatshapp$/i.test(text)
  );
}

function isPhoneJid(jid: string | null | undefined): boolean {
  return !!jid && /@(c\.us|s\.whatsapp\.net)$/i.test(jid);
}

function isLidJid(jid: string | null | undefined): boolean {
  return !!jid && /@lid$/i.test(jid);
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

function resolveGroupSenderJid(raw: unknown, fallbackFrom?: string | null): string | null {
  const r = asRecord(raw);
  const key = extractMessageKey(r);
  const data = asRecord(r?._data);
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
  key?: WahaMessagePayload['key'],
): string | null {
  if (fromMe) return null;
  if (isGroupJid(chatId)) return resolveGroupSenderJid(raw, rawFrom ?? null);
  return pickBestSenderJid(
    key?.remoteJidAlt,
    key?.participantAlt,
    rawFrom && !isGroupJid(rawFrom) ? rawFrom : null,
  );
}

function preferFromJid(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (isPhoneJid(incoming) && !isPhoneJid(existing)) return incoming;
  if (isLidJid(existing) && !isLidJid(incoming)) return incoming;
  if (isGroupJid(existing) && !isGroupJid(incoming)) return incoming;
  return existing;
}

function normalizeWhatsappJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/i, '@c.us');
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

function chatIdFromSerializedId(id: string): string | null {
  const m = /^(?:true|false)_(.+?)_[A-F0-9]+$/i.exec(id.trim());
  return m?.[1] ?? null;
}

function resolveCanonicalChatId(
  remoteJid: string,
  key?: WahaMessagePayload['key'] | null,
  isGroup = false,
): string {
  if (isGroup) return remoteJid;
  const alt = key?.remoteJidAlt;
  if (alt && isPhoneJid(alt)) return normalizeWhatsappJid(alt);
  if (isPhoneJid(remoteJid)) return normalizeWhatsappJid(remoteJid);
  if (isLidJid(remoteJid)) return remoteJid;
  return remoteJid;
}

function resolveWahaMessageId(payload: WahaMessagePayload): string | null {
  if (typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  const key = extractMessageKey(payload);
  if (key?.id && key.remoteJid) {
    const prefix = key.fromMe ? 'true' : 'false';
    return `${prefix}_${key.remoteJid}_${key.id}`;
  }
  return key?.id ?? null;
}

function wahaIdSuffix(id: string | null | undefined): string | null {
  if (!id) return null;
  const parts = id.split('_');
  return parts.length >= 3 ? parts[parts.length - 1] ?? null : id;
}

async function deleteGhostOutgoingMessages(
  admin: SupabaseClient,
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

async function migrateChatIfNeeded(
  admin: SupabaseClient,
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
  admin: SupabaseClient,
  companyId: string,
  remoteJid: string,
  key?: WahaMessagePayload['key'] | null,
  isGroup = false,
): Promise<string> {
  let canonical = resolveCanonicalChatId(remoteJid, key, isGroup);
  if (isGroup) return canonical;

  const altPhone = key?.remoteJidAlt;
  if (isLidJid(remoteJid) && altPhone && isPhoneJid(altPhone)) {
    const phoneJid = normalizeWhatsappJid(altPhone);
    await migrateChatIfNeeded(admin, companyId, phoneJid, remoteJid);
    canonical = phoneJid;
  }

  const { data: siblings } = await admin
    .from('whatsapp_chats')
    .select('chat_id')
    .eq('company_id', companyId)
    .neq('chat_id', canonical)
    .limit(500);
  for (const row of siblings ?? []) {
    if (!jidsSameContact(row.chat_id, canonical)) continue;
    const phoneJid = isPhoneJid(canonical)
      ? canonical
      : isPhoneJid(row.chat_id)
        ? row.chat_id
        : null;
    const lidJid = isLidJid(canonical)
      ? canonical
      : isLidJid(row.chat_id)
        ? row.chat_id
        : null;
    if (phoneJid && lidJid && phoneJid !== lidJid) {
      await migrateChatIfNeeded(admin, companyId, phoneJid, lidJid);
      canonical = phoneJid;
    } else if (row.chat_id !== canonical) {
      await migrateChatIfNeeded(admin, companyId, canonical, row.chat_id);
    }
  }

  return canonical;
}

/**
 * Desempaqueta envolturas habituales (NOWEB/Baileys) hasta llegar al nodo con
 * conversation / imageMessage / …
 */
function unwrapBaileysMessage(msg: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 8) return msg;
  const ep = asRecord(msg.ephemeralMessage);
  if (ep?.message) return unwrapBaileysMessage(asRecord(ep.message) ?? {}, depth + 1);
  const v1 = asRecord(msg.viewOnceMessage);
  if (v1?.message) return unwrapBaileysMessage(asRecord(v1.message) ?? {}, depth + 1);
  const v2 = asRecord(msg.viewOnceMessageV2);
  if (v2?.message) return unwrapBaileysMessage(asRecord(v2.message) ?? {}, depth + 1);
  const dwc = asRecord(msg.documentWithCaptionMessage);
  if (dwc?.message) return unwrapBaileysMessage(asRecord(dwc.message) ?? {}, depth + 1);
  const ed = asRecord(msg.editedMessage);
  if (ed?.message) return unwrapBaileysMessage(asRecord(ed.message) ?? {}, depth + 1);
  return msg;
}

function httpMediaUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u.trim()) return null;
  const s = u.trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return null;
}

/**
 * Extrae tipo + texto/media del nodo Baileys. No confiamos en el orden de
 * Object.keys (senderKeyDistributionMessage puede ir primero y vaciaba el body).
 */
function baileysContent(msg: Record<string, unknown> | undefined): {
  type: string;
  body: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
} {
  const empty = {
    type: 'text' as const,
    body: null as string | null,
    caption: null as string | null,
    mediaUrl: null as string | null,
    mediaMime: null as string | null,
    mediaFilename: null as string | null,
    mediaSize: null as number | null,
  };

  if (!msg || typeof msg !== 'object') {
    return { ...empty, type: 'text' };
  }
  const root = unwrapBaileysMessage(msg);

  const get = (path: string): unknown => {
    const parts = path.split('.');
    let cur: unknown = root;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  };

  if (root.conversation !== undefined && root.conversation !== null) {
    const t = String(root.conversation).trim();
    return { ...empty, type: 'text', body: t || null };
  }

  const ext = asRecord(root.extendedTextMessage);
  if (ext?.text !== undefined) {
    const t = String(ext.text).trim();
    return { ...empty, type: 'text', body: t || null };
  }

  if (root.imageMessage) {
    return {
      ...empty,
      type: 'image',
      caption: (get('imageMessage.caption') as string) ?? null,
      mediaUrl: httpMediaUrl(get('imageMessage.url')),
      mediaMime: (get('imageMessage.mimetype') as string) ?? 'image/jpeg',
      mediaSize: Number(get('imageMessage.fileLength') ?? 0) || null,
    };
  }
  if (root.videoMessage) {
    return {
      ...empty,
      type: 'video',
      caption: (get('videoMessage.caption') as string) ?? null,
      mediaUrl: httpMediaUrl(get('videoMessage.url')),
      mediaMime: (get('videoMessage.mimetype') as string) ?? 'video/mp4',
      mediaSize: Number(get('videoMessage.fileLength') ?? 0) || null,
    };
  }
  if (root.audioMessage) {
    return {
      ...empty,
      type: (get('audioMessage.ptt') ? 'voice' : 'audio'),
      mediaUrl: httpMediaUrl(get('audioMessage.url')),
      mediaMime: (get('audioMessage.mimetype') as string) ?? 'audio/ogg',
      mediaSize: Number(get('audioMessage.fileLength') ?? 0) || null,
    };
  }
  if (root.documentMessage) {
    return {
      ...empty,
      type: 'document',
      caption: (get('documentMessage.caption') as string) ?? null,
      mediaUrl: httpMediaUrl(get('documentMessage.url')),
      mediaMime: (get('documentMessage.mimetype') as string) ?? 'application/octet-stream',
      mediaFilename: (get('documentMessage.fileName') as string) ?? null,
      mediaSize: Number(get('documentMessage.fileLength') ?? 0) || null,
    };
  }
  if (root.stickerMessage) {
    const stickerUrl = httpMediaUrl(get('stickerMessage.url'));
    return {
      ...empty,
      type: 'sticker',
      body: stickerUrl ? null : '[sticker]',
      mediaUrl: stickerUrl,
      mediaMime: (get('stickerMessage.mimetype') as string) ?? 'image/webp',
      mediaSize: Number(get('stickerMessage.fileLength') ?? 0) || null,
    };
  }
  if (root.locationMessage) {
    return { ...empty, type: 'location' };
  }
  if (root.contactMessage || root.contactsArrayMessage) {
    return { ...empty, type: 'contact' };
  }
  if (root.pollCreationMessage || root.pollUpdateMessage) {
    return { ...empty, type: 'poll', body: '[encuesta]' };
  }
  if (root.buttonsResponseMessage || root.listResponseMessage || root.templateButtonReplyMessage) {
    const sel = String(
      get('buttonsResponseMessage.selectedDisplayText') ??
        get('listResponseMessage.title') ??
        get('templateButtonReplyMessage.selectedDisplayText') ??
        '',
    ).trim();
    return {
      ...empty,
      type: 'text',
      body: sel || '[respuesta a botón/lista]',
    };
  }

  const keys = Object.keys(root).filter((k) => !BAILEYS_SKIP.has(k));
  const firstKey = keys[0] ?? '';
  return { ...empty, type: firstKey || 'unknown' };
}

function normalizeMessage(
  payload: WahaMessagePayload,
  mePushName?: string | null,
): NormalizedMessage | null {
  const key = extractMessageKey(payload);
  const isBaileys = !!(key?.remoteJid);

  if (isBaileys) {
    const remoteJid = key!.remoteJid!;
    const isGroup = /@g\.us$/i.test(remoteJid);
    const c = baileysContent(payload.message ?? asRecord(payload._data)?.message as Record<string, unknown> | undefined);
    const tsRaw = payload.messageTimestamp ?? asRecord(payload._data)?.messageTimestamp;
    const tsSecs = typeof tsRaw === 'string' ? Number(tsRaw) : Number(tsRaw ?? 0);
    const ts = isoFromUnixSecondsLive(tsSecs || null);
    const fromJid = isGroup
      ? resolveIncomingFromJid(remoteJid, !!key!.fromMe, null, payload, key)
      : resolveIncomingFromJid(
          remoteJid,
          !!key!.fromMe,
          remoteJid,
          payload,
          key,
        );
    return {
      id: resolveWahaMessageId(payload),
      chatId: remoteJid,
      fromJid,
      fromMe: !!key!.fromMe,
      type: sanitizeWhatsappMessageType(c.type, {
      mime: c.mediaMime,
      filename: c.mediaFilename,
    }),
      body: c.body ?? (typeof payload.body === 'string' ? payload.body : null),
      caption: c.caption,
      mediaUrl: c.mediaUrl ?? (typeof payload.media?.url === 'string' ? payload.media.url : null),
      mediaMime: c.mediaMime,
      mediaFilename: c.mediaFilename,
      mediaSize: c.mediaSize,
      ack: 0,
      timestamp: ts,
      pushName: extractContactPushName(payload, mePushName),
      isGroup,
      raw: payload,
    };
  }

  // Formato WEBJS plano (legacy)
  const chatId = (() => {
    if (payload.fromMe && payload.to) return payload.to;
    if (payload.from) return payload.from;
    if (typeof payload.id === 'string') {
      const fromSerialized = chatIdFromSerializedId(payload.id);
      if (fromSerialized) return fromSerialized;
    }
    return key?.remoteJid ?? null;
  })();
  if (!chatId) return null;
  const ts = isoFromUnixSecondsLive(payload.timestamp ?? null);
  const inferred = inferWhatsappMediaFromRaw(payload);
  const bodyOrPreview = (() => {
    const b = payload.body?.trim();
    if (b && b !== 'undefined' && b !== 'null') return b;
    const c = payload.caption?.trim();
    if (c && c !== 'undefined' && c !== 'null') return c;
    return inferred?.caption ?? inferred?.body ?? null;
  })();
  const isGroupChat = /@g\.us$/i.test(chatId);
  const fromJid = resolveIncomingFromJid(
    chatId,
    !!payload.fromMe,
    payload.from ?? null,
    payload,
    key,
  );
  const declaredType = payload.type ?? 'text';
  const mimeHint =
    payload.media?.mimetype ??
    (typeof (payload as Record<string, unknown>).mimetype === 'string'
      ? ((payload as Record<string, unknown>).mimetype as string)
      : null) ??
    inferred?.mediaMime ??
    null;
  return {
    id: resolveWahaMessageId(payload),
    chatId,
    fromJid,
    fromMe: !!payload.fromMe,
    type: sanitizeWhatsappMessageType(
      isWeakWhatsappMessageType(declaredType) && inferred ? inferred.type : declaredType,
      {
        mime: mimeHint,
        filename: payload.media?.filename ?? inferred?.mediaFilename ?? null,
      },
    ),
    body: bodyOrPreview,
    caption: payload.caption ?? inferred?.caption ?? null,
    mediaUrl: payload.media?.url ?? inferred?.mediaUrl ?? null,
    mediaMime: mimeHint,
    mediaFilename: payload.media?.filename ?? inferred?.mediaFilename ?? null,
    mediaSize: payload.media?.size ?? inferred?.mediaSize ?? null,
    ack: Number(payload.ack ?? 0) || 0,
    timestamp: ts,
    pushName: extractContactPushName(payload, mePushName),
    isGroup: isGroupChat,
    raw: payload,
  };
}

function groupPreviewSender(m: NormalizedMessage): string | null {
  if (m.fromMe) return null;
  const phone =
    m.fromJid && isPhoneJid(m.fromJid)
      ? `+${m.fromJid.split('@')[0]?.replace(/[^0-9]/g, '')}`
      : null;
  if (m.pushName && phone) return `${m.pushName} (${phone})`;
  if (m.pushName) return m.pushName;
  if (phone) return phone;
  return null;
}

function previewFor(m: NormalizedMessage): string | null {
  const body = m.body?.trim();
  if (body && body !== 'undefined' && body !== 'null') return body;
  const caption = m.caption?.trim();
  if (caption && caption !== 'undefined' && caption !== 'null') return caption;
  const t = sanitizeWhatsappMessageType(m.type, {
    mime: m.mediaMime,
    filename: m.mediaFilename,
  });
  if (t === 'text' || t === 'chat') return null;
  return whatsappMediaPreviewLabel(t);
}

async function handleMessage(
  admin: SupabaseClient,
  companyId: string,
  payload: WahaMessagePayload,
  mePushName?: string | null,
  sourceProvider: 'waha' | 'openwa' | 'meta' = 'waha',
) {
  const m = normalizeMessage(payload, mePushName);
  if (!m) {
    console.warn('handleMessage: payload no parseable', JSON.stringify(payload).slice(0, 300));
    return;
  }
  if (isWhatsappSystemOrNotificationMessage(m)) return;

  const msgKey = extractMessageKey(payload);
  const chatId = await resolveChatIdForStorage(
    admin,
    companyId,
    m.chatId,
    msgKey,
    m.isGroup,
  );

  const messageRow = {
    company_id: companyId,
    chat_id: chatId,
    source_provider: sourceProvider,
    waha_message_id: m.id,
    from_jid: m.fromJid,
    from_me: m.fromMe,
    type: m.type,
    body: m.body,
    caption: m.caption,
    media_url: m.mediaUrl,
    media_mime_type: m.mediaMime,
    media_filename: m.mediaFilename,
    media_size: m.mediaSize,
    ack: m.ack,
    timestamp: m.timestamp,
    raw: m.raw,
  };

  // Waha envía a veces `message` y `message.any` seguidos; el segundo POST puede
  // traer el mismo id con menos campos y vaciar body si hacemos upsert ciego.
  let rowToWrite: typeof messageRow = messageRow;
  if (m.id) {
    const { data: existing } = await admin
      .from('whatsapp_messages')
      .select(
        'body, caption, type, media_url, media_mime_type, media_filename, media_size, from_jid, raw, timestamp',
      )
      .eq('company_id', companyId)
      .eq('waha_message_id', m.id)
      .maybeSingle();
    let existingRow = existing;
    if (!existingRow) {
      const suffix = wahaIdSuffix(m.id);
      if (suffix) {
        const { data: rows } = await admin
          .from('whatsapp_messages')
          .select(
            'body, caption, type, media_url, media_mime_type, media_filename, media_size, from_jid, raw, timestamp',
          )
          .eq('company_id', companyId)
          .eq('chat_id', chatId)
          .like('waha_message_id', `%_${suffix}`)
          .limit(1);
        existingRow = rows?.[0] ?? null;
      }
    }
    if (existingRow) {
      const keepBody =
        (!m.body || !String(m.body).trim()) && existingRow.body && String(existingRow.body).trim();
      const keepCap =
        (!m.caption || !String(m.caption).trim()) &&
        existingRow.caption &&
        String(existingRow.caption).trim();
      rowToWrite = {
        ...messageRow,
        from_jid: preferFromJid(existingRow.from_jid as string | null, m.fromJid),
        body: keepBody ? existingRow.body : m.body,
        caption: keepCap ? existingRow.caption : m.caption,
        type:
          m.type && m.type !== 'unknown' && m.type !== 'text'
            ? m.type
            : existingRow.type && existingRow.type !== 'unknown'
              ? existingRow.type
              : m.type,
        media_url: m.mediaUrl ?? existingRow.media_url,
        media_mime_type: m.mediaMime ?? existingRow.media_mime_type,
        media_filename: m.mediaFilename ?? existingRow.media_filename,
        media_size: m.mediaSize ?? existingRow.media_size,
        // No pisar el desempate intra-segundo ya persistido.
        timestamp: (existingRow.timestamp as string | null) ?? m.timestamp,
        raw: keepBody || keepCap ? (existingRow.raw as unknown) ?? m.raw : m.raw,
      };
    }
  }

  if (m.fromMe) {
    await deleteGhostOutgoingMessages(admin, companyId, chatId, m.body);
  }

  if (m.id) {
    const { error } = await admin
      .from('whatsapp_messages')
      .upsert(rowToWrite, {
        onConflict: 'company_id,waha_message_id',
        ignoreDuplicates: false,
      });
    if (error) {
      console.error('handleMessage upsert failed:', error, 'row:', rowToWrite);
      const { error: insErr } = await admin
        .from('whatsapp_messages')
        .insert(rowToWrite);
      if (insErr) console.error('handleMessage insert fallback failed:', insErr);
    }
  } else {
    const { error } = await admin.from('whatsapp_messages').insert(messageRow);
    if (error) console.error('handleMessage insert failed:', error, 'row:', messageRow);
  }

  // Upsert del chat con preview + contador de no leídos
  const { data: existingChat } = await admin
    .from('whatsapp_chats')
    .select('id, unread_count, name')
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .maybeSingle();

  const basePreview = previewFor(m);
  const sender = groupPreviewSender(m);
  const preview =
    m.isGroup && !m.fromMe && sender
      ? `${sender}: ${basePreview ?? '…'}`
      : basePreview;
  const incomingUnread = !m.fromMe ? (existingChat?.unread_count ?? 0) + 1 : 0;
  const updates: Record<string, unknown> = {
    company_id: companyId,
    chat_id: chatId,
    is_group: m.isGroup,
    last_message_preview: preview,
    last_message_at: m.timestamp,
    last_message_from_me: m.fromMe,
  };
  if (!m.fromMe) updates.unread_count = incomingUnread || 1;
  const contactName = !m.fromMe && !m.isGroup
    ? extractContactPushName(payload, mePushName)
    : null;
  if (contactName) {
    const existingName = existingChat?.name?.trim() ?? '';
    const wrongOwnerName =
      !!mePushName &&
      existingName.toLowerCase() === mePushName.trim().toLowerCase();
    if (!existingName || wrongOwnerName) {
      updates.name = contactName;
    }
  }

  if (m.isGroup) {
    const groupName = extractGroupNameFromPayload(payload);
    const existingName = existingChat?.name?.trim() ?? '';
    const needsName =
      !existingName ||
      existingName.includes('@') ||
      /^\+?\d{10,}$/.test(existingName) ||
      existingName === 'Grupo';
    if (groupName && needsName) {
      updates.name = groupName;
    }
  }

  const { error: chatErr } = await admin
    .from('whatsapp_chats')
    .upsert(updates, { onConflict: 'company_id,chat_id', ignoreDuplicates: false });
  if (chatErr) console.error('handleMessage chat upsert failed:', chatErr);

  // Intentar vinculación automática a cliente/lead (solo si está sin vincular)
  try {
    await admin.rpc('whatsapp_auto_link_chat', {
      p_company_id: companyId,
      p_chat_id: chatId,
    });
  } catch {
    // No bloqueamos el webhook si la auto-vinculación falla
  }

  // Contactos nuevos entrantes (CTWA / WhatsApp Meta) → lead en Marketing
  if (!m.fromMe && !m.isGroup) {
    try {
      const { maybeAutoCreateMarketingLeadFromInbound } = await import(
        '../_shared/whatsappInboundMarketingLead.ts'
      );
      const autoLead = await maybeAutoCreateMarketingLeadFromInbound(
        admin,
        companyId,
        chatId,
        {
          messageRaw: payload,
          messageTimestamp: m.timestamp,
          messageBody: m.body ?? m.caption ?? null,
          chatDisplayName: contactName ?? existingChat?.name ?? null,
        },
      );
      if (autoLead.created) {
        console.log(
          'whatsapp inbound marketing lead created:',
          autoLead.leadId,
          autoLead.reason,
        );
      }
    } catch (leadErr) {
      console.error('whatsapp inbound marketing lead failed:', leadErr);
    }
  }

  if (!m.fromMe) {
    const { data: linkedChat } = await admin
      .from('whatsapp_chats')
      .select('marketing_lead_id')
      .eq('company_id', companyId)
      .eq('chat_id', chatId)
      .maybeSingle();
    try {
      await processAutomationReply(
        admin,
        companyId,
        chatId,
        m.body ?? m.caption,
        (linkedChat?.marketing_lead_id as string | null) ?? null,
      );
    } catch (autoErr) {
      console.error('marketing WhatsApp automation reply failed:', autoErr);
    }
  }
}

async function handleAck(
  admin: SupabaseClient,
  companyId: string,
  payload: WahaMessagePayload & { ack?: number },
) {
  const rawId = payload?.id ?? payload?.key?.id ?? null;
  if (!rawId) return;
  const ack = Number(payload.ack ?? 0) || 0;

  const { data: direct } = await admin
    .from('whatsapp_messages')
    .update({ ack })
    .eq('company_id', companyId)
    .eq('waha_message_id', rawId)
    .select('id');

  if (direct && direct.length > 0) return;

  // Waha a veces manda el id compuesto (false_...@lid_3EB0...) y en BD
  // guardamos solo el sufijo Baileys o viceversa.
  const suffix = rawId.includes('_') ? rawId.split('_').pop() : null;
  if (suffix) {
    await admin
      .from('whatsapp_messages')
      .update({ ack })
      .eq('company_id', companyId)
      .eq('waha_message_id', suffix);
  }
}

async function verifyOpenwaSignature(
  bodyText: string,
  secret: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return true;
  const expected = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === expected;
}

/** Evita bucles de restart cuando WAHA emite FAILED en ráfaga. */
const wahaFailedRestartAt = new Map<string, number>();
const WAHA_FAILED_RESTART_COOLDOWN_MS = 25_000;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function bytesToBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, Math.min(buf.length, i + 0x8000)));
  }
  return btoa(binary);
}

type WahaConn = { baseUrl: string; apiKey: string | null; sessionName: string };

async function wahaFetchQrDataUrl(conn: WahaConn): Promise<string | null> {
  const headers = new Headers();
  if (conn.apiKey) headers.set('X-Api-Key', conn.apiKey);
  const url =
    `${trimSlash(conn.baseUrl)}/api/${encodeURIComponent(conn.sessionName)}/auth/qr?format=image`;
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) {
    console.warn('whatsapp-webhook: fetch QR failed', resp.status, await resp.text().catch(() => ''));
    return null;
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.length < 200) return null;
  return `data:image/png;base64,${bytesToBase64(buf)}`;
}

/** Reinicia sesión FAILED (p. ej. QR agotado) para generar un QR nuevo. */
async function wahaRestartSession(conn: WahaConn): Promise<boolean> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (conn.apiKey) headers.set('X-Api-Key', conn.apiKey);
  const base = trimSlash(conn.baseUrl);
  const name = encodeURIComponent(conn.sessionName);
  const tryPost = async (path: string, body?: string) => {
    const r = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: body ?? '{}',
      signal: AbortSignal.timeout(30_000),
    });
    return r.ok || r.status === 201;
  };
  // Preferir /restart; si no existe, stop+start.
  if (await tryPost(`/api/sessions/${name}/restart`)) return true;
  await tryPost(`/api/sessions/${name}/stop`).catch(() => false);
  if (await tryPost(`/api/sessions/${name}/start`)) return true;
  return tryPost(`/api/sessions/start`, JSON.stringify({ name: conn.sessionName }));
}

async function handleStateChange(
  admin: SupabaseClient,
  companyId: string,
  envelope: WahaEnvelope,
  eventName: string,
  wahaConn?: WahaConn | null,
) {
  const payload = envelope.payload as
    | { status?: string; state?: string; message?: string; qr?: string | null }
    | undefined;
  const statusRaw = payload?.status ?? payload?.state;
  const status =
    typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim() : null;
  // engine.event es ruido interno de Baileys (creds/chats.update); no trae status
  // y no debe pisar last_status a null (deja la UI pensando que la sesión cayó).
  if (eventName === 'engine.event' && !status) {
    const patch: Record<string, unknown> = {
      last_status_at: new Date().toISOString(),
    };
    if (envelope.me?.id) patch.me_jid = envelope.me.id;
    if (envelope.me?.pushName) patch.me_pushname = envelope.me.pushName;
    if (Object.keys(patch).length > 1) {
      await admin.from('whatsapp_config').update(patch).eq('company_id', companyId);
    }
    return;
  }
  if (!status && eventName !== 'session.status' && eventName !== 'state.change') {
    return;
  }
  const statusUpper = (status ?? '').toUpperCase();
  let qrDataUrl: string | undefined;
  const qrRaw = payload?.qr;
  if (typeof qrRaw === 'string' && qrRaw.length > 0) {
    qrDataUrl = qrRaw.startsWith('data:') ? qrRaw : `data:image/png;base64,${qrRaw}`;
  }
  // WAHA re-emite SCAN_QR_CODE cada vez que rota el QR (60s + varios de 20s).
  // Hay que pedir la imagen actualizada; si no, la UI se queda con un QR caducado.
  if (statusUpper === 'SCAN_QR_CODE' && wahaConn && !qrDataUrl) {
    const fetched = await wahaFetchQrDataUrl(wahaConn).catch((e) => {
      console.warn('whatsapp-webhook: QR refresh error', e);
      return null;
    });
    if (fetched) qrDataUrl = fetched;
  }

  await admin
    .from('whatsapp_config')
    .update({
      ...(status ? { last_status: status } : {}),
      last_status_message: payload?.message ?? null,
      last_status_at: new Date().toISOString(),
      ...(qrDataUrl ? { qr_data_url: qrDataUrl, qr_updated_at: new Date().toISOString() } : {}),
      ...(envelope.me?.id ? { me_jid: envelope.me.id } : {}),
      ...(envelope.me?.pushName ? { me_pushname: envelope.me.pushName } : {}),
    })
    .eq('company_id', companyId);

  // Tras agotar los QR, WAHA pasa a FAILED. Reiniciar genera un ciclo nuevo de QR.
  if (statusUpper === 'FAILED' && wahaConn) {
    const last = wahaFailedRestartAt.get(companyId) ?? 0;
    const now = Date.now();
    if (now - last >= WAHA_FAILED_RESTART_COOLDOWN_MS) {
      wahaFailedRestartAt.set(companyId, now);
      console.log('whatsapp-webhook: auto-restart WAHA tras FAILED (QR agotado)', companyId);
      const ok = await wahaRestartSession(wahaConn).catch((e) => {
        console.warn('whatsapp-webhook: restart tras FAILED falló', e);
        return false;
      });
      if (ok) {
        await admin
          .from('whatsapp_config')
          .update({
            last_status: 'STARTING',
            last_status_message: 'QR caducado: regenerando…',
            last_status_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const url = new URL(req.url);
  const companyIdQuery = url.searchParams.get('company_id');

  // Meta Cloud API webhook verification (GET hub.challenge)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token') ?? '';
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (mode !== 'subscribe' || !token || !challenge) {
      return json({ error: 'Parámetros hub.* inválidos' }, 400);
    }
    if (!companyIdQuery) {
      return json({ error: 'Falta company_id en la URL del webhook Meta' }, 400);
    }
    const { data: cfgRow } = await admin
      .from('whatsapp_config')
      .select('webhook_secret, meta_verify_token, enabled, provider')
      .eq('company_id', companyIdQuery)
      .maybeSingle();
    if (!cfgRow) return json({ error: 'Empresa no encontrada' }, 404);
    const expected = (cfgRow.meta_verify_token || cfgRow.webhook_secret || '').trim();
    if (!expected || expected !== token) {
      return json({ error: 'Verify token inválido' }, 403);
    }
    return new Response(challenge, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const secret =
      req.headers.get('X-Webhook-Secret') ??
      req.headers.get('x-webhook-secret') ??
      url.searchParams.get('secret') ??
      url.searchParams.get('webhook_secret') ??
      '';

    const bodyText = await req.text();
    let rawBody: unknown = null;
    try {
      rawBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return json({ error: 'JSON inválido' }, 400);
    }

    const isMeta = isMetaCloudWebhookBody(rawBody);
    const hubSig = req.headers.get('X-Hub-Signature-256') ?? req.headers.get('x-hub-signature-256');

    let cfgRow: {
      company_id: string;
      webhook_secret: string | null;
      enabled: boolean;
      me_pushname: string | null;
      provider?: string | null;
      meta_linked?: boolean | null;
      meta_app_secret?: string | null;
      meta_verify_token?: string | null;
      base_url?: string | null;
      api_key?: string | null;
      waha_base_url?: string | null;
      waha_api_key?: string | null;
      session_name?: string | null;
      waha_session_name?: string | null;
    } | null = null;

    if (isMeta) {
      if (!companyIdQuery) {
        return json({ error: 'Webhook Meta requiere ?company_id= en la Callback URL' }, 400);
      }
      const { data } = await admin
        .from('whatsapp_config')
        .select(
          'company_id, webhook_secret, enabled, me_pushname, provider, meta_linked, meta_app_secret, meta_verify_token',
        )
        .eq('company_id', companyIdQuery)
        .maybeSingle();
      cfgRow = data ?? null;
      if (!cfgRow) return json({ error: 'Empresa no encontrada' }, 404);
      if (!cfgRow.enabled) return json({ ok: true, ignored: 'disabled' });
      const appSecret = (cfgRow.meta_app_secret || '').trim();
      if (appSecret) {
        const ok = await verifyMetaHubSignature(bodyText, appSecret, hubSig);
        if (!ok) return json({ error: 'Firma Meta inválida (X-Hub-Signature-256)' }, 401);
      } else if (secret) {
        const expected = (cfgRow.webhook_secret || '').trim();
        if (!expected || expected !== secret) {
          return json({ error: 'Secreto inválido' }, 401);
        }
      }
      // Sin app_secret ni secret: aceptar si motor Meta exclusivo o canal Meta vinculado (híbrido).
      else if ((cfgRow.provider ?? '') !== 'meta' && !cfgRow.meta_linked) {
        return json({ error: 'Configura meta_app_secret o webhook_secret' }, 401);
      }
    } else {
      if (!secret) {
        return json(
          {
            error:
              'Falta X-Webhook-Secret (header) o ?secret=... / ?webhook_secret=... (query)',
          },
          401,
        );
      }
      if (companyIdQuery) {
        const { data } = await admin
          .from('whatsapp_config')
          .select(
            'company_id, webhook_secret, enabled, me_pushname, provider, meta_linked, meta_app_secret, meta_verify_token, base_url, api_key, waha_base_url, waha_api_key, session_name, waha_session_name',
          )
          .eq('company_id', companyIdQuery)
          .maybeSingle();
        cfgRow = data ?? null;
      } else {
        const { data } = await admin
          .from('whatsapp_config')
          .select(
            'company_id, webhook_secret, enabled, me_pushname, provider, meta_app_secret, meta_verify_token, base_url, api_key, waha_base_url, waha_api_key, session_name, waha_session_name',
          )
          .eq('webhook_secret', secret)
          .limit(1);
        cfgRow = (data && data[0]) ?? null;
      }
      if (!cfgRow) return json({ error: 'Empresa no encontrada' }, 404);
      if (!cfgRow.webhook_secret || cfgRow.webhook_secret !== secret) {
        return json({ error: 'Secreto inválido' }, 401);
      }
      if (!cfgRow.enabled) return json({ ok: true, ignored: 'disabled' });

      const openwaSig = req.headers.get('X-OpenWA-Signature');
      if (openwaSig && !(await verifyOpenwaSignature(bodyText, cfgRow.webhook_secret, openwaSig))) {
        return json({ error: 'Firma OpenWA inválida (X-OpenWA-Signature)' }, 401);
      }
    }

    const companyId = cfgRow.company_id;

    if (isMeta) {
      const envelopes = metaCloudWebhookToWahaEnvelopes(rawBody);
      let handled = 0;
      for (const envelope of envelopes) {
        const event = (envelope.event ?? '').toLowerCase();
        if (event === 'message' || event === 'message.any') {
          await handleMessage(
            admin,
            companyId,
            (envelope.payload ?? {}) as WahaMessagePayload,
            cfgRow.me_pushname,
            'meta',
          );
          handled += 1;
        } else if (event === 'message.ack') {
          await handleAck(admin, companyId, (envelope.payload ?? {}) as WahaMessagePayload);
          handled += 1;
        }
      }
      return json({ ok: true, provider: 'meta', handled, events: envelopes.length });
    }

    let envelope: WahaEnvelope;
    const fromOpenwa = isOpenwaWebhookBody(rawBody);
    envelope = fromOpenwa
      ? openwaToWahaEnvelope(rawBody as OpenwaWebhookEnvelope)
      : (rawBody as WahaEnvelope);

    const event = (envelope.event ?? '').toLowerCase();

    if (event === 'test') {
      return json({ ok: true, test: true });
    }

    if (event === 'message' || event === 'message.any') {
      await handleMessage(
        admin,
        companyId,
        (envelope.payload ?? {}) as WahaMessagePayload,
        cfgRow.me_pushname,
        fromOpenwa ? 'openwa' : 'waha',
      );
    } else if (event === 'message.ack' || event === 'message.reaction') {
      await handleAck(admin, companyId, (envelope.payload ?? {}) as WahaMessagePayload);
    } else if (
      event === 'state.change' ||
      event === 'session.status' ||
      event === 'engine.event'
    ) {
      const provider = (cfgRow.provider ?? 'waha').toLowerCase();
      const baseUrl =
        (provider === 'waha'
          ? cfgRow.waha_base_url || cfgRow.base_url
          : cfgRow.base_url) || null;
      const apiKey =
        provider === 'waha'
          ? cfgRow.waha_api_key || cfgRow.api_key || null
          : cfgRow.api_key || null;
      const sessionName =
        (provider === 'waha'
          ? cfgRow.waha_session_name || cfgRow.session_name
          : cfgRow.session_name) || 'default';
      const wahaConn =
        provider !== 'meta' && provider !== 'openwa' && baseUrl
          ? { baseUrl, apiKey, sessionName }
          : null;
      await handleStateChange(admin, companyId, envelope, event, wahaConn);
    } else if (event === 'chat.archive') {
      const p = (envelope.payload ?? {}) as { chatId?: string; archived?: boolean };
      if (p.chatId) {
        await admin
          .from('whatsapp_chats')
          .update({ archived: !!p.archived })
          .eq('company_id', companyId)
          .eq('chat_id', p.chatId);
      }
    } else if (
      event === 'group.v2.update' ||
      event === 'group.update' ||
      event === 'group.v2.join' ||
      event === 'group.v2.participants'
    ) {
      const p = asRecord(envelope.payload);
      const group = asRecord(p?.group) ?? p;
      const groupId = String(group?.id ?? p?.id ?? p?.groupId ?? '');
      let subject: string | null = null;
      for (const key of ['subject', 'name', 'formattedTitle']) {
        const v = group?.[key] ?? p?.[key];
        if (typeof v === 'string' && v.trim() && !v.includes('@')) {
          subject = v.trim();
          break;
        }
      }
      if (groupId && isGroupJid(groupId)) {
        const patch: Record<string, unknown> = {
          is_group: true,
          updated_at: new Date().toISOString(),
        };
        if (subject) patch.name = subject;
        await admin
          .from('whatsapp_chats')
          .update(patch)
          .eq('company_id', companyId)
          .eq('chat_id', groupId);
      }
    } else if (event === 'group.v2.participants.join-request') {
      const p = asRecord(envelope.payload);
      const group = asRecord(p?.group);
      const groupId = String(group?.id ?? p?.groupId ?? '');
      const action = String(p?.action ?? 'created').toLowerCase();
      const requesterPn = String(p?.requesterPn ?? '');
      const requesterId = String(p?.requesterId ?? '');
      if (groupId && isGroupJid(groupId)) {
        const { data: existing } = await admin
          .from('whatsapp_chats')
          .select('id, unread_count, raw')
          .eq('company_id', companyId)
          .eq('chat_id', groupId)
          .maybeSingle();

        const rawPrev =
          existing?.raw && typeof existing.raw === 'object' && !Array.isArray(existing.raw)
            ? (existing.raw as Record<string, unknown>)
            : {};
        const label = requesterPn || requesterId || 'alguien';
        const preview =
          action === 'created'
            ? `Solicitud de entrada: ${label}`
            : action === 'rejected'
              ? `Solicitud rechazada: ${label}`
              : `Solicitud (${action}): ${label}`;

        const nextUnread =
          action === 'created'
            ? Math.max(0, Number(existing?.unread_count ?? 0)) + 1
            : Number(existing?.unread_count ?? 0);

        await admin.from('whatsapp_chats').upsert(
          {
            company_id: companyId,
            chat_id: groupId,
            is_group: true,
            last_message_preview: preview.slice(0, 200),
            last_message_at: new Date().toISOString(),
            last_message_from_me: false,
            unread_count: nextUnread,
            updated_at: new Date().toISOString(),
            raw: {
              ...rawPrev,
              suite_join_request: {
                action,
                requesterId: requesterId || null,
                requesterPn: requesterPn || null,
                requestMethod: p?.requestMethod ?? null,
                timestamp: p?.timestamp ?? null,
                received_at: new Date().toISOString(),
              },
            },
          },
          { onConflict: 'company_id,chat_id', ignoreDuplicates: false },
        );
      }
    }

    return json({ ok: true, provider: fromOpenwa ? 'openwa' : 'waha', event });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado';
    console.error('whatsapp-webhook error', e);
    return json({ error: msg }, 500);
  }
});
