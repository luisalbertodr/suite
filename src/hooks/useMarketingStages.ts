import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { Database } from '@/integrations/supabase/types';

export type MarketingLeadStage = Database['public']['Tables']['marketing_lead_stages']['Row'];
export type MarketingLeadStageInsert = Database['public']['Tables']['marketing_lead_stages']['Insert'];
export type MarketingLeadStageUpdate = Database['public']['Tables']['marketing_lead_stages']['Update'];

const DEFAULT_STAGES: Array<Omit<MarketingLeadStageInsert, 'company_id'>> = [
  { name: 'Nuevo Formulario',           position: 0, color: '#22c55e', is_default_intake: true,  is_won: false },
  { name: 'Formulario+Agenda ficticia', position: 1, color: '#3b82f6', is_default_intake: false, is_won: false },
  { name: '¡Aún no te ha escuchado!',   position: 2, color: '#f59e0b', is_default_intake: false, is_won: false },
  { name: '¡Llamar por la mañana!',     position: 3, color: '#06b6d4', is_default_intake: false, is_won: false },
  { name: '¡Llamar por la tarde!',      position: 4, color: '#0ea5e9', is_default_intake: false, is_won: false },
  { name: 'Contactar más adelante',     position: 5, color: '#a855f7', is_default_intake: false, is_won: false },
  { name: 'Cita Confirmada (Sin pago)', position: 6, color: '#10b981', is_default_intake: false, is_won: true  },
];

export const useMarketingStages = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const query = useQuery({
    queryKey: ['marketing-stages', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<MarketingLeadStage[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('marketing_lead_stages')
        .select('*')
        .eq('company_id', companyId)
        .order('position', { ascending: true });

      if (error) throw error;

      // Auto-seed para empresas creadas después de la migración inicial
      if (!data || data.length === 0) {
        const seedRows = DEFAULT_STAGES.map((s) => ({ ...s, company_id: companyId }));
        const { data: seeded, error: seedError } = await supabase
          .from('marketing_lead_stages')
          .insert(seedRows)
          .select('*');
        if (seedError) {
          // Si falla por conflicto u otra razón, devolvemos lista vacía sin tirar la query.
          console.warn('No se pudieron sembrar etapas por defecto:', seedError.message);
          return [];
        }
        return (seeded ?? []).sort((a, b) => a.position - b.position);
      }

      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['marketing-stages', companyId] });

  const createStage = useMutation({
    mutationFn: async (input: Omit<MarketingLeadStageInsert, 'company_id'>) => {
      if (!companyId) throw new Error('Sin empresa');
      const { data, error } = await supabase
        .from('marketing_lead_stages')
        .insert({ ...input, company_id: companyId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateStage = useMutation({
    mutationFn: async (input: { id: string; values: MarketingLeadStageUpdate }) => {
      const { data, error } = await supabase
        .from('marketing_lead_stages')
        .update(input.values)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_lead_stages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
    },
  });

  const reorderStages = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('marketing_lead_stages').update({ position: index }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: invalidate,
  });

  return {
    stages: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  };
};
