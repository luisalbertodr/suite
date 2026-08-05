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
import { Eye, EyeOff, Landmark, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { centsToEurosInput, eurosToCents } from '@/hooks/useStripeConfig';
import { useRedsysConfig } from '@/hooks/useRedsysConfig';
import { useMarketingStages } from '@/hooks/useMarketingStages';
import { WHATSAPP_MESSAGE_TEMPLATE_VARS } from '@/lib/whatsappMessageTemplates';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const NONE_STAGE = '__none__';

export const RedsysConfigPanel: React.FC = () => {
  const { toast } = useToast();
  const { config, gatewayCompanyId, isLoading, upsertConfig, testConnection } = useRedsysConfig();
  const { stages } = useMarketingStages(gatewayCompanyId);

  const [merchantCode, setMerchantCode] = useState('');
  const [terminal, setTerminal] = useState('1');
  const [signatureKey, setSignatureKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [signatureVersion, setSignatureVersion] = useState<'HMAC_SHA512_V2' | 'HMAC_SHA256_V1'>(
    'HMAC_SHA512_V2',
  );
  const [environment, setEnvironment] = useState<'live' | 'test'>('live');
  const [enabled, setEnabled] = useState(false);
  const [bizumEnabled, setBizumEnabled] = useState(true);
  const [depositEuros, setDepositEuros] = useState('');
  const [publicAppUrl, setPublicAppUrl] = useState('');
  const [confirmedStageId, setConfirmedStageId] = useState<string>(NONE_STAGE);
  const [orphanedStageWarning, setOrphanedStageWarning] = useState<string | null>(null);
  const [successWhatsapp, setSuccessWhatsapp] = useState('');
  const [productDescription, setProductDescription] = useState('Señal reserva cita');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!config) return;
    setMerchantCode(config.merchant_code ?? '');
    setTerminal(config.terminal ?? '1');
    setHasStoredKey(config.has_signature_key ?? false);
    setSignatureVersion(config.signature_version ?? 'HMAC_SHA512_V2');
    setEnvironment(config.environment ?? 'live');
    setEnabled(config.enabled ?? false);
    setBizumEnabled(config.bizum_enabled ?? true);
    setDepositEuros(centsToEurosInput(config.default_deposit_amount_cents));
    setPublicAppUrl(config.public_app_url ?? window.location.origin);
    setSuccessWhatsapp(config.payment_success_whatsapp_message ?? '');
    setProductDescription(config.product_description ?? 'Señal reserva cita');

    const stageId = config.confirmed_stage_id;
    if (stageId && stages.length > 0 && !stages.some((s) => s.id === stageId)) {
      setConfirmedStageId(NONE_STAGE);
      setOrphanedStageWarning(
        'La etapa tras pago ya no existe (eliminada o recreada). Elige la etapa actual y guarda.',
      );
    } else {
      setConfirmedStageId(stageId ?? NONE_STAGE);
      setOrphanedStageWarning(null);
    }
  }, [config, stages]);

  const notificationUrl = useMemo(() => {
    if (!SUPABASE_URL || !config?.company_id) return '';
    return `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/redsys-notification?company_id=${config.company_id}`;
  }, [config?.company_id]);

  const handleSave = async () => {
    try {
      const saved = await upsertConfig.mutateAsync({
        merchant_code: merchantCode.trim() || null,
        terminal: terminal.trim() || '1',
        signature_version: signatureVersion,
        environment,
        enabled,
        bizum_enabled: bizumEnabled,
        default_deposit_amount_cents: eurosToCents(depositEuros),
        public_app_url: publicAppUrl.trim() || null,
        confirmed_stage_id:
          confirmedStageId === NONE_STAGE ? null : confirmedStageId,
        payment_success_whatsapp_message: successWhatsapp.trim() || null,
        product_description: productDescription.trim() || null,
        ...(signatureKey.trim() ? { signature_key: signatureKey.trim() } : {}),
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      setSignatureKey('');
      setApiKey('');
      setHasStoredKey(saved.has_signature_key);
      if (saved.merchant_code) setMerchantCode(saved.merchant_code);
      if (saved.terminal) setTerminal(saved.terminal);
      if (saved.signature_version) setSignatureVersion(saved.signature_version);
      if (saved.environment) setEnvironment(saved.environment);
      toast({ title: 'Configuración Redsys guardada' });
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
        title: 'Configuración Redsys OK',
        description: [
          res.merchant_code
            ? `Comercio ${res.merchant_code} · Terminal ${res.terminal} · ${res.environment}`
            : null,
          (res as { stage_warning?: string }).stage_warning,
        ]
          .filter(Boolean)
          .join(' — ') || undefined,
      });
    } catch (e) {
      toast({
        title: 'Error de configuración',
        description: e instanceof Error ? e.message : 'Revisa comercio y clave',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2">
              <Landmark className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <CardTitle>Pagos Redsys · Señal de reserva</CardTitle>
              <CardDescription>
                TPV Virtual (tarjeta y Bizum). En el centro M/E la config se guarda en
                Estética (hub), compartida con Medicina. Convive con Stripe: el enlace{' '}
                {'{link_pago}'} ofrece los métodos activos en la página pública.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-900 dark:bg-amber-950/20">
              <Label>API Key del portal (opcional)</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="PROD_… o TEST_… (rellena comercio, terminal y clave)"
              />
              <p className="text-[11px] text-muted-foreground">
                Si la pegas, se guardan comercio/terminal/clave y se usa firma{' '}
                <code>HMAC_SHA256_V1</code> (clave sha256 embebida). Alternativa: rellena
                los campos clásicos y usa la clave sha512 con{' '}
                <code>HMAC_SHA512_V2</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Código de comercio (FUC)</Label>
              <Input
                value={merchantCode}
                onChange={(e) => setMerchantCode(e.target.value)}
                placeholder="97295984"
              />
            </div>
            <div className="space-y-2">
              <Label>Terminal</Label>
              <Input
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Clave de firma</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={signatureKey}
                  onChange={(e) => setSignatureKey(e.target.value)}
                  placeholder={
                    hasStoredKey
                      ? 'Guardada. Escribe una nueva solo si quieres cambiarla.'
                      : 'Clave sha512 (V2) o sha256/base64 (V1)'
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
            <div className="space-y-2">
              <Label>Versión de firma</Label>
              <Select
                value={signatureVersion}
                onValueChange={(v) =>
                  setSignatureVersion(v as 'HMAC_SHA512_V2' | 'HMAC_SHA256_V1')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HMAC_SHA512_V2">HMAC_SHA512_V2 (clave 16 chars)</SelectItem>
                  <SelectItem value="HMAC_SHA256_V1">HMAC_SHA256_V1 (clásica)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entorno</Label>
              <Select
                value={environment}
                onValueChange={(v) => setEnvironment(v as 'live' | 'test')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Producción (sis.redsys.es)</SelectItem>
                  <SelectItem value="test">Pruebas (sis-t.redsys.es)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>URL de notificación (merchantUrl)</Label>
              {notificationUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-[11px]">
                    {notificationUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(notificationUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Guarda la configuración para generar la URL con tu company_id.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Configúrala en el portal Redsys / entidad. Es la fuente de verdad del pago
                (no uses solo la vuelta del navegador).
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
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Concepto en extracto / TPV</Label>
              <Input
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Señal reserva cita"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Etapa tras pago confirmado</Label>
              <Select
                value={confirmedStageId}
                onValueChange={(v) => {
                  setConfirmedStageId(v);
                  setOrphanedStageWarning(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto: primera etapa ganada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_STAGE}>Auto (etapa marcada como ganada)</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_won ? ' · ganada' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Se guarda por ID: si renombras la etapa en Marketing, sigue vinculada. Si la
                eliminas, elige otra y guarda.
              </p>
              {orphanedStageWarning ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  {orphanedStageWarning}
                </p>
              ) : null}
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <div>
                  <p className="text-sm font-medium">Redsys activo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Muestra tarjeta (y Bizum) en /pago/…
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={bizumEnabled} onCheckedChange={setBizumEnabled} />
                <div>
                  <p className="text-sm font-medium">Bizum</p>
                  <p className="text-[11px] text-muted-foreground">Requiere Bizum en el terminal</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
                {testConnection.isPending ? 'Comprobando…' : 'Comprobar config'}
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

export default RedsysConfigPanel;
