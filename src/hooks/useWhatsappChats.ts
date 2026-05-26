import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
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
      return data ?? [];
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
    mutationFn: async () =>
      invokeWhatsappProxy<{ ok: boolean; count: number }>({
        action: 'chats.list',
        limit: 150,
      }),
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: async (chatId: string) =>
      invokeWhatsappProxy<{ ok: boolean }>({
        action: 'chat.mark_read',
        chat_id: chatId,
      }),
    onSuccess: invalidate,
  });

  return {
    chats: chatsQuery.data ?? [],
    isLoading: chatsQuery.isLoading,
    isError: chatsQuery.isError,
    error: chatsQuery.error as Error | null,
    refetch: chatsQuery.refetch,
    refreshFromWaha,
    markRead,
  };
};
