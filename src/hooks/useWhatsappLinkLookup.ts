import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { MetaLeadInfo } from '@/components/whatsapp/whatsappUtils';

export interface WhatsappLinkSummary {
  customerNameById: Record<string, string>;
  leadNameById: Record<string, string>;
  leadMetaById: Record<string, MetaLeadInfo>;
}

export const useWhatsappLinkLookup = (
  chats: Array<{
    customer_id: string | null;
    marketing_lead_id: string | null;
  }>,
): WhatsappLinkSummary => {
  const { companyId } = useCompanyFilter();

  const customerIds = useMemo(
    () => Array.from(new Set(chats.map((c) => c.customer_id).filter(Boolean))) as string[],
    [chats],
  );
  const leadIds = useMemo(
    () =>
      Array.from(
        new Set(chats.map((c) => c.marketing_lead_id).filter(Boolean)),
      ) as string[],
    [chats],
  );

  const customersQuery = useQuery({
    queryKey: ['whatsapp-link-customers', companyId, customerIds.sort().join(',')],
    enabled: !!companyId && customerIds.length > 0,
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const leadsQuery = useQuery({
    queryKey: ['whatsapp-link-leads', companyId, leadIds.sort().join(',')],
    enabled: !!companyId && leadIds.length > 0,
    queryFn: async () => {
      if (leadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('marketing_leads')
        .select('id, first_name, last_name, campaign, form_name, source, external_created_at')
        .in('id', leadIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    const customerNameById: Record<string, string> = {};
    for (const c of customersQuery.data ?? []) {
      customerNameById[c.id] = c.name ?? '';
    }
    const leadNameById: Record<string, string> = {};
    const leadMetaById: Record<string, MetaLeadInfo> = {};
    for (const l of leadsQuery.data ?? []) {
      const full = [l.first_name, l.last_name].filter(Boolean).join(' ').trim();
      const name = full || 'Lead';
      leadNameById[l.id] = name;
      leadMetaById[l.id] = {
        name,
        campaign: l.campaign ?? null,
        formName: l.form_name ?? null,
        source: l.source ?? null,
        externalCreatedAt: l.external_created_at ?? null,
      };
    }
    return { customerNameById, leadNameById, leadMetaById };
  }, [customersQuery.data, leadsQuery.data]);
};
