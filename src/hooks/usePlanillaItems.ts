
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useCompanyFilter } from './useCompanyFilter';

export interface PlanillaItem {
  id?: string;
  planilla_id?: string;
  article_id?: string | null;
  customer_id?: string | null;
  description?: string | null;
  notes?: string | null;
  quantity: number;
  row_index: number;
  created_at?: string;
  updated_at?: string;
}

export const usePlanillaItems = (planillaId?: string) => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { data: items = [], isLoading: loading, error } = useQuery({
    queryKey: ['planilla-items', planillaId],
    queryFn: async () => {
      if (!planillaId) {
        console.log('No planilla ID provided');
        return [];
      }

      console.log('Fetching planilla items for:', planillaId);

      const { data, error } = await supabase
        .from('planilla_items')
        .select('*')
        .eq('planilla_id', planillaId)
        .order('row_index', { ascending: true });

      if (error) {
        console.error('Error fetching planilla items:', error);
        throw error;
      }

      console.log('Fetched planilla items:', data?.length || 0);
      return (data || []) as PlanillaItem[];
    },
    enabled: !!planillaId,
  });

  const saveItemsMutation = useMutation({
    mutationFn: async (itemsData: PlanillaItem[]) => {
      if (!planillaId) {
        throw new Error('No planilla ID available');
      }

      if (!companyId) {
        throw new Error('No company ID available');
      }

      console.log('Saving planilla items:', itemsData.length, 'for company:', companyId);

      // First, verify that the planilla belongs to the current company
      const { data: planillaData, error: planillaError } = await supabase
        .from('planillas')
        .select('company_id')
        .eq('id', planillaId)
        .single();

      if (planillaError) {
        console.error('Error fetching planilla:', planillaError);
        throw new Error('Error verificando la planilla');
      }

      if (planillaData.company_id !== companyId) {
        throw new Error('No tiene permisos para modificar esta planilla');
      }

      // Delete existing items first
      const { error: deleteError } = await supabase
        .from('planilla_items')
        .delete()
        .eq('planilla_id', planillaId);

      if (deleteError) {
        console.error('Error deleting existing items:', deleteError);
        throw deleteError;
      }

      // Insert new items
      if (itemsData.length > 0) {
        const itemsWithPlanillaId = itemsData.map((item, index) => ({
          planilla_id: planillaId,
          article_id: item.article_id || null,
          customer_id: item.customer_id || null,
          description: item.description || null,
          notes: item.notes || null,
          quantity: item.quantity || 0,
          row_index: item.row_index ?? index,
        }));

        const { data, error } = await supabase
          .from('planilla_items')
          .insert(itemsWithPlanillaId)
          .select();

        if (error) {
          console.error('Error inserting items:', error);
          throw error;
        }

        console.log('Items saved successfully:', data?.length || 0);
        return data;
      }

      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planilla-items', planillaId] });
      console.log('Items saved and cache invalidated');
    },
    onError: (error) => {
      console.error('Error saving items:', error);
      toast.error(`Error al guardar los items: ${error.message}`);
    },
  });

  return {
    items,
    loading,
    error,
    saveItems: saveItemsMutation.mutateAsync,
    isSaving: saveItemsMutation.isPending,
  };
};
