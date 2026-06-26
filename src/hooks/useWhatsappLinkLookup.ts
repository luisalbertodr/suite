import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import type { MetaLeadInfo } from '@/components/whatsapp/whatsappUtils';

export interface WhatsappLinkSummary {
  customerNameById: Record<string, string>;
  leadNameById: Record<string, string>;
  leadMetaById: Record<string, MetaLeadInfo>;
}

type MetaFormAudioRow = {
  id: string;
  form_name: string | null;
  whatsapp_initial_audio_enabled: boolean;
  whatsapp_initial_audio_path: string | null;
  whatsapp_initial_audio_filename: string | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  campaign: string | null;
  form_name: string | null;
  source: string | null;
  external_created_at: string | null;
  stripe_deposit_paid_at: string | null;
  meta_form_id: string | null;
};

function normLabel(s: string): string {
  return s.trim().toLowerCase();
}

function resolveFormAudioForLead(
  lead: LeadRow,
  forms: MetaFormAudioRow[],
): { hasAudio: boolean; filename: string | null; formId: string | null } {
  const withAudio = (f: MetaFormAudioRow | undefined) =>
    !!(
      f?.whatsapp_initial_audio_enabled &&
      f.whatsapp_initial_audio_path?.trim()
    );

  if (lead.meta_form_id) {
    const byId = forms.find((f) => f.id === lead.meta_form_id);
    if (byId && withAudio(byId)) {
      return {
        hasAudio: true,
        filename: byId.whatsapp_initial_audio_filename,
        formId: byId.id,
      };
    }
  }

  const campaign = lead.campaign?.trim();
  if (campaign) {
    const c = normLabel(campaign);
    const hit = forms.find((f) => {
      const fn = f.form_name?.trim();
      if (!fn) return false;
      const n = normLabel(fn);
      return n === c || n.includes(c) || c.includes(n);
    });
    if (hit && withAudio(hit)) {
      return { hasAudio: true, filename: hit.whatsapp_initial_audio_filename, formId: hit.id };
    }
  }

  const formName = lead.form_name?.trim();
  if (formName) {
    const f = normLabel(formName);
    const hit = forms.find((x) => x.form_name && normLabel(x.form_name) === f);
    if (hit && withAudio(hit)) {
      return { hasAudio: true, filename: hit.whatsapp_initial_audio_filename, formId: hit.id };
    }
  }

  return { hasAudio: false, filename: null, formId: lead.meta_form_id };
}

export const useWhatsappLinkLookup = (
  chats: Array<{
    customer_id: string | null;
    marketing_lead_id: string | null;
  }>,
  options?: { extraLeadIds?: string[] },
): WhatsappLinkSummary => {
  const { companyId } = useWhatsappCompanyId();

  const customerIds = useMemo(
    () => Array.from(new Set(chats.map((c) => c.customer_id).filter(Boolean))) as string[],
    [chats],
  );
  const leadIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...chats.map((c) => c.marketing_lead_id).filter(Boolean),
          ...(options?.extraLeadIds ?? []),
        ]),
      ) as string[],
    [chats, options?.extraLeadIds],
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
        .select(
          'id, first_name, last_name, campaign, form_name, source, external_created_at, stripe_deposit_paid_at, meta_form_id',
        )
        .in('id', leadIds);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const formsQuery = useQuery({
    queryKey: ['whatsapp-link-meta-forms-audio', companyId],
    enabled: !!companyId && leadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_forms')
        .select(
          'id, form_name, whatsapp_initial_audio_enabled, whatsapp_initial_audio_path, whatsapp_initial_audio_filename',
        )
        .eq('company_id', companyId!);
      if (error) throw error;
      return (data ?? []) as MetaFormAudioRow[];
    },
  });

  return useMemo(() => {
    const customerNameById: Record<string, string> = {};
    for (const c of customersQuery.data ?? []) {
      customerNameById[c.id] = c.name ?? '';
    }
    const leadNameById: Record<string, string> = {};
    const leadMetaById: Record<string, MetaLeadInfo> = {};
    const forms = formsQuery.data ?? [];
    for (const l of leadsQuery.data ?? []) {
      const full = [l.first_name, l.last_name].filter(Boolean).join(' ').trim();
      const name = full || 'Lead';
      leadNameById[l.id] = name;
      const audio = resolveFormAudioForLead(l, forms);
      leadMetaById[l.id] = {
        name,
        campaign: l.campaign ?? null,
        formName: l.form_name ?? null,
        source: l.source ?? null,
        externalCreatedAt: l.external_created_at ?? null,
        stripeDepositPaidAt: l.stripe_deposit_paid_at ?? null,
        metaFormId: audio.formId,
        hasCampaignAudio: audio.hasAudio,
        campaignAudioFilename: audio.filename,
      };
    }
    return { customerNameById, leadNameById, leadMetaById };
  }, [customersQuery.data, leadsQuery.data, formsQuery.data]);
};
