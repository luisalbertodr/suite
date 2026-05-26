import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

// Devuelve el total de mensajes no leídos a través de todos los chats de la
// empresa actual (suma de `unread_count`). Se actualiza en tiempo real gracias
// a la publicación realtime sobre `whatsapp_chats`.
export const useWhatsappUnread = () => {
  const queryClient = useQueryClient();
  const { companyId, loading } = useCompanyFilter();

  const totalQuery = useQuery({
    queryKey: ['whatsapp-unread-total', companyId],
    enabled: !!companyId && !loading,
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('unread_count')
        .eq('company_id', companyId)
        .eq('archived', false)
        .gt('unread_count', 0);
      if (error) throw error;
      return (data ?? []).reduce(
        (acc, row) => acc + (row.unread_count ?? 0),
        0,
      );
    },
  });

  const channelIdRef = useRef<string>('');
  if (!channelIdRef.current) {
    channelIdRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`whatsapp_chats_unread:${companyId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_chats',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['whatsapp-unread-total', companyId],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  return {
    total: totalQuery.data ?? 0,
    isLoading: totalQuery.isLoading,
  };
};
