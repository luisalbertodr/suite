import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

function sumUnreadFromChats(chats: WhatsappChatRow[] | undefined): number | null {
  if (!chats?.length) return null;
  return chats
    .filter((c) => !c.archived)
    .reduce((acc, row) => acc + (row.unread_count ?? 0), 0);
}

/** Total de no leídos WhatsApp (badge del dock). */
export const useWhatsappUnread = () => {
  const queryClient = useQueryClient();
  const { companyId, loading } = useCompanyFilter();

  const totalQuery = useQuery({
    queryKey: ['whatsapp-unread-total', companyId],
    enabled: !!companyId && !loading,
    staleTime: 15_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;

      const fromCache = sumUnreadFromChats(
        queryClient.getQueryData<WhatsappChatRow[]>(['whatsapp-chats', companyId]),
      );
      if (fromCache != null) return fromCache;

      const { data, error } = await supabase.rpc('whatsapp_unread_total', {
        p_company_id: companyId,
      });
      if (error) {
        const { data: rows, error: fallbackErr } = await supabase
          .from('whatsapp_chats')
          .select('unread_count')
          .eq('company_id', companyId)
          .eq('archived', false)
          .gt('unread_count', 0);
        if (fallbackErr) throw fallbackErr;
        return (rows ?? []).reduce((acc, row) => acc + (row.unread_count ?? 0), 0);
      }
      return Number(data ?? 0);
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

  useEffect(() => {
    if (!companyId) return;
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.type === 'updated' &&
        event.query.queryKey[0] === 'whatsapp-chats' &&
        event.query.queryKey[1] === companyId
      ) {
        const total = sumUnreadFromChats(event.query.state.data as WhatsappChatRow[] | undefined);
        if (total != null) {
          queryClient.setQueryData(['whatsapp-unread-total', companyId], total);
        }
      }
    });
    return unsub;
  }, [companyId, queryClient]);

  return {
    total: totalQuery.data ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
};
