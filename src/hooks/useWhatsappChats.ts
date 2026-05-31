import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import { isSystemChatJid } from '@/components/whatsapp/whatsappUtils';
import type { Database } from '@/integrations/supabase/types';

export type WhatsappChatRow = Database['public']['Tables']['whatsapp_chats']['Row'];

export const useWhatsappChats = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const chatsQuery = useQuery({
    queryKey: ['whatsapp-chats', companyId],
    enabled: !!companyId && !companyLoading,
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

  const syncHistoryFromWaha = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Sin empresa activa');
      let offset = 0;
      let totalMessages = 0;
      let iterations = 0;
      while (iterations < 30) {
        const res = await invokeWhatsappProxy<{
          ok: boolean;
          messages: number;
          next_offset: number | null;
          warnings?: string[];
        }>({
          action: 'messages.sync_history',
          company_id: companyId,
          limit_per_chat: 200,
          max_chats: 25,
          offset,
          refresh_chats: offset === 0,
        });
        totalMessages += res.messages ?? 0;
        if (res.next_offset == null) {
          return { ok: true, messages: totalMessages, warnings: res.warnings };
        }
        offset = res.next_offset;
        iterations += 1;
      }
      return { ok: true, messages: totalMessages };
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', companyId] });
    },
  });

  const refreshAllFromWaha = useMutation({
    mutationFn: async () => {
      await refreshFromWaha.mutateAsync();
      return syncHistoryFromWaha.mutateAsync();
    },
  });

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
    markRead,
  };
};
