// Helpers compartidos por los componentes de WhatsApp.

/** Paleta y clases Tailwind alineadas con WhatsApp Web. */
export const waTheme = {
  appBg: 'bg-[#eae6df]',
  sidebarBg: 'bg-white dark:bg-zinc-950',
  headerBg: 'bg-[#f0f2f5] dark:bg-zinc-900',
  border: 'border-[#e9edef] dark:border-zinc-800',
  textMuted: 'text-[#667781] dark:text-zinc-400',
  textIcon: 'text-[#54656f] dark:text-zinc-400',
  chatBg: 'bg-[#efeae2] dark:bg-zinc-900',
  chatActive: 'bg-[#f0f2f5] dark:bg-zinc-800',
  chatHover: 'hover:bg-[#f5f6f6] dark:hover:bg-zinc-900/80',
  bubbleOut: 'wa-bubble-out',
  bubbleIn: 'wa-bubble-in',
  searchBg: 'bg-[#f0f2f5] dark:bg-zinc-900',
  inputBg: 'bg-white dark:bg-zinc-800',
} as const;

export const WA_CHAT_WALLPAPER =
  "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')";

export interface MetaLeadInfo {
  name: string;
  campaign: string | null;
  formName: string | null;
  source: string | null;
  externalCreatedAt: string | null;
  stripeDepositPaidAt: string | null;
  metaFormId?: string | null;
  hasCampaignAudio?: boolean;
  campaignAudioFilename?: string | null;
}

export function isMetaMarketingLead(meta: MetaLeadInfo | null | undefined): boolean {
  if (!meta) return false;
  const s = (meta.source ?? '').trim().toLowerCase();
  if (s === 'meta' || s === 'facebook' || s === 'instagram') return true;
  return !!(meta.campaign?.trim() || meta.formName?.trim());
}

export function formatMetaLeadLabel(meta: MetaLeadInfo): string {
  const label = meta.campaign?.trim() || meta.formName?.trim();
  if (label) return `Lead Meta · ${label}`;
  return 'Lead Meta';
}

export function isRecentMetaLead(
  externalCreatedAt: string | null | undefined,
): boolean {
  if (!externalCreatedAt) return false;
  const d = new Date(externalCreatedAt);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= 48 * 60 * 60 * 1000;
}

export function jidToDisplay(jid: string | null | undefined): string {
  if (!jid) return '';
  if (isLidJid(jid)) return '';
  const at = jid.indexOf('@');
  const local = at >= 0 ? jid.slice(0, at) : jid;
  if (!local) return jid;
  // Si es solo dígitos, formatealo como +<number>
  if (/^\d+$/.test(local)) return `+${local}`;
  return local;
}

export function isPhoneJid(jid: string | null | undefined): boolean {
  return !!jid && /@(c\.us|s\.whatsapp\.net)$/i.test(jid);
}

export function isLidJid(jid: string | null | undefined): boolean {
  return !!jid && /@lid$/i.test(jid);
}

export function isGroupJid(jid: string | null | undefined): boolean {
  return !!jid && /@g\.us$/i.test(jid);
}

/** Chats de sistema de WhatsApp (estados, newsletters…) — no son conversaciones 1:1. */
export function isSystemChatJid(jid: string | null | undefined): boolean {
  if (!jid) return false;
  const j = jid.toLowerCase();
  if (j === 'status@broadcast') return true;
  if (j.endsWith('@broadcast')) return true;
  if (j.endsWith('@newsletter')) return true;
  return false;
}

/** Prefiere JID con teléfono real (@c.us / @s.whatsapp.net) frente a @lid o @g.us. */
export function pickBestSenderJid(
  ...candidates: (string | null | undefined)[]
): string | null {
  const list = candidates.filter(
    (c): c is string => typeof c === 'string' && c.trim().length > 0,
  );
  const phone = list.find(isPhoneJid);
  if (phone) return phone;
  const nonGroupNonLid = list.find((j) => !isGroupJid(j) && !isLidJid(j));
  if (nonGroupNonLid) return nonGroupNonLid;
  const nonGroup = list.find((j) => !isGroupJid(j));
  return nonGroup ?? list[0] ?? null;
}

