import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  invokeStripeProxy,
  useStripeConfig,
  centsToEurosInput,
} from '@/hooks/useStripeConfig';
import { DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE } from '@/lib/stripeDepositMessages';

type Props = {
  chatId: string;
  chatDisplayName?: string;
  marketingLeadId?: string | null;
  customerId?: string | null;
  depositPaid?: boolean;
  onSendText: (text: string) => Promise<void>;
  onLeadLinked?: (leadId: string) => void;
};

export const WhatsappSendDepositLinkButton: React.FC<Props> = ({
  chatId,
  chatDisplayName,
  marketingLeadId,
  customerId,
  depositPaid,
  onSendText,
  onLeadLinked,
}) => {
  const { toast } = useToast();
  const { config } = useStripeConfig();
  const [sending, setSending] = useState(false);

  const hasTemplate =
    (config?.deposit_request_whatsapp_message?.trim() ||
      DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE).length > 0;

  if (!hasTemplate) return null;

  const handleClick = async () => {
    if (depositPaid) {
      toast({
        title: 'Señal ya pagada',
        description: 'Este contacto ya tiene la señal confirmada.',
      });
      return;
    }
    setSending(true);
    try {
      const res = await invokeStripeProxy<{
        ok: boolean;
        already_paid?: boolean;
        text?: string | null;
        amount_cents?: number | null;
        lead_id?: string;
        lead_created?: boolean;
      }>({
        action: 'deposit.render_message_for_chat',
        chat_id: chatId,
        chat_display_name: chatDisplayName ?? null,
        customer_id: customerId ?? null,
        marketing_lead_id: marketingLeadId ?? null,
      });
      if (res.already_paid) {
        toast({
          title: 'Señal ya pagada',
          description: 'No hace falta volver a enviar el mensaje de cobro.',
        });
        return;
      }
      if (!res.text?.trim()) {
        throw new Error('No se generó el mensaje');
      }
      await onSendText(res.text);
      if (res.lead_id && onLeadLinked) onLeadLinked(res.lead_id);
      const euros = res.amount_cents ? centsToEurosInput(res.amount_cents) : null;
      toast({
        title: res.lead_created ? 'Lead creado y mensaje enviado' : 'Mensaje de cobro enviado',
        description: euros
          ? `Instrucciones de señal (${euros} €) enviadas al cliente.`
          : 'El cliente ha recibido las instrucciones de pago.',
      });
    } catch (e) {
      toast({
        title: 'No se pudo enviar',
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
      className="h-8 gap-1.5 text-xs border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      disabled={sending || depositPaid}
      title={
        depositPaid
          ? 'La señal ya está registrada como pagada'
          : 'Enviar mensaje de cobro de señal (Stripe, Bizum, transferencia…)'
      }
      onClick={handleClick}
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CreditCard className="h-3.5 w-3.5" />
      )}
      {depositPaid ? 'Señal pagada' : 'Cobro señal'}
    </Button>
  );
};
