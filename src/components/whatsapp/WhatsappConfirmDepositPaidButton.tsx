import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
import { useQueryClient } from '@tanstack/react-query';
import { invokeStripeProxy, centsToEurosInput } from '@/hooks/useStripeConfig';

type PaymentMethod = 'bizum' | 'transfer' | 'cash' | 'other';

type Props = {
  chatId: string;
  chatDisplayName?: string;
  marketingLeadId?: string | null;
  customerId?: string | null;
  depositPaid?: boolean;
  onConfirmed?: (leadId: string) => void;
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bizum: 'Bizum',
  transfer: 'Transferencia',
  cash: 'Efectivo',
  other: 'Otro',
};

export const WhatsappConfirmDepositPaidButton: React.FC<Props> = ({
  chatId,
  chatDisplayName,
  marketingLeadId,
  customerId,
  depositPaid,
  onConfirmed,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null);
  const [confirming, setConfirming] = useState(false);

  const runConfirm = async (method: PaymentMethod) => {
    setConfirming(true);
    try {
      const res = await invokeStripeProxy<{
        ok: boolean;
        already_paid?: boolean;
        lead_id?: string;
        amount_cents?: number | null;
        whatsapp_sent?: boolean;
        whatsapp_skipped_reason?: string;
      }>({
        action: 'deposit.confirm_manual_for_chat',
        chat_id: chatId,
        chat_display_name: chatDisplayName ?? null,
        customer_id: customerId ?? null,
        marketing_lead_id: marketingLeadId ?? null,
        payment_method: method,
      });

      if (res.already_paid) {
        toast({
          title: 'Señal ya registrada',
          description: 'Este contacto ya tenía la señal marcada como pagada.',
        });
        return;
      }

      const euros = res.amount_cents ? centsToEurosInput(res.amount_cents) : null;
      const methodLabel = METHOD_LABELS[method];

      if (res.whatsapp_sent) {
        toast({
          title: `Señal confirmada (${methodLabel})`,
          description: euros
            ? `Registrado ${euros} €. WhatsApp de confirmación enviado al cliente.`
            : 'WhatsApp de confirmación enviado al cliente.',
        });
      } else if (res.whatsapp_skipped_reason === 'outside_hours') {
        toast({
          title: `Señal confirmada (${methodLabel})`,
          description:
            'Pago registrado. El WhatsApp de confirmación se enviará en el horario automático (o envíalo manualmente).',
        });
      } else if (res.whatsapp_skipped_reason === 'no_template') {
        toast({
          title: `Señal confirmada (${methodLabel})`,
          description:
            euros
              ? `Registrado ${euros} €. Configura «WhatsApp tras pago» en Pagos para el mensaje automático.`
              : 'Pago registrado. Sin plantilla de confirmación configurada.',
        });
      } else {
        toast({
          title: `Señal confirmada (${methodLabel})`,
          description: euros ? `Registrado ${euros} € en el lead.` : 'Pago registrado en el lead.',
        });
      }

      if (res.lead_id && onConfirmed) onConfirmed(res.lead_id);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-link-leads'] });
      setOpen(false);
    } catch (e) {
      toast({
        title: 'No se pudo confirmar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
      setPendingMethod(null);
    }
  };

  const handlePick = (method: PaymentMethod) => {
    setPendingMethod(method);
    setOpen(true);
  };

  if (depositPaid) return null;

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-[10px] border-sky-200 bg-sky-50/80 text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
          disabled={confirming}
          title="Confirmar señal recibida por Bizum"
          onClick={() => handlePick('bizum')}
        >
          {confirming && pendingMethod === 'bizum' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Bizum
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-[10px] border-sky-200 bg-sky-50/80 text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
          disabled={confirming}
          title="Confirmar señal recibida por transferencia"
          onClick={() => handlePick('transfer')}
        >
          {confirming && pendingMethod === 'transfer' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Transfer.
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={(v) => !confirming && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar señal recibida</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará el pago en Marketing (etapa confirmada, notificación interna y Meta
              CAPI si aplica). Si hay plantilla configurada, se enviará el mismo WhatsApp de
              confirmación que tras un pago Stripe.
              {pendingMethod ? ` Método: ${METHOD_LABELS[pendingMethod]}.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirming || !pendingMethod}
              onClick={(e) => {
                e.preventDefault();
                if (pendingMethod) runConfirm(pendingMethod);
              }}
            >
              {confirming ? 'Confirmando…' : 'Confirmar y notificar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
