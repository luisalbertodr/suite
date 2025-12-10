
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompanyFilter } from './useCompanyFilter';

export interface PrestashopConfig {
  id?: string;
  company_id: string;
  api_url: string;
  api_key: string;
  webhook_secret?: string;
  is_active: boolean;
  sync_frequency: number;
  last_sync_at?: string;
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
        .from('prestashop_configurations')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      return data as PrestashopConfig | null;
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (configData: Omit<PrestashopConfig, 'id' | 'created_at' | 'updated_at'>) => {
      if (!companyId) throw new Error('No company ID available');

      const { data, error } = await supabase
        .from('prestashop_configurations')
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
    mutationFn: async (config: Pick<PrestashopConfig, 'api_url' | 'api_key'>) => {
      const { data, error } = await supabase.functions.invoke('prestashop-test-connection', {
        body: { api_url: config.api_url, api_key: config.api_key }
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
