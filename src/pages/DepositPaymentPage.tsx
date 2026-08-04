import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { invokeStripeProxy } from '@/hooks/useStripeConfig';
import { invokeRedsysProxy } from '@/hooks/useRedsysConfig';

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

type PaymentMethods = {
  stripe: boolean;
  redsys_card: boolean;
  redsys_bizum: boolean;
};

function postRedsysForm(form: {
  endpoint: string;
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}) {
  const el = document.createElement('form');
  el.method = 'POST';
  el.action = form.endpoint;
  el.style.display = 'none';
  const fields: Record<string, string> = {
    Ds_SignatureVersion: form.Ds_SignatureVersion,
    Ds_MerchantParameters: form.Ds_MerchantParameters,
    Ds_Signature: form.Ds_Signature,
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    el.appendChild(input);
  }
  document.body.appendChild(el);
  el.submit();
}

export const DepositPaymentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isSuccess = window.location.pathname.endsWith('/exito');

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<'stripe' | 'card' | 'bizum' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    amount_cents: number;
    currency: string;
    status: string;
    lead_name: string | null;
    offer_name: string | null;
    methods: PaymentMethods;
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
      methods?: PaymentMethods;
    }>({ action: 'deposit.public_info', token })
      .then((data) => {
        setInfo({
          amount_cents: data.amount_cents,
          currency: data.currency,
          status: data.status,
          lead_name: data.lead_name,
          offer_name: data.offer_name,
          methods: data.methods ?? {
            stripe: true,
            redsys_card: false,
            redsys_bizum: false,
          },
        });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el pago');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleStripe = async () => {
    if (!token) return;
    setPaying('stripe');
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
      setPaying(null);
    }
  };

  const handleRedsys = async (payMethod: 'card' | 'bizum') => {
    if (!token) return;
    setPaying(payMethod);
    setError(null);
    try {
      const res = await invokeRedsysProxy<{
        ok: boolean;
        status: string;
        form?: {
          endpoint: string;
          Ds_SignatureVersion: string;
          Ds_MerchantParameters: string;
          Ds_Signature: string;
        };
      }>({
        action: 'deposit.public_checkout',
        token,
        origin: window.location.origin,
        pay_method: payMethod,
      });
      if (res.status === 'paid') {
        navigate(`/pago/${token}/exito`, { replace: true });
        return;
      }
      if (res.form) {
        postRedsysForm(res.form);
        return;
      }
      setError('No se pudo abrir el TPV Redsys');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago');
    } finally {
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
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

  const methods = info?.methods;
  const hasAny =
    methods && (methods.stripe || methods.redsys_card || methods.redsys_bizum);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex justify-center">
            <CreditCard className="h-10 w-10 text-emerald-700" />
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

          {!hasAny ? (
            <p className="text-center text-sm text-muted-foreground">
              El cobro online no está disponible en este momento.
            </p>
          ) : null}

          {methods?.redsys_card ? (
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleRedsys('card')}
              disabled={!!paying || !info}
            >
              {paying === 'card' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirigiendo al TPV…
                </>
              ) : (
                'Pagar con tarjeta'
              )}
            </Button>
          ) : null}

          {methods?.redsys_bizum ? (
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={() => handleRedsys('bizum')}
              disabled={!!paying || !info}
            >
              {paying === 'bizum' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirigiendo a Bizum…
                </>
              ) : (
                <>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Pagar con Bizum
                </>
              )}
            </Button>
          ) : null}

          {methods?.stripe ? (
            <Button
              className="w-full"
              size="lg"
              variant={methods.redsys_card || methods.redsys_bizum ? 'outline' : 'default'}
              onClick={handleStripe}
              disabled={!!paying || !info}
            >
              {paying === 'stripe' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirigiendo a Stripe…
                </>
              ) : methods.redsys_card || methods.redsys_bizum ? (
                'Pagar con tarjeta (Stripe)'
              ) : (
                'Pagar con tarjeta'
              )}
            </Button>
          ) : null}

          <p className="text-center text-[11px] text-muted-foreground">
            Pago seguro procesado por{' '}
            {methods?.redsys_card || methods?.redsys_bizum
              ? methods?.stripe
                ? 'Redsys / Stripe'
                : 'Redsys'
              : 'Stripe'}
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepositPaymentPage;
