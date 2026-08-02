import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { Database } from '@/integrations/supabase/types';

export type MarketingCtwaCampaign =
  Database['public']['Tables']['marketing_ctwa_campaigns']['Row'];
export type MarketingCtwaCampaignInput = {
  name: string;
  match_keywords?: string;
  intro_message?: string | null;
  intro_enabled?: boolean;
  meta_form_id?: string | null;
  is_default?: boolean;
  enabled?: boolean;
  sort_order?: number;
};

export function useMarketingCtwaCampaigns(scopeCompanyId?: string | null) {
  const { companyId: filterCompanyId } = useCompanyFilter();
  const companyId = scopeCompanyId ?? filterCompanyId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketing-ctwa-campaigns', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<MarketingCtwaCampaign[]> => {
      const { data, error } = await supabase
        .from('marketing_ctwa_campaigns')
        .select('*')
        .eq('company_id', companyId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketing-ctwa-campaigns', companyId] });

  const createCampaign = useMutation({
    mutationFn: async (input: MarketingCtwaCampaignInput) => {
      if (!companyId) throw new Error('Sin empresa activa');
      if (input.is_default) {
        await supabase
          .from('marketing_ctwa_campaigns')
          .update({ is_default: false })
          .eq('company_id', companyId)
          .eq('is_default', true);
      }
      const { data, error } = await supabase
        .from('marketing_ctwa_campaigns')
        .insert({
          company_id: companyId,
          name: input.name.trim(),
          match_keywords: input.match_keywords?.trim() ?? '',
          intro_message: input.intro_message?.trim() || null,
          intro_enabled: input.intro_enabled ?? true,
          meta_form_id: input.meta_form_id || null,
          is_default: input.is_default ?? false,
          enabled: input.enabled ?? true,
          sort_order: input.sort_order ?? 0,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateCampaign = useMutation({
    mutationFn: async (input: { id: string; values: Partial<MarketingCtwaCampaignInput> }) => {
      if (!companyId) throw new Error('Sin empresa activa');
      if (input.values.is_default === true) {
        await supabase
          .from('marketing_ctwa_campaigns')
          .update({ is_default: false })
          .eq('company_id', companyId)
          .eq('is_default', true)
          .neq('id', input.id);
      }
      const patch: Database['public']['Tables']['marketing_ctwa_campaigns']['Update'] = {
        ...input.values,
      };
      if (typeof patch.name === 'string') patch.name = patch.name.trim();
      if (typeof patch.match_keywords === 'string') {
        patch.match_keywords = patch.match_keywords.trim();
      }
      if (typeof patch.intro_message === 'string') {
        patch.intro_message = patch.intro_message.trim() || null;
      }
      const { data, error } = await supabase
        .from('marketing_ctwa_campaigns')
        .update(patch)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_ctwa_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    campaigns: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  };
}
