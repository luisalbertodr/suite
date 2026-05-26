// Helpers compartidos por los componentes de WhatsApp.

export function jidToDisplay(jid: string | null | undefined): string {
  if (!jid) return '';
  const at = jid.indexOf('@');
  const local = at >= 0 ? jid.slice(0, at) : jid;
  if (!local) return jid;
  // Si es solo dígitos, formatealo como +<number>
  if (/^\d+$/.test(local)) return `+${local}`;
  return local;
}

export function isGroupJid(jid: string | null | undefined): boolean {
  return !!jid && /@g\.us$/i.test(jid);
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
/** URL HTTP de sticker/imagen en el payload Baileys (si Waha la expone). */
export function extractMediaUrlFromWahaMessageRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const msg = root.message;
  if (!msg || typeof msg !== 'object') return null;
  const unwrap = (m: Record<string, unknown>, depth: number): Record<string, unknown> => {
    if (depth > 8) return m;
    for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2'] as const) {
      const w = m[key];
      if (w && typeof w === 'object') {
        const inner = (w as Record<string, unknown>).message;
        if (inner && typeof inner === 'object') return unwrap(inner as Record<string, unknown>, depth + 1);
      }
    }
    return m;
  };
  const u = unwrap(msg as Record<string, unknown>, 0);
  const sm = u.stickerMessage;
  if (sm && typeof sm === 'object') {
    const url = (sm as Record<string, unknown>).url;
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
  }
  return null;
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