export function extractPushNameFromRaw(raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;
  const data = r._data as Record<string, unknown> | undefined;
  const topKey = r.key as Record<string, unknown> | undefined;
  const nestedKey = data?.key as Record<string, unknown> | undefined;
  // Waha NOWEB: pushName/notifyName del remitente (incl. grupos) suele estar en _data.
  for (const v of [
    data?.pushName,
    data?.notifyName,
    nestedKey?.pushName,
    nestedKey?.notifyName,
    topKey?.pushName,
    topKey?.notifyName,
    r.pushName,
    r.notifyName,
    r.author,
    data?.author,
  ]) {
    if (typeof v === 'string' && v.trim() && !v.includes('@')) return v.trim();
  }
  return null;
}

function looksLikeJid(value: string): boolean {
  return value.includes('@') || /^\+\d{10,}$/.test(value);
}

/** Nombre usable en UI (no JID, no teléfono crudo, no placeholder genérico). */
export function isGoodChatDisplayName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name.trim();
  if (looksLikeJid(n)) return false;
  if (n === 'Grupo') return false;
  return true;
}

/** True si el chat de grupo ya tiene nombre resoluble (BD o raw de WAHA). */
export function hasResolvedGroupName(
  name: string | null | undefined,
  chatRaw?: unknown,
): boolean {
  if (isGoodChatDisplayName(name)) return true;
  return !!extractGroupNameFromChatRaw(chatRaw);
}

/** Nombre del grupo desde el raw del chat (subject / formattedTitle de Baileys). */
export function extractGroupNameFromChatRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  for (const key of ['subject', 'name', 'formattedTitle']) {
    const v = r[key];
    if (typeof v === 'string' && v.trim() && !looksLikeJid(v.trim())) return v.trim();
  }
  for (const nestedKey of ['_chat', 'groupMetadata', 'chat']) {
    const nested = r[nestedKey];
    if (!nested || typeof nested !== 'object') continue;
    const n = nested as Record<string, unknown>;
    for (const key of ['subject', 'name', 'formattedTitle']) {
      const v = n[key];
      if (typeof v === 'string' && v.trim() && !looksLikeJid(v.trim())) return v.trim();
    }
  }
  return null;
}

export function formatPhoneDigits(digits: string | null | undefined): string {
  if (!digits) return '';
  const d = digits.replace(/\D/g, '');
  if (d.length < 6) return '';
  return `+${d}`;
}

/** Teléfono legible para un chat (incl. @lid vía chats relacionados o mensajes). */
export function resolvePhoneLabelForChat(
  chatId: string,
  options?: {
    relatedChatIds?: string[];
    messageFromJids?: (string | null | undefined)[];
    customerPhone?: string | null;
  },
): string {
  if (isGroupJid(chatId)) return '';
  const direct = jidToDisplay(chatId);
  if (direct) return direct;

  for (const id of options?.relatedChatIds ?? []) {
    const p = jidToDisplay(id);
    if (p) return p;
  }

  for (const jid of options?.messageFromJids ?? []) {
    const resolved = jid
      ? resolveGroupSenderJidFromRaw(null, jid) ?? jid
      : null;
    const p = jidToDisplay(resolved);
    if (p) return p;
  }

  if (options?.customerPhone) {
    const formatted = formatPhoneDigits(options.customerPhone);
    if (formatted) return formatted;
  }

  return '';
}

/** Directorio jid → etiqueta para mostrar remitentes en grupos. */
export function buildGroupSenderDirectory(
  messages: Array<{
    from_jid?: string | null;
    raw?: unknown;
    from_me?: boolean;
  }>,
): Record<string, string> {
  const acc = new Map<string, { name?: string; phone?: string }>();

  for (const m of messages) {
    if (m.from_me) continue;
    const jid =
      resolveGroupSenderJidFromRaw(m.raw, m.from_jid) ?? m.from_jid ?? null;
    if (!jid || isGroupJid(jid)) continue;

    const pushName = extractPushNameFromRaw(m.raw);
    const phone = isPhoneJid(jid) ? jidToDisplay(jid) : undefined;
    const prev = acc.get(jid) ?? {};
    if (pushName && !prev.name) prev.name = pushName;
    if (phone && !prev.phone) prev.phone = phone;
    acc.set(jid, prev);

    if (isLidJid(jid)) {
      const short = jid.split('@')[0] ?? '';
      if (short) {
        const prevShort = acc.get(short) ?? {};
        if (pushName && !prevShort.name) prevShort.name = pushName;
        acc.set(short, prevShort);
      }
    }
  }

  const out: Record<string, string> = {};
  for (const [jid, info] of acc) {
    const label = formatGroupSenderLabel(
      isLidJid(jid) ? `${jid.split('@')[0]}@lid` : jid,
      info.name,
    );
    out[jid] = label ?? info.name ?? info.phone ?? 'Participante';
  }
  return out;
}

