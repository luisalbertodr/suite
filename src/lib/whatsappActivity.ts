export function isWhatsappRouteActive(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/whatsapp');
}

const recentKeys = new Map<string, number>();

/** Evita toasts/notificaciones duplicadas (p. ej. StrictMode o doble webhook). */
export function shouldNotifyIncomingMessage(key: string): boolean {
  const now = Date.now();
  const prev = recentKeys.get(key);
  if (prev != null && now - prev < 5000) return false;
  recentKeys.set(key, now);
  if (recentKeys.size > 200) {
    for (const [id, ts] of recentKeys) {
      if (now - ts > 5000) recentKeys.delete(id);
    }
  }
  return true;
}

export function incomingMessageNotifyKey(row: {
  id: string;
  waha_message_id?: string | null;
  chat_id: string;
  body?: string | null;
  timestamp?: string;
}): string {
  if (row.waha_message_id) return `wa:${row.waha_message_id}`;
  return `row:${row.id}:${row.chat_id}:${row.body ?? ''}:${row.timestamp ?? ''}`;
}
