import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MARKETING_HOST_COMPANY_ID } from '@/lib/marketingScope';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import { patchMarketingLeadsCache } from '@/lib/marketingLeadsCache';

function unreadCountQueryKey(companyIds: string[]) {
  return ['marketing-unread-count', companyIds.slice().sort().join(',')] as const;
}

/** Empresa del tablero de marketing (siempre Estética). */
export function useMarketingUnreadScopeCompanyIds(): string[] {
  return [MARKETING_HOST_COMPANY_ID];
}

/** Lead pendiente de consultar por el equipo (sin team_viewed_at). */
export function isMarketingLeadUnread(lead: Pick<MarketingLead, 'team_viewed_at'>): boolean {
  return !lead.team_viewed_at;
}

/** Marca un lead como visto por el equipo (idempotente). */
export async function markMarketingLeadTeamViewed(leadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_marketing_lead_team_viewed', {
    p_lead_id: leadId,
  });
  if (error) throw error;
}

function patchLeadTeamViewedInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  leadId: string,
  viewedAt: string,
) {
  queryClient.setQueryData<MarketingLead[]>(['marketing-leads', companyId], (prev) =>
    prev?.map((l) =>
      l.id === leadId && !l.team_viewed_at
        ? { ...l, team_viewed_at: viewedAt }
        : l,
    ),
  );
}

/** Total de leads no consultados por el equipo (badge en DockBar). */
export function useMarketingUnread() {
  const queryClient = useQueryClient();
  const scopeIds = useMarketingUnreadScopeCompanyIds();
  const totalQuery = useQuery({
    queryKey: unreadCountQueryKey(scopeIds),
    enabled: scopeIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('count_marketing_unviewed_leads', {
        p_company_ids: scopeIds,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  const channelIdRef = useRef<string>('');
  if (!channelIdRef.current) {
    channelIdRef.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
  }

  useEffect(() => {
    if (scopeIds.length === 0) return;
    const filter =
      scopeIds.length === 1
        ? `company_id=eq.${scopeIds[0]}`
        : `company_id=in.(${scopeIds.join(',')})`;

    const channel = supabase
      .channel(`marketing_unread:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_leads', filter },
        (payload) => {
          const companyId = String(
            (payload.new as { company_id?: string } | null)?.company_id ??
              (payload.old as { company_id?: string } | null)?.company_id ??
              '',
          );
          if (companyId && scopeIds.includes(companyId)) {
            queryClient.setQueryData<MarketingLead[]>(
              ['marketing-leads', companyId],
              (prev) =>
                patchMarketingLeadsCache(prev, {
                  eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                  new: payload.new as Record<string, unknown> | null,
                  old: payload.old as Record<string, unknown> | null,
                }),
            );
          }
          queryClient.invalidateQueries({ queryKey: ['marketing-unread-count'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scopeIds, queryClient]);

  return {
    total: totalQuery.data ?? 0,
    isLoading: totalQuery.isLoading,
  };
}

export function useMarkMarketingLeadViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { leadId: string; companyId: string }) => {
      await markMarketingLeadTeamViewed(input.leadId);
    },
    onMutate: async (vars) => {
      const viewedAt = new Date().toISOString();
      patchLeadTeamViewedInCache(queryClient, vars.companyId, vars.leadId, viewedAt);
      return { viewedAt };
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-unread-count'] });
    },
  });
}
