import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';

async function fetchWhatsappUnreadTotal(companyId: string): Promise<number> {
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
}

/** Ajuste optimista del badge cuando llega un cambio realtime antes del refetch RPC. */
function patchUnreadTotalFromRealtime(
  queryClient: QueryClient,
  companyId: string,
  payload: {
    eventType: string;
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  },
) {
  const readUnread = (row: Record<string, unknown> | null) =>
    Number(row?.unread_count ?? 0) || 0;
  const isArchived = (row: Record<string, unknown> | null) => row?.archived === true;

  let delta = 0;
  if (payload.eventType === 'INSERT') {
    if (!isArchived(payload.new)) delta = readUnread(payload.new);
  } else if (payload.eventType === 'DELETE') {
    if (!isArchived(payload.old)) delta = -readUnread(payload.old);
  } else if (payload.eventType === 'UPDATE') {
    const wasArchived = isArchived(payload.old);
    const isNowArchived = isArchived(payload.new);
    const oldUnread = readUnread(payload.old);
    const newUnread = readUnread(payload.new);
    if (!wasArchived && isNowArchived) {
      delta = -oldUnread;
    } else if (wasArchived && !isNowArchived) {
      delta = newUnread;
    } else if (!wasArchived && !isNowArchived) {
      delta = newUnread - oldUnread;
    }
  }

  if (delta === 0) return;
  queryClient.setQueryData<number>(['whatsapp-unread-total', companyId], (prev) =>
    Math.max(0, (prev ?? 0) + delta),
  );
}

/** Total de no leídos WhatsApp (badge del dock). */
export const useWhatsappUnread = () => {
  const queryClient = useQueryClient();
  const { companyId, loading } = useWhatsappCompanyId();

  const totalQuery = useQuery({
    queryKey: ['whatsapp-unread-total', companyId],
    enabled: !!companyId && !loading,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      return fetchWhatsappUnreadTotal(companyId);
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
        (payload) => {
          patchUnreadTotalFromRealtime(queryClient, companyId, {
            eventType: payload.eventType,
            new: payload.new as Record<string, unknown> | null,
            old: payload.old as Record<string, unknown> | null,
          });
          void queryClient.invalidateQueries({
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
    isError: totalQuery.isError,
  };
};
