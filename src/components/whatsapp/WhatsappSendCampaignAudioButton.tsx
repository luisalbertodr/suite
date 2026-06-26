import React, { useState } from 'react';
import { Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import type { MetaLeadInfo } from './whatsappUtils';
import { isMetaMarketingLead } from './whatsappUtils';

type Props = {
  chatId: string;
  chatDisplayName?: string;
  marketingLeadId?: string | null;
  customerId?: string | null;
  leadMeta?: MetaLeadInfo;
  onSent?: () => void;
};

export const WhatsappSendCampaignAudioButton: React.FC<Props> = ({
  chatId,
  chatDisplayName,
  marketingLeadId,
  customerId,
  leadMeta,
  onSent,
}) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  if (!marketingLeadId && !isMetaMarketingLead(leadMeta)) return null;
  if (leadMeta?.hasCampaignAudio === false) return null;

  const campaignLabel =
    leadMeta?.campaign?.trim() || leadMeta?.formName?.trim() || 'campaña';

  const handleClick = async () => {
    setSending(true);
    try {
      const res = await invokeWhatsappProxy<{
        ok: boolean;
        campaign_label?: string;
        filename?: string;
        sent_kind?: string;
        error?: string;
      }>({
        action: 'marketing.send_campaign_audio',
        chat_id: chatId,
        chat_display_name: chatDisplayName ?? null,
        customer_id: customerId ?? null,
        marketing_lead_id: marketingLeadId ?? null,
      });
      if (!res.ok) throw new Error(res.error ?? 'No se pudo enviar');
      toast({
        title: 'Audio de campaña enviado',
        description:
          res.sent_kind === 'audio_link'
            ? `Enlace de audio (${res.filename ?? campaignLabel}) enviado.`
            : `Nota de voz de «${res.campaign_label ?? campaignLabel}» enviada.`,
      });
      onSent?.();
    } catch (e) {
      toast({
        title: 'No se pudo enviar el audio',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs border-violet-200 bg-violet-50/80 text-violet-800 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
      disabled={sending}
      title={`Enviar audio de la campaña «${campaignLabel}»`}
      onClick={handleClick}
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
      Audio campaña
    </Button>
  );
};
