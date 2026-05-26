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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function normalizeMessage(payload: WahaMessagePayload): NormalizedMessage | null {
  // ¿Es Baileys (NOWEB) o WEBJS plano?
  const isBaileys = !!(payload.key && payload.key.remoteJid);

  if (isBaileys) {
    const remoteJid = payload.key!.remoteJid!;
    const isGroup = /@g\.us$/i.test(remoteJid);
    const c = baileysContent(payload.message);
    const tsRaw = payload.messageTimestamp;
    const tsSecs = typeof tsRaw === 'string' ? Number(tsRaw) : Number(tsRaw ?? 0);
    const ts = tsSecs ? new Date(tsSecs * 1000).toISOString() : new Date().toISOString();
    // En grupos, "from" del remitente real está en payload.key.participant
    // (o participantAlt en lid). Para chats 1:1, el "from" es el propio remoteJid.
    const fromJid = !payload.key!.fromMe && isGroup
      ? (payload.key!.participantAlt ?? payload.key!.participant ?? null)
      : payload.key!.fromMe
        ? null
        : remoteJid;
    return {
      id: payload.key!.id ?? null,
      chatId: remoteJid,
      fromJid,
      fromMe: !!payload.key!.fromMe,
      type: c.type,
      body: c.body,
      caption: c.caption,
      mediaUrl: c.mediaUrl,
      mediaMime: c.mediaMime,
      mediaFilename: c.mediaFilename,
      mediaSize: c.mediaSize,
      ack: 0,
      timestamp: ts,
      pushName: payload.pushName ?? null,
      isGroup,
      raw: payload,
    };
  }

  // Formato WEBJS plano (legacy)
  const chatId = (() => {
    if (payload.fromMe && payload.to) return payload.to;
    if (payload.from) return payload.from;
    return null;
  })();
  if (!chatId) return null;
  const ts = payload.timestamp
    ? new Date(payload.timestamp * 1000).toISOString()
    : new Date().toISOString();
  const bodyOrPreview = (() => {
    if (payload.body && payload.body.trim()) return payload.body;
    if (payload.caption && payload.caption.trim()) return payload.caption;
    return null;
  })();
  return {
    id: payload.id ?? null,
    chatId,
    fromJid: payload.from ?? null,
    fromMe: !!payload.fromMe,
    type: (payload.type ?? 'text').toLowerCase(),
    body: bodyOrPreview,
    caption: payload.caption ?? null,
    mediaUrl: payload.media?.url ?? null,
    mediaMime: payload.media?.mimetype ?? null,
    mediaFilename: payload.media?.filename ?? null,
    mediaSize: payload.media?.size ?? null,
    ack: Number(payload.ack ?? 0) || 0,
    timestamp: ts,
    pushName: payload.pushName ?? payload._data?.pushName ?? payload._data?.notifyName ?? payload.notifyName ?? null,
    isGroup: /@g\.us$/i.test(chatId),
    raw: payload,
  };
}

function previewFor(m: NormalizedMessage): string | null {
  if (m.body && m.body.trim()) return m.body;
  if (m.caption && m.caption.trim()) return m.caption;
  const t = m.type.toLowerCase();
  if (!t || t === 'chat' || t === 'text') return null;
  return `[${t}]`;
}

async function handleMessage(
  admin: SupabaseClient,
  companyId: string,
  payload: WahaMessagePayload,
) {
  const m = normalizeMessage(payload);
  if (!m) {
    console.warn('handleMessage: payload no parseable', JSON.stringify(payload).slice(0, 300));
    return;
  }

  const messageRow = {
    company_id: companyId,
    chat_id: m.chatId,
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
        'body, caption, type, media_url, media_mime_type, media_filename, media_size, raw',
      )
      .eq('company_id', companyId)
      .eq('waha_message_id', m.id)
      .maybeSingle();
    if (existing) {
      const keepBody =
        (!m.body || !String(m.body).trim()) && existing.body && String(existing.body).trim();
      const keepCap =
        (!m.caption || !String(m.caption).trim()) &&
        existing.caption &&
        String(existing.caption).trim();
      rowToWrite = {
        ...messageRow,
        body: keepBody ? existing.body : m.body,
        caption: keepCap ? existing.caption : m.caption,
        type:
          m.type && m.type !== 'unknown' && m.type !== 'text'
            ? m.type
            : existing.type && existing.type !== 'unknown'
              ? existing.type
              : m.type,
        media_url: m.mediaUrl ?? existing.media_url,
        media_mime_type: m.mediaMime ?? existing.media_mime_type,
        media_filename: m.mediaFilename ?? existing.media_filename,
        media_size: m.mediaSize ?? existing.media_size,
        raw: keepBody || keepCap ? (existing.raw as unknown) ?? m.raw : m.raw,
      };
    }
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
    .eq('chat_id', m.chatId)
    .maybeSingle();

  const basePreview = previewFor(m);
  const preview =
    m.isGroup && !m.fromMe && m.pushName
      ? `${m.pushName}: ${basePreview ?? '…'}`
      : basePreview;
  const incomingUnread = !m.fromMe ? (existingChat?.unread_count ?? 0) + 1 : 0;
  const updates: Record<string, unknown> = {
    company_id: companyId,
    chat_id: m.chatId,
    is_group: m.isGroup,
    last_message_preview: preview,
    last_message_at: m.timestamp,
    last_message_from_me: m.fromMe,
  };
  if (!m.fromMe) updates.unread_count = incomingUnread || 1;
  // En grupos, `pushName` es el remitente, no el nombre del grupo: no machacar el título.
  if (!existingChat?.name && m.pushName && !m.isGroup) updates.name = m.pushName;

  const { error: chatErr } = await admin
    .from('whatsapp_chats')
    .upsert(updates, { onConflict: 'company_id,chat_id', ignoreDuplicates: false });
  if (chatErr) console.error('handleMessage chat upsert failed:', chatErr);

  // Intentar vinculación automática a cliente/lead (solo si está sin vincular)
  try {
    await admin.rpc('whatsapp_auto_link_chat', {
      p_company_id: companyId,
      p_chat_id: m.chatId,
    });
  } catch {
    // No bloqueamos el webhook si la auto-vinculación falla
  }
}

