import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const SCALE_WEIGH_TTL_SECONDS = 5 * 60;

export type ScaleWeighRequestStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired';

export type ScaleWeighRequest = {
  id: string;
  company_id: string;
  customer_id: string;
  status: ScaleWeighRequestStatus;
  created_at: string;
  expires_at: string;
  fulfilled_at: string | null;
  measurement_id: string | null;
  matched_weight_kg: number | null;
  height_cm?: number | null;
  age_years?: number | null;
  sex?: string | null;
  profile_name?: string | null;
};

async function expireStaleOpen(companyId: string, customerId: string) {
  const now = new Date().toISOString();
  await (supabase as any)
    .from('scale_weigh_requests')
    .update({ status: 'expired' })
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('status', 'open')
    .lt('expires_at', now);
}

export function useActiveScaleWeighRequest(
  companyId: string | null | undefined,
  customerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['scale_weigh_request', companyId, customerId],
    enabled: Boolean(companyId && customerId),
    refetchInterval: (query) => {
      const row = query.state.data as ScaleWeighRequest | null | undefined;
      if (row?.status === 'open') return 2_000;
      return false;
    },
    queryFn: async (): Promise<ScaleWeighRequest | null> => {
      if (!companyId || !customerId) return null;
      await expireStaleOpen(companyId, customerId);

      const { data, error } = await (supabase as any)
        .from('scale_weigh_requests')
        .select(
          'id, company_id, customer_id, status, created_at, expires_at, fulfilled_at, measurement_id, matched_weight_kg, height_cm, age_years, sex, profile_name',
        )
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .in('status', ['open', 'fulfilled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as ScaleWeighRequest;
      if (row.status === 'open' && new Date(row.expires_at).getTime() <= Date.now()) {
        await (supabase as any)
          .from('scale_weigh_requests')
          .update({ status: 'expired' })
          .eq('id', row.id);
        return null;
      }

      // Tras cumplirse, mostrar unos segundos y luego dejar de destacar
      if (row.status === 'fulfilled') {
        const fulfilledAt = row.fulfilled_at ? new Date(row.fulfilled_at).getTime() : 0;
        if (Date.now() - fulfilledAt > 60_000) return null;
      }

      return row;
    },
  });
}

export function useStartScaleWeighRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      companyId: string;
      customerId: string;
      heightCm: number;
      ageYears: number;
      sex: 'M' | 'F';
      profileName?: string | null;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + SCALE_WEIGH_TTL_SECONDS * 1000);

      // Una sola petición abierta por centro: cancela las demás.
      await (supabase as any)
        .from('scale_weigh_requests')
        .update({ status: 'cancelled' })
        .eq('company_id', input.companyId)
        .eq('status', 'open');

      const { data, error } = await (supabase as any)
        .from('scale_weigh_requests')
        .insert({
          company_id: input.companyId,
          customer_id: input.customerId,
          status: 'open',
          created_by: user?.id ?? null,
          expires_at: expiresAt.toISOString(),
          height_cm: input.heightCm,
          age_years: input.ageYears,
          sex: input.sex,
          profile_name: (input.profileName || 'Suite').trim().slice(0, 8) || 'Suite',
        })
        .select(
          'id, company_id, customer_id, status, created_at, expires_at, fulfilled_at, measurement_id, matched_weight_kg, height_cm, age_years, sex, profile_name',
        )
        .single();

      if (error) throw error;
      return data as ScaleWeighRequest;
    },
    onSuccess: (row) => {
      void queryClient.invalidateQueries({
        queryKey: ['scale_weigh_request', row.company_id, row.customer_id],
      });
    },
  });
}

export function useCancelScaleWeighRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; companyId: string; customerId: string }) => {
      const { error } = await (supabase as any)
        .from('scale_weigh_requests')
        .update({ status: 'cancelled' })
        .eq('id', input.id)
        .eq('status', 'open');
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      void queryClient.invalidateQueries({
        queryKey: ['scale_weigh_request', input.companyId, input.customerId],
      });
    },
  });
}
