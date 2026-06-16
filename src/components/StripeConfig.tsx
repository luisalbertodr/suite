import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, CreditCard, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  centsToEurosInput,
  eurosToCents,
  useStripeConfig,
} from '@/hooks/useStripeConfig';
import { useMarketingStages } from '@/hooks/useMarketingStages';
import { WHATSAPP_MESSAGE_TEMPLATE_VARS } from '@/lib/whatsappMessageTemplates';
import { DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE } from '@/lib/stripeDepositMessages';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const NONE_STAGE = '__none__';

export const StripeConfigPanel: React.FC = () => {
  const { toast } = useToast();
  const { config, isLoading, upsertConfig, testConnection } = useStripeConfig();
  const { stages } = useMarketingStages();

  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [hasStoredSecret, setHasStoredSecret] = useState(false);
  const [hasStoredWebhook, setHasStoredWebhook] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [depositEuros, setDepositEuros] = useState('');
  const [publicAppUrl, setPublicAppUrl] = useState('');
  const [confirmedStageId, setConfirmedStageId] = useState<string>(NONE_STAGE);
  const [successWhatsapp, setSuccessWhatsapp] = useState('');
  const [depositRequestWhatsapp, setDepositRequestWhatsapp] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!config) return;
    setPublishableKey(config.publishable_key ?? '');
    setHasStoredSecret(config.has_secret_key ?? false);
    setHasStoredWebhook(config.has_webhook_secret ?? false);
    setEnabled(config.enabled ?? false);
    setDepositEuros(centsToEurosInput(config.default_deposit_amount_cents));
    setPublicAppUrl(config.public_app_url ?? window.location.origin);
    setConfirmedStageId(config.confirmed_stage_id ?? NONE_STAGE);
    setSuccessWhatsapp(config.payment_success_whatsapp_message ?? '');
    setDepositRequestWhatsapp(
      config.deposit_request_whatsapp_message ?? DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE,
    );
  }, [config]);

  const webhookUrl = useMemo(() => {
    if (!SUPABASE_URL || !config?.company_id) return '';
    return `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/stripe-webhook?company_id=${config.company_id}`;
  }, [config?.company_id]);

  const handleSave = async () => {
    try {
      const saved = await upsertConfig.mutateAsync({
        publishable_key: publishableKey.trim() || null,
        enabled,
        default_deposit_amount_cents: eurosToCents(depositEuros),
        public_app_url: publicAppUrl.trim() || null,
        confirmed_stage_id:
          confirmedStageId === NONE_STAGE ? null : confirmedStageId,
        payment_success_whatsapp_message: successWhatsapp.trim() || null,
        deposit_request_whatsapp_message: depositRequestWhatsapp.trim() || null,
        ...(secretKey.trim() ? { secret_key: secretKey.trim() } : {}),
        ...(webhookSecret.trim() ? { webhook_secret: webhookSecret.trim() } : {}),
      });
      setSecretKey('');
      setWebhookSecret('');
      setHasStoredSecret(saved.has_secret_key);
      setHasStoredWebhook(saved.has_webhook_secret);
      toast({ title: 'Configuración Stripe guardada' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo guardar',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async () => {
    try {
      const res = await testConnection.mutateAsync();
      toast({
        title: 'Conexión con Stripe OK',
        description: res.account_id ? `Cuenta ${res.account_id}` : undefined,
      });
    } catch (e) {
      toast({
        title: 'Error de conexión',
        description: e instanceof Error ? e.message : 'Revisa las claves',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/10 p-2">
              <CreditCard className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle>Pagos Stripe · Señal de reserva</CardTitle>
              <CardDescription>
                Cobro online de la señal para confirmar la cita. Enlaza con WhatsApp
                automático usando {'{link_pago}'} y {'{importe_senal}'} en los mensajes Meta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Clave publicable (pk_…)</Label>
              <Input
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                placeholder="pk_live_… o pk_test_…"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave secreta (sk_…)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder={
                      hasStoredSecret
                        ? 'Guardada. Escribe una nueva solo si quieres cambiarla.'
                        : 'sk_live_…'
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowSecret((v) => !v)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Webhook signing secret (whsec_…)</Label>
              <div className="relative">
                <Input
                  type={showWebhook ? 'text' : 'password'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={
                    hasStoredWebhook
                      ? 'Guardado. Escribe uno nuevo solo si quieres cambiarlo.'
                      : 'whsec_…'
                  }
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowWebhook((v) => !v)}
                >
                  {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {webhookUrl ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-[11px]">
                    {webhookUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(webhookUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                En el panel de Stripe → Webhooks, escucha el evento{' '}
                <strong>checkout.session.completed</strong> con esta URL.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Importe señal por defecto (€)</Label>
              <Input
                inputMode="decimal"
                value={depositEuros}
                onChange={(e) => setDepositEuros(e.target.value)}
                placeholder="50"
              />
            </div>
            <div className="space-y-2">
              <Label>URL pública de la app</Label>
              <Input
                value={publicAppUrl}
                onChange={(e) => setPublicAppUrl(e.target.value)}
                placeholder="https://suite.tudominio.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Base para enlaces /pago/… que reciben los leads por WhatsApp.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Etapa tras pago confirmado</Label>
              <Select value={confirmedStageId} onValueChange={setConfirmedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto: primera etapa ganada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_STAGE}>Auto (etapa marcada como ganada)</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>WhatsApp tras pago (opcional)</Label>
              <Textarea
                value={successWhatsapp}
                onChange={(e) => setSuccessWhatsapp(e.target.value)}
                rows={3}
                placeholder="¡Gracias {nombre}! Hemos recibido tu señal de {importe_senal}. Tu cita queda confirmada."
              />
              <p className="text-[11px] text-muted-foreground">
                Variables:{' '}
                {WHATSAPP_MESSAGE_TEMPLATE_VARS.slice(0, 4)
                  .map((v) => `{${v.key}}`)
                  .join(', ')}
                …
              </p>
            </div>
            <div className="space-y-2 md:col-span-2 rounded-lg border border-emerald-200/80 bg-emerald-50/30 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
              <Label className="text-sm font-medium">Mensaje de cobro de señal (WhatsApp)</Label>
              <p className="text-[11px] text-muted-foreground">
                Lo envía el botón <strong>Cobro señal</strong> en cualquier chat individual. Incluye
                Bizum, transferencia, datos de tu banco y, si quieres, el enlace Stripe con{' '}
                <code>{'{link_pago}'}</code>. Si no usas Stripe, omite esa variable.
              </p>
              <Textarea
                value={depositRequestWhatsapp}
                onChange={(e) => setDepositRequestWhatsapp(e.target.value)}
                rows={8}
                className="text-xs font-mono"
                placeholder={DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE}
              />
              <p className="text-[11px] text-muted-foreground">
                Variables:{' '}
                {WHATSAPP_MESSAGE_TEMPLATE_VARS
                  .filter((v) =>
                    ['nombre', 'importe_senal', 'link_pago', 'telefono', 'oferta', 'formulario'].includes(
                      v.key,
                    ),
                  )
                  .map((v) => `{${v.key}}`)
                  .join(', ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <div>
                <p className="text-sm font-medium">Cobro de señal activo</p>
                <p className="text-[11px] text-muted-foreground">
                  Permite generar enlaces {`{link_pago}`} en automatizaciones WhatsApp.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
                {testConnection.isPending ? 'Probando…' : 'Probar conexión'}
              </Button>
              <Button onClick={handleSave} disabled={upsertConfig.isPending}>
                {upsertConfig.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeConfigPanel;
