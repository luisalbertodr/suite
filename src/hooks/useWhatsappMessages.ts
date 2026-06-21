import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import { jidsSameContact } from '@/components/whatsapp/whatsappUtils';
import { patchChatsListAfterOutgoing } from '@/lib/whatsappQueryCache';
import type { Database } from '@/integrations/supabase/types';

export type WhatsappMessageRow = Database['public']['Tables']['whatsapp_messages']['Row'];

type SyncChatHistoryResponse = {
  ok: boolean;
  count: number;
  offset?: number;
  has_more?: boolean;
  synced?: boolean;
  already_synced?: boolean;
};

export type WhatsappSyncMode = 'auto' | 'full' | 'recent';

const MESSAGE_LIST_COLUMNS =
  'id,company_id,chat_id,waha_message_id,from_jid,from_me,type,body,caption,media_url,media_mime_type,media_filename,media_size,ack,quoted_message_id,timestamp,created_at,updated_at';

/** Mensajes recientes en BD (rápido). Historial completo se pagina aparte. */
const MESSAGE_PAGE_SIZE = 100;
/** Página ligera vía proxy (solo últimos mensajes del proveedor). */
const RECENT_PROVIDER_LIMIT = 35;
const RECENT_POLL_MS = 45_000;

async function syncChatHistoryChunk(
  companyId: string,
  chatId: string,
  offset: number,
  force = false,
): Promise<SyncChatHistoryResponse> {
  return invokeWhatsappProxy<SyncChatHistoryResponse>({
    action: 'messages.sync_chat_history',
    chat_id: chatId,
    offset,
    force,
    company_id: companyId,
  });
}

async function syncChatHistoryPaginated(
  companyId: string,
  chatIds: string[],
  force = false,
  onChunk?: () => void,
): Promise<number> {
  let total = 0;
  for (const id of chatIds) {
    let offset = 0;
    let pages = 0;
    while (pages < 40) {
      const res = await syncChatHistoryChunk(companyId, id, offset, force);
      total += res.count ?? 0;
      pages += 1;
      if (res.count > 0) onChunk?.();
      if (res.already_synced || !res.has_more || res.synced) break;
      offset = res.offset ?? offset + 200;
    }
  }
  return total;
}

/** Una sola petición al proveedor (messages.list) — mucho más rápida que sync_chat_history. */
async function syncRecentMessagesFromProvider(
  companyId: string,
  chatId: string,
): Promise<number> {
  const res = await invokeWhatsappProxy<{ ok: boolean; count: number }>({
    action: 'messages.list',
    chat_id: chatId,
    limit: RECENT_PROVIDER_LIMIT,
    company_id: companyId,
  });
  return res.count ?? 0;
}

function parseMessageTime(m: WhatsappMessageRow): number {
  const t = Date.parse(m.timestamp);
  return Number.isNaN(t) ? 0 : t;
}

function compareWhatsappMessages(a: WhatsappMessageRow, b: WhatsappMessageRow): number {
  const diff = parseMessageTime(a) - parseMessageTime(b);
  if (diff !== 0) return diff;
  if (a.from_me === b.from_me) {
    return (a.created_at ?? a.id).localeCompare(b.created_at ?? b.id);
  }
  return a.from_me ? -1 : 1;
}

function fixTimelineOrder(rows: WhatsappMessageRow[]): WhatsappMessageRow[] {
  if (rows.length < 2) return rows;
  const sorted = [...rows].sort(compareWhatsappMessages);
  for (let i = 0; i < sorted.length - 1; i++) {
    const incoming = sorted[i];
    const outgoing = sorted[i + 1];
    if (incoming.from_me || !outgoing.from_me) continue;
    const ti = parseMessageTime(incoming);
    const to = parseMessageTime(outgoing);
    if (ti >= to) {
      sorted[i + 1] = {
        ...outgoing,
        timestamp: new Date(ti + 1).toISOString(),
      };
    } else {
      sorted[i] = {
        ...incoming,
        timestamp: new Date(to + 1).toISOString(),
      };
    }
  }
  return sorted.sort(compareWhatsappMessages);
}

