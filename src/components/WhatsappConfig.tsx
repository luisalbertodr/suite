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
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  EyeOff,
  RefreshCw,
  MessageCircle,
  Copy,
  CheckCircle2,
  Webhook,
  Power,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWhatsappConfig } from '@/hooks/useWhatsappConfig';

function maskToken(token: string | null | undefined): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function randomSecret(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

export const WhatsappConfig: React.FC = () => {
  const { toast } = useToast();
  const {
    config,
    isLoading,
    upsertConfig,
    sessionStatus,
    sessionStart,
    sessionStop,
    sessionLogout,
    fetchQr,
    configureWebhook,
    ping,
  } = useWhatsappConfig();

  const [pingResult, setPingResult] = useState<null | {
    base_url: string;
    session_name: string;
    public_ok: boolean;
    public_status?: number;
    public_error?: string;
    public_body_snippet?: string;
    auth_ok: boolean;
    auth_status?: number;
    auth_error?: string;
    auth_server?: string;
    auth_www_auth?: string;
    sessions?: Array<{ name?: string; status?: string }>;
    session_in_list?: boolean;
  }>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [sessionName, setSessionName] = useState('default');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [defaultCountry, setDefaultCountry] = useState('34');
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!config) return;
    setBaseUrl(config.base_url ?? '');
    setHasStoredKey(!!config.api_key);
    setSessionName(config.session_name || 'default');
    setWebhookSecret(config.webhook_secret ?? '');
    setDefaultCountry(config.default_country_code ?? '34');
    setEnabled(config.enabled ?? true);
  }, [config]);

  const webhookUrl = useMemo(() => {
    if (!SUPABASE_URL) return '';
    const cid = config?.company_id ?? '';
    const u = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/whatsapp-webhook`;
    return cid ? `${u}?company_id=${cid}` : u;
  }, [config?.company_id]);

  // URL completa con el secret incluido como query param (lista para pegar
  // directamente en Waha si no se usa el botón de configuración automática).
  const webhookUrlWithSecret = useMemo(() => {
    if (!webhookUrl || !webhookSecret) return '';
    const sep = webhookUrl.includes('?') ? '&' : '?';
    return `${webhookUrl}${sep}secret=${encodeURIComponent(webhookSecret)}`;
  }, [webhookUrl, webhookSecret]);

  const handleApplyWebhook = async () => {
    try {
      const res = await configureWebhook.mutateAsync(undefined);
      toast({
        title: 'Webhook aplicado en Waha',
        description: `Eventos: ${res.events.join(', ')}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo aplicar el webhook';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handlePing = async () => {
    setPingResult(null);
    try {
      const res = await ping.mutateAsync();
      setPingResult(res.diagnostics);
      if (res.diagnostics.auth_ok) {
        toast({
          title: 'Conexión con Waha OK',
          description: res.diagnostics.session_in_list
            ? `Sesión "${res.diagnostics.session_name}" encontrada.`
            : `La API key es correcta, pero NO existe la sesión "${res.diagnostics.session_name}". Crea esa sesión en Waha o ajusta el nombre.`,
          variant: res.diagnostics.session_in_list ? 'default' : 'destructive',
        });
      } else if (!res.diagnostics.public_ok) {
        toast({
          title: 'Waha inalcanzable',
          description: `No se pudo contactar con ${res.diagnostics.base_url}. Revisa la URL base.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'API key inválida',
          description:
            res.diagnostics.auth_error ??
            'Waha está vivo pero rechaza la X-Api-Key. Cópiala de los logs de arranque de Waha.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo probar la conexión';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const copyWebhookUrlWithSecret = async () => {
    if (!webhookUrlWithSecret) return;
    try {
      await navigator.clipboard.writeText(webhookUrlWithSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    try {
      await upsertConfig.mutateAsync({
        base_url: baseUrl.trim() || null,
        session_name: sessionName.trim() || 'default',
        webhook_secret: webhookSecret.trim() || null,
        default_country_code: defaultCountry.trim() || null,
        enabled,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      setApiKey('');
      setShowKey(false);
      setHasStoredKey((prev) => prev || !!apiKey.trim());
      toast({ title: 'Configuración WhatsApp guardada' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleClearKey = async () => {
    try {
      await upsertConfig.mutateAsync({ api_key: null });
      setApiKey('');
      setHasStoredKey(false);
      toast({ title: 'API key eliminada' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo borrar la clave';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleGenerateSecret = () => {
    setWebhookSecret(randomSecret());
  };

  const copyWebhookUrl = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const status = (config?.last_status ?? '').toUpperCase();
  const statusBadge = (() => {
    if (status === 'WORKING') {
      return (
        <Badge className="bg-emerald-500 text-white">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
        </Badge>
      );
    }
    if (status === 'SCAN_QR_CODE') {
      return <Badge className="bg-amber-500 text-white">Esperando QR</Badge>;
    }
    if (status === 'STARTING') {
      return <Badge className="bg-sky-500 text-white">Iniciando…</Badge>;
    }
    if (status === 'FAILED') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="outline">{config?.last_status ?? 'Sin iniciar'}</Badge>;
  })();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle>Integración con WhatsApp (Waha)</CardTitle>
                <CardDescription>
                  Configura los datos de tu instancia de Waha (URL base y API
                  key) y vincula la cuenta de WhatsApp escaneando el QR. Todos
                  los mensajes se persisten en Supabase y se reciben en tiempo
                  real vía webhook.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge}
              <Button
                variant="outline"
                size="sm"
                onClick={() => sessionStatus.mutate()}
                disabled={sessionStatus.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-3.5 w-3.5 ${sessionStatus.isPending ? 'animate-spin' : ''}`}
                />
                Refrescar estado
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePing}
                disabled={ping.isPending || !config?.base_url}
                title="Hace un diagnóstico paso a paso: conectividad + API key + sesión"
              >
                {ping.isPending ? 'Probando…' : 'Probar conexión'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-base-url">URL base de Waha</Label>
              <Input
                id="wa-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://waha.lipoout.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Endpoint HTTP de tu instancia de Waha self-hosted o cloud.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-api-key">API key (X-Api-Key)</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="wa-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      hasStoredKey
                        ? `Guardada (${maskToken(config?.api_key)}). Deja en blanco para no cambiar.`
                        : 'Tu API key de Waha…'
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowKey((v) => !v)}
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {hasStoredKey ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearKey}
                    disabled={upsertConfig.isPending}
                  >
                    Borrar
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-session">Nombre de sesión</Label>
              <Input
                id="wa-session"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="default"
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador de la sesión dentro de Waha. Una sesión por
                empresa (recomendado: el nombre/slug de tu empresa).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-country">Prefijo país por defecto</Label>
              <Input
                id="wa-country"
                value={defaultCountry}
                onChange={(e) => setDefaultCountry(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="34"
              />
              <p className="text-[11px] text-muted-foreground">
                Se antepone a los números cortos al iniciar chats nuevos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <div>
                <p className="text-sm font-medium">Integración activa</p>
                <p className="text-[11px] text-muted-foreground">
                  Desactívala para pausar el envío y la recepción de mensajes.
                </p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>

          {pingResult ? (
            <div className="space-y-1 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-sm font-semibold">Diagnóstico</p>
              <p>
                <strong>Conectividad (sin auth):</strong>{' '}
                {pingResult.public_ok
                  ? `OK (HTTP ${pingResult.public_status})`
                  : `FALLO${pingResult.public_status ? ` (HTTP ${pingResult.public_status})` : ''}${pingResult.public_error ? ` — ${pingResult.public_error}` : ''}`}
              </p>
              <p>
                <strong>API key (X-Api-Key):</strong>{' '}
                {pingResult.auth_ok
                  ? 'OK'
                  : `FALLO${pingResult.auth_status ? ` (HTTP ${pingResult.auth_status})` : ''} — ${pingResult.auth_error ?? 'sin detalle'}`}
              </p>
              {pingResult.auth_server ? (
                <p className="text-muted-foreground">
                  Server: <code>{pingResult.auth_server}</code>
                </p>
              ) : null}
              {pingResult.auth_www_auth ? (
                <p className="text-muted-foreground">
                  WWW-Authenticate: <code>{pingResult.auth_www_auth}</code>
                </p>
              ) : null}
              {pingResult.auth_ok ? (
                <p>
                  <strong>Sesión "{pingResult.session_name}":</strong>{' '}
                  {pingResult.session_in_list ? (
                    <span className="text-emerald-600">existe en Waha</span>
                  ) : (
                    <span className="text-red-600">
                      NO existe en Waha. Sesiones disponibles:{' '}
                      {(pingResult.sessions ?? [])
                        .map((s) => `${s.name}(${s.status ?? '?'})`)
                        .join(', ') || '(ninguna)'}
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-500/10 p-2">
              <Webhook className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <CardTitle>Webhook para recibir mensajes</CardTitle>
              <CardDescription>
                Configura este endpoint dentro de Waha para que nos notifique
                los mensajes entrantes y los cambios de estado en tiempo real.
                Eventos recomendados: <code>message</code>, <code>message.any</code>,{' '}
                <code>message.ack</code>, <code>state.change</code>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>URL del webhook (base)</Label>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={copyWebhookUrl}
                disabled={!webhookUrl}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wa-webhook-secret">
              Secreto (header <code>X-Webhook-Secret</code>)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="wa-webhook-secret"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Genera un valor aleatorio largo"
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleGenerateSecret}>
                Generar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Lo usamos para verificar que los eventos vienen de tu Waha. Si
              está vacío, el webhook rechazará todas las peticiones.
            </p>
          </div>

          {webhookUrlWithSecret ? (
            <div className="grid gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Label className="text-xs">
                URL completa (con secret incluido como query) — pégala en Waha
                si configuras el webhook manualmente
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={webhookUrlWithSecret}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWebhookUrlWithSecret}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={handleSave} disabled={upsertConfig.isPending}>
              Guardar secreto y URL
            </Button>
            <Button
              variant="default"
              onClick={handleApplyWebhook}
              disabled={
                configureWebhook.isPending ||
                !config?.base_url ||
                !webhookSecret
              }
              title="Configura automáticamente el webhook en Waha con la URL + eventos correctos"
            >
              <Webhook className="mr-2 h-3.5 w-3.5" />
              {configureWebhook.isPending
                ? 'Aplicando…'
                : 'Aplicar webhook en Waha'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2">
              <Power className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Sesión de WhatsApp</CardTitle>
              <CardDescription>
                Controla la sesión que Waha mantiene con WhatsApp. Aquí puedes
                iniciarla, detenerla o desvincular el teléfono.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">
              Estado: {config?.last_status ?? 'Sin iniciar'}
            </p>
            {config?.me_jid ? (
              <p className="text-xs text-muted-foreground">
                Cuenta vinculada: {config.me_pushname ?? '—'} ({config.me_jid})
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => sessionStart.mutate()}
              disabled={sessionStart.isPending}
            >
              {sessionStart.isPending ? 'Iniciando…' : 'Iniciar sesión'}
            </Button>
            <Button
              variant="outline"
              onClick={() => fetchQr.mutate()}
              disabled={fetchQr.isPending}
            >
              {fetchQr.isPending ? 'Pidiendo QR…' : 'Refrescar QR'}
            </Button>
            <Button
              variant="outline"
              onClick={() => sessionStop.mutate()}
              disabled={sessionStop.isPending}
            >
              Detener
            </Button>
            <Button
              variant="destructive"
              onClick={() => sessionLogout.mutate()}
              disabled={sessionLogout.isPending}
            >
              Cerrar sesión
            </Button>
          </div>
          {config?.qr_data_url ? (
            <div className="flex justify-center pt-2">
              <img
                src={config.qr_data_url}
                alt="QR Waha"
                className="h-48 w-48 rounded-lg border bg-white p-2"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsappConfig;