async function handleAck(
  admin: SupabaseClient,
  companyId: string,
  payload: WahaMessagePayload & { ack?: number },
) {
  const id = payload?.id ?? payload?.key?.id ?? null;
  if (!id) return;
  await admin
    .from('whatsapp_messages')
    .update({ ack: Number(payload.ack ?? 0) || 0 })
    .eq('company_id', companyId)
    .eq('waha_message_id', id);
}

async function handleStateChange(
  admin: SupabaseClient,
  companyId: string,
  envelope: WahaEnvelope,
) {
  const payload = envelope.payload as
    | { status?: string; state?: string; message?: string }
    | undefined;
  const status = payload?.status ?? payload?.state ?? null;
  await admin
    .from('whatsapp_config')
    .update({
      last_status: status,
      last_status_message: payload?.message ?? null,
      last_status_at: new Date().toISOString(),
      ...(envelope.me?.id ? { me_jid: envelope.me.id } : {}),
      ...(envelope.me?.pushName ? { me_pushname: envelope.me.pushName } : {}),
    })
    .eq('company_id', companyId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const companyIdQuery = url.searchParams.get('company_id');
    const secret =
      req.headers.get('X-Webhook-Secret') ??
      req.headers.get('x-webhook-secret') ??
      url.searchParams.get('secret') ??
      url.searchParams.get('webhook_secret') ??
      '';
    if (!secret) {
      return json(
        {
          error:
            'Falta X-Webhook-Secret (header) o ?secret=... / ?webhook_secret=... (query)',
        },
        401,
      );
    }

    let cfgRow: { company_id: string; webhook_secret: string | null; enabled: boolean } | null = null;
    if (companyIdQuery) {
      const { data } = await admin
        .from('whatsapp_config')
        .select('company_id, webhook_secret, enabled')
        .eq('company_id', companyIdQuery)
        .maybeSingle();
      cfgRow = data ?? null;
    } else {
      const { data } = await admin
        .from('whatsapp_config')
        .select('company_id, webhook_secret, enabled')
        .eq('webhook_secret', secret)
        .limit(1);
      cfgRow = (data && data[0]) ?? null;
    }
    if (!cfgRow) return json({ error: 'Empresa no encontrada' }, 404);
    if (!cfgRow.webhook_secret || cfgRow.webhook_secret !== secret) {
      return json({ error: 'Secreto inválido' }, 401);
    }
    if (!cfgRow.enabled) return json({ ok: true, ignored: 'disabled' });

    let envelope: WahaEnvelope;
    try {
      envelope = (await req.json()) as WahaEnvelope;
    } catch {
      return json({ error: 'Body JSON inválido' }, 400);
    }
    const event = (envelope.event ?? '').toLowerCase();
    const companyId = cfgRow.company_id;

    if (event === 'message' || event === 'message.any') {
      await handleMessage(admin, companyId, (envelope.payload ?? {}) as WahaMessagePayload);
    } else if (event === 'message.ack' || event === 'message.reaction') {
      await handleAck(admin, companyId, (envelope.payload ?? {}) as WahaMessagePayload);
    } else if (
      event === 'state.change' ||
      event === 'session.status' ||
      event === 'engine.event'
    ) {
      await handleStateChange(admin, companyId, envelope);
    } else if (event === 'chat.archive') {
      const p = (envelope.payload ?? {}) as { chatId?: string; archived?: boolean };
      if (p.chatId) {
        await admin
          .from('whatsapp_chats')
          .update({ archived: !!p.archived })
          .eq('company_id', companyId)
          .eq('chat_id', p.chatId);
      }
    }
    // Eventos desconocidos: 200 OK silencioso (Waha no reintenta).

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado';
    return json({ error: msg }, 500);
  }
});
