import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
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

/** Pagina el historial en peticiones cortas (evita timeout 504 del gateway). */
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

/** Trae solo la página más reciente (mensajes nuevos). */
async function syncRecentMessagesFromWaha(
  companyId: string,
  chatIds: string[],
): Promise<number> {
  let total = 0;
  for (const id of chatIds) {
    const res = await syncChatHistoryChunk(companyId, id, 0, false);
    total += res.count ?? 0;
  }
  return total;
}

/** Evita burbujas duplicadas cuando webhook y send crean dos filas del mismo envío. */
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
  return [...byKey.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
  );
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

export const useWhatsappMessages = (
  chatId: string | null,
  relatedChatIds: string[] = [],
  options?: { historySyncedAt?: string | null },
) => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const historySyncedAt = options?.historySyncedAt ?? null;

  const chatIds = useMemo(() => {
    if (!chatId) return [];
    return Array.from(new Set([chatId, ...relatedChatIds]));
  }, [chatId, relatedChatIds]);

  const enabled = !!companyId && !companyLoading && chatIds.length > 0;
  const key = ['whatsapp-messages', companyId, chatIds.slice().sort().join('|')] as const;

  const messagesQuery = useQuery({
    queryKey: key,
    enabled,
    queryFn: async (): Promise<WhatsappMessageRow[]> => {
      if (!companyId || chatIds.length === 0) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('company_id', companyId)
        .in('chat_id', chatIds)
        .order('timestamp', { ascending: true })
        .limit(5000);
      if (error) throw error;
      return dedupeWhatsappMessages(data ?? []);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

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
        () => {
          invalidate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, chatIds.join('|'), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFromWaha = useMutation({
    mutationFn: async (mode: WhatsappSyncMode = 'auto') => {
      if (chatIds.length === 0) throw new Error('Sin chat seleccionado');
      if (!companyId) throw new Error('Sin empresa activa');

      if (mode === 'recent') {
        const count = await syncRecentMessagesFromWaha(companyId, chatIds);
        return { ok: true, count, mode: 'recent' as const };
      }

      const force = mode === 'full';
      const count = await syncChatHistoryPaginated(
        companyId,
        chatIds,
        force,
        () => invalidate(),
      );
      return { ok: true, count, mode: force ? ('full' as const) : ('auto' as const) };
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  const openSyncKeyRef = useRef('');
  useEffect(() => {
    if (!enabled) return;
    const syncKey = `${chatIds.join('|')}|${historySyncedAt ?? 'pending'}`;
    if (openSyncKeyRef.current === syncKey) return;
    openSyncKeyRef.current = syncKey;
    refreshFromWaha.mutate('auto', { onError: () => undefined });
  }, [enabled, chatIds.join('|'), historySyncedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Respaldo si Realtime o el webhook fallan: solo mensajes recientes.
  useEffect(() => {
    if (!enabled || !historySyncedAt) return;
    const timer = window.setInterval(() => {
      refreshFromWaha.mutate('recent', { onError: () => undefined });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [enabled, chatIds.join('|'), historySyncedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isSyncingHistory: refreshFromWaha.isPending && !historySyncedAt,
    isError: messagesQuery.isError,
    error: messagesQuery.error as Error | null,
    refetch: messagesQuery.refetch,
    refreshFromWaha,
    sendMessage,
    forwardMessage,
  };
};
