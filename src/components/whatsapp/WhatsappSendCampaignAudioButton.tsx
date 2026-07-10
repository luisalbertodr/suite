import React, { useState } from 'react';
import { Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { invokeWhatsappProxy, useWhatsappConfig } from '@/hooks/useWhatsappConfig';
import { useCampaignAudioPreviouslySent } from '@/hooks/useCampaignAudioPreviouslySent';
import type { WhatsappMessageRow } from '@/hooks/useWhatsappMessages';
import type { MetaLeadInfo } from './whatsappUtils';

type Props = {
  chatId: string;
  chatDisplayName?: string;
  marketingLeadId?: string | null;
  customerId?: string | null;
  leadMeta?: MetaLeadInfo;
  messages?: WhatsappMessageRow[];
  onSent?: () => void;
};

export const WhatsappSendCampaignAudioButton: React.FC<Props> = ({
  chatId,
  chatDisplayName,
  marketingLeadId,
  customerId,
  leadMeta,
  messages,
  onSent,
}) => {
  const { toast } = useToast();
  const { sessionStatus } = useWhatsappConfig();
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const campaignLabel =
    leadMeta?.campaign?.trim() || leadMeta?.formName?.trim() || 'campaña';

  const { previouslySent, lastSentAt, refetch } = useCampaignAudioPreviouslySent({
    marketingLeadId,
    chatId,
    messages,
    campaignAudioFilename: leadMeta?.campaignAudioFilename,
  });

  const lastSentLabel = lastSentAt
    ? new Date(lastSentAt).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  const performSend = async () => {
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
      const label = res.campaign_label ?? campaignLabel;
      const description =
        res.sent_kind === 'audio_link'
          ? `Enlace de audio (${res.filename ?? label}) enviado.`
          : res.sent_kind === 'voice'
            ? `Nota de voz de «${label}» enviada.`
            : `Audio adjunto de «${label}» enviado.`;
      toast({
        title: 'Audio de campaña enviado',
        description,
      });
      await refetch();
      onSent?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error desconocido';
      if (/sesión whatsapp no conectada/i.test(message)) {
        sessionStatus.mutate(undefined, { onError: () => undefined });
      }
      toast({
        title: 'No se pudo enviar el audio',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleClick = () => {
    if (sending) return;
    if (previouslySent) {
      setConfirmOpen(true);
      return;
    }
    void performSend();
  };

  const handleConfirmResend = () => {
    setConfirmOpen(false);
    void performSend();
  };

  return (
    <>
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

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !sending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reenviar audio de campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya se envió el audio de «{campaignLabel}» a este contacto
              {lastSentLabel ? ` el ${lastSentLabel}` : ' anteriormente'}.
              ¿Quieres enviarlo de nuevo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmResend();
              }}
            >
              {sending ? 'Enviando…' : 'Enviar de nuevo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
