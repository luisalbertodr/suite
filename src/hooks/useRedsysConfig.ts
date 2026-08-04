import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getSupabaseAccessToken } from '@/lib/supabaseSession';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { Database } from '@/integrations/supabase/types';

export type RedsysConfigSafe = Database['public']['Views']['redsys_config_safe']['Row'] & {
  signature_version: 'HMAC_SHA512_V2' | 'HMAC_SHA256_V1';
  environment: 'live' | 'test';
};

export type RedsysConfigSavePayload = {
  merchant_code?: string | null;
  terminal?: string | null;
  signature_key?: string | null;
  signature_version?: 'HMAC_SHA512_V2' | 'HMAC_SHA256_V1' | null;
  environment?: 'live' | 'test' | null;
  enabled?: boolean;
  bizum_enabled?: boolean;
  default_deposit_amount_cents?: number;
  public_app_url?: string | null;
  confirmed_stage_id?: string | null;
  payment_success_whatsapp_message?: string | null;
  product_description?: string | null;
  api_key?: string | null;
};

export type RedsysProxyAction =
  | { action: 'config.test'; company_id?: string }
  | ({ action: 'config.save'; company_id?: string } & RedsysConfigSavePayload)
  | {
      action: 'deposit.public_checkout';
      token: string;
      origin?: string;
      pay_method?: 'card' | 'bizum';
    };

export async function invokeRedsysProxy<T = unknown>(payload: RedsysProxyAction): Promise<T> {
  const publicActions = new Set(['deposit.public_checkout']);
  const headers: Record<string, string> = {};
  if (!publicActions.has(payload.action)) {
    headers.Authorization = `Bearer ${await getSupabaseAccessToken()}`;
  }
  const response = await supabase.functions.invoke('redsys-proxy', {
    headers,
    body: payload,
  });
  if (response.error) {
    throw new Error(response.error.message ?? 'Error en Redsys');
  }
  const data = response.data as T & { error?: string };
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const useRedsysConfig = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const configQuery = useQuery({
    queryKey: ['redsys-config', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<RedsysConfigSafe | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('redsys_config_safe')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as RedsysConfigSafe | null;
    },
  });

  const upsertConfig = useMutation({
    mutationFn: async (values: RedsysConfigSavePayload) => {
      if (!companyId) throw new Error('Sin empresa');
      const res = await invokeRedsysProxy<{
        ok: boolean;
        config: RedsysConfigSafe;
      }>({
        action: 'config.save',
        company_id: companyId,
        ...values,
      });
      return res.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redsys-config', companyId] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () =>
      invokeRedsysProxy<{
        ok: boolean;
        merchant_code?: string;
        terminal?: string;
        environment?: string;
      }>({
        action: 'config.test',
        company_id: companyId ?? undefined,
      }),
  });

  return {
    config: configQuery.data ?? null,
    isLoading: configQuery.isLoading,
    upsertConfig,
    testConnection,
  };
};
