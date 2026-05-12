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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ListChecks,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useMetaConfig,
  type MetaFormRow,
  type MetaSyncFormResult,
} from '@/hooks/useMetaConfig';
import { useMarketingStages } from '@/hooks/useMarketingStages';
import { MarketingImportDialog } from './marketing/MarketingImportDialog';

const NONE_STAGE_VALUE = '__none__';

const INTERVAL_PRESETS: Array<{ value: number; label: string }> = [
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

  const [openImport, setOpenImport] = useState(false);
  const [newFormId, setNewFormId] = useState('');
  const [newFormName, setNewFormName] = useState('');
  const [newCreatesAppt, setNewCreatesAppt] = useState(false);

  useEffect(() => {
    if (!config) return;
    setBusinessId(config.business_id ?? '');
    setHasStoredToken(!!config.access_token);
    setSyncInterval(config.sync_interval_minutes ?? 60);
    setEnabled(config.enabled ?? true);
    setApiVersion(config.graph_api_version ?? 'v23.0');
  }, [config]);

  const intakeStage = useMemo(
    () =>
      stages.find((s) => s.is_default_intake) ??
      stages.find((s) => s.name.toLowerCase() === 'nuevo formulario') ??
      stages[0] ??
      null,
    [stages],
  );

  const appointmentStage = useMemo(
    () =>
      stages.find((s) =>
        s.name.toLowerCase().replace(/\s+/g, ' ').includes('formulario+agenda ficticia') ||
        s.name.toLowerCase().replace(/\s+/g, ' ').includes('formulario + agenda ficticia'),
      ) ?? null,
    [stages],
  );

  const handleSaveGeneral = async () => {
    try {
      await upsertConfig.mutateAsync({
        business_id: businessId.trim() || null,
        graph_api_version: apiVersion.trim() || 'v23.0',
        sync_interval_minutes: Math.max(5, Number(syncInterval) || 60),
        enabled,
        ...(accessToken.trim()
          ? { access_token: accessToken.trim() }
          : {}),
      });
      setAccessToken('');
      setShowToken(false);
      setHasStoredToken(true);
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

  const handleSyncNow = async (formId?: string) => {
    try {
      const result = await syncNow.mutateAsync(
        formId ? { form_ids: [formId] } : undefined,
      );
      const summary = result.results
        .map(
          (r: MetaSyncFormResult) =>
            `${r.form_name ?? r.form_id}: ${r.inserted} nuevos${
              r.errors ? ` · ${r.errors} con error` : ''
            }`,
        )
        .join(' · ');
      toast({
        title: 'Sincronización Meta',
        description:
          summary ||
          `${result.inserted} nuevos · ${result.skipped} ya existían · ${result.errors} con error`,
      });
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
                  <CalendarCheck className="h-3 w-3" /> Genera cita
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
              <p className="text-xs font-medium">Tratar todos los leads como cita</p>
              <p className="text-[11px] text-muted-foreground">
                Si está activado, todos los leads de este formulario van a la etapa
                de "Formulario+Agenda ficticia".
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <div>
                <p className="text-sm font-medium">Sincronización activa</p>
                <p className="text-[11px] text-muted-foreground">
                  Última sincronización: {formatRelative(config?.last_sync_at)}
                  {config?.last_sync_message ? ` · ${config.last_sync_message}` : ''}
                </p>
              </div>
            </div>
            <Button onClick={handleSaveGeneral} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending ? 'Guardando…' : 'Guardar configuración'}
            </Button>
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
                ficticia".
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
    </div>
  );
};

export default MetaConfig;
