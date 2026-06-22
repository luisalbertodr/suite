import type { WhatsappProvider } from './whatsappProviderTypes.ts';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** True si el JSON `raw` guardado en BD corresponde a OpenWA (sync o webhook). */
export function isOpenwaStoredMessage(raw: unknown): boolean {
  const r = asRecord(raw);
  if (!r) return false;

  const idObj = asRecord(r.id);
  if (typeof idObj?._serialized === 'string' && idObj._serialized.trim()) return true;

  const key = asRecord(r.key);
  if (typeof key?.remoteJid === 'string' && key.remoteJid.trim()) return false;
  if (r._data !== undefined && r._data !== null) return false;
  if (r.message !== undefined && r.message !== null) return false;

  if (typeof r.waMessageId === 'string' && r.waMessageId.trim()) return true;
  if (r.direction === 'outgoing' || r.direction === 'incoming') return true;
  if (r.contact !== undefined && r.contact !== null) return true;

  if (
    typeof r.from === 'string' &&
    typeof r.fromMe === 'boolean' &&
    !r.author &&
    !r.quotedMsg &&
    (r.hasMedia !== undefined || r.notifyName || r.pushName)
  ) {
    return true;
  }

  return false;
}

export function messageSourceProvider(
  raw: unknown,
  explicit?: WhatsappProvider | null,
): WhatsappProvider | null {
  if (explicit === 'openwa' || explicit === 'waha') return explicit;
  return isOpenwaStoredMessage(raw) ? 'openwa' : 'waha';
}

/** Fragmento SQL (sin alias de tabla) para filtrar mensajes OpenWA en Postgres. */
export const OPENWA_MESSAGE_SQL_FILTER = `
  (
    source_provider = 'openwa'
    OR (
      source_provider IS NULL
      AND raw IS NOT NULL
      AND (
        (
          jsonb_typeof(raw->'id') = 'object'
          AND (raw->'id') ? '_serialized'
          AND COALESCE(raw->'id'->>'_serialized', '') <> ''
        )
        OR (
          NOT COALESCE((raw ? 'key') AND (raw->'key') ? 'remoteJid', false)
          AND NOT (raw ? '_data')
          AND NOT (raw ? 'message')
          AND (
            (raw ? 'waMessageId')
            OR raw->>'direction' IN ('outgoing', 'incoming')
            OR (raw ? 'contact')
            OR (
              (raw ? 'from')
              AND (raw ? 'fromMe')
              AND NOT (raw ? 'author')
              AND NOT (raw ? 'quotedMsg')
              AND (
                (raw ? 'hasMedia')
                OR (raw ? 'notifyName')
                OR (raw ? 'pushName')
              )
            )
          )
        )
      )
    )
  )
`;