export function lookupGroupSenderLabel(
  directory: Record<string, string>,
  fromJid: string | null | undefined,
  raw: unknown,
): string | null {
  const jid = resolveGroupSenderJidFromRaw(raw, fromJid) ?? fromJid;
  if (!jid) return null;
  if (directory[jid]) return directory[jid];
  if (isLidJid(jid)) {
    const short = jid.split('@')[0] ?? '';
    if (short && directory[short]) return directory[short];
  }
  return null;
}

/** Extrae el remitente real en mensajes de grupo (participant / participantAlt). */
export function resolveGroupSenderJidFromRaw(
  raw: unknown,
  fromJid: string | null | undefined,
): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  const topKey = r?.key as Record<string, unknown> | undefined;
  const data = r?._data as Record<string, unknown> | undefined;
  const nestedKey = data?.key as Record<string, unknown> | undefined;
  return pickBestSenderJid(
    nestedKey?.participantAlt as string,
    nestedKey?.participant as string,
    topKey?.participantAlt as string,
    topKey?.participant as string,
    data?.author as string,
    r?.author as string,
    fromJid && isPhoneJid(fromJid) ? fromJid : null,
    fromJid && !isGroupJid(fromJid) ? fromJid : null,
  );
}

/** Etiqueta legible para el remitente en burbujas de grupo. */
export function formatGroupSenderLabel(
  fromJid: string | null | undefined,
  pushName: string | null | undefined,
): string | null {
  const name = pushName?.trim() || null;
  const phone = fromJid && isPhoneJid(fromJid) ? jidToDisplay(fromJid) : null;
  if (name && phone) return `${name} · ${phone}`;
  if (name) return name;
  if (phone) return phone;
  if (fromJid && isLidJid(fromJid)) {
    const suffix = fromJid.split('@')[0]?.slice(-4);
    return suffix ? `Contacto ···${suffix}` : 'Contacto';
  }
  return fromJid ? jidToDisplay(fromJid) || fromJid : null;
}

export function extractPhoneDigitsFromJid(jid: string | null | undefined): string | null {
  if (!jid || isLidJid(jid) || isGroupJid(jid)) return null;
  const local = jid.split('@')[0] ?? '';
  const digits = local.replace(/[^0-9]/g, '');
  return digits.length >= 6 ? digits : null;
}

