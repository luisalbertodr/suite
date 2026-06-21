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
  Trash2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWhatsappConfig, type WhatsappConfigRow } from '@/hooks/useWhatsappConfig';

type WhatsappProviderId = 'waha' | 'openwa';

type ProviderDraft = {
  baseUrl: string;
  sessionName: string;
};

function emptyDrafts(): Record<WhatsappProviderId, ProviderDraft> {
  return {
    waha: { baseUrl: '', sessionName: 'default' },
    openwa: { baseUrl: '', sessionName: 'default' },
  };
}

function storedApiKeyForProvider(
  config: WhatsappConfigRow,
  p: WhatsappProviderId,
): string | null {
  if (p === 'openwa') {
    return config.openwa_api_key ?? (config.provider === 'openwa' ? config.api_key : null);
  }
  return config.waha_api_key ?? (config.provider !== 'openwa' ? config.api_key : null);
}

function draftsFromConfig(config: WhatsappConfigRow): Record<WhatsappProviderId, ProviderDraft> {
  const activeIsOpenwa = config.provider === 'openwa';
  return {
    waha: {
      baseUrl:
        config.waha_base_url ?? (!activeIsOpenwa ? config.base_url ?? '' : ''),
      sessionName:
        config.waha_session_name ??
        (!activeIsOpenwa ? config.session_name : null) ??
        'default',
    },
    openwa: {
      baseUrl:
        config.openwa_base_url ?? (activeIsOpenwa ? config.base_url ?? '' : ''),
      sessionName:
        config.openwa_session_name ??
        (activeIsOpenwa ? config.session_name : null) ??
        'default',
    },
  };
}

