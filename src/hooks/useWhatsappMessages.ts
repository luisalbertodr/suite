import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import type { Database } from '@/integrations/supabase/types';

export type WhatsappMessageRow = Database['public']['Tables']['whatsapp_messages']['Row'];

export type SendMessageInput =
  | { chat_id: string; type: 'text'; text: string }
  | {
      chat_id: string;
      type: 'image' | 'video' | 'audio' | 'document' | 'voice';
      media_base64: string;
      mime_type: string;
      filename: string;
      caption?: string;
    };

export const useWhatsappMessages = (chatId: string | null) => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const enabled = !!companyId && !companyLoading && !!chatId;
  const key = ['whatsapp-messages', companyId, chatId] as const;

  const messagesQuery = useQuery({
    queryKey: key,
    enabled,
    queryFn: async (): Promise<WhatsappMessageRow[]> => {
      if (!companyId || !chatId) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('company_id', companyId)
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
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
      .channel(`whatsapp_messages:${companyId}:${chatId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { chat_id?: string } | undefined;
          if (row?.chat_id === chatId) invalidate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, chatId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFromWaha = useMutation({
    mutationFn: async () => {
      if (!chatId) throw new Error('Sin chat seleccionado');
      return invokeWhatsappProxy<{ ok: boolean; count: number }>({
        action: 'messages.list',
        chat_id: chatId,
        limit: 100,
      });
    },
    onSuccess: invalidate,
  });

  const sendMessage = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      return invokeWhatsappProxy<{
        ok: boolean;
        waha_message_id?: string;
        chat_id?: string;
        chat_id_was_migrated?: boolean;
        message?: WhatsappMessageRow;
      }>({
        action: 'messages.send',
        ...input,
      });
    },
    onSuccess: (data) => {
      // Optimistic: si el backend devolvió la fila insertada, la añadimos a
      // la caché en local sin esperar a Realtime.
      if (data?.message) {
        const targetKey = data.chat_id_was_migrated && data.chat_id
          ? (['whatsapp-messages', companyId, data.chat_id] as const)
          : key;
        queryClient.setQueryData<WhatsappMessageRow[] | undefined>(
          targetKey,
          (prev) => {
            const list = prev ?? [];
            if (list.some((m) => m.id === data.message!.id)) return list;
            return [...list, data.message!].sort((a, b) =>
              a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
            );
          },
        );
      }
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error as Error | null,
    refetch: messagesQuery.refetch,
    refreshFromWaha,
    sendMessage,
  };
};
