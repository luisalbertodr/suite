import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { Database } from '@/integrations/supabase/types';

export type MetaConfigRow = Database['public']['Tables']['meta_config']['Row'];
export type MetaConfigInsert = Database['public']['Tables']['meta_config']['Insert'];
export type MetaConfigUpdate = Database['public']['Tables']['meta_config']['Update'];

export type MetaFormRow = Database['public']['Tables']['meta_forms']['Row'];
export type MetaFormInsert = Database['public']['Tables']['meta_forms']['Insert'];
export type MetaFormUpdate = Database['public']['Tables']['meta_forms']['Update'];

export type MetaSyncFormResult = {
  form_id: string;
  form_name: string | null;
  status: 'ok' | 'error' | 'skipped' | 'partial';
  inserted: number;
  skipped: number;
  errors: number;
  message?: string;
};

export type MetaSyncResponse = {
  ok: boolean;
  inserted: number;
  skipped: number;
  errors: number;
  results: MetaSyncFormResult[];
};

const DEFAULT_CONFIG: Omit<MetaConfigInsert, 'company_id'> = {
  business_id: null,
  access_token: null,
  graph_api_version: 'v23.0',
  sync_interval_minutes: 60,
  enabled: true,
};

export const useMetaConfig = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const configQuery = useQuery({
    queryKey: ['meta-config', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<MetaConfigRow | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('meta_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const formsQuery = useQuery({
    queryKey: ['meta-forms', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<MetaFormRow[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('meta_forms')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateConfig = () =>
    queryClient.invalidateQueries({ queryKey: ['meta-config', companyId] });
  const invalidateForms = () =>
    queryClient.invalidateQueries({ queryKey: ['meta-forms', companyId] });

  const upsertConfig = useMutation({
    mutationFn: async (values: Omit<MetaConfigUpdate, 'company_id'>) => {
      if (!companyId) throw new Error('Sin empresa');
      const row: MetaConfigInsert = {
        ...DEFAULT_CONFIG,
        ...values,
        company_id: companyId,
      };
      const { data, error } = await supabase
        .from('meta_config')
        .upsert(row, { onConflict: 'company_id' })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateConfig,
  });

  const createForm = useMutation({
    mutationFn: async (input: Omit<MetaFormInsert, 'company_id'>) => {
      if (!companyId) throw new Error('Sin empresa');
      const { data, error } = await supabase
        .from('meta_forms')
        .insert({ ...input, company_id: companyId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateForms,
  });

  const updateForm = useMutation({
    mutationFn: async (input: { id: string; values: MetaFormUpdate }) => {
      const { data, error } = await supabase
        .from('meta_forms')
        .update(input.values)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateForms,
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_forms')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateForms,
  });

  const syncNow = useMutation({
    mutationFn: async (input?: { form_ids?: string[]; force?: boolean }): Promise<MetaSyncResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');
      const response = await supabase.functions.invoke('meta-sync-leads', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: input ?? {},
      });
      if (response.error) {
        type FunctionError = { context?: { json?: () => Promise<unknown> } };
        const fnErr = response.error as Error & FunctionError;
        let serverMessage = fnErr.message ?? 'Error en sincronización Meta';
        try {
          const body = await fnErr.context?.json?.();
          if (body && typeof body === 'object' && 'error' in body) {
            const msg = (body as { error?: unknown }).error;
            if (typeof msg === 'string' && msg.length > 0) serverMessage = msg;
          }
        } catch {
          // ignoramos: usamos el message base
        }
        throw new Error(serverMessage);
      }
      return response.data as MetaSyncResponse;
    },
    onSuccess: () => {
      invalidateConfig();
      invalidateForms();
      queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
    },
  });

  return {
    config: configQuery.data ?? null,
    forms: formsQuery.data ?? [],
    isLoading: configQuery.isLoading || formsQuery.isLoading,
    isError: configQuery.isError || formsQuery.isError,
    error: (configQuery.error ?? formsQuery.error) as Error | null,
    refetch: () => Promise.all([configQuery.refetch(), formsQuery.refetch()]),
    upsertConfig,
    createForm,
    updateForm,
    deleteForm,
    syncNow,
  };
};
