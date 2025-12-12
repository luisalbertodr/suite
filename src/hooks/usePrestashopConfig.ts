
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompanyFilter } from './useCompanyFilter';

export interface PrestashopConfig {
  id?: string;
  company_id: string;
  api_url: string | null;
  api_key_encrypted: string | null;
  enabled: boolean | null;
  sync_products: boolean | null;
  sync_stock: boolean | null;
  sync_orders: boolean | null;
  last_sync_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const usePrestashopConfig = () => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['prestashop-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('prestashop_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      return data as PrestashopConfig | null;
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (configData: Partial<PrestashopConfig>) => {
      if (!companyId) throw new Error('No company ID available');

      const { data, error } = await supabase
        .from('prestashop_config')
        .upsert({
          ...configData,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestashop-config', companyId] });
      toast.success('Configuración de PrestaShop guardada correctamente');
    },
    onError: (error) => {
      console.error('Error saving PrestaShop config:', error);
      toast.error('Error al guardar la configuración');
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (testConfig: { api_url: string; api_key: string }) => {
      const { data, error } = await supabase.functions.invoke('prestashop-test-connection', {
        body: { api_url: testConfig.api_url, api_key: testConfig.api_key }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Conexión establecida correctamente');
    },
    onError: (error) => {
      console.error('Connection test failed:', error);
      toast.error('Error al conectar con PrestaShop');
    },
  });

  return {
    config,
    isLoading,
    error,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    testConnection: testConnectionMutation.mutateAsync,
    isTesting: testConnectionMutation.isPending,
  };
};