function hasStoredKeyForProvider(config: WhatsappConfigRow, p: WhatsappProviderId): boolean {
  return !!storedApiKeyForProvider(config, p);
}

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
    purgeHistory,
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

  const [provider, setProvider] = useState<WhatsappProviderId>('waha');
  const [drafts, setDrafts] = useState<Record<WhatsappProviderId, ProviderDraft>>(emptyDrafts);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<WhatsappProviderId, string>>({
    waha: '',
    openwa: '',
  });
  const [hasStoredKeys, setHasStoredKeys] = useState<Record<WhatsappProviderId, boolean>>({
    waha: false,
    openwa: false,
  });
  const [showKey, setShowKey] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [defaultCountry, setDefaultCountry] = useState('34');
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  const baseUrl = drafts[provider].baseUrl;
  const sessionName = drafts[provider].sessionName;
  const apiKey = apiKeyInputs[provider];
  const hasStoredKey = hasStoredKeys[provider];
  const activeProvider: WhatsappProviderId =
    config?.provider === 'openwa' ? 'openwa' : 'waha';
  const needsSaveToActivate = provider !== activeProvider;

  useEffect(() => {
    if (!config) return;
    setDrafts(draftsFromConfig(config));
    setHasStoredKeys({
      waha: hasStoredKeyForProvider(config, 'waha'),
      openwa: hasStoredKeyForProvider(config, 'openwa'),
    });
    setApiKeyInputs({ waha: '', openwa: '' });
    setProvider(config.provider === 'openwa' ? 'openwa' : 'waha');
    setWebhookSecret(config.webhook_secret ?? '');
    setDefaultCountry(config.default_country_code ?? '34');
    setEnabled(config.enabled ?? true);
  }, [
    config?.company_id,
    config?.provider,
    config?.waha_base_url,
    config?.waha_session_name,
    config?.openwa_base_url,
    config?.openwa_session_name,
    config?.base_url,
    config?.session_name,
    config?.webhook_secret,
    config?.default_country_code,
    config?.enabled,
    config?.waha_api_key,
    config?.openwa_api_key,
    config?.api_key,
  ]);

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
      const providerLabel = activeProvider === 'openwa' ? 'OpenWA' : 'WAHA';
      toast({
        title: `Webhook aplicado en ${providerLabel}`,
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

  const updateDraft = (patch: Partial<ProviderDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));
  };

  const handleSave = async () => {
    try {
      const wahaDraft = drafts.waha;
      const openwaDraft = drafts.openwa;
      const activeDraft = drafts[provider];
      const activeApiKey = apiKeyInputs[provider].trim();

      await upsertConfig.mutateAsync({
        provider,
        waha_base_url: wahaDraft.baseUrl.trim() || null,
        waha_session_name: wahaDraft.sessionName.trim() || 'default',
        openwa_base_url: openwaDraft.baseUrl.trim() || null,
        openwa_session_name: openwaDraft.sessionName.trim() || 'default',
        base_url: activeDraft.baseUrl.trim() || null,
        session_name: activeDraft.sessionName.trim() || 'default',
        webhook_secret: webhookSecret.trim() || null,
        default_country_code: defaultCountry.trim() || null,
        enabled,
        ...(apiKeyInputs.waha.trim() ? { waha_api_key: apiKeyInputs.waha.trim() } : {}),
        ...(apiKeyInputs.openwa.trim() ? { openwa_api_key: apiKeyInputs.openwa.trim() } : {}),
        ...(activeApiKey ? { api_key: activeApiKey } : {}),
      });
      setApiKeyInputs({ waha: '', openwa: '' });
      setShowKey(false);
      setHasStoredKeys((prev) => ({
        waha: prev.waha || !!apiKeyInputs.waha.trim(),
        openwa: prev.openwa || !!apiKeyInputs.openwa.trim(),
      }));
      toast({ title: 'Configuración WhatsApp guardada' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleClearKey = async () => {
    try {
      const keyField = provider === 'openwa' ? 'openwa_api_key' : 'waha_api_key';
      await upsertConfig.mutateAsync({
        [keyField]: null,
        ...(activeProvider === provider ? { api_key: null } : {}),
      });
      setApiKeyInputs((prev) => ({ ...prev, [provider]: '' }));
      setHasStoredKeys((prev) => ({ ...prev, [provider]: false }));
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
                <CardTitle>Integración con WhatsApp</CardTitle>
                <CardDescription>
                  Elige el motor API (WAHA o OpenWA), configura URL y API key, y vincula la cuenta
                  escaneando el QR. Los mensajes se persisten en Supabase vía webhook.
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
            <div className="space-y-2 md:col-span-2">
              <Label>Proveedor API</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v === 'openwa' ? 'openwa' : 'waha')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waha">WAHA (devlikeapro)</SelectItem>
                  <SelectItem value="openwa">OpenWA (open-wa.org)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                WAHA: URL típica <code className="text-xs">http://host:3333</code>. OpenWA:
                <code className="text-xs"> http://host:2785</code>. Cada proveedor guarda sus propios
                datos; al cambiar el selector no se pierden.
              </p>
              {needsSaveToActivate ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Estás editando {provider === 'openwa' ? 'OpenWA' : 'WAHA'}. Guarda para activarlo
                  (ahora en uso: {activeProvider === 'openwa' ? 'OpenWA' : 'WAHA'}).
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-base-url">URL base del servidor</Label>
              <Input
                id="wa-base-url"
                value={baseUrl}
                onChange={(e) => updateDraft({ baseUrl: e.target.value })}
                placeholder={
                  provider === 'openwa' ? 'http://192.168.1.10:2785' : 'https://waha.lipoout.com'
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Endpoint HTTP de tu instancia {provider === 'openwa' ? 'OpenWA' : 'WAHA'}.
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
                    onChange={(e) =>
                      setApiKeyInputs((prev) => ({ ...prev, [provider]: e.target.value }))
                    }
                    placeholder={
                      hasStoredKey
                        ? `Guardada (${maskToken(config ? storedApiKeyForProvider(config, provider) : null)}). Deja en blanco para no cambiar.`
                        : `Tu API key de ${provider === 'openwa' ? 'OpenWA' : 'WAHA'}…`
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
                onChange={(e) => updateDraft({ sessionName: e.target.value })}
                placeholder="default"
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador de sesión en {provider === 'openwa' ? 'OpenWA' : 'WAHA'} (se guarda por
                proveedor).
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
                {activeProvider === 'openwa' ? (
                  <>
                    Suite registra el webhook en OpenWA vía{' '}
                    <code className="text-xs">POST /api/sessions/&#123;id&#125;/webhooks</code>{' '}
                    (botón «Aplicar webhook»). OpenWA envía{' '}
                    <code>X-OpenWA-Signature</code> (HMAC) y el header{' '}
                    <code>X-Webhook-Secret</code>. En el contenedor OpenWA necesitas{' '}
                    <code>SSRF_ALLOWED_HOSTS=supabase.lipoout.com</code> o{' '}
                    <code>WEBHOOK_SSRF_PROTECT=false</code> para URLs internas.
                  </>
                ) : (
                  <>
                    Suite registra el webhook en WAHA vía{' '}
                    <code className="text-xs">PUT /api/sessions/&#123;sesión&#125;</code> (botón
                    «Aplicar webhook en Waha»). Eventos:{' '}
                    <code>message</code>, <code>message.any</code>, <code>message.ack</code>,{' '}
                    <code>session.status</code> y más. El header{' '}
                    <code>X-Webhook-Secret</code> valida el origen.
                  </>
                )}
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
                URL completa (con secret en query) — alternativa manual si no usas el botón
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
              title={
                activeProvider === 'openwa'
                  ? 'Registra POST /api/sessions/{id}/webhooks en OpenWA'
                  : 'Configura automáticamente el webhook en WAHA con la URL + eventos correctos'
              }
            >
              <Webhook className="mr-2 h-3.5 w-3.5" />
              {configureWebhook.isPending
                ? 'Aplicando…'
                : activeProvider === 'openwa'
                  ? 'Aplicar webhook en OpenWA'
                  : 'Aplicar webhook en WAHA'}
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
            <Button
              variant="destructive"
              className="border-destructive/50"
              disabled={purgeHistory.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    '¿Borrar todo el historial de WhatsApp guardado en la suite?\n\n' +
                      'Se eliminarán conversaciones y mensajes locales. ' +
                      'También se intentará cerrar la sesión en Waha antes de vincular el nuevo teléfono.\n\n' +
                      'Esta acción no se puede deshacer.',
                  )
                ) {
                  return;
                }
                purgeHistory.mutate(true, {
                  onSuccess: (res) => {
                    toast({
                      title: 'Historial eliminado',
                      description: `${res.messages_deleted} mensajes y ${res.chats_deleted} chats borrados.`,
                    });
                  },
                  onError: (e) => {
                    toast({
                      title: 'Error',
                      description: e instanceof Error ? e.message : 'No se pudo limpiar',
                      variant: 'destructive',
                    });
                  },
                });
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {purgeHistory.isPending ? 'Limpiando…' : 'Limpiar historial'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Usa «Limpiar historial» antes de escanear el QR con un teléfono nuevo para no mezclar conversaciones antiguas.
          </p>
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