function dedupeWhatsappMessages(rows: WhatsappMessageRow[]): WhatsappMessageRow[] {
  const byKey = new Map<string, WhatsappMessageRow>();
  for (const m of rows) {
    const suffix = m.waha_message_id?.includes('_')
      ? m.waha_message_id.split('_').pop()
      : m.waha_message_id;
    const key = suffix
      ? `id:${suffix}`
      : `fb:${m.chat_id}:${m.from_me}:${m.body ?? ''}:${m.timestamp}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    if (!prev.waha_message_id && m.waha_message_id) byKey.set(key, m);
  }
  return fixTimelineOrder([...byKey.values()]);
}

function adjustIncomingBeforeAppend(
  list: WhatsappMessageRow[],
  incoming: WhatsappMessageRow,
): WhatsappMessageRow {
  if (incoming.from_me) return incoming;
  let lastOutgoingMs = 0;
  for (const m of list) {
    if (m.from_me || m.id.startsWith('pending-')) {
      lastOutgoingMs = Math.max(lastOutgoingMs, parseMessageTime(m));
    }
  }
  if (lastOutgoingMs === 0) return incoming;
  const incMs = parseMessageTime(incoming);
  if (incMs < lastOutgoingMs) {
    return { ...incoming, timestamp: new Date(lastOutgoingMs + 1).toISOString() };
  }
  return incoming;
}

export type SendMessageInput =
  | { chat_id: string; type: 'text'; text: string; reply_to_message_id?: string }
  | {
      chat_id: string;
      type: 'image' | 'video' | 'audio' | 'document' | 'voice';
      media_base64: string;
      mime_type: string;
      filename: string;
      caption?: string;
      reply_to_message_id?: string;
    };

function buildOptimisticMessage(
  companyId: string,
  input: SendMessageInput,
  tempId: string,
): WhatsappMessageRow {
  const now = new Date().toISOString();
  return {
    id: tempId,
    company_id: companyId,
    chat_id: input.chat_id,
    waha_message_id: null,
    from_jid: null,
    from_me: true,
    type: input.type,
    body: input.type === 'text' ? input.text : null,
    caption: input.type !== 'text' ? (input.caption ?? null) : null,
    media_url: null,
    media_mime_type: input.type !== 'text' ? input.mime_type : null,
    media_filename: input.type !== 'text' ? input.filename : null,
    media_size: null,
    ack: 0,
    quoted_message_id: input.reply_to_message_id ?? null,
    timestamp: now,
    created_at: now,
    updated_at: now,
  };
}

function messageBelongsToChat(row: WhatsappMessageRow, chatIds: string[]): boolean {
  return chatIds.some((id) => id === row.chat_id || jidsSameContact(id, row.chat_id));
}

function appendMessageToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
  row: WhatsappMessageRow,
) {
  queryClient.setQueryData<WhatsappMessageRow[]>(key, (prev) => {
    const list = prev ?? [];
    if (
      list.some(
        (m) =>
          m.id === row.id ||
          (m.waha_message_id && row.waha_message_id && m.waha_message_id === row.waha_message_id),
      )
    ) {
      return list;
    }
    const adjusted = adjustIncomingBeforeAppend(list, row);
    return dedupeWhatsappMessages([...list, adjusted]);
  });
}

function newestMessageMs(rows: WhatsappMessageRow[] | undefined): number {
  if (!rows?.length) return 0;
  return rows.reduce((max, m) => Math.max(max, parseMessageTime(m)), 0);
}

function shouldSkipRecentProviderSync(
  cached: WhatsappMessageRow[] | undefined,
  historySyncedAt: string | null,
  lastMessageAt: string | null | undefined,
): boolean {
  if (!cached?.length) return false;
  if (!historySyncedAt) return false;
  if (!lastMessageAt) return true;
  const lastChatMs = Date.parse(lastMessageAt);
  if (Number.isNaN(lastChatMs)) return false;
  return lastChatMs <= newestMessageMs(cached) + 3000;
}

export const useWhatsappMessages = (
  chatId: string | null,
  relatedChatIds: string[] = [],
  options?: { historySyncedAt?: string | null; lastMessageAt?: string | null },
) => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useWhatsappCompanyId();
  const historySyncedAt = options?.historySyncedAt ?? null;
  const lastMessageAt = options?.lastMessageAt ?? null;

  const chatIds = useMemo(() => {
    if (!chatId) return [];
    return Array.from(new Set([chatId, ...relatedChatIds]));
  }, [chatId, relatedChatIds]);

  const enabled = !!companyId && !companyLoading && chatIds.length > 0;
  const key = ['whatsapp-messages', companyId, chatIds.slice().sort().join('|')] as const;

  const messagesQuery = useQuery({
    queryKey: key,
    enabled,
    staleTime: 45_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async (): Promise<WhatsappMessageRow[]> => {
      if (!companyId || chatIds.length === 0) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(MESSAGE_LIST_COLUMNS)
        .eq('company_id', companyId)
        .in('chat_id', chatIds)
        .order('timestamp', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      if (error) throw error;
      const rows = (data ?? []) as WhatsappMessageRow[];
      return dedupeWhatsappMessages([...rows].reverse());
    },
  });

  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidate = (immediate = false) => {
    if (immediate) {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
      invalidateTimerRef.current = null;
      void queryClient.invalidateQueries({ queryKey: key });
      return;
    }
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      invalidateTimerRef.current = null;
      void queryClient.invalidateQueries({ queryKey: key });
    }, 250);
  };

  const channelIdRef = useRef<string>('');
  if (!channelIdRef.current) {
    channelIdRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`whatsapp_messages:${companyId}:${chatIds.join('|')}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as WhatsappMessageRow | null;
          if (row && messageBelongsToChat(row, chatIds)) {
            if (payload.eventType === 'INSERT') {
              appendMessageToCache(queryClient, key, row);
              return;
            }
            if (payload.eventType === 'UPDATE') {
              queryClient.setQueryData<WhatsappMessageRow[]>(key, (prev) =>
                (prev ?? []).map((m) => (m.id === row.id ? { ...m, ...row } : m)),
              );
              return;
            }
          }
          if (payload.eventType === 'DELETE') return;
          invalidate();
        },
      )
      .subscribe();
    return () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [companyId, chatIds.join('|'), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFromWaha = useMutation({
    mutationFn: async (mode: WhatsappSyncMode = 'auto') => {
      if (!chatId || chatIds.length === 0) throw new Error('Sin chat seleccionado');
      if (!companyId) throw new Error('Sin empresa activa');

      if (mode === 'recent') {
        const count = await syncRecentMessagesFromProvider(companyId, chatId);
        return { ok: true, count, mode: 'recent' as const };
      }

      const force = mode === 'full';
      const count = await syncChatHistoryPaginated(companyId, chatIds, force);
      return { ok: true, count, mode: force ? ('full' as const) : ('auto' as const) };
    },
    onSuccess: (res) => {
      if ((res.count ?? 0) > 0 || res.mode === 'full') {
        invalidate();
      }
    },
  });

  const openSyncKeyRef = useRef('');
  const forceRetryRef = useRef(false);
  useEffect(() => {
    if (!enabled || !chatId) return;
    const syncKey = chatIds.slice().sort().join('|');
    if (openSyncKeyRef.current === syncKey) return;
    openSyncKeyRef.current = syncKey;
    forceRetryRef.current = false;

    const cached = queryClient.getQueryData<WhatsappMessageRow[]>(key);
    const skipRecent = shouldSkipRecentProviderSync(cached, historySyncedAt, lastMessageAt);

    const runSync = () => {
      if (skipRecent) return;

      refreshFromWaha.mutate('recent', {
        onSuccess: (res) => {
          if ((res.count ?? 0) > 0) return;
          const latest = queryClient.getQueryData<WhatsappMessageRow[]>(key);
          if (latest && latest.length > 0) return;
          if (historySyncedAt) return;
          if (forceRetryRef.current) return;
          forceRetryRef.current = true;
          refreshFromWaha.mutate('auto', { onError: () => undefined });
        },
        onError: () => {
          const latest = queryClient.getQueryData<WhatsappMessageRow[]>(key);
          if (latest && latest.length > 0) return;
          if (historySyncedAt || forceRetryRef.current) return;
          forceRetryRef.current = true;
          refreshFromWaha.mutate('auto', { onError: () => undefined });
        },
      });
    };

    const delayMs = cached?.length ? 2800 : 800;
    const timer = window.setTimeout(runSync, delayMs);
    return () => window.clearTimeout(timer);
  }, [enabled, chatId, chatIds.join('|'), historySyncedAt, lastMessageAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (refreshFromWaha.isPending) return;
      const cached = queryClient.getQueryData<WhatsappMessageRow[]>(key);
      if (shouldSkipRecentProviderSync(cached, historySyncedAt, lastMessageAt)) return;
      refreshFromWaha.mutate('recent', { onError: () => undefined });
    };
    const timer = window.setInterval(tick, RECENT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, chatIds.join('|'), historySyncedAt, lastMessageAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{
        ok: boolean;
        waha_message_id?: string;
        chat_id?: string;
        chat_id_was_migrated?: boolean;
        message?: WhatsappMessageRow;
      }>({
        action: 'messages.send',
        ...input,
        company_id: companyId,
      });
    },
    onMutate: async (input) => {
      if (!companyId) return {};
      const tempId = `pending-${Date.now()}`;
      const optimistic = buildOptimisticMessage(companyId, input, tempId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<WhatsappMessageRow[]>(key);
      appendMessageToCache(queryClient, key, optimistic);
      return { prev, tempId };
    },
    onSuccess: (res, input, ctx) => {
      const confirmed = res.message as WhatsappMessageRow | undefined;
      const chatIdOut = res.chat_id ?? input.chat_id;
      if (confirmed) {
        queryClient.setQueryData<WhatsappMessageRow[]>(key, (prev) => {
          const optimistic = prev?.find((m) => m.id === ctx?.tempId);
          const withoutPending = (prev ?? []).filter((m) => m.id !== ctx?.tempId);
          let merged = confirmed;
          if (optimistic) {
            const optMs = parseMessageTime(optimistic);
            const confMs = parseMessageTime(confirmed);
            if (optMs > confMs) {
              merged = { ...confirmed, timestamp: optimistic.timestamp };
            }
          }
          return dedupeWhatsappMessages([...withoutPending, merged]);
        });
      } else {
        invalidate(true);
      }
      if (companyId && chatIdOut) {
        const preview =
          confirmed?.body?.trim() ||
          confirmed?.caption?.trim() ||
          (input.type === 'text' ? input.text.trim() : `[${input.type}]`);
        patchChatsListAfterOutgoing(
          queryClient,
          companyId,
          chatIdOut,
          preview || null,
          confirmed?.timestamp,
        );
      }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
  });

  const forwardMessage = useMutation({
    mutationFn: async (input: { chat_id: string; message_id: string }) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{
        ok: boolean;
        waha_message_id?: string;
        chat_id?: string;
      }>({
        action: 'messages.forward',
        ...input,
        company_id: companyId,
      });
    },
    onSuccess: () => {
      invalidate();
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (input: { chat_id: string; message_id: string }) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{
        ok: boolean;
        waha_message_id?: string;
        chat_id?: string;
      }>({
        action: 'messages.delete',
        ...input,
        company_id: companyId,
      });
    },
    onSuccess: () => {
      invalidate();
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isSyncingHistory:
      refreshFromWaha.isPending &&
      !historySyncedAt &&
      (messagesQuery.data?.length ?? 0) === 0,
    isError: messagesQuery.isError,
    error: messagesQuery.error as Error | null,
    refetch: messagesQuery.refetch,
    refreshFromWaha,
    sendMessage,
    forwardMessage,
    deleteMessage,
  };
};
