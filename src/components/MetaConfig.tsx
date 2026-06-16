import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Eye,
  EyeOff,
  PlusCircle,
  RefreshCw,
  Trash2,
  Upload,
  Facebook,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ListFilter,
  ListChecks,
  RotateCcw,
  MessageSquare,
  CreditCard,
  Settings2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useMetaConfig,
  type MetaFormRow,
  type MetaSyncFormResult,
  META_FULL_RESYNC_CONFIRM,
  formatMetaSyncErrorsSummary,
  stripMetaSyncDetailFromSummary,
  extractMetaSyncDetailFromMessage,
} from '@/hooks/useMetaConfig';
import { useMarketingStages } from '@/hooks/useMarketingStages';
import { findMarketingIntakeStage } from '@/lib/marketingIntakeStage';
import { MarketingImportDialog } from './marketing/MarketingImportDialog';
import { MarketingFieldsConfigDialog } from './marketing/MarketingFieldsConfigDialog';
import { MarketingStagesManager } from './marketing/MarketingStagesManager';
import { WHATSAPP_MESSAGE_TEMPLATE_VARS } from '@/lib/whatsappMessageTemplates';
import { centsToEurosInput, eurosToCents } from '@/hooks/useStripeConfig';

const NONE_STAGE_VALUE = '__none__';

const INTERVAL_PRESETS: Array<{ value: number; label: string }> = [
  { value: 5, label: 'Cada 5 minutos' },
  { value: 10, label: 'Cada 10 minutos' },
  { value: 15, label: 'Cada 15 minutos' },
  { value: 30, label: 'Cada 30 minutos' },
  { value: 60, label: 'Cada hora' },
  { value: 120, label: 'Cada 2 horas' },
  { value: 240, label: 'Cada 4 horas' },
  { value: 720, label: 'Cada 12 horas' },
  { value: 1440, label: 'Cada 24 horas' },
];

const maskToken = (token: string | null | undefined): string => {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
};

const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return 'nunca';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'desconocido';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'hace unos segundos';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
};

function saveFormWhatsappField(
  form: MetaFormRow,
  field:
    | 'whatsapp_initial_message'
    | 'whatsapp_reply_1_message'
    | 'whatsapp_reply_2_message'
    | 'whatsapp_reply_invalid_message'
    | 'whatsapp_reminder_message',
  value: string,
  updateForm: ReturnType<typeof useMetaConfig>['updateForm'],
) {
  const next = value.trim() || null;
  if (next === (form[field] ?? null)) return;
  updateForm.mutate({ id: form.id, values: { [field]: next } });
}

function saveFormWhatsappDelay(
  form: MetaFormRow,
  value: string,
  updateForm: ReturnType<typeof useMetaConfig>['updateForm'],
) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 72) return;
  if (parsed === (form.whatsapp_reminder_delay_hours ?? 3)) return;
  updateForm.mutate({
    id: form.id,
    values: { whatsapp_reminder_delay_hours: parsed },
  });
}

