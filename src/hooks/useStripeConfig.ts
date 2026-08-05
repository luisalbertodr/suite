import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getSupabaseAccessToken } from '@/lib/supabaseSession';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { resolvePaymentGatewayCompanyIdClient } from '@/lib/paymentGatewayCompany';
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
      allow_if_paid?: boolean;
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
  const { billingCompanies, loading: wcLoading } = useWorkCenter();

  const gatewayQuery = useQuery({
    queryKey: ['payment-gateway-company', companyId, billingCompanies.map((c) => c.id).join(',')],
    enabled: !!companyId && !companyLoading && !wcLoading,
    staleTime: 60_000,
    queryFn: async () => {
      if (!companyId) return null;
      return resolvePaymentGatewayCompanyIdClient(companyId, billingCompanies);
    },
  });

  const gatewayCompanyId = gatewayQuery.data ?? companyId;

  const configQuery = useQuery({
    queryKey: ['stripe-config', gatewayCompanyId],
    enabled: !!gatewayCompanyId && !companyLoading && !gatewayQuery.isLoading,
    queryFn: async (): Promise<StripeConfigSafe | null> => {
      if (!gatewayCompanyId) return null;
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
      if (!gatewayCompanyId) throw new Error('Sin empresa');
      const res = await invokeStripeProxy<{
        ok: boolean;
        config: StripeConfigSafe;
      }>({
        action: 'config.save',
        company_id: gatewayCompanyId,
        ...values,
      });
      return res.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-config', gatewayCompanyId] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () =>
      invokeStripeProxy<{ ok: boolean; account_id?: string }>({
        action: 'config.test',
        company_id: gatewayCompanyId ?? undefined,
      }),
  });

  return {
    config: configQuery.data ?? null,
    gatewayCompanyId: gatewayCompanyId ?? null,
    isLoading: configQuery.isLoading || gatewayQuery.isLoading,
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
