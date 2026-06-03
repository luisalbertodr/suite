import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  Hand,
  Loader2,
  Play,
  RefreshCw,
  Server,
  Trash2,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useLegacyImport } from '@/hooks/useLegacyImport';
import { useAuth } from '@/hooks/useAuth';
import {
  LEGACY_IMPORT_MODE_LABELS,
  LEGACY_IMPORT_STEPS,
  legacyImportWorkerCommand,
  type LegacyImportMode,
  type LegacyImportStepKind,
} from '@/lib/legacyImportSteps';

const kindMeta: Record<
  LegacyImportStepKind,
  { label: string; icon: React.ReactNode; className: string }
> = {
  manual: {
    label: 'Manual',
    icon: <Hand className="h-3.5 w-3.5" />,
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  },
  semi: {
    label: 'Semi-automático',
    icon: <Server className="h-3.5 w-3.5" />,
    className: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  },
  automatic: {
    label: 'Automático',
    icon: <Zap className="h-3.5 w-3.5" />,
    className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES');
  } catch {
    return iso;
  }
}

function copyText(text: string, toast: ReturnType<typeof useToast>['toast']) {
  void navigator.clipboard.writeText(text);
  toast({ title: 'Copiado al portapapeles' });
}

export const LegacyImportPanel: React.FC = () => {
  const { toast } = useToast();
  const { isSuperuser } = useAuth();
  const {
    status,
    runs,
    activeRun,
    loading,
    busy,
    error,
    refresh,
    resetLegacy,
    createRun,
    startPolling,
    setActiveRun,
  } = useLegacyImport();

  const [mode, setMode] = useState<LegacyImportMode>('refresh');
  const [skipMaster, setSkipMaster] = useState(false);
  const [cleanImport, setCleanImport] = useState(false);
  const [workerCommand, setWorkerCommand] = useState<string | null>(null);
  const [checkedManual, setCheckedManual] = useState<Record<string, boolean>>({});

  const handleReset = async (scope: 'sales' | 'appointments') => {
    if (
      !window.confirm(
        scope === 'sales'
          ? '¿Borrar ventas y facturas legacy? Esta acción no se puede deshacer.'
          : '¿Borrar citas legacy y sus ventas/facturas? Esta acción no se puede deshacer.',
      )
    ) {
      return;
    }
    try {
      await resetLegacy(scope);
      toast({
        title: 'Datos legacy eliminados',
        description: scope === 'sales' ? 'Ventas y facturas legacy borradas.' : 'Citas y ventas legacy borradas.',
      });
    } catch {
      toast({ title: 'Error al borrar', variant: 'destructive' });
    }
  };

  const handleCreateRun = async () => {
    try {
      const options: Record<string, unknown> = {
        skipMaster: mode === 'full' ? skipMaster : true,
        cleanImport,
        includeFallback: false,
      };
      const { runId, workerCommand: cmd } = await createRun(mode, options);
      setWorkerCommand(cmd);
      startPolling(runId);
      toast({
        title: 'Importación encolada',
        description: 'Ejecute el comando del worker en el servidor.',
      });
    } catch {
      toast({ title: 'No se pudo encolar', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Importación legacy Dunasoft
          </CardTitle>
          <CardDescription>
            Reimporta datos desde Style/Dunasoft. Los pasos marcados como{' '}
            <strong>Manual</strong> deben hacerlos usted en el equipo con Dunasoft o en el servidor;
            los <strong>Automáticos</strong> se ejecutan desde Suite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground text-xs">Staging legacy.*</p>
              <p className="font-medium">{status?.legacy_staging.faccab_rows ?? 0} faccab</p>
              <p className="text-xs text-muted-foreground">
                Último importe: {formatDate(status?.legacy_staging.last_imported_at)}
              </p>
              {status?.legacy_staging.last_import_batch && (
                <p className="text-xs text-muted-foreground">
                  Lote: {status.legacy_staging.last_import_batch}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground text-xs">Promovido en Suite</p>
              <p className="font-medium">
                {status?.public_promoted.counts_deferred
                  ? 'N/D (consulta pesada omitida)'
                  : `${status?.public_promoted.legacy_appointments ?? 0} citas`}
              </p>
              {!status?.public_promoted.counts_deferred && (
                <p className="text-xs">
                  {status?.public_promoted.legacy_sales ?? 0} ventas ·{' '}
                  {status?.public_promoted.legacy_invoices ?? 0} facturas
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground text-xs">albcab (tickets TPV)</p>
              <p className="font-medium">{status?.legacy_staging.albcab_rows ?? 0} registros</p>
              {(status?.legacy_staging.albcab_rows ?? 0) === 0 && (
                <p className="text-xs text-amber-600">Importe albcab.dbf si hay cobros TPV</p>
              )}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar estado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pasos del proceso</CardTitle>
          <CardDescription>
            Siga el orden. Marque los pasos manuales cuando los haya completado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {LEGACY_IMPORT_STEPS.map((step) => {
            const meta = kindMeta[step.kind];
            const isManual = step.kind === 'manual';
            return (
              <div
                key={step.id}
                className="flex gap-3 rounded-lg border border-border/70 p-4"
              >
                <div className="pt-0.5">
                  {isManual && checkedManual[step.id] ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{step.title}</span>
                    <Badge variant="outline" className={`gap-1 text-[10px] ${meta.className}`}>
                      {meta.icon}
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {step.command && (
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                        {workerCommand && step.actionId === 'create-run'
                          ? workerCommand
                          : step.command}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyText(
                            workerCommand && step.actionId === 'create-run'
                              ? workerCommand
                              : step.command!,
                            toast,
                          )
                        }
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {isManual && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!checkedManual[step.id]}
                        onCheckedChange={(v) =>
                          setCheckedManual((prev) => ({ ...prev, [step.id]: !!v }))
                        }
                      />
                      He completado este paso
                    </label>
                  )}
                  {step.actionId === 'reset-appointments' && isSuperuser && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleReset('sales')}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Borrar ventas/facturas legacy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleReset('appointments')}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Borrar citas + ventas legacy
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejecutar importación</CardTitle>
          <CardDescription>
            Encola la importación en Suite y luego ejecute el worker en el servidor con acceso a
            los DBF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSuperuser && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Solo superusuarios pueden borrar datos legacy. Puede encolar importaciones si tiene
                acceso a Configuración.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as LegacyImportMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEGACY_IMPORT_MODE_LABELS) as LegacyImportMode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {LEGACY_IMPORT_MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'full' && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={skipMaster} onCheckedChange={(v) => setSkipMaster(!!v)} />
              Omitir catálogo/clientes/bonos (solo citas y ventas)
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={cleanImport} onCheckedChange={(v) => setCleanImport(!!v)} />
            Borrar <strong>todas</strong> las citas al promover (--clean-import). Solo si no hay
            citas creadas en Suite.
          </label>

          <Alert>
            <Hand className="h-4 w-4" />
            <AlertTitle>Paso manual obligatorio tras encolar</AlertTitle>
            <AlertDescription>
              En el servidor con los DBF y el repo Suite, ejecute el comando del worker. La UI no
              puede leer archivos .dbf ni ejecutar Python en su red local.
            </AlertDescription>
          </Alert>

          <Button onClick={() => void handleCreateRun()} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Encolar importación
          </Button>

          {workerCommand && (
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <p className="text-sm font-medium">Comando para el servidor:</p>
              <code className="block rounded bg-muted p-2 text-xs break-all">{workerCommand}</code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copyText(workerCommand, toast)}
              >
                <ClipboardCopy className="mr-2 h-4 w-4" />
                Copiar comando
              </Button>
            </div>
          )}

          {activeRun && (
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Ejecución {activeRun.id.slice(0, 8)}…</span>
                <Badge
                  variant={
                    activeRun.status === 'completed'
                      ? 'default'
                      : activeRun.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {activeRun.status}
                </Badge>
              </div>
              {activeRun.current_step && (
                <p className="text-muted-foreground">Paso: {activeRun.current_step}</p>
              )}
              {activeRun.error_message && (
                <p className="text-destructive text-xs">{activeRun.error_message}</p>
              )}
              {activeRun.status === 'running' && (
                <p className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Actualizando cada 3 s…
                </p>
              )}
            </div>
          )}

          {runs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Ejecuciones recientes</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {runs.map((run) => (
                  <li key={run.id} className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      className="text-left hover:underline text-foreground"
                      onClick={() => {
                        setActiveRun(run);
                        if (run.status === 'running' || run.status === 'queued') {
                          startPolling(run.id);
                        }
                      }}
                    >
                      {formatDate(run.created_at)} · {run.mode} · {run.status}
                    </button>
                    {(run.status === 'failed' || run.status === 'running') && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => {
                          const cmd = `${legacyImportWorkerCommand(run.id)} --force`;
                          setWorkerCommand(cmd);
                          setActiveRun(run);
                          copyText(cmd, toast);
                          toast({
                            title: 'Reanudar importación',
                            description:
                              'Ejecute el comando con --force en el servidor si el run quedó en running.',
                          });
                        }}
                      >
                        {run.status === 'failed' ? 'Reanudar' : 'Forzar reanuda'}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
