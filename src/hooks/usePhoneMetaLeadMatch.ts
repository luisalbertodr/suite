import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { marketingLeadPhoneNorm } from '@/hooks/useMarketingLeads';
import type { MetaLeadInfo } from '@/components/whatsapp/whatsappUtils';

export type PhoneMetaLeadMatch = MetaLeadInfo & {
  id: string;
  phoneNorm: string;
};

type CallPhoneRef = {
  customer?: { id: string } | null;
  customer_phone?: string | null;
};

/**
 * Cruza teléfonos de llamadas (sin cliente vinculado) con leads Meta en marketing_leads.
 */
export function usePhoneMetaLeadMatch(calls: CallPhoneRef[]) {
  const { companyId } = useCompanyFilter();

  const phoneNorms = useMemo(() => {
    const norms = new Set<string>();
    for (const call of calls) {
      if (call.customer?.id) continue;
      const norm = marketingLeadPhoneNorm(call.customer_phone);
      if (norm) norms.add(norm);
    }
    return [...norms].sort();
  }, [calls]);

  const matchQuery = useQuery({
    queryKey: ['phone-meta-leads', companyId, phoneNorms.join(',')],
    enabled: !!companyId && phoneNorms.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (!companyId || phoneNorms.length === 0) {
        return {} as Record<string, PhoneMetaLeadMatch>;
      }

      const { data, error } = await supabase
        .from('marketing_leads')
        .select(
          'id, first_name, last_name, phone_norm, campaign, form_name, source, external_created_at',
        )
        .eq('company_id', companyId)
        .in('phone_norm', phoneNorms)
        .is('customer_id', null)
        .is('archived_at', null);

      if (error) throw error;

      const byNorm = new Map<string, PhoneMetaLeadMatch>();
      for (const row of data ?? []) {
        const norm = row.phone_norm;
        if (!norm) continue;
        const full = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
        const name = full || 'Lead Meta';
        const candidate: PhoneMetaLeadMatch = {
          id: row.id,
          phoneNorm: norm,
          name,
          campaign: row.campaign ?? null,
          formName: row.form_name ?? null,
          source: row.source ?? null,
          externalCreatedAt: row.external_created_at ?? null,
        };
        const prev = byNorm.get(norm);
        if (!prev) {
          byNorm.set(norm, candidate);
          continue;
        }
        const prevTs = prev.externalCreatedAt ? Date.parse(prev.externalCreatedAt) : 0;
        const nextTs = candidate.externalCreatedAt ? Date.parse(candidate.externalCreatedAt) : 0;
        if (nextTs >= prevTs) byNorm.set(norm, candidate);
      }

      const out: Record<string, PhoneMetaLeadMatch> = {};
      for (const [norm, match] of byNorm) {
        out[norm] = match;
      }
      return out;
    },
  });

  return {
    metaLeadByPhoneNorm: matchQuery.data ?? {},
    isMatching: matchQuery.isFetching,
  };
}

export function metaLeadForCall(
  call: CallPhoneRef,
  metaLeadByPhoneNorm: Record<string, PhoneMetaLeadMatch>,
): PhoneMetaLeadMatch | null {
  if (call.customer?.id) return null;
  const norm = marketingLeadPhoneNorm(call.customer_phone);
  if (!norm) return null;
  return metaLeadByPhoneNorm[norm] ?? null;
}
