import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getSupabaseAccessToken } from '@/lib/supabaseSession';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { Database } from '@/integrations/supabase/types';

export type StripeConfigSafe = Database['public']['Views']['stripe_config_safe']['Row'];

export type StripeConfigSavePayload = {
  publishable_key?: string | null;
  enabled?: boolean;
  default_deposit_amount_cents?: number;
  public_app_url?: string | null;
  confirmed_stage_id?: string | null;
  payment_success_whatsapp_message?: string | null;
  deposit_request_whatsapp_message?: string | null;
  secret_key?: string | null;
  webhook_secret?: string | null;
};

export type StripeProxyAction =
  | { action: 'config.test'; company_id?: string }
  | ({ action: 'config.save'; company_id?: string } & StripeConfigSavePayload)
  | { action: 'deposit.create_for_lead'; lead_id: string; company_id?: string }
  | { action: 'deposit.render_message_for_lead'; lead_id: string; company_id?: string }
  | {
      action: 'deposit.render_message_for_chat';
      chat_id: string;
      company_id?: string;
      chat_display_name?: string | null;
      customer_id?: string | null;
      marketing_lead_id?: string | null;
    }
  | {
      action: 'deposit.confirm_manual_for_chat';
      chat_id: string;
      company_id?: string;
      chat_display_name?: string | null;
      customer_id?: string | null;
      marketing_lead_id?: string | null;
      payment_method?: 'bizum' | 'transfer' | 'cash' | 'other';
    }
  | { action: 'deposit.public_info'; token: string }
  | { action: 'deposit.public_checkout'; token: string; origin?: string };

export async function invokeStripeProxy<T = unknown>(payload: StripeProxyAction): Promise<T> {
  const publicActions = new Set(['deposit.public_info', 'deposit.public_checkout']);
  const headers: Record<string, string> = {};
  if (!publicActions.has(payload.action)) {
    headers.Authorization = `Bearer ${await getSupabaseAccessToken()}`;
  }
  const response = await supabase.functions.invoke('stripe-proxy', {
    headers,
    body: payload,
  });
  if (response.error) {
    throw new Error(response.error.message ?? 'Error en Stripe');
  }
  const data = response.data as T & { error?: string };
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const useStripeConfig = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const configQuery = useQuery({
    queryKey: ['stripe-config', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<StripeConfigSafe | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('stripe_config_safe')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const upsertConfig = useMutation({
    mutationFn: async (values: StripeConfigSavePayload) => {
      if (!companyId) throw new Error('Sin empresa');
      const res = await invokeStripeProxy<{
        ok: boolean;
        config: StripeConfigSafe;
      }>({
        action: 'config.save',
        company_id: companyId,
        ...values,
      });
      return res.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-config', companyId] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () =>
      invokeStripeProxy<{ ok: boolean; account_id?: string }>({
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

export function eurosToCents(euros: string | number): number {
  const n = typeof euros === 'number' ? euros : Number(String(euros).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToEurosInput(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}
