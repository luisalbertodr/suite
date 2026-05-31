import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { invokeStripeProxy } from '@/hooks/useStripeConfig';

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export const DepositPaymentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isSuccess = window.location.pathname.endsWith('/exito');

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    amount_cents: number;
    currency: string;
    status: string;
    lead_name: string | null;
    offer_name: string | null;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Enlace no válido');
      setLoading(false);
      return;
    }
    invokeStripeProxy<{
      ok: boolean;
      amount_cents: number;
      currency: string;
      status: string;
      lead_name: string | null;
      offer_name: string | null;
    }>({ action: 'deposit.public_info', token })
      .then((data) => {
        setInfo({
          amount_cents: data.amount_cents,
          currency: data.currency,
          status: data.status,
          lead_name: data.lead_name,
          offer_name: data.offer_name,
        });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el pago');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    if (!token) return;
    setPaying(true);
    setError(null);
    try {
      const res = await invokeStripeProxy<{
        ok: boolean;
        checkout_url: string;
        status: string;
      }>({
        action: 'deposit.public_checkout',
        token,
        origin: window.location.origin,
      });
      if (res.status === 'paid') {
        navigate(`/pago/${token}/exito`, { replace: true });
        return;
      }
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setError('No se pudo abrir la pasarela de pago');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (isSuccess || info?.status === 'paid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <CardTitle>Pago recibido</CardTitle>
            <CardDescription>
              Hemos confirmado tu señal. En breve recibirás la confirmación por WhatsApp.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex justify-center">
            <CreditCard className="h-10 w-10 text-violet-600" />
          </div>
          <CardTitle className="text-center">Señal para reservar tu cita</CardTitle>
          <CardDescription className="text-center">
            {info?.lead_name ? `Hola ${info.lead_name}` : 'Completa el pago para confirmar'}
            {info?.offer_name ? ` · ${info.offer_name}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {info ? (
            <p className="text-center text-3xl font-semibold">
              {formatMoney(info.amount_cents, info.currency)}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button className="w-full" size="lg" onClick={handlePay} disabled={paying || !info}>
            {paying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirigiendo a Stripe…
              </>
            ) : (
              'Pagar con tarjeta'
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Pago seguro procesado por Stripe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepositPaymentPage;
