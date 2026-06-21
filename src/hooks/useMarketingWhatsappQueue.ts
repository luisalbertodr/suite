import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type MarketingWhatsappQueueStats = {
  pending: number;
  sent_today: number;
  sent_today_text: number;
  sent_today_audio: number;
  daily_limit: number;
  eligible_not_queued: number;
  within_hours: boolean;
  next_send_at: string | null;
  hour_start: number;
  hour_end: number;
};

export type EligibleQueueLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  form_name: string | null;
  campaign: string | null;
  external_created_at: string | null;
  created_at: string;
};

export type MarketingWhatsappQueueRow = {
  id: string;
  status: string;
  queued_at: string;
  sent_at: string | null;
  sent_kind: string | null;
  error: string | null;
  marketing_lead_id: string;
  marketing_leads: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    form_name: string | null;
    external_created_at: string | null;
    created_at: string;
    wa_automation_status: string;
    wa_automation_error: string | null;
    wa_automation_initial_sent_kind: string | null;
    stage_id: string | null;
    meta_form_id: string | null;
  } | null;
};

async function invokeQueue<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('marketing-whatsapp-queue', {
    body,
  });
  if (error) throw new Error(error.message ?? 'Error en cola WhatsApp');
  const payload = data as T & { error?: string };
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(String(payload.error));
  }
  return data as T;
}

export function useMarketingWhatsappQueue(companyId: string | null | undefined) {
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ['marketing-whatsapp-queue-stats', companyId],
    enabled: !!companyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const data = await invokeQueue<MarketingWhatsappQueueStats & { ok: boolean }>({
        action: 'stats',
        company_id: companyId,
      });
      return data;
    },
  });

  const listQuery = useQuery({
    queryKey: ['marketing-whatsapp-queue-list', companyId],
    enabled: !!companyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_whatsapp_queue')
        .select(
          `
          id,
          status,
          queued_at,
          sent_at,
          sent_kind,
          error,
          marketing_lead_id,
          marketing_leads (
            id,
            first_name,
            last_name,
            phone,
            form_name,
            external_created_at,
            created_at,
            wa_automation_status,
            wa_automation_error,
            wa_automation_initial_sent_kind,
            stage_id,
            meta_form_id
          )
        `,
        )
        .eq('company_id', companyId!)
        .order('queued_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MarketingWhatsappQueueRow[];
    },
  });

  const fetchEligibleLeads = useQuery({
    queryKey: ['marketing-whatsapp-queue-eligible', companyId],
    enabled: false,
    queryFn: async () => {
      const data = await invokeQueue<{ ok: boolean; leads: EligibleQueueLead[] }>({
        action: 'list_eligible',
        company_id: companyId,
      });
      return data.leads ?? [];
    },
  });

  const enqueueLeads = useMutation({
    mutationFn: async (leadIds: string[]) => {
      return invokeQueue<{
        ok: boolean;
        enqueued: number;
        skipped: number;
        stats: MarketingWhatsappQueueStats;
      }>({
        action: 'enqueue',
        company_id: companyId,
        lead_ids: leadIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-stats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-list', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-eligible', companyId] });
    },
  });

  const cancelPending = useMutation({
    mutationFn: async (queueIds: string[]) => {
      return invokeQueue<{ ok: boolean; cancelled: number }>({
        action: 'cancel',
        company_id: companyId,
        queue_ids: queueIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-stats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-list', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-eligible', companyId] });
    },
  });

  const sendNow = useMutation({
    mutationFn: async (queueId: string) => {
      const data = await invokeQueue<{
        ok: boolean;
        send_error?: string;
        stats: MarketingWhatsappQueueStats;
      }>({
        action: 'send_now',
        company_id: companyId,
        queue_id: queueId,
      });
      if (!data.ok) {
        throw new Error(data.send_error ?? 'No se pudo enviar el WhatsApp');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-stats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-list', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-eligible', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
    },
  });

  return {
    stats: statsQuery.data,
    statsLoading: statsQuery.isLoading,
    queueRows: listQuery.data ?? [],
    queueLoading: listQuery.isLoading,
    fetchEligibleLeads,
    enqueueLeads,
    cancelPending,
    sendNow,
    refetch: () => {
      statsQuery.refetch();
      listQuery.refetch();
    },
  };
}
