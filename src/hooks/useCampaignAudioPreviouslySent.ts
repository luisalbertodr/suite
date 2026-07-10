import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import type { WhatsappMessageRow } from '@/hooks/useWhatsappMessages';

const CAMPAIGN_AUDIO_TYPES = ['meta_initial_audio', 'meta_initial_audio_link'] as const;

function chatPhoneSuffix(chatId: string): string | null {
  const local = chatId.split('@')[0]?.replace(/\D/g, '') ?? '';
  return local.length >= 9 ? local.slice(-9) : local || null;
}

/** Mensajes salientes persistidos por el envío manual/automático de audio de campaña. */
export function detectCampaignAudioInMessages(
  messages: WhatsappMessageRow[],
  campaignAudioFilename?: string | null,
): boolean {
  const filename = campaignAudioFilename?.trim();
  return messages.some((m) => {
    if (!m.from_me) return false;
    const body = (m.body ?? '').trim();
    if (filename && body === `[audio] ${filename}`) return true;
    if (body === '[nota de voz]') return true;
    if (body.startsWith('[audio]')) return true;
    return false;
  });
}

export function useCampaignAudioPreviouslySent(input: {
  marketingLeadId?: string | null;
  chatId: string;
  messages?: WhatsappMessageRow[];
  campaignAudioFilename?: string | null;
}) {
  const { companyId, loading: companyLoading } = useWhatsappCompanyId();
  const { marketingLeadId, chatId, messages, campaignAudioFilename } = input;

  const logQuery = useQuery({
    queryKey: ['campaign-audio-sent-log', companyId, marketingLeadId, chatId],
    enabled: !!companyId && !companyLoading,
    queryFn: async () => {
      let q = supabase
        .from('whatsapp_automation_send_log')
        .select('id, created_at')
        .eq('company_id', companyId!)
        .in('automation_type', [...CAMPAIGN_AUDIO_TYPES])
        .eq('success', true);

      if (marketingLeadId) {
        q = q.in('reference_id', [
          marketingLeadId,
          `${marketingLeadId}:manual_audio`,
          `${marketingLeadId}:manual_audio_link`,
        ]);
      } else {
        const suffix = chatPhoneSuffix(chatId);
        if (!suffix) return null;
        q = q.or(`sent_to_phone.ilike.%${suffix},intended_phone.ilike.%${suffix}`);
      }

      const { data, error } = await q.order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const fromMessages = messages
    ? detectCampaignAudioInMessages(messages, campaignAudioFilename)
    : false;

  return {
    previouslySent: !!logQuery.data || fromMessages,
    lastSentAt: logQuery.data?.created_at ?? null,
    refetch: logQuery.refetch,
  };
}
