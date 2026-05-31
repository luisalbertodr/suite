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
  bubbleOut: 'bg-[#d9fdd3] dark:bg-emerald-900',
  bubbleIn: 'bg-white dark:bg-zinc-800',
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

  const unwrap = (m: Record<string, unknown>, depth: number): Record<string, unknown> => {
    if (depth > 8) return m;
    for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage', 'editedMessage'] as const) {
      const w = m[key];
      if (w && typeof w === 'object') {
        const inner = (w as Record<string, unknown>).message;
        if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
      }
    }
    return m;
  };

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

export function mediaKindFromMime(mime: string | null | undefined):
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document' {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/ogg') || m.includes('opus')) return 'voice';
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
};

export function messagePreviewText(m: MessagePreviewSource): string {
  const type = (m.type ?? 'text').toLowerCase();
  if (type === 'text' || type === 'chat') {
    return m.body?.trim() || extractBodyFromWahaMessageRaw(m.raw) || 'Mensaje';
  }
  if (type === 'image') return m.caption?.trim() || '📷 Imagen';
  if (type === 'video') return m.caption?.trim() || '🎬 Vídeo';
  if (type === 'audio' || type === 'voice' || type === 'ptt') return '🎤 Audio';
  if (type === 'sticker') return '🎭 Sticker';
  if (type === 'document') return m.media_filename?.trim() || '📎 Documento';
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
