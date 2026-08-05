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

async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function invokeRedsysProxy<T = unknown>(payload: RedsysProxyAction): Promise<T> {
  const publicActions = new Set(['deposit.public_checkout']);
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  if (!url) throw new Error('Falta VITE_SUPABASE_URL');
  const endpoint = `${url.replace(/\/+$/, '')}/functions/v1/redsys-proxy`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  };
  if (!publicActions.has(payload.action)) {
    headers.Authorization = `Bearer ${await getSupabaseAccessToken()}`;
  } else {
    headers.Authorization = `Bearer ${
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
    }`;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(
      `No se pudo contactar con Redsys: ${e instanceof Error ? e.message : 'Error de red'}`,
    );
  }

  const data = await readJsonBody(res);

  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : typeof data === 'string' && data
          ? data.slice(0, 280)
          : `Error Redsys (HTTP ${res.status})`;
    throw new Error(msg);
  }

  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const errMsg = (data as { error?: unknown }).error;
    if (errMsg) throw new Error(String(errMsg));
  }
  // config.test puede devolver ok:false con mensaje sin HTTP de error
  if (
    data &&
    typeof data === 'object' &&
    data !== null &&
    'ok' in data &&
    (data as { ok?: unknown }).ok === false
  ) {
    const errMsg =
      'error' in data && (data as { error?: unknown }).error
        ? String((data as { error: unknown }).error)
        : 'Configuración Redsys incompleta';
    throw new Error(errMsg);
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
