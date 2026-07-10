import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  useRunServiceMonitor,
  useServiceMonitorLogs,
  useServiceMonitorNotifications,
  useServiceMonitorSettings,
  useServiceMonitorStatus,
  useUpdateServiceMonitorSettings,
  type ServiceMonitorStatus,
  type ServiceStatusRow,
} from '@/hooks/useServiceMonitor';

const STATUS_LABEL: Record<ServiceMonitorStatus, string> = {
  ok: 'Operativo',
  degraded: 'Degradado',
  down: 'Caído',
  unknown: 'Sin datos',
};

function StatusIcon({ status }: { status: ServiceMonitorStatus }) {
  if (status === 'ok') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === 'degraded') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  if (status === 'down') return <XCircle className="h-5 w-5 text-destructive" />;
  return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
}

function statusBadgeVariant(status: ServiceMonitorStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ok') return 'default';
  if (status === 'down') return 'destructive';
  if (status === 'degraded') return 'secondary';
  return 'outline';
}

function ServiceCard({ row }: { row: ServiceStatusRow }) {
  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <StatusIcon status={row.status} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{row.display_name}</span>
              <Badge variant={statusBadgeVariant(row.status)}>{STATUS_LABEL[row.status]}</Badge>
              {row.latency_ms != null && (
                <span className="text-xs text-muted-foreground tabular-nums">{row.latency_ms} ms</span>
              )}
            </div>
            {row.last_error && row.status !== 'ok' && (
              <p className="text-xs text-destructive mt-1 break-words">{row.last_error}</p>
            )}
            {row.status === 'ok' && row.details?.last_message && (
              <p className="text-xs text-muted-foreground mt-1">{String(row.details.last_message)}</p>
            )}
            {row.service_key === 'spa3102' && row.details?.pstn_hook_state && (
              <p className="text-xs text-muted-foreground mt-1">
                {row.details.pstn_in_call === true ? 'En llamada' : `PSTN: ${String(row.details.pstn_hook_state)}`}
                {row.details.pstn_state ? ` · ${String(row.details.pstn_state)}` : ''}
                {row.details.line_voltage ? ` · ${String(row.details.line_voltage)}` : ''}
                {Number(row.details.pstn_off_minutes) > 0
                  ? ` · off-hook idle ${row.details.pstn_off_minutes} min`
                  : ''}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              {row.last_check_at
                ? `Último check: ${format(new Date(row.last_check_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}`
                : 'Sin comprobaciones'}
              {row.consecutive_failures > 0 ? ` · Fallos seguidos: ${row.consecutive_failures}` : ''}
              {row.details?.alert_active === true ? ' · Alerta activa' : ''}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const ServidoresMonitorPanel: React.FC = () => {
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useServiceMonitorSettings();
  const { data: services, isLoading: servicesLoading } = useServiceMonitorStatus(10_000);
  const { data: logs } = useServiceMonitorLogs(40);
  const { data: notifications } = useServiceMonitorNotifications(15);
  const runMonitor = useRunServiceMonitor();
  const updateSettings = useUpdateServiceMonitorSettings();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef(false);
  const mutateRef = useRef(runMonitor.mutate);
  mutateRef.current = runMonitor.mutate;
  pendingRef.current = runMonitor.isPending;

  const intervalSec = settings?.check_interval_seconds ?? 60;

  useEffect(() => {
    if (!settings?.enabled) return;

    const tick = () => {
      if (pendingRef.current) return;
      mutateRef.current(true);
    };

    tick();
    intervalRef.current = setInterval(tick, intervalSec * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings?.enabled, intervalSec]);

  const handleManualCheck = () => {
    runMonitor.mutate(true, {
      onSuccess: () => {
        toast({ title: 'Comprobación completada', description: 'Estado de servicios actualizado.' });
      },
      onError: (e: Error) => {
        toast({
          title: 'Error en comprobación',
          description: e.message,
          variant: 'destructive',
        });
      },
    });
  };

  const saveSettings = (patch: Parameters<typeof updateSettings.mutate>[0]) => {
    updateSettings.mutate(patch, {
      onSuccess: () => toast({ title: 'Configuración guardada' }),
      onError: (e: Error) =>
        toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            Monitor de servidores
          </CardTitle>
          <CardDescription>
            Comprobación automática cada {intervalSec} s. Aviso de caída tras{' '}
            {settings?.failures_before_alert ?? 2} checks fallidos seguidos; recuperación tras{' '}
            {settings?.successes_before_recovery ?? 3} checks OK seguidos (evita falsos positivos).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="monitor-enabled"
                checked={settings?.enabled ?? true}
                disabled={settingsLoading || updateSettings.isPending}
                onCheckedChange={(enabled) => saveSettings({ enabled })}
              />
              <Label htmlFor="monitor-enabled">Monitor activo</Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={runMonitor.isPending}
              onClick={handleManualCheck}
            >
              {runMonitor.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Comprobar ahora
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Email alertas (servicios + WAHA caído)</Label>
              <Input
                defaultValue={settings?.alert_email ?? 'luisadr@gmail.com'}
                key={`alert-${settings?.updated_at}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== settings?.alert_email) saveSettings({ alert_email: v, waha_down_email: v });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp alertas (WAHA OK + reinicio SPA3102)</Label>
              <Input
                defaultValue={settings?.waha_up_whatsapp ?? '34667435503'}
                key={`wa-${settings?.updated_at}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== settings?.waha_up_whatsapp) saveSettings({ waha_up_whatsapp: v });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intervalo (segundos)</Label>
              <Input
                type="number"
                min={30}
                max={600}
                defaultValue={settings?.check_interval_seconds ?? 60}
                key={`int-${settings?.updated_at}`}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 30 && n !== settings?.check_interval_seconds) {
                    saveSettings({ check_interval_seconds: n });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Checks fallidos antes de avisar caída</Label>
              <Input
                type="number"
                min={1}
                max={10}
                defaultValue={settings?.failures_before_alert ?? 2}
                key={`fail-${settings?.updated_at}`}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n !== settings?.failures_before_alert) {
                    saveSettings({ failures_before_alert: n });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Checks OK antes de avisar recuperación</Label>
              <Input
                type="number"
                min={1}
                max={10}
                defaultValue={settings?.successes_before_recovery ?? 3}
                key={`ok-${settings?.updated_at}`}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n !== settings?.successes_before_recovery) {
                    saveSettings({ successes_before_recovery: n });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SPA3102: min off-hook antes de reinicio</Label>
              <Input
                type="number"
                min={5}
                max={180}
                defaultValue={settings?.spa3102_offhook_minutes ?? 30}
                key={`spa-off-${settings?.updated_at}`}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 5 && n !== settings?.spa3102_offhook_minutes) {
                    saveSettings({ spa3102_offhook_minutes: n });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SPA3102: cooldown reinicio (min)</Label>
              <Input
                type="number"
                min={15}
                max={720}
                defaultValue={settings?.spa3102_reboot_cooldown_minutes ?? 60}
                key={`spa-cd-${settings?.updated_at}`}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 15 && n !== settings?.spa3102_reboot_cooldown_minutes) {
                    saveSettings({ spa3102_reboot_cooldown_minutes: n });
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="spa3102-auto-reboot"
                checked={settings?.spa3102_auto_reboot ?? true}
                disabled={settingsLoading || updateSettings.isPending}
                onCheckedChange={(spa3102_auto_reboot) => saveSettings({ spa3102_auto_reboot })}
              />
              <Label htmlFor="spa3102-auto-reboot" className="text-xs">
                SPA3102: reinicio automático si línea PSTN bloqueada
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Estado actual
        </h3>
        {servicesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {(services ?? []).map((row) => (
              <ServiceCard key={row.service_key} row={row} />
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historial de comprobaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1.5 max-h-64 overflow-y-auto">
              {(logs ?? []).map((log) => (
                <li key={log.id} className="border-b border-border/40 pb-1.5 last:border-0">
                  <span className="font-medium">{log.service_key}</span>
                  {' · '}
                  <span className={log.status === 'ok' ? 'text-emerald-700' : 'text-destructive'}>
                    {log.status}
                  </span>
                  {log.latency_ms != null ? ` · ${log.latency_ms} ms` : ''}
                  {log.recovery_attempted && (
                    <span className="text-muted-foreground">
                      {' '}
                      · recovery {log.recovery_success ? 'OK' : 'FAIL'}
                      {log.recovery_message ? `: ${log.recovery_message}` : ''}
                    </span>
                  )}
                  <br />
                  <span className="text-muted-foreground">
                    {format(new Date(log.checked_at), 'dd/MM HH:mm:ss', { locale: es })}
                    {log.message ? ` — ${log.message}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notificaciones enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1.5 max-h-64 overflow-y-auto">
              {(notifications ?? []).map((n) => (
                <li key={n.id} className="border-b border-border/40 pb-1.5 last:border-0">
                  <span className="font-medium">{n.channel}</span> → {n.destination}
                  {' · '}
                  {n.success ? (
                    <span className="text-emerald-700">OK</span>
                  ) : (
                    <span className="text-destructive">Error</span>
                  )}
                  <br />
                  <span className="text-muted-foreground">
                    {format(new Date(n.created_at), 'dd/MM HH:mm:ss', { locale: es })}
                    {n.service_key ? ` · ${n.service_key}` : ''}
                    {n.error ? ` — ${n.error}` : ''}
                  </span>
                </li>
              ))}
              {!notifications?.length && (
                <li className="text-muted-foreground py-4 text-center">Sin notificaciones aún</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Para comprobaciones 24/7 sin depender del navegador, configura el cron en el servidor Supabase
        con <code className="text-[10px]">scripts/setup-service-monitor-cron.ps1</code> y la variable{' '}
        <code className="text-[10px]">SERVICE_MONITOR_CRON_SECRET</code> en el contenedor edge.
        {' '}Para el gateway FXO-FXS SPA3102 (192.168.99.82), añade{' '}
        <code className="text-[10px]">SPA3102_PASSWORD</code> (y opcionalmente{' '}
        <code className="text-[10px]">SPA3102_BASE_URL</code>,{' '}
        <code className="text-[10px]">SPA3102_USERNAME</code>) al contenedor edge.
      </p>
    </div>
  );
};