function phoneDigitsLast9(digits: string): string | null {
  const d = digits.replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

/** Chat del teléfono de prueba WA (modo prueba activo). */
export function isWhatsappTestChatId(
  chatId: string,
  settings: { test_mode_enabled: boolean; test_phone: string } | null | undefined,
): boolean {
  if (!settings?.test_mode_enabled) return false;
  const testN9 = phoneDigitsLast9(settings.test_phone || '667435503');
  const chatN9 = phoneDigitsLast9(extractPhoneDigitsFromJid(chatId) ?? '');
  return !!(testN9 && chatN9 && testN9 === chatN9);
}

/** Ruta interna a la ficha de un cliente en Suite. */
export function customerProfilePath(customerId: string, tab = 'ficha'): string {
  const params = new URLSearchParams({ customer: customerId, tab });
  return `/clientes?${params.toString()}`;
}

/** True si dos JIDs apuntan al mismo contacto (mismo número de teléfono). */
export function jidsSameContact(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const da = extractPhoneDigitsFromJid(a);
  const db = extractPhoneDigitsFromJid(b);
  return !!(da && db && da === db);
}

export function displayNameForChat(
  chatId: string,
  name: string | null | undefined,
  fallback?: string | null,
  chatRaw?: unknown,
): string {
  const isGroup = isGroupJid(chatId);
  const fromRaw = isGroup ? extractGroupNameFromChatRaw(chatRaw) : null;
  const goodName = isGoodChatDisplayName(name) ? name!.trim() : null;
  const n = fromRaw || goodName || fallback?.trim();
  if (n && !looksLikeJid(n)) return n;
  if (isGroup) return 'Grupo';
  if (isLidJid(chatId)) {
    const suffix = chatId.split('@')[0]?.slice(-4);
    return suffix ? `Contacto ···${suffix}` : 'Contacto';
  }
  const phone = jidToDisplay(chatId);
  return phone || chatId;
}

export function formatChatListTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'ayer';
  const diff = (now.getTime() - date.getTime()) / 86_400_000;
  if (diff < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateHeader(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Ayer';
  }
  return date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year:
      date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function dayKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Agrupa mensajes por día calendario (ordenados antes para no duplicar cabeceras). */
export function groupMessagesByDay<T extends { timestamp: string }>(
  messages: T[],
): Array<{ day: string; iso: string; messages: T[] }> {
  const sorted = [...messages].sort((a, b) => {
    const ta = Date.parse(a.timestamp);
    const tb = Date.parse(b.timestamp);
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  });
  const out: Array<{ day: string; iso: string; messages: T[] }> = [];
  for (const m of sorted) {
    const k = dayKey(m.timestamp);
    const last = out[out.length - 1];
    if (last && last.day === k) {
      last.messages.push(m);
    } else {
      out.push({ day: k, iso: m.timestamp, messages: [m] });
    }
  }
  return out;
}

/** IDs de mensajes entrantes no leídos (según contador del chat al abrirlo). */
export function unreadMessageIdsFromCount<T extends { id: string; from_me: boolean | null }>(
  messages: T[],
  unreadCount: number,
): Set<string> {
  const ids = new Set<string>();
  if (unreadCount <= 0 || messages.length === 0) return ids;
  let remaining = unreadCount;
  for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
    const m = messages[i];
    if (m.from_me) continue;
    ids.add(m.id);
    remaining -= 1;
  }
  return ids;
}

export function firstUnreadMessageId<T extends { id: string; from_me: boolean | null }>(
  messages: T[],
  unreadCount: number,
): string | null {
  if (unreadCount <= 0 || messages.length === 0) return null;
  let remaining = unreadCount;
  let first: string | null = null;
  for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
    const m = messages[i];
    if (m.from_me) continue;
    first = m.id;
    remaining -= 1;
  }
  return first;
}

/** Lee texto del `raw` JSON (Baileys/NOWEB del webhook) si `body` quedó vacío. */
export function isExternalWhatsappCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes('whatsapp.net') || h.includes('fbcdn.net');
  } catch {
    return false;
  }
}

/** Reescribe URLs de Storage guardadas con host interno (kong:8000) → VITE_SUPABASE_URL. */
export function resolveSupabasePublicStorageUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (!url.includes('/storage/v1/object/public/')) return url;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    const h = u.hostname.toLowerCase();
    if (
      h === 'kong' ||
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h.startsWith('192.168.') ||
      h.startsWith('10.')
    ) {
      const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
      if (base) return `${base}${u.pathname}${u.search}`;
    }
  } catch {
    // mantener
  }
  return url;
}

const BAILEYS_WRAP_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'documentWithCaptionMessage',
  'editedMessage',
] as const;

function unwrapBaileysInnerMessage(
  m: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 8) return m;
  for (const key of BAILEYS_WRAP_KEYS) {
    const w = m[key];
    if (w && typeof w === 'object') {
      const inner = (w as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') {
        return unwrapBaileysInnerMessage(inner as Record<string, unknown>, depth + 1);
      }
    }
  }
  return m;
}

/** Detecta sticker en el JSON crudo (Baileys/Waha) aunque `type` en BD sea text/unknown. */
export function hasStickerInWahaMessageRaw(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const root = raw as Record<string, unknown>;
  const checkMsg = (msg: unknown): boolean => {
    if (!msg || typeof msg !== 'object') return false;
    const u = unwrapBaileysInnerMessage(msg as Record<string, unknown>);
    const sticker = u.stickerMessage;
    return sticker != null && typeof sticker === 'object';
  };
  if (checkMsg(root.message)) return true;
  const data = root._data as Record<string, unknown> | undefined;
  return data ? checkMsg(data.message) : false;
}

