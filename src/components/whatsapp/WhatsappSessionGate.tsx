import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Power, LogOut, QrCode, Smartphone, AlertTriangle } from 'lucide-react';
import { useWhatsappConfig, type WhatsappConfigRow } from '@/hooks/useWhatsappConfig';
import { useToast } from '@/hooks/use-toast';

interface Props {
  config: WhatsappConfigRow;
  onConnected?: () => void;
}

function statusLabel(status: string | null | undefined): string {
  switch ((status ?? '').toUpperCase()) {
    case 'WORKING':
      return 'Conectado';
    case 'STOPPED':
      return 'Detenido';
    case 'STARTING':
      return 'Iniciando';
    case 'SCAN_QR_CODE':
      return 'Esperando escaneo del QR';
    case 'FAILED':
      return 'Error';
    case 'UNKNOWN':
      return 'Estado desconocido';
    default:
      return status ?? 'Sin iniciar';
  }
}

export const WhatsappSessionGate: React.FC<Props> = ({ config, onConnected }) => {
  const { toast } = useToast();
  const {
    sessionStatus,
    sessionStart,
    sessionStop,
    sessionLogout,
    fetchQr,
  } = useWhatsappConfig();

  const connectedNotifiedRef = useRef(false);
  const autoRenewBusyRef = useRef(false);
  const lastAutoRenewAtRef = useRef(0);

  // Refresca el estado al montar
  useEffect(() => {
    sessionStatus.mutate(undefined, { onError: () => undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll cada 5s mientras NO esté working; pide QR actualizado en cada ciclo.
  useEffect(() => {
    const status = (config.last_status ?? '').toUpperCase();
    if (status === 'WORKING') {
      if (!connectedNotifiedRef.current) {
        connectedNotifiedRef.current = true;
        onConnected?.();
      }
      return;
    }
    connectedNotifiedRef.current = false;
    const id = setInterval(() => {
      sessionStatus.mutate(undefined, { onError: () => undefined });
      if (status === 'SCAN_QR_CODE' && config.provider !== 'meta') {
        fetchQr.mutate(undefined, { onError: () => undefined });
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.last_status]);

  // Si WAHA agota los QR → FAILED: reinicia sola la sesión para un QR nuevo.
  useEffect(() => {
    const status = (config.last_status ?? '').toUpperCase();
    if (config.provider === 'meta' || (status !== 'FAILED' && status !== 'STOPPED')) return;
    // STOPPED sin me: suele ser el force-stop tras QR; no tocar si el usuario detuvo una sesión WORKING.
    if (status === 'STOPPED' && config.me_jid) return;

    const now = Date.now();
    if (autoRenewBusyRef.current || now - lastAutoRenewAtRef.current < 20_000) return;
    autoRenewBusyRef.current = true;
    lastAutoRenewAtRef.current = now;

    (async () => {
      try {
        // session.qr del proxy reinicia si hace falta y guarda el PNG nuevo.
        await fetchQr.mutateAsync();
      } catch {
        try {
          await sessionStart.mutateAsync();
          await fetchQr.mutateAsync();
        } catch {
          /* el poll mostrará el error; el usuario puede pulsar renovar */
        }
      } finally {
        autoRenewBusyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.last_status, config.provider, config.me_jid]);

  const status = (config.last_status ?? '').toUpperCase();
  const isWorking = status === 'WORKING';
  const isScanning = status === 'SCAN_QR_CODE';
  const isStarting = status === 'STARTING';
  const isFailed = status === 'FAILED';
  const isRenewingQr =
    (isFailed || (status === 'STOPPED' && !config.me_jid)) &&
    (fetchQr.isPending || sessionStart.isPending);

  const handleStart = async () => {
    try {
      await sessionStart.mutateAsync();
      toast({
        title: config.provider === 'meta' ? 'Meta Cloud API' : 'Sesión iniciada',
        description:
          config.provider === 'meta'
            ? 'Token y Phone Number ID validados.'
            : 'Espera el QR…',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleFreshQr = async () => {
    try {
      await sessionLogout.mutateAsync();
      await sessionStart.mutateAsync();
      fetchQr.mutate(undefined, { onError: () => undefined });
      toast({
        title: 'QR renovado',
        description:
          'Escanea el código desde WhatsApp Business → Ajustes → Dispositivos vinculados.',
      });
    } catch (e) {
      toast({
        title: 'No se pudo renovar el QR',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle>Conectar WhatsApp</CardTitle>
              <CardDescription>
                {config.provider === 'meta'
                  ? 'Meta Cloud API está como motor exclusivo (sin QR). En Configuración → WhatsApp pulsa «Activar híbrido WAHA + Meta» para recuperar el QR de WhatsApp Business y mantener Cloud API.'
                  : 'Vincula WhatsApp Business con Suite escaneando el QR de WAHA (Ajustes → Dispositivos vinculados). El QR se renueva solo al caducar.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <div>
              <p className="font-medium">Estado de la sesión</p>
              <p className="text-xs text-muted-foreground">
                {statusLabel(config.last_status)}
                {config.last_status_message ? ` · ${config.last_status_message}` : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sessionStatus.mutate()}
              disabled={sessionStatus.isPending}
            >
              <RefreshCw
                className={`mr-1 h-3.5 w-3.5 ${sessionStatus.isPending ? 'animate-spin' : ''}`}
              />
              Refrescar
            </Button>
          </div>

          {isScanning || isRenewingQr ? (
            <div className="space-y-3">
              <p className="text-sm">
                Abre <strong>WhatsApp Business</strong> en el móvil →{' '}
                <strong>Ajustes</strong> → <strong>Dispositivos vinculados</strong> →{' '}
                <strong>Vincular un dispositivo</strong> y escanea este código.
              </p>
              <div className="flex justify-center rounded-lg border bg-white p-4">
                {config.qr_data_url && isScanning ? (
                  <img
                    src={config.qr_data_url}
                    alt="QR de WhatsApp"
                    className="h-64 w-64 object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    {isRenewingQr ? 'Renovando QR caducado…' : 'Obteniendo QR…'}
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                WhatsApp rota el QR cada ~20–60 s; Suite lo actualiza solo. Si caduca del todo, se regenera automáticamente.
              </p>
            </div>
          ) : isWorking ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              Sesión activa
              {config.me_pushname ? ` · ${config.me_pushname}` : ''}.
            </div>
          ) : isStarting ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Iniciando sesión, espera unos segundos…
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {config.provider === 'meta'
                      ? 'Motor Meta exclusivo (sin QR).'
                      : 'La sesión WAHA no está activa.'}
                  </p>
                  <p className="text-xs">
                    {config.provider === 'meta'
                      ? 'Para escanear el QR de WhatsApp Business, activa el híbrido WAHA + Meta en Configuración → WhatsApp.'
                      : 'Pulsa "Iniciar sesión" para arrancarla. Después aparecerá un código QR: en el móvil abre WhatsApp Business → Ajustes → Dispositivos vinculados → Vincular un dispositivo.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isFailed && config.provider !== 'meta' ? (
              <Button onClick={() => void handleFreshQr()} disabled={sessionLogout.isPending || sessionStart.isPending}>
                <QrCode className="mr-2 h-4 w-4" />
                {sessionLogout.isPending || sessionStart.isPending ? 'Renovando…' : 'Nueva vinculación QR'}
              </Button>
            ) : null}
            {!isWorking ? (
              <Button onClick={handleStart} disabled={sessionStart.isPending}>
                <Power className="mr-2 h-4 w-4" />
                {sessionStart.isPending
                  ? 'Comprobando…'
                  : config.provider === 'meta'
                    ? 'Comprobar Meta'
                    : 'Iniciar sesión'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => sessionStop.mutate()}
                  disabled={sessionStop.isPending}
                >
                  <Power className="mr-2 h-4 w-4" />
                  Detener
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => sessionLogout.mutate()}
                  disabled={sessionLogout.isPending}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
