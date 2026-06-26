import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';
import { isLidJid, resolveSupabasePublicStorageUrl } from '@/components/whatsapp/whatsappUtils';
import type { WhatsappMessageRow } from '@/hooks/useWhatsappMessages';

export type PrefetchedMedia = { mime: string; url: string };

type PrefetchResponse = {
  ok: boolean;
  chat_id?: string;
  items?: Array<{ message_id: string; mime: string; url: string }>;
};

const STORAGE_MEDIA_MARKER = '/storage/v1/object/public/whatsapp-media/';

function storePrefetchItem(
  map: Map<string, PrefetchedMedia>,
  messageId: string,
  item: PrefetchedMedia,
) {
  map.set(messageId, item);
  const suffix = messageId.split('_').pop();
  if (suffix && suffix.length >= 8) map.set(suffix, item);
}

function seedFromMessages(
  map: Map<string, PrefetchedMedia>,
  messages: WhatsappMessageRow[],
) {
  for (const m of messages) {
    const url = m.media_url;
    const id = m.waha_message_id;
    if (!id || !url?.includes(STORAGE_MEDIA_MARKER)) continue;
    storePrefetchItem(map, id, {
      mime: m.media_mime_type ?? 'image/jpeg',
      url: resolveSupabasePublicStorageUrl(url) ?? url,
    });
  }
}

/** Precarga media reciente → URLs en Storage (BD primero, OpenWA solo si falta). */
export function useWhatsappMediaPrefetch(
  chatId: string,
  relatedChatIds: string[] = [],
  messages: WhatsappMessageRow[] = [],
  options?: { enabled?: boolean },
) {
  const panelActive = useRoutePanelActive();
  const enabled = options?.enabled !== false && panelActive;
  const { companyId } = useWhatsappCompanyId();
  const storeRef = useRef(new Map<string, PrefetchedMedia>());
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  const relatedKey = relatedChatIds.join('|');
  const messagesSeedKey = useMemo(
    () =>
      messages
        .slice(-30)
        .map((m) => `${m.waha_message_id ?? ''}:${m.media_url ?? ''}`)
        .join('|'),
    [messages],
  );

  useEffect(() => {
    if (!enabled || !companyId || !chatId) {
      storeRef.current.clear();
      setReady(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    storeRef.current.clear();
    seedFromMessages(storeRef.current, messages);
    const seeded = storeRef.current.size;
    setReady(seeded >= 2);
    setLoading(seeded < 2);

    const lidFirst = [
      chatId,
      ...relatedChatIds.filter((id) => id !== chatId && isLidJid(id)),
      ...relatedChatIds.filter((id) => id !== chatId && !isLidJid(id)),
    ].filter((id, i, arr) => arr.indexOf(id) === i);

    const primary = lidFirst[0] ?? chatId;
    const alts = lidFirst.slice(1, 2);

    // Si la BD ya tiene URLs de Storage, no saturar el edge con OpenWA.
    if (seeded >= 4) {
      setLoading(false);
      setReady(true);
      setVersion((v) => v + 1);
      return;
    }

    (async () => {
      try {
        const res = await invokeWhatsappProxy<PrefetchResponse>({
          action: 'messages.prefetch_media',
          chat_id: primary,
          limit: 6,
          alt_chat_ids: alts,
          company_id: companyId,
        });
        if (cancelled) return;
        for (const item of res.items ?? []) {
          if (!item.url) continue;
          const publicUrl = resolveSupabasePublicStorageUrl(item.url) ?? item.url;
          storePrefetchItem(storeRef.current, item.message_id, {
            mime: item.mime,
            url: publicUrl,
          });
        }
      } catch {
        // Fallback: descarga individual en cola.
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
          setVersion((v) => v + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, companyId, relatedKey, messagesSeedKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPrefetchMedia = useCallback(
    (messageId: string | null | undefined): PrefetchedMedia | null => {
      if (!messageId) return null;
      void version;
      return (
        storeRef.current.get(messageId) ??
        storeRef.current.get(messageId.split('_').pop() ?? '') ??
        null
      );
    },
    [version],
  );

  return { loading, ready, getPrefetchMedia };
}
