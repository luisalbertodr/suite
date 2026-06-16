import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type MarketingWhatsappQueueStats = {
  pending: number;
  sent_today: number;
  daily_limit: number;
  eligible_not_queued: number;
  within_hours: boolean;
  next_send_at: string | null;
  hour_start: number;
  hour_end: number;
};

export type MarketingWhatsappQueueRow = {
  id: string;
  status: string;
  queued_at: string;
  sent_at: string | null;
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
            wa_automation_error
          )
        `,
        )
        .eq('company_id', companyId!)
        .order('queued_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MarketingWhatsappQueueRow[];
    },
  });

  const enqueueAll = useMutation({
    mutationFn: async () => {
      return invokeQueue<{
        ok: boolean;
        enqueued: number;
        skipped: number;
        stats: MarketingWhatsappQueueStats;
      }>({
        action: 'enqueue_all',
        company_id: companyId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-stats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-whatsapp-queue-list', companyId] });
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
    },
  });

  return {
    stats: statsQuery.data,
    statsLoading: statsQuery.isLoading,
    queueRows: listQuery.data ?? [],
    queueLoading: listQuery.isLoading,
    enqueueAll,
    cancelPending,
    refetch: () => {
      statsQuery.refetch();
      listQuery.refetch();
    },
  };
}