export const MetaConfig: React.FC = () => {
  const { toast } = useToast();
  const {
    config,
    forms,
    isLoading,
    upsertConfig,
    createForm,
    updateForm,
    deleteForm,
    syncNow,
  } = useMetaConfig();
  const { stages } = useMarketingStages();

  const [businessId, setBusinessId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [syncInterval, setSyncInterval] = useState<number>(60);
  const [enabled, setEnabled] = useState(true);
  const [apiVersion, setApiVersion] = useState('v23.0');
  const [pixelId, setPixelId] = useState('');
  const [conversionsEnabled, setConversionsEnabled] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [n8nWebhookSecret, setN8nWebhookSecret] = useState('');
  const [hasStoredN8nSecret, setHasStoredN8nSecret] = useState(false);
  const [conversionsTestCode, setConversionsTestCode] = useState('');

  const [openImport, setOpenImport] = useState(false);
  const [openFieldsConfig, setOpenFieldsConfig] = useState(false);
  const [openStagesManager, setOpenStagesManager] = useState(false);
  const [fullResyncOpen, setFullResyncOpen] = useState(false);
  const [fullResyncAck, setFullResyncAck] = useState(false);
  /** Última respuesta de sync en esta sesión (lista por formulario). */
  const [lastSyncResults, setLastSyncResults] = useState<MetaSyncFormResult[] | null>(null);
  const prevCompanyId = useRef<string | undefined>(undefined);
  const [newFormId, setNewFormId] = useState('');
  const [newFormName, setNewFormName] = useState('');
  const [newCreatesAppt, setNewCreatesAppt] = useState(false);

  useEffect(() => {
    if (!config) return;
    const cid = config.company_id;
    if (
      prevCompanyId.current !== undefined &&
      prevCompanyId.current !== cid
    ) {
      setLastSyncResults(null);
    }
    prevCompanyId.current = cid;

    setBusinessId(config.business_id ?? '');
    setHasStoredToken(!!config.access_token);
    setSyncInterval(config.sync_interval_minutes ?? 60);
    setEnabled(config.enabled ?? true);
    setApiVersion(config.graph_api_version ?? 'v23.0');
    setPixelId(config.pixel_id ?? '');
    setConversionsEnabled(config.conversions_enabled ?? false);
    setN8nWebhookUrl(config.n8n_webhook_url ?? '');
    setHasStoredN8nSecret(!!config.n8n_webhook_secret);
    setN8nWebhookSecret('');
    setConversionsTestCode(config.conversions_test_event_code ?? '');
  }, [config]);

  const intakeStage = useMemo(() => findMarketingIntakeStage(stages), [stages]);

  const appointmentStage = useMemo(
    () =>
      stages.find((s) =>
        s.name.toLowerCase().replace(/\s+/g, ' ').includes('formulario+agenda ficticia') ||
        s.name.toLowerCase().replace(/\s+/g, ' ').includes('formulario + agenda ficticia'),
      ) ?? null,
    [stages],
  );

  const persistedSyncDetail = extractMetaSyncDetailFromMessage(
    config?.last_sync_message,
  );
  const configSyncSummaryLine =
    stripMetaSyncDetailFromSummary(config?.last_sync_message) ??
    config?.last_sync_message;
  const structuredFromLastRun = useMemo(
    () => lastSyncResults?.filter((r) => r.message || r.errors > 0) ?? [],
    [lastSyncResults],
  );
  const showSyncErrorPanel =
    structuredFromLastRun.length > 0 ||
    (!!persistedSyncDetail &&
      (config?.last_sync_status === 'error' ||
        config?.last_sync_status === 'partial'));

  const metaSyncErrorTextCombined = useMemo(() => {
    const bits = structuredFromLastRun
      .map((r) => r.message ?? '')
      .filter((s) => s.length > 0);
    if (persistedSyncDetail) bits.push(persistedSyncDetail);
    return bits.join(' ');
  }, [structuredFromLastRun, persistedSyncDetail]);

  /** Respuesta típica de Graph API cuando el token de usuario ya no es válido. */
  const showMetaInvalidUserSessionHint = useMemo(() => {
    const t = metaSyncErrorTextCombined.toLowerCase();
    return (
      t.includes('session is invalid') || t.includes('user logged out')
    );
  }, [metaSyncErrorTextCombined]);

  const handleSaveGeneral = async () => {
    try {
      await upsertConfig.mutateAsync({
        business_id: businessId.trim() || null,
        graph_api_version: apiVersion.trim() || 'v23.0',
        sync_interval_minutes: Math.max(5, Number(syncInterval) || 60),
        enabled,
        pixel_id: pixelId.trim() || null,
        conversions_enabled: conversionsEnabled,
        n8n_webhook_url: n8nWebhookUrl.trim() || null,
        conversions_test_event_code: conversionsTestCode.trim() || null,
        ...(n8nWebhookSecret.trim()
          ? { n8n_webhook_secret: n8nWebhookSecret.trim() }
          : {}),
        ...(accessToken.trim()
          ? { access_token: accessToken.trim() }
          : {}),
      });
      setAccessToken('');
      setN8nWebhookSecret('');
      setShowToken(false);
      setHasStoredToken(true);
      setHasStoredN8nSecret(true);
      toast({ title: 'Configuración Meta guardada' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleClearToken = async () => {
    try {
      await upsertConfig.mutateAsync({ access_token: null });
      setAccessToken('');
      setHasStoredToken(false);
      toast({ title: 'Token borrado' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo borrar el token';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleAddForm = async () => {
    const id = newFormId.trim();
    if (!id) {
      toast({ title: 'Indica el ID del formulario', variant: 'destructive' });
      return;
    }
    try {
      await createForm.mutateAsync({
        form_id: id,
        form_name: newFormName.trim() || null,
        creates_appointment: newCreatesAppt,
        enabled: true,
        default_stage_id: null,
        appointment_stage_id: null,
      });
      setNewFormId('');
      setNewFormName('');
      setNewCreatesAppt(false);
      toast({ title: 'Formulario añadido' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo añadir el formulario';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleFullMetaResync = async () => {
    try {
      const result = await syncNow.mutateAsync({
        force: true,
        full_meta_resync: true,
        confirm_full_meta_resync: META_FULL_RESYNC_CONFIRM,
      });
      setLastSyncResults(result.results);
      const del = result.deleted_meta_leads ?? 0;
      if (result.errors > 0) {
        toast({
          title: 'Resincronización Meta con errores',
          description: `${formatMetaSyncErrorsSummary(result)} · Reinsertados ${result.inserted} · eliminados ${del} anteriores.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Resincronización Meta completada',
          description: `Eliminados ${del} leads Meta previos (y sus notas). Reinsertados ${result.inserted} desde Meta.`,
        });
      }
      setFullResyncOpen(false);
      setFullResyncAck(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error en resincronización';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleSyncNow = async (formId?: string) => {
    try {
      const result = await syncNow.mutateAsync(
        formId ? { form_ids: [formId] } : undefined,
      );
      setLastSyncResults(result.results);
      if (result.errors > 0) {
        toast({
          title: 'Sincronización Meta con errores',
          description: formatMetaSyncErrorsSummary(result),
          variant: 'destructive',
        });
      } else {
        const summary = result.results
          .map(
            (r: MetaSyncFormResult) =>
              `${r.form_name ?? r.form_id}: ${r.inserted} nuevos`,
          )
          .join(' · ');
        toast({
          title: 'Sincronización Meta',
          description:
            summary ||
            `${result.inserted} nuevos · ${result.skipped} ya existían`,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error en sincronización';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const renderFormCard = (form: MetaFormRow) => {
    const statusBadge = (() => {
      if (!form.last_sync_status) {
        return (
          <Badge variant="outline" className="gap-1 text-[10px]">
            Sin sincronizar
          </Badge>
        );
      }
      if (form.last_sync_status === 'ok') {
        return (
          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> OK
          </Badge>
        );
      }
      if (form.last_sync_status === 'partial') {
        return (
          <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Parcial
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="gap-1 border-rose-200 bg-rose-50 text-[10px] text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          <XCircle className="h-3 w-3" /> Error
        </Badge>
      );
    })();

    return (
      <div
        key={form.id}
        className="rounded-xl border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {form.form_name || `Formulario ${form.form_id}`}
              </p>
              {form.creates_appointment ? (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CalendarCheck className="h-3 w-3" /> Con reservas Meta
                </Badge>
              ) : null}
              {!form.enabled ? (
                <Badge variant="outline" className="text-[10px]">
                  Deshabilitado
                </Badge>
              ) : null}
              {statusBadge}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">{form.form_id}</p>
            <p className="text-[11px] text-muted-foreground">
              Última sync: {formatRelative(form.last_sync_at)}
              {form.last_sync_message ? ` · ${form.last_sync_message}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSyncNow(form.form_id)}
              disabled={syncNow.isPending}
              title="Sincronizar sólo este formulario"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncNow.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
              onClick={() => deleteForm.mutate(form.id)}
              disabled={deleteForm.isPending}
              title="Eliminar formulario"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Nombre descriptivo</Label>
            <Input
              value={form.form_name ?? ''}
              onChange={(e) =>
                updateForm.mutate({
                  id: form.id,
                  values: { form_name: e.target.value.trim() || null },
                })
              }
              placeholder="Campaña primavera 2026"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Etapa por defecto</Label>
            <Select
              value={form.default_stage_id ?? NONE_STAGE_VALUE}
              onValueChange={(v) =>
                updateForm.mutate({
                  id: form.id,
                  values: { default_stage_id: v === NONE_STAGE_VALUE ? null : v },
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Nuevo Formulario (por defecto)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_STAGE_VALUE}>
                  Auto: {intakeStage?.name ?? 'Nuevo Formulario'}
                </SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Etapa si el lead agendó cita</Label>
            <Select
              value={form.appointment_stage_id ?? NONE_STAGE_VALUE}
              onValueChange={(v) =>
                updateForm.mutate({
                  id: form.id,
                  values: { appointment_stage_id: v === NONE_STAGE_VALUE ? null : v },
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Formulario+Agenda ficticia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_STAGE_VALUE}>
                  Auto: {appointmentStage?.name ?? 'Formulario+Agenda ficticia'}
                </SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-xs font-medium">Formulario con reservas en Meta</p>
              <p className="text-[11px] text-muted-foreground">
                Actívalo si el formulario usa reservas o instant booking en Meta. Además de
                detectar fechas por el nombre de la pregunta, se revisan todos los valores
                del lead por si el slot viene en un campo genérico. Sin esto, sólo se usa la
                heurística por etiquetas de pregunta.
              </p>
            </div>
            <Switch
              checked={form.creates_appointment}
              onCheckedChange={(v) =>
                updateForm.mutate({
                  id: form.id,
                  values: { creates_appointment: v },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-xs font-medium">Sincronización activa</p>
              <p className="text-[11px] text-muted-foreground">
                Desactívalo para pausar este formulario.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) =>
                updateForm.mutate({ id: form.id, values: { enabled: v } })
              }
            />
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium">WhatsApp automático</p>
                <p className="text-[11px] text-muted-foreground">
                  Al sincronizar un lead nuevo se envía el mensaje 1 (bienvenida). Si no responde,
                  el mensaje 2 (recordatorio) sale tras las horas configuradas. Para el histórico sin
                  WhatsApp, usa <strong>Marketing → Cola</strong> (envío gradual). Incluye{' '}
                  <code>{'{link_pago}'}</code> si activas señal Stripe. Respuestas 1/2 opcionales;
                  si no las configuras, cualquier respuesta del lead pasa a gestión humana.
                </p>
              </div>
            </div>
            <Switch
              checked={form.whatsapp_automation_enabled ?? false}
              onCheckedChange={(v) =>
                updateForm.mutate({
                  id: form.id,
                  values: { whatsapp_automation_enabled: v },
                })
              }
            />
          </div>

          {form.whatsapp_automation_enabled ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2 rounded-lg border bg-white/60 p-3 dark:bg-zinc-950/40">
                <p className="text-[11px] font-medium text-foreground">Variables disponibles</p>
                <p className="text-[10px] text-muted-foreground">
                  Escríbelas entre llaves en cualquier mensaje. Si un dato no existe, se deja vacío.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WHATSAPP_MESSAGE_TEMPLATE_VARS.map((v) => (
                    <span
                      key={v.key}
                      title={v.description}
                      className="cursor-help rounded bg-emerald-100/80 px-1.5 py-0.5 font-mono text-[10px] text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                      {`{${v.key}}`}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px]">
                  Mensaje 1 · Bienvenida (al recibir el lead)
                </Label>
                <Textarea
                  key={`${form.id}-initial-${form.whatsapp_initial_message ?? ''}`}
                  defaultValue={form.whatsapp_initial_message ?? ''}
                  rows={6}
                  className="text-xs"
                  placeholder="Hola {nombre}… Usa {respuesta_zona} para personalizar según el formulario."
                  onBlur={(e) =>
                    saveFormWhatsappField(
                      form,
                      'whatsapp_initial_message',
                      e.target.value,
                      updateForm,
                    )
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px]">
                  Mensaje 2 · Recordatorio si no responde
                </Label>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground shrink-0">
                    Enviar tras
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    className="h-7 w-16 text-xs"
                    defaultValue={form.whatsapp_reminder_delay_hours ?? 3}
                    onBlur={(e) => saveFormWhatsappDelay(form, e.target.value, updateForm)}
                  />
                  <span className="text-[10px] text-muted-foreground">horas sin respuesta</span>
                </div>
                <Textarea
                  key={`${form.id}-reminder-${form.whatsapp_reminder_message ?? ''}`}
                  defaultValue={form.whatsapp_reminder_message ?? ''}
                  rows={5}
                  className="text-xs"
                  placeholder="¡Hola de nuevo, {nombre}!… {propuesta_dia_1} / {propuesta_dia_2}"
                  onBlur={(e) =>
                    saveFormWhatsappField(
                      form,
                      'whatsapp_reminder_message',
                      e.target.value,
                      updateForm,
                    )
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2 rounded-md border border-dashed p-2">
                <p className="text-[10px] text-muted-foreground">
                  Opcional: flujo con respuesta automática 1/2 (si el lead escribe «1» o «2»).
                  Si no configuras estas respuestas, cualquier mensaje del lead cierra la
                  automatización y la conversación pasa a gestión humana.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Respuesta automática si eligen 1 (opcional)</Label>
                <Textarea
                  key={`${form.id}-r1-${form.whatsapp_reply_1_message ?? ''}`}
                  defaultValue={form.whatsapp_reply_1_message ?? ''}
                  rows={3}
                  className="text-xs"
                  placeholder="Perfecto {nombre}. Sobre {oferta} te contamos que…"
                  onBlur={(e) =>
                    saveFormWhatsappField(
                      form,
                      'whatsapp_reply_1_message',
                      e.target.value,
                      updateForm,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Respuesta automática si eligen 2 (opcional)</Label>
                <Textarea
                  key={`${form.id}-r2-${form.whatsapp_reply_2_message ?? ''}`}
                  defaultValue={form.whatsapp_reply_2_message ?? ''}
                  rows={3}
                  className="text-xs"
                  placeholder="Entendido {nombre}. Para {formulario} la opción 2 implica…"
                  onBlur={(e) =>
                    saveFormWhatsappField(
                      form,
                      'whatsapp_reply_2_message',
                      e.target.value,
                      updateForm,
                    )
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px]">
                  Respuesta si no es 1 ni 2 (opcional)
                </Label>
                <Textarea
                  key={`${form.id}-inv-${form.whatsapp_reply_invalid_message ?? ''}`}
                  defaultValue={form.whatsapp_reply_invalid_message ?? ''}
                  rows={2}
                  className="text-xs"
                  placeholder="Por favor, responde solo con 1 o 2."
                  onBlur={(e) =>
                    saveFormWhatsappField(
                      form,
                      'whatsapp_reply_invalid_message',
                      e.target.value,
                      updateForm,
                    )
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 text-violet-600" />
              <div>
                <p className="text-xs font-medium">Señal Stripe en este formulario</p>
                <p className="text-[10px] text-muted-foreground">
                  Incluye {'{link_pago}'} y {'{importe_senal}'} en los mensajes WhatsApp. Requiere
                  Stripe activo en Configuración → Stripe.
                </p>
              </div>
            </div>
            <Switch
              checked={form.stripe_deposit_enabled ?? false}
              onCheckedChange={(v) =>
                updateForm.mutate({
                  id: form.id,
                  values: { stripe_deposit_enabled: v },
                })
              }
            />
          </div>
          {form.stripe_deposit_enabled ? (
            <div className="space-y-1 max-w-xs">
              <Label className="text-[11px]">Importe señal (€) — vacío = default global</Label>
              <Input
                key={`${form.id}-stripe-${form.stripe_deposit_amount_cents ?? ''}`}
                inputMode="decimal"
                defaultValue={centsToEurosInput(form.stripe_deposit_amount_cents)}
                className="text-xs"
                placeholder="50"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  updateForm.mutate({
                    id: form.id,
                    values: {
                      stripe_deposit_amount_cents: raw
                        ? eurosToCents(raw)
                        : null,
                    },
                  });
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-500/10 p-2">
                <Settings2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <CardTitle>Estructura de Marketing</CardTitle>
                <CardDescription>
                  Configura los campos visibles de las tarjetas y las etapas del embudo.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpenFieldsConfig(true)}>
                <ListFilter className="mr-2 h-3.5 w-3.5" /> Campos
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpenStagesManager(true)}>
                <Settings2 className="mr-2 h-3.5 w-3.5" /> Etapas
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sky-500/10 p-2">
                <Facebook className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <CardTitle>Integración con Meta</CardTitle>
                <CardDescription>
                  Consulta automáticamente los formularios de Lead Ads de Facebook /
                  Instagram y cárgalos en el embudo de Marketing.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenImport(true)}
              >
                <Upload className="mr-2 h-3.5 w-3.5" /> Importar leads (JSON/CSV)
              </Button>
              <Button
                size="sm"
                onClick={() => handleSyncNow()}
                disabled={syncNow.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-3.5 w-3.5 ${syncNow.isPending ? 'animate-spin' : ''}`}
                />
                {syncNow.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={() => setFullResyncOpen(true)}
                disabled={syncNow.isPending || forms.length === 0}
                title="Borra todos los leads Meta de esta empresa y los vuelve a descargar desde la API"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Resincronización completa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meta-business-id">Business ID</Label>
              <Input
                id="meta-business-id"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="578436115928021"
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador del Business Manager dueño de los formularios.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-access-token">Access Token</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="meta-access-token"
                    type={showToken ? 'text' : 'password'}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={
                      hasStoredToken
                        ? `Guardado (${maskToken(config?.access_token)}). Deja en blanco para no cambiar.`
                        : 'EAAxxxxxxxx…'
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowToken((v) => !v)}
                    tabIndex={-1}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {hasStoredToken ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearToken}
                    disabled={upsertConfig.isPending}
                  >
                    Borrar
                  </Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se almacena cifrado por las políticas RLS y nunca se expone en el
                frontend después de guardarlo.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Intervalo de sincronización</Label>
              <Select
                value={String(syncInterval)}
                onValueChange={(v) => setSyncInterval(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Cuando alguien abra Marketing y haya pasado este tiempo desde la
                última sync, se lanzará automáticamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Versión Graph API</Label>
              <Input
                value={apiVersion}
                onChange={(e) => setApiVersion(e.target.value)}
                placeholder="v23.0"
              />
              <p className="text-[11px] text-muted-foreground">
                Cambiar sólo si necesitas fijar otra versión (por defecto v23.0).
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-dashed p-4">
            <div>
              <p className="text-sm font-medium">API de conversiones (CAPI → n8n → Meta)</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Suite envía eventos al webhook n8n; n8n hashea los datos y los reenvía a Meta.
                El token de Meta CAPI debe configurarse solo en n8n (System User EAA…).
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meta-pixel-id">Pixel / Dataset ID</Label>
                <Input
                  id="meta-pixel-id"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="291687001692956"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-n8n-url">URL webhook n8n</Label>
                <Input
                  id="meta-n8n-url"
                  value={n8nWebhookUrl}
                  onChange={(e) => setN8nWebhookUrl(e.target.value)}
                  placeholder="http://192.168.99.110:5678/webhook/suite-meta-capi-lipoout"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-n8n-secret">Secreto webhook (X-Suite-Secret)</Label>
                <Input
                  id="meta-n8n-secret"
                  type="password"
                  value={n8nWebhookSecret}
                  onChange={(e) => setN8nWebhookSecret(e.target.value)}
                  placeholder={
                    hasStoredN8nSecret
                      ? 'Guardado. Deja en blanco para no cambiar.'
                      : 'suite-meta-lipoout-2026'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-test-code">Código de prueba (TESTXXXX)</Label>
                <Input
                  id="meta-test-code"
                  value={conversionsTestCode}
                  onChange={(e) => setConversionsTestCode(e.target.value)}
                  placeholder="Opcional; solo para Events Manager → Probar eventos"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
              <Switch
                checked={conversionsEnabled}
                onCheckedChange={setConversionsEnabled}
              />
              <div>
                <p className="text-sm font-medium">Emitir conversiones a n8n</p>
                <p className="text-[11px] text-muted-foreground">
                  Desactivado por defecto. Activa solo tras validar el flujo con TESTXXXX.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <div>
                <p className="text-sm font-medium">Sincronización activa</p>
                <p className="text-[11px] text-muted-foreground">
                  Última sincronización: {formatRelative(config?.last_sync_at)}
                  {configSyncSummaryLine ? ` · ${configSyncSummaryLine}` : ''}
                </p>
              </div>
            </div>
            <Button onClick={handleSaveGeneral} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending ? 'Guardando…' : 'Guardar configuración'}
            </Button>
            {showSyncErrorPanel ? (
              <Alert
                variant="destructive"
                className="mt-1 w-full basis-full border-destructive/40"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Errores de sincronización</AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  {showMetaInvalidUserSessionHint ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] leading-snug text-foreground">
                      Meta ha invalidado el token (sesión de Facebook cerrada, contraseña
                      cambiada o token de corta duración). Genera un{' '}
                      <strong>token nuevo</strong> con permisos para leer leads del
                      formulario, pégalo arriba y guarda. En entornos reales conviene un
                      token de larga duración o un usuario del sistema en Business
                      Manager, no un token copiado de una sesión de navegador que caduca
                      al cerrar sesión.
                    </p>
                  ) : null}
                  {structuredFromLastRun.length > 0 ? (
                    <ul className="list-none space-y-2 p-0">
                      {structuredFromLastRun.map((r) => (
                        <li key={r.form_id} className="text-xs">
                          <p className="font-medium text-foreground">
                            {r.form_name ?? r.form_id}
                          </p>
                          {r.message ? (
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
                              {r.message}
                            </pre>
                          ) : r.errors > 0 ? (
                            <p className="mt-1 text-[11px] text-destructive/90">
                              {r.errors} registro(s) no se pudieron insertar.
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : persistedSyncDetail ? (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
                      {persistedSyncDetail}
                    </pre>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2">
              <ListChecks className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Formularios a consultar</CardTitle>
              <CardDescription>
                Añade aquí los IDs de cada formulario de Meta. Los leads se reparten
                automáticamente en "Nuevo Formulario" o, si el lead agendó una cita
                (o el formulario es de tipo "Genera cita"), en "Formulario+Agenda
                ficticia". Puedes configurar mensajes WhatsApp automáticos por formulario.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid items-end gap-3 rounded-xl border border-dashed p-3 md:grid-cols-[160px_1fr_auto_auto]">
            <div className="space-y-1">
              <Label className="text-[11px]">Form ID</Label>
              <Input
                value={newFormId}
                onChange={(e) => setNewFormId(e.target.value)}
                placeholder="2411357172631172"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Nombre (opcional)</Label>
              <Input
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="Campaña primavera 2026"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <Switch
                checked={newCreatesAppt}
                onCheckedChange={setNewCreatesAppt}
                id="new-creates-appt"
              />
              <Label htmlFor="new-creates-appt" className="text-[11px]">
                Genera cita
              </Label>
            </div>
            <Button onClick={handleAddForm} disabled={createForm.isPending}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {createForm.isPending ? 'Añadiendo…' : 'Añadir'}
            </Button>
          </div>

          {forms.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no has añadido formularios.
              <br />
              Pega arriba un ID (p. ej. <code>2411357172631172</code>) y pulsa "Añadir".
            </div>
          ) : (
            <div className="space-y-3">{forms.map(renderFormCard)}</div>
          )}
        </CardContent>
      </Card>

      <MarketingImportDialog
        open={openImport}
        onOpenChange={setOpenImport}
        stages={stages}
      />
      <MarketingFieldsConfigDialog open={openFieldsConfig} onOpenChange={setOpenFieldsConfig} />
      <MarketingStagesManager open={openStagesManager} onOpenChange={setOpenStagesManager} />

      <AlertDialog
        open={fullResyncOpen}
        onOpenChange={(open) => {
          setFullResyncOpen(open);
          if (!open) setFullResyncAck(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resincronizar todos los leads desde Meta?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Se eliminarán de Marketing todos los leads con origen Meta / Facebook / Instagram de{' '}
                  <strong className="text-foreground">esta empresa</strong>, incluidas las{' '}
                  <strong className="text-foreground">notas</strong> asociadas (se pierden hasta que vuelvas a
                  importar desde tu app original).
                </p>
                <p>
                  Después se volverán a descargar <strong className="text-foreground">todos</strong> los leads desde la
                  API de Meta para cada formulario activo, reiniciando cursores de sincronización y rellenando{' '}
                  <strong className="text-foreground">fecha y texto de cita ficticia</strong> cuando el formulario los
                  traiga.
                </p>
                <p>
                  Los leads de otras fuentes (p. ej. importación TuPartner) no se borran; si comparten teléfono con un
                  lead nuevo de Meta, podrás tener duplicados hasta que importes de nuevo y se fusionen.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm">
            <Checkbox
              checked={fullResyncAck}
              onCheckedChange={(v) => setFullResyncAck(!!v)}
              className="mt-0.5"
            />
            <span>
              Entiendo que esta acción es irreversible para los leads Meta actuales y sus notas en esta empresa.
            </span>
          </label>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={syncNow.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!fullResyncAck || syncNow.isPending}
              onClick={() => void handleFullMetaResync()}
            >
              {syncNow.isPending ? 'Ejecutando…' : 'Borrar y volver a importar desde Meta'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MetaConfig;
