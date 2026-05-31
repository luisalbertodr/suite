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
  /** Leads borrados antes de reimportar (solo si full_meta_resync). */
  deleted_meta_leads?: number;
  full_meta_resync?: boolean;
  results: MetaSyncFormResult[];
};

/** Texto para toasts / avisos cuando hay errores por formulario. */
export function formatMetaSyncErrorsSummary(
  data: MetaSyncResponse,
  maxLen = 900,
): string {
  const parts = data.results
    .filter((r) => r.message || r.errors > 0)
    .map((r) => {
      const label = r.form_name ?? r.form_id;
      if (r.message) return `${label}: ${r.message}`;
      if (r.errors > 0) {
        return `${label}: ${r.errors} registro(s) no insertados`;
      }
      return '';
    })
    .filter(Boolean);
  const s = parts.join(' · ');
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

/** Sufijo que añade meta-sync-leads en `meta_config.last_sync_message` con el detalle. */
export const META_SYNC_DETAIL_MARKER = '. Detalle: ' as const;

export function stripMetaSyncDetailFromSummary(
  message: string | null | undefined,
): string | null {
  if (!message) return null;
  const idx = message.indexOf(META_SYNC_DETAIL_MARKER);
  if (idx === -1) return message;
  const head = message.slice(0, idx).trim();
  return head.length > 0 ? head : null;
}

export function extractMetaSyncDetailFromMessage(
  message: string | null | undefined,
): string | null {
  if (!message) return null;
  const idx = message.indexOf(META_SYNC_DETAIL_MARKER);
  if (idx === -1) return null;
  const rest = message.slice(idx + META_SYNC_DETAIL_MARKER.length).trim();
  return rest.length > 0 ? rest : null;
}

/** Debe coincidir con la edge function meta-sync-leads (confirm_full_meta_resync). */
export const META_FULL_RESYNC_CONFIRM = 'BORRAR_LEADS_META' as const;

/** Sin access_token: si lo mezclamos aquí, cada guardado parcial borraría el token en BD. */
const DEFAULT_CONFIG: Omit<MetaConfigInsert, 'company_id' | 'access_token'> = {
  business_id: null,
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
      const { data: existing, error: readErr } = await supabase
        .from('meta_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (readErr) throw readErr;

      const row: MetaConfigInsert = {
        ...DEFAULT_CONFIG,
        ...(existing ?? {}),
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
    mutationFn: async (input?: {
      form_ids?: string[];
      force?: boolean;
      full_meta_resync?: boolean;
      confirm_full_meta_resync?: string;
    }): Promise<MetaSyncResponse> => {
      if (!companyId) throw new Error('Sin empresa activa');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');
      const response = await supabase.functions.invoke('meta-sync-leads', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { ...input, company_id: companyId },
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
      queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes-index', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes-counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-unread-count'] });
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