export type WhatsappMessageTypeSource = {
  type?: string | null;
  body?: string | null;
  media_mime_type?: string | null;
  raw?: unknown;
};

/** Tipo efectivo para UI (stickers mal tipados en sync antiguo o WAHA). */
export function resolveWhatsappMessageType(m: WhatsappMessageTypeSource): string {
  const rawType = (m.type ?? 'text').toLowerCase();
  if (rawType === 'undefined' || rawType === 'null' || rawType === 'unknown') {
    const mime = m.media_mime_type?.toLowerCase() ?? '';
    if (mime.includes('ogg') || mime.includes('opus')) return 'voice';
    if (mime.startsWith('audio/')) return 'audio';
    return 'text';
  }
  if (rawType === 'sticker' || rawType === 'stickermessage') return 'sticker';
  if (hasStickerInWahaMessageRaw(m.raw)) return 'sticker';
  if (m.body?.trim() === '[sticker]') return 'sticker';
  if (
    (rawType === 'image' || rawType === 'unknown') &&
    m.media_mime_type?.toLowerCase().includes('webp') &&
    hasStickerInWahaMessageRaw(m.raw)
  ) {
    return 'sticker';
  }
  return rawType;
}

/** Base64 embebido en raw (OpenWA history o webhook con media.data). */
export function extractEmbeddedMediaBase64(
  raw: unknown,
): { data: string; mime: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const media = root.media;
  if (!media || typeof media !== 'object') return null;
  const m = media as Record<string, unknown>;
  const data = m.data;
  if (typeof data !== 'string' || data.length < 32) return null;
  const mime =
    typeof m.mimetype === 'string' && m.mimetype.trim()
      ? m.mimetype
      : 'application/octet-stream';
  return { data, mime };
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const cleaned = b64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const bin = atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function resolveWhatsappMediaMessageId(
  message: { waha_message_id?: string | null; raw?: unknown },
): string | null {
  if (message.waha_message_id?.trim()) return message.waha_message_id.trim();
  if (!message.raw || typeof message.raw !== 'object') return null;
  const r = message.raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  if (id && typeof id === 'object') {
    const ser = (id as Record<string, unknown>)._serialized;
    if (typeof ser === 'string' && ser.trim()) return ser.trim();
  }
  return null;
}

/** Extrae chat JID del id serializado WhatsApp (p.ej. false_346...@c.us_ABC). */
export function chatIdFromSerializedMessageId(messageId: string | null | undefined): string | null {
  if (!messageId?.trim()) return null;
  const parts = messageId.split('_');
  if (parts.length >= 3 && parts[1]?.includes('@')) return parts[1];
  return null;
}

/** Chat id más fiable para pedir media a OpenWA (prioriza @lid del mensaje). */
export function resolveMediaDownloadChatId(
  message: { chat_id?: string; from_jid?: string | null; waha_message_id?: string | null; raw?: unknown },
  activeChatId: string,
  relatedChatIds: string[] = [],
): string {
  const msgId = resolveWhatsappMediaMessageId(message);
  const fromSerialized = chatIdFromSerializedMessageId(msgId);
  if (fromSerialized) return fromSerialized;
  if (message.from_jid?.includes('@') && (isLidJid(message.from_jid) || isPhoneJid(message.from_jid))) {
    return message.from_jid;
  }
  if (isLidJid(message.chat_id)) return message.chat_id!;
  if (isLidJid(activeChatId)) return activeChatId;
  for (const id of relatedChatIds) {
    if (isLidJid(id)) return id;
  }
  return message.chat_id ?? activeChatId;
}

/** URL HTTP de sticker/imagen en el payload Baileys/Waha (si está expuesta). */
export function extractMediaUrlFromWahaMessageRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;

  const topMedia = root.media;
  if (topMedia && typeof topMedia === 'object') {
    const url = (topMedia as Record<string, unknown>).url;
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'))) {
      return url;
    }
  }

  const unwrap = unwrapBaileysInnerMessage;

  const tryMsg = (msg: unknown): string | null => {
    if (!msg || typeof msg !== 'object') return null;
    const u = unwrap(msg as Record<string, unknown>, 0);
    for (const key of ['stickerMessage', 'imageMessage', 'videoMessage'] as const) {
      const node = u[key];
      if (node && typeof node === 'object') {
        const url = (node as Record<string, unknown>).url;
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'))) {
          return url;
        }
      }
    }
    return null;
  };

  return tryMsg(root.message) ?? tryMsg((root._data as Record<string, unknown> | undefined)?.message);
}

