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

function formatDepositPaidAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  });
}

type Props = {
  chatId: string;
  chatDisplayName?: string;
  marketingLeadId?: string | null;
  customerId?: string | null;
  depositPaid?: boolean;
  /** ISO de `stripe_deposit_paid_at` para avisar con fecha si ya se cobró. */
  depositPaidAt?: string | null;
  onSendText: (text: string) => Promise<void>;
  onLeadLinked?: (leadId: string) => void;
};

export const WhatsappSendDepositLinkButton: React.FC<Props> = ({
  chatId,
  chatDisplayName,
  marketingLeadId,
  customerId,
  depositPaid,
  depositPaidAt,
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

  const paidAtLabel = formatDepositPaidAt(depositPaidAt);

  const handleClick = async () => {
    if (depositPaid) {
      toast({
        title: 'Señal ya cobrada',
        description: paidAtLabel
          ? `Ya consta el pago el ${paidAtLabel}. Se reenviará el mensaje de cobro.`
          : 'Este contacto ya tiene la señal confirmada. Se reenviará el mensaje de cobro.',
      });
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
        paid_at?: string | null;
      }>({
        action: 'deposit.render_message_for_chat',
        chat_id: chatId,
        chat_display_name: chatDisplayName ?? null,
        customer_id: customerId ?? null,
        marketing_lead_id: marketingLeadId ?? null,
        // Permitir reenviar instrucciones aunque ya conste el pago.
        allow_if_paid: true,
      });
      if (res.already_paid && !res.text?.trim()) {
        const when = formatDepositPaidAt(res.paid_at) ?? paidAtLabel;
        toast({
          title: 'Señal ya cobrada',
          description: when
            ? `Pago registrado el ${when}.`
            : 'Este contacto ya tiene la señal confirmada.',
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
      disabled={sending}
      title={
        depositPaid
          ? paidAtLabel
            ? `Señal ya cobrada el ${paidAtLabel}. Puedes reenviar el mensaje.`
            : 'Señal ya cobrada. Puedes reenviar el mensaje.'
          : 'Enviar mensaje de cobro de señal (Redsys, Stripe, Bizum, transferencia…)'
      }
      onClick={handleClick}
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CreditCard className="h-3.5 w-3.5" />
      )}
      Cobro señal
    </Button>
  );
};
