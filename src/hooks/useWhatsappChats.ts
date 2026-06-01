import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import {
  isSystemChatJid,
  isGroupJid,
  hasResolvedGroupName,
} from '@/components/whatsapp/whatsappUtils';
import type { Database } from '@/integrations/supabase/types';

export type WhatsappChatRow = Database['public']['Tables']['whatsapp_chats']['Row'];

const BG_SYNC_INTERVAL_MS = 4000;

export const useWhatsappChats = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const chatsQuery = useQuery({
    queryKey: ['whatsapp-chats', companyId],
    enabled: !!companyId && !companyLoading,
    staleTime: 5_000,
    queryFn: async (): Promise<WhatsappChatRow[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('company_id', companyId)
        .eq('archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).filter((c) => !isSystemChatJid(c.chat_id));
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });

  const channelIdRef = useRef<string>('');
  if (!channelIdRef.current) {
    channelIdRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`whatsapp_chats:${companyId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_chats',
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
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFromWaha = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{ ok: boolean; count: number }>({
        action: 'chats.list',
        limit: 150,
        company_id: companyId,
      });
    },
    onSuccess: invalidate,
  });

  const syncHistoryChunk = useMutation({
    mutationFn: async (messageOffset = 0) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{
        ok: boolean;
        messages: number;
        next_offset: number | null;
        message_offset?: number | null;
        warnings?: string[];
      }>({
        action: 'messages.sync_history',
        company_id: companyId,
        message_offset: messageOffset,
        refresh_chats: false,
      });
    },
    onSuccess: () => {
      invalidate();
    },
  });

  const syncHistoryFromWaha = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Sin empresa activa');
      let messageOffset = 0;
      let totalMessages = 0;
      let iterations = 0;
      while (iterations < 120) {
        const res = await invokeWhatsappProxy<{
          ok: boolean;
          messages: number;
          next_offset: number | null;
          message_offset?: number | null;
          warnings?: string[];
        }>({
          action: 'messages.sync_history',
          company_id: companyId,
          message_offset: messageOffset,
          refresh_chats: messageOffset === 0 && iterations === 0,
        });
        totalMessages += res.messages ?? 0;
        if (res.message_offset != null) {
          messageOffset = res.message_offset;
        } else {
          messageOffset = 0;
        }
        if (res.next_offset == null && res.message_offset == null) {
          return { ok: true, messages: totalMessages, warnings: res.warnings };
        }
        iterations += 1;
      }
      return { ok: true, messages: totalMessages };
    },
    onSuccess: () => {
      invalidate();
    },
  });

  const syncPicturesFromWaha = useMutation({
    mutationFn: async (chatIds?: string[]) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{ ok: boolean; count: number }>({
        action: 'pictures.sync_batch',
        company_id: companyId,
        chat_ids: chatIds?.slice(0, 1),
        limit: 1,
      });
    },
    onSuccess: invalidate,
  });

  const syncGroupNameFromWaha = useMutation({
    mutationFn: async (chatId: string) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{ ok: boolean; updated?: boolean; name?: string }>({
        action: 'groups.sync_name',
        company_id: companyId,
        chat_id: chatId,
      });
    },
    onSuccess: invalidate,
  });

  const refreshAllFromWaha = useMutation({
    mutationFn: async () => refreshFromWaha.mutateAsync(),
  });

  const bgMessageOffsetRef = useRef(0);
  const bgBusyRef = useRef(false);
  const unsyncedCount = (chatsQuery.data ?? []).filter((c) => !c.history_synced_at).length;
  const missingPictureChatIds = useMemo(
    () =>
      (chatsQuery.data ?? [])
        .filter(
          (c) =>
            !c.profile_picture_url?.includes('/storage/v1/object/public/whatsapp-avatars/'),
        )
        .map((c) => c.chat_id),
    [chatsQuery.data],
  );
  const missingGroupNameChatIds = useMemo(
    () =>
      (chatsQuery.data ?? [])
        .filter(
          (c) =>
            (c.is_group || isGroupJid(c.chat_id)) &&
            !hasResolvedGroupName(c.name, c.raw),
        )
        .map((c) => c.chat_id),
    [chatsQuery.data],
  );

  useEffect(() => {
    if (!companyId) return;

    const runNext = () => {
      if (bgBusyRef.current) return;
      if (
        syncHistoryChunk.isPending ||
        syncGroupNameFromWaha.isPending ||
        syncPicturesFromWaha.isPending ||
        refreshFromWaha.isPending
      ) {
        return;
      }

      if (unsyncedCount > 0) {
        bgBusyRef.current = true;
        syncHistoryChunk.mutate(bgMessageOffsetRef.current, {
          onSuccess: (res) => {
            if (res.message_offset != null) {
              bgMessageOffsetRef.current = res.message_offset;
            } else {
              bgMessageOffsetRef.current = 0;
            }
          },
          onSettled: () => {
            bgBusyRef.current = false;
          },
          onError: () => undefined,
        });
        return;
      }

      const nextGroup = missingGroupNameChatIds[0];
      if (nextGroup) {
        bgBusyRef.current = true;
        syncGroupNameFromWaha.mutate(nextGroup, {
          onSettled: () => {
            bgBusyRef.current = false;
          },
          onError: () => undefined,
        });
        return;
      }

      const nextPicture = missingPictureChatIds[0];
      if (nextPicture) {
        bgBusyRef.current = true;
        syncPicturesFromWaha.mutate([nextPicture], {
          onSettled: () => {
            bgBusyRef.current = false;
          },
          onError: () => undefined,
        });
      }
    };

    const timer = setInterval(runNext, BG_SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    companyId,
    unsyncedCount,
    missingGroupNameChatIds.join('|'),
    missingPictureChatIds.join('|'),
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useMutation({
    mutationFn: async (chatId: string) => {
      if (!companyId) throw new Error('Sin empresa activa');
      return invokeWhatsappProxy<{ ok: boolean }>({
        action: 'chat.mark_read',
        chat_id: chatId,
        company_id: companyId,
      });
    },
    onSuccess: invalidate,
  });

  return {
    chats: chatsQuery.data ?? [],
    isLoading: chatsQuery.isLoading,
    isError: chatsQuery.isError,
    error: chatsQuery.error as Error | null,
    refetch: chatsQuery.refetch,
    refreshFromWaha,
    syncHistoryFromWaha,
    refreshAllFromWaha,
    syncPicturesFromWaha,
    syncGroupNameFromWaha,
    markRead,
  };
};