/** Hay URL embebida o en Storage para pedir media al proveedor (sin solo message id). */
export function hasWhatsappProviderMediaHint(message: {
  media_url?: string | null;
  raw?: unknown;
}): boolean {
  const stored = message.media_url?.includes('/storage/v1/object/public/whatsapp-media/');
  if (stored) return true;
  if (extractEmbeddedMediaBase64(message.raw)) return true;
  const rawUrl = extractMediaUrlFromWahaMessageRaw(message.raw);
  if (rawUrl && !isExternalWhatsappCdnUrl(rawUrl)) return true;
  const direct = message.media_url?.trim();
  if (direct && !isExternalWhatsappCdnUrl(direct)) return true;
  return false;
}

export function extractBodyFromWahaMessageRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  let msg: unknown = root.message;
  if (!msg || typeof msg !== 'object') return null;

  const unwrap = (m: Record<string, unknown>, depth: number): Record<string, unknown> => {
    if (depth > 8) return m;
    const ep = m.ephemeralMessage;
    if (ep && typeof ep === 'object') {
      const inner = (ep as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
    }
    const v1 = m.viewOnceMessage;
    if (v1 && typeof v1 === 'object') {
      const inner = (v1 as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
    }
    const v2 = m.viewOnceMessageV2;
    if (v2 && typeof v2 === 'object') {
      const inner = (v2 as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
    }
    const dwc = m.documentWithCaptionMessage;
    if (dwc && typeof dwc === 'object') {
      const inner = (dwc as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
    }
    const ed = m.editedMessage;
    if (ed && typeof ed === 'object') {
      const inner = (ed as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
    }
    return m;
  };

  const unwrapped = unwrap(msg as Record<string, unknown>, 0);
  if (typeof unwrapped.conversation === 'string') {
    const t = unwrapped.conversation.trim();
    if (t) return t;
  }
  const ext = unwrapped.extendedTextMessage;
  if (ext && typeof ext === 'object') {
    const t = (ext as Record<string, unknown>).text;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)),
    );
  }
  return btoa(binary);
}

function bytesContainOpusHead(bytes: Uint8Array): boolean {
  for (let i = 0; i <= bytes.length - 8; i++) {
    if (
      bytes[i] === 0x4f &&
      bytes[i + 1] === 0x70 &&
      bytes[i + 2] === 0x75 &&
      bytes[i + 3] === 0x73 &&
      bytes[i + 4] === 0x48 &&
      bytes[i + 5] === 0x65 &&
      bytes[i + 6] === 0x61 &&
      bytes[i + 7] === 0x64
    ) {
      return true;
    }
  }
  return false;
}

/** Archivo adjunto que debe enviarse como nota de voz (OGG/Opus), no como documento. */
export function isWhatsappOggAttachment(filename: string, mime?: string | null): boolean {
  const name = filename.toLowerCase();
  const type = (mime ?? '').toLowerCase();
  return (
    name.endsWith('.ogg') ||
    name.endsWith('.opus') ||
    type.includes('ogg') ||
    type.includes('opus')
  );
}

const OPUS_HEAD_SCAN_BYTES = 4096;

/** Valida OGG/Opus antes de enviar nota de voz por OpenWA. */
export async function assertWhatsappVoiceNoteFile(file: File): Promise<void> {
  if (!isWhatsappOggAttachment(file.name, file.type)) return;
  const head = new Uint8Array(
    await file.slice(0, OPUS_HEAD_SCAN_BYTES).arrayBuffer(),
  );
  if (!bytesContainOpusHead(head)) {
    throw new Error(
      'El archivo .ogg no es Opus (nota de voz de WhatsApp). Muchos .ogg usan Vorbis y se envían como adjunto. Reenvía una nota de voz desde WhatsApp o convierte el audio a OGG/Opus.',
    );
  }
}

const WHATSAPP_EXT_MIME: Record<string, string> = {
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  aac: 'audio/aac',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
};

/** MIME para envío WA cuando el navegador no rellena file.type (p. ej. .ogg). */
export function resolveWhatsappFileMime(filename: string, blobType?: string): string {
  const raw = (blobType ?? '').trim().toLowerCase();
  if (raw.includes('ogg') || raw.includes('opus')) return 'audio/ogg';
  if (raw === 'application/ogg') return 'audio/ogg';
  if (raw && raw !== 'application/octet-stream') return raw;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return WHATSAPP_EXT_MIME[ext] ?? 'application/octet-stream';
}

export function mediaKindFromMime(mime: string | null | undefined):
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document' {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/ogg') || m.includes('opus') || m === 'application/ogg') return 'voice';
  if (m.startsWith('audio/')) return 'audio';
  return 'document';
}

