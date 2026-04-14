
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useCompanyFilter } from './useCompanyFilter';

export interface SyncLog {
  id: string;
  company_id: string;
  sync_type: string;
  status: string;
  error_message?: string | null;
  items_synced?: number | null;
  created_at: string;
}

export interface ProductMapping {
  id: string;
  company_id: string;
  article_id: string | null;
  prestashop_product_id: number;
  last_synced_at?: string | null;
  created_at: string;
}

export const usePrestashopSync = () => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { data: syncLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['prestashop-sync-logs', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('prestashop_sync_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SyncLog[];
    },
    enabled: !!companyId,
  });

  const { data: productMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['prestashop-product-mappings', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('prestashop_mappings')
        .select(`
          *,
          articles:article_id (codigo, descripcion)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProductMapping[];
    },
    enabled: !!companyId,
  });

  const syncStockMutation = useMutation({
    mutationFn: async (direction: 'inbound' | 'outbound' | 'bidirectional') => {
      const { data, error } = await supabase.functions.invoke('prestashop-sync-stock', {
        body: { direction, company_id: companyId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestashop-sync-logs', companyId] });
      toast.success('Sincronización de stock iniciada');
    },
    onError: (error) => {
      console.error('Stock sync failed:', error);
      toast.error('Error al sincronizar stock');
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async (mapping: { article_id: string; prestashop_product_id: number }) => {
      if (!companyId) throw new Error('No company ID available');

      const { data, error } = await supabase
        .from('prestashop_mappings')
        .insert({
          ...mapping,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestashop-product-mappings', companyId] });
      toast.success('Mapeo de producto creado');
    },
    onError: (error) => {
      console.error('Error creating product mapping:', error);
      toast.error('Error al crear el mapeo de producto');
    },
  });

  return {
    syncLogs,
    logsLoading,
    productMappings,
    mappingsLoading,
    syncStock: syncStockMutation.mutateAsync,
    isSyncing: syncStockMutation.isPending,
    createMapping: createMappingMutation.mutateAsync,
    isCreatingMapping: createMappingMutation.isPending,
  };
};
