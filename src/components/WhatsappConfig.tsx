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
import { useWhatsappConfig, useWhatsappSessionLimits, type WhatsappConfigRow } from '@/hooks/useWhatsappConfig';
import { WhatsappSessionLimitsAlert } from '@/components/whatsapp/WhatsappSessionLimitsAlert';

type WhatsappProviderId = 'waha' | 'openwa' | 'meta';

type ProviderDraft = {
  baseUrl: string;
  sessionName: string;
};

function emptyDrafts(): Record<WhatsappProviderId, ProviderDraft> {
  return {
    waha: { baseUrl: '', sessionName: 'default' },
    openwa: { baseUrl: '', sessionName: 'default' },
    meta: { baseUrl: 'v21.0', sessionName: '' },
  };
}

function storedApiKeyForProvider(
  config: WhatsappConfigRow,
  p: WhatsappProviderId,
): string | null {
  if (p === 'openwa') {
    return config.openwa_api_key ?? (config.provider === 'openwa' ? config.api_key : null);
  }
  if (p === 'meta') {
    return config.meta_access_token ?? (config.provider === 'meta' ? config.api_key : null);
  }
  return config.waha_api_key ?? (config.provider === 'waha' || !config.provider ? config.api_key : null);
}

function draftsFromConfig(config: WhatsappConfigRow): Record<WhatsappProviderId, ProviderDraft> {
  const activeIsOpenwa = config.provider === 'openwa';
  const activeIsMeta = config.provider === 'meta';
  return {
    waha: {
      baseUrl:
        config.waha_base_url ?? (!activeIsOpenwa && !activeIsMeta ? config.base_url ?? '' : ''),
      sessionName:
        config.waha_session_name ??
        (!activeIsOpenwa && !activeIsMeta ? config.session_name ?? 'default' : 'default'),
    },
    openwa: {
      baseUrl:
        config.openwa_base_url ?? (activeIsOpenwa ? config.base_url ?? '' : ''),
      sessionName:
        config.openwa_session_name ??
        (activeIsOpenwa ? config.session_name ?? 'default' : 'default'),
    },
    meta: {
      baseUrl: config.meta_graph_version ?? 'v21.0',
      sessionName: config.meta_phone_number_id ?? (activeIsMeta ? config.session_name ?? '' : ''),
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
    metaValidate,
    metaConfigureWebhook,
    configureWebhook,
    ping,
    purgeHistory,
    purgeOpenwaHistory,
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
    meta: '',
  });
  const [hasStoredKeys, setHasStoredKeys] = useState<Record<WhatsappProviderId, boolean>>({
    waha: false,
    openwa: false,
    meta: false,
  });
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaVerifyToken, setMetaVerifyToken] = useState('');
  const [hasMetaAppSecret, setHasMetaAppSecret] = useState(false);
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
    config?.provider === 'openwa' ? 'openwa' : config?.provider === 'meta' ? 'meta' : 'waha';
  const needsSaveToActivate = provider !== activeProvider;
  const sessionLimitsQuery = useWhatsappSessionLimits(activeProvider === 'waha');

  useEffect(() => {
    if (!config) return;
    setDrafts(draftsFromConfig(config));
    setHasStoredKeys({
      waha: hasStoredKeyForProvider(config, 'waha'),
      openwa: hasStoredKeyForProvider(config, 'openwa'),
      meta: hasStoredKeyForProvider(config, 'meta'),
    });
    setApiKeyInputs({ waha: '', openwa: '', meta: '' });
    setProvider(
      config.provider === 'openwa' ? 'openwa' : config.provider === 'meta' ? 'meta' : 'waha',
    );
    setMetaWabaId(config.meta_waba_id ?? '');
    setMetaVerifyToken(config.meta_verify_token ?? '');
    setMetaAppSecret('');
    setHasMetaAppSecret(!!config.meta_app_secret);
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
    config?.meta_phone_number_id,
    config?.meta_graph_version,
    config?.meta_waba_id,
    config?.meta_verify_token,
    config?.meta_app_secret,
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
      const providerLabel =
        activeProvider === 'openwa'
          ? 'OpenWA'
          : activeProvider === 'meta'
            ? 'Meta Cloud API'
            : 'WAHA';
      toast({
        title:
          activeProvider === 'meta'
            ? 'Datos webhook Meta listos'
            : `Webhook aplicado en ${providerLabel}`,
        description:
          activeProvider === 'meta'
            ? (res as { webhook_url_with_company?: string; verify_token?: string; note?: string })
                .note ??
              `URL: ${(res as { webhook_url_with_company?: string }).webhook_url_with_company ?? ''} · verify: ${(res as { verify_token?: string }).verify_token ?? ''}`
            : `Eventos: ${res.events.join(', ')}`,
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
      const metaDraft = drafts.meta;
      const activeDraft = drafts[provider];
      const activeApiKey = apiKeyInputs[provider].trim();
      const activeBaseUrl =
        provider === 'meta'
          ? `https://graph.facebook.com/${(metaDraft.baseUrl || 'v21.0').trim()}`
          : activeDraft.baseUrl.trim() || null;
      const activeSession =
        provider === 'meta'
          ? metaDraft.sessionName.trim() || 'default'
          : activeDraft.sessionName.trim() || 'default';

      await upsertConfig.mutateAsync({
        provider,
        waha_base_url: wahaDraft.baseUrl.trim() || null,
        waha_session_name: wahaDraft.sessionName.trim() || 'default',
        openwa_base_url: openwaDraft.baseUrl.trim() || null,
        openwa_session_name: openwaDraft.sessionName.trim() || 'default',
        meta_phone_number_id: metaDraft.sessionName.trim() || null,
        meta_graph_version: metaDraft.baseUrl.trim() || 'v21.0',
        meta_waba_id: metaWabaId.trim() || null,
        meta_verify_token: metaVerifyToken.trim() || null,
        meta_linked: !!(
          metaDraft.sessionName.trim() &&
          (apiKeyInputs.meta.trim() || hasStoredKeys.meta || config?.meta_access_token || config?.meta_linked)
        ),
        base_url: activeBaseUrl,
        session_name: activeSession,
        webhook_secret: webhookSecret.trim() || null,
        default_country_code: defaultCountry.trim() || null,
        enabled,
        ...(apiKeyInputs.waha.trim() ? { waha_api_key: apiKeyInputs.waha.trim() } : {}),
        ...(apiKeyInputs.openwa.trim() ? { openwa_api_key: apiKeyInputs.openwa.trim() } : {}),
        ...(apiKeyInputs.meta.trim() ? { meta_access_token: apiKeyInputs.meta.trim() } : {}),
        ...(metaAppSecret.trim() ? { meta_app_secret: metaAppSecret.trim() } : {}),
        ...(activeApiKey ? { api_key: activeApiKey } : {}),
      });
      setApiKeyInputs({ waha: '', openwa: '', meta: '' });
      setMetaAppSecret('');
      setShowKey(false);
      setHasStoredKeys((prev) => ({
        waha: prev.waha || !!apiKeyInputs.waha.trim(),
        openwa: prev.openwa || !!apiKeyInputs.openwa.trim(),
        meta: prev.meta || !!apiKeyInputs.meta.trim(),
      }));
      if (metaAppSecret.trim()) setHasMetaAppSecret(true);
      toast({
        title: 'Configuración WhatsApp guardada',
        description:
          provider === 'meta'
            ? 'Meta es el motor exclusivo (sin QR). Para coexistencia elige WAHA y conserva Meta abajo.'
            : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const activateHybridWaha = async () => {
    try {
      const wahaDraft = drafts.waha;
      const base =
        wahaDraft.baseUrl.trim() ||
        config?.waha_base_url ||
        (config?.provider === 'waha' || !config?.provider ? config?.base_url : null);
      if (!base) {
        toast({
          title: 'Falta URL WAHA',
          description: 'Indica la URL base de WAHA y guarda, o rellénala antes de activar el híbrido.',
          variant: 'destructive',
        });
        setProvider('waha');
        return;
      }
      await upsertConfig.mutateAsync({
        provider: 'waha',
        waha_base_url: base,
        waha_session_name:
          wahaDraft.sessionName.trim() || config?.waha_session_name || 'default',
        base_url: base,
        session_name:
          wahaDraft.sessionName.trim() || config?.waha_session_name || 'default',
        meta_phone_number_id: drafts.meta.sessionName.trim() || config?.meta_phone_number_id || null,
        meta_graph_version: drafts.meta.baseUrl.trim() || config?.meta_graph_version || 'v21.0',
        meta_waba_id: metaWabaId.trim() || config?.meta_waba_id || null,
        meta_verify_token: metaVerifyToken.trim() || config?.meta_verify_token || null,
        meta_linked: true,
        ...(apiKeyInputs.waha.trim() ? { waha_api_key: apiKeyInputs.waha.trim() } : {}),
        ...(apiKeyInputs.meta.trim() ? { meta_access_token: apiKeyInputs.meta.trim() } : {}),
        ...(apiKeyInputs.waha.trim() ? { api_key: apiKeyInputs.waha.trim() } : {}),
      });
      setProvider('waha');
      toast({
        title: 'Modo híbrido activo',
        description:
          'Motor WAHA (QR) restaurado. Escanea el QR con WhatsApp Business. Credenciales Meta conservadas.',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo activar el híbrido',
        variant: 'destructive',
      });
    }
  };

  const handleClearKey = async () => {
    try {
      const keyField =
        provider === 'openwa' ? 'openwa_api_key' : provider === 'meta' ? 'meta_access_token' : 'waha_api_key';
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
                  Motor WAHA con QR para vincular WhatsApp Business en el móvil, y opcionalmente canal
                  oficial Meta Cloud API en coexistencia (mismo número). No elijas Meta como motor si
                  quieres seguir usando el QR.
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
          {activeProvider === 'waha' ? (
            <WhatsappSessionLimitsAlert limits={sessionLimitsQuery.data ?? null} />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Motor de mensajería</Label>
              <Select
                value={provider}
                onValueChange={(v) =>
                  setProvider(v === 'openwa' ? 'openwa' : v === 'meta' ? 'meta' : 'waha')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waha">WAHA (QR)</SelectItem>
                  <SelectItem value="openwa">OpenWA (QR)</SelectItem>
                  <SelectItem value="meta">Meta Cloud API (exclusivo, sin QR)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Híbrido recomendado: motor <strong>WAHA</strong> (QR de WhatsApp Business) + sección
                «Canal oficial Meta» abajo. Solo usa «Meta exclusivo» si no necesitas QR.
              </p>
              {activeProvider === 'meta' ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs space-y-2">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Meta está como motor exclusivo: Suite no muestra el QR de la app.
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    Meta permite coexistencia con dispositivos vinculados. Activa el híbrido para
                    volver a WAHA (QR WhatsApp Business) sin borrar las credenciales Cloud API.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={upsertConfig.isPending}
                    onClick={() => void activateHybridWaha()}
                  >
                    Activar híbrido WAHA + Meta
                  </Button>
                </div>
              ) : null}
              {config?.meta_linked && activeProvider !== 'meta' ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Canal Meta vinculado (coexistencia)
                </Badge>
              ) : null}
              {needsSaveToActivate ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Estás editando{' '}
                  {provider === 'openwa' ? 'OpenWA' : provider === 'meta' ? 'Meta Cloud API' : 'WAHA'}.
                  Guarda para activarlo (ahora en uso:{' '}
                  {activeProvider === 'openwa'
                    ? 'OpenWA'
                    : activeProvider === 'meta'
                      ? 'Meta Cloud API'
                      : 'WAHA'}
                  ).
                </p>
              ) : null}
            </div>

            {provider === 'meta' ? (
              <div className="space-y-2">
                <Label htmlFor="wa-base-url">Versión Graph API</Label>
                <Input
                  id="wa-base-url"
                  value={baseUrl}
                  onChange={(e) => updateDraft({ baseUrl: e.target.value })}
                  placeholder="v21.0"
                />
                <p className="text-[11px] text-muted-foreground">
                  P.ej. <code className="text-xs">v21.0</code>. Suite usa{' '}
                  <code className="text-xs">https://graph.facebook.com/&#123;versión&#125;</code>.
                </p>
              </div>
            ) : (
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
            )}

            <div className="space-y-2">
              <Label htmlFor="wa-api-key">
                {provider === 'meta' ? 'Access token (Bearer)' : 'API key (X-Api-Key)'}
              </Label>
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
                        : provider === 'meta'
                          ? 'Token permanente de System User / WhatsApp…'
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
              <Label htmlFor="wa-session">
                {provider === 'meta' ? 'Phone Number ID' : 'Nombre de sesión'}
              </Label>
              <Input
                id="wa-session"
                value={sessionName}
                onChange={(e) => updateDraft({ sessionName: e.target.value })}
                placeholder={provider === 'meta' ? '123456789012345' : 'default'}
              />
              <p className="text-[11px] text-muted-foreground">
                {provider === 'meta'
                  ? 'ID del número en Meta (WhatsApp → API Setup), no el E.164.'
                  : `Identificador de sesión en ${provider === 'openwa' ? 'OpenWA' : 'WAHA'} (se guarda por proveedor).`}
              </p>
            </div>

            {provider === 'meta' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wa-meta-waba">WABA ID (opcional)</Label>
                  <Input
                    id="wa-meta-waba"
                    value={metaWabaId}
                    onChange={(e) => setMetaWabaId(e.target.value)}
                    placeholder="WhatsApp Business Account ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-meta-app-secret">App Secret</Label>
                  <Input
                    id="wa-meta-app-secret"
                    type="password"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                    placeholder={
                      hasMetaAppSecret
                        ? 'Guardado. Déjalo en blanco para no cambiar.'
                        : 'Para validar X-Hub-Signature-256'
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="wa-meta-verify">Verify token (hub.verify_token)</Label>
                  <Input
                    id="wa-meta-verify"
                    value={metaVerifyToken}
                    onChange={(e) => setMetaVerifyToken(e.target.value)}
                    placeholder="Si vacío, Suite usará el secreto del webhook"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Callback URL en Meta:{' '}
                    <code className="text-xs break-all">
                      {((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(
                        /\/+$/,
                        '',
                      )}
                      /functions/v1/whatsapp-webhook?company_id=…
                    </code>
                  </p>
                </div>
              </>
            ) : (
              <div className="md:col-span-2 space-y-3 rounded-lg border border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3">
                <div>
                  <p className="text-sm font-medium">Canal oficial Meta (coexistencia con WAHA)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Guarda token y Phone Number ID sin cambiar el motor QR. El QR de WAHA se escanea
                    en WhatsApp Business → Dispositivos vinculados.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wa-meta-graph">Versión Graph API</Label>
                    <Input
                      id="wa-meta-graph"
                      value={drafts.meta.baseUrl}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          meta: { ...prev.meta, baseUrl: e.target.value },
                        }))
                      }
                      placeholder="v21.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-meta-phone">Phone Number ID</Label>
                    <Input
                      id="wa-meta-phone"
                      value={drafts.meta.sessionName}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          meta: { ...prev.meta, sessionName: e.target.value },
                        }))
                      }
                      placeholder="123456789012345"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="wa-meta-token">Access token (Bearer)</Label>
                    <Input
                      id="wa-meta-token"
                      type={showKey ? 'text' : 'password'}
                      value={apiKeyInputs.meta}
                      onChange={(e) =>
                        setApiKeyInputs((prev) => ({ ...prev, meta: e.target.value }))
                      }
                      placeholder={
                        hasStoredKeys.meta
                          ? `Guardado (${maskToken(config ? storedApiKeyForProvider(config, 'meta') : null)}). Déjalo en blanco para no cambiar.`
                          : 'Token permanente de System User / WhatsApp…'
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-meta-waba-h">WABA ID (opcional)</Label>
                    <Input
                      id="wa-meta-waba-h"
                      value={metaWabaId}
                      onChange={(e) => setMetaWabaId(e.target.value)}
                      placeholder="WhatsApp Business Account ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-meta-app-secret-h">App Secret</Label>
                    <Input
                      id="wa-meta-app-secret-h"
                      type="password"
                      value={metaAppSecret}
                      onChange={(e) => setMetaAppSecret(e.target.value)}
                      placeholder={
                        hasMetaAppSecret
                          ? 'Guardado. Déjalo en blanco para no cambiar.'
                          : 'Para validar X-Hub-Signature-256'
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="wa-meta-verify-h">Verify token (hub.verify_token)</Label>
                    <Input
                      id="wa-meta-verify-h"
                      value={metaVerifyToken}
                      onChange={(e) => setMetaVerifyToken(e.target.value)}
                      placeholder="Si vacío, Suite usará el secreto del webhook"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={metaValidate.isPending}
                    onClick={() =>
                      metaValidate.mutate(undefined, {
                        onSuccess: (res) =>
                          toast({
                            title: 'Meta Cloud API OK',
                            description:
                              res.note ??
                              [res.verified_name, res.display_phone_number].filter(Boolean).join(' · '),
                          }),
                        onError: (e) =>
                          toast({
                            title: 'Meta no válida',
                            description: e instanceof Error ? e.message : 'Error',
                            variant: 'destructive',
                          }),
                      })
                    }
                  >
                    {metaValidate.isPending ? 'Comprobando…' : 'Comprobar Meta'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={metaConfigureWebhook.isPending}
                    onClick={() =>
                      metaConfigureWebhook.mutate(undefined, {
                        onSuccess: (res) =>
                          toast({
                            title: 'Datos webhook Meta',
                            description:
                              res.note ??
                              `URL: ${res.webhook_url_with_company ?? ''} · verify: ${res.verify_token ?? ''}`,
                          }),
                        onError: (e) =>
                          toast({
                            title: 'Error',
                            description: e instanceof Error ? e.message : 'Error',
                            variant: 'destructive',
                          }),
                      })
                    }
                  >
                    {metaConfigureWebhook.isPending ? '…' : 'URL webhook Meta'}
                  </Button>
                </div>
              </div>
            )}

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
                {activeProvider === 'meta' ? (
                  <>
                    En Meta Developer → WhatsApp → Configuration: Callback URL ={' '}
                    <code className="text-xs">…/whatsapp-webhook?company_id=&#123;uuid&#125;</code>,
                    Verify token = el de abajo (o el secreto del webhook). Suscribe el WABA al campo{' '}
                    <code>messages</code>. El botón genera la URL y el token a copiar (Meta no se
                    configura por API desde Suite).
                  </>
                ) : activeProvider === 'openwa' ? (
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
                activeProvider === 'meta'
                  ? 'Muestra la Callback URL y verify token para Meta Developer'
                  : activeProvider === 'openwa'
                  ? 'Registra POST /api/sessions/{id}/webhooks en OpenWA'
                  : 'Configura automáticamente el webhook en WAHA con la URL + eventos correctos'
              }
            >
              <Webhook className="mr-2 h-3.5 w-3.5" />
              {configureWebhook.isPending
                ? 'Aplicando…'
                : activeProvider === 'meta'
                  ? 'Obtener datos webhook Meta'
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
                {activeProvider === 'meta'
                  ? 'Meta Cloud API exclusiva no usa QR. Activa el híbrido WAHA + Meta arriba para recuperar el QR de WhatsApp Business sin perder Cloud API.'
                  : 'Inicia la sesión WAHA y escanea el QR con WhatsApp Business en el móvil (Dispositivos vinculados).'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeProvider === 'waha' ? (
            <WhatsappSessionLimitsAlert limits={sessionLimitsQuery.data ?? null} />
          ) : null}
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
              {sessionStart.isPending
                ? 'Comprobando…'
                : activeProvider === 'meta'
                  ? 'Comprobar Meta Cloud API'
                  : 'Iniciar sesión'}
            </Button>
            <Button
              variant="outline"
              onClick={() => fetchQr.mutate()}
              disabled={fetchQr.isPending || activeProvider === 'meta'}
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
              disabled={purgeOpenwaHistory.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    '¿Borrar solo los mensajes guardados con OpenWA?\n\n' +
                      'Se conservará el historial sincronizado con WAHA. ' +
                      'Los chats sin mensajes restantes se eliminarán.\n\n' +
                      'Esta acción no se puede deshacer.',
                  )
                ) {
                  return;
                }
                purgeOpenwaHistory.mutate(undefined, {
                  onSuccess: (res) => {
                    toast({
                      title: 'Mensajes OpenWA eliminados',
                      description: `${res.messages_deleted} mensajes borrados. ${res.chats_removed} chats vacíos eliminados.`,
                    });
                  },
                  onError: (e) => {
                    toast({
                      title: 'Error',
                      description: e instanceof Error ? e.message : 'No se pudo limpiar OpenWA',
                      variant: 'destructive',
                    });
                  },
                });
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {purgeOpenwaHistory.isPending ? 'Limpiando OpenWA…' : 'Borrar mensajes OpenWA'}
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
            «Borrar mensajes OpenWA» quita solo el historial importado con OpenWA y mantiene WAHA.
            «Limpiar historial» borra todo antes de vincular un teléfono nuevo.
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