export function ackLabel(ack: number): string {
  switch (ack) {
    case -1:
      return 'Error';
    case 0:
      return 'Pendiente';
    case 1:
      return 'Enviado';
    case 2:
      return 'Entregado';
    case 3:
      return 'Leído';
    case 4:
      return 'Reproducido';
    default:
      return '';
  }
}

type MessagePreviewSource = {
  type?: string | null;
  body?: string | null;
  caption?: string | null;
  media_filename?: string | null;
  raw?: unknown;
  waha_message_id?: string | null;
  from_me?: boolean;
};

export function isMessageRevoked(m: { type?: string | null }): boolean {
  return (m.type ?? '').toLowerCase() === 'revoked';
}

export function revokedMessageLabel(fromMe: boolean): string {
  return fromMe ? 'Eliminaste este mensaje' : 'Este mensaje fue eliminado';
}

export function messagePreviewText(m: MessagePreviewSource): string {
  const type = resolveWhatsappMessageType(m);
  if (type === 'revoked') return revokedMessageLabel(!!m.from_me);
  if (type === 'text' || type === 'chat') {
    return m.body?.trim() || extractBodyFromWahaMessageRaw(m.raw) || 'Mensaje';
  }
  if (type === 'image') return m.caption?.trim() || '📷 Imagen';
  if (type === 'video') return m.caption?.trim() || '🎬 Vídeo';
  if (type === 'audio' || type === 'voice' || type === 'ptt') return '🎤 Audio';
  if (type === 'sticker') return '🎭 Sticker';
  if (type === 'document') return m.media_filename?.trim() || '📎 Documento';
  if (!type || type === 'undefined' || type === 'null') return '🎤 Audio';
  return `[${type}]`;
}

export function extractReplyToFromRaw(
  raw: unknown,
): { id?: string; body?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const replyTo = root.replyTo ?? root.quotedMsg;
  if (!replyTo || typeof replyTo !== 'object') return null;
  const rt = replyTo as Record<string, unknown>;
  const id =
    typeof rt.id === 'string'
      ? rt.id
      : rt.id && typeof rt.id === 'object'
        ? ((rt.id as Record<string, unknown>)._serialized as string | undefined) ??
          ((rt.id as Record<string, unknown>).id as string | undefined)
        : undefined;
  const body =
    typeof rt.body === 'string'
      ? rt.body
      : typeof rt.text === 'string'
        ? rt.text
        : undefined;
  return { id, body };
}

export function findMessageByWahaId<T extends { waha_message_id?: string | null }>(
  messages: T[],
  wahaId: string | null | undefined,
): T | undefined {
  if (!wahaId) return undefined;
  const exact = messages.find((m) => m.waha_message_id === wahaId);
  if (exact) return exact;
  const suffix = wahaId.includes('_') ? wahaId.split('_').pop() : wahaId;
  if (!suffix) return undefined;
  return messages.find((m) => {
    if (!m.waha_message_id) return false;
    if (m.waha_message_id === wahaId) return true;
    if (m.waha_message_id.endsWith(`_${suffix}`)) return true;
    return m.waha_message_id.split('_').pop() === suffix;
  });
}
