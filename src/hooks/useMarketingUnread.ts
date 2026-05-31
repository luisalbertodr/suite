import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

function unreadCountQueryKey(companyIds: string[]) {
  return ['marketing-unread-count', companyIds.slice().sort().join(',')] as const;
}

function viewedSetQueryKey(companyId: string | null) {
  return ['marketing-lead-viewed', companyId] as const;
}

/** IDs de empresa para el contador del dock (centro de facturación completo si aplica). */
export function useMarketingUnreadScopeCompanyIds(): string[] {
  const { companyId } = useCompanyFilter();
  const { billingCompanies, isMultiEntity } = useWorkCenter();

  return useMemo(() => {
    if (isMultiEntity && billingCompanies.length > 0) {
      return billingCompanies.map((c) => c.id);
    }
    return companyId ? [companyId] : [];
  }, [companyId, isMultiEntity, billingCompanies]);
}

/** Total de leads no vistos por el usuario (badge en DockBar). */
export function useMarketingUnread() {
  const queryClient = useQueryClient();
  const { loading: companyLoading } = useCompanyFilter();
  const scopeIds = useMarketingUnreadScopeCompanyIds();

  const totalQuery = useQuery({
    queryKey: unreadCountQueryKey(scopeIds),
    enabled: scopeIds.length > 0 && !companyLoading,
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
        () => {
          queryClient.invalidateQueries({ queryKey: ['marketing-unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['marketing-lead-viewed'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_lead_views' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['marketing-unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['marketing-lead-viewed'] });
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

/** Conjunto de lead_id ya vistos por el usuario en una empresa (tarjetas del kanban). */
export function useMarketingLeadViewedSet(scopeCompanyId: string | null) {
  const query = useQuery({
    queryKey: viewedSetQueryKey(scopeCompanyId),
    enabled: !!scopeCompanyId,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      if (!scopeCompanyId) return new Set();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return new Set();

      const { data, error } = await supabase
        .from('marketing_lead_views')
        .select('lead_id')
        .eq('user_id', user.id)
        .eq('company_id', scopeCompanyId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.lead_id));
    },
  });

  return {
    viewedLeadIds: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
  };
}

export function useMarkMarketingLeadViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { leadId: string; companyId: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('marketing_lead_views').upsert(
        {
          user_id: user.id,
          lead_id: input.leadId,
          company_id: input.companyId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lead_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-unread-count'] });
      queryClient.invalidateQueries({
        queryKey: viewedSetQueryKey(vars.companyId),
      });
    },
  });
}
