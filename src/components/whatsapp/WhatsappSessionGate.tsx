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

  // Refresca el estado al montar
  useEffect(() => {
    sessionStatus.mutate(undefined, { onError: () => undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll cada 5s mientras NO esté working
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
      if (status === 'SCAN_QR_CODE') {
        fetchQr.mutate(undefined, { onError: () => undefined });
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.last_status]);

  const status = (config.last_status ?? '').toUpperCase();
  const isWorking = status === 'WORKING';
  const isScanning = status === 'SCAN_QR_CODE';
  const isStarting = status === 'STARTING';

  const handleStart = async () => {
    try {
      await sessionStart.mutateAsync();
      toast({ title: 'Sesión iniciada', description: 'Espera el QR…' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
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
                Vincula tu cuenta de WhatsApp con la plataforma a través de Waha
                para enviar y recibir mensajes desde aquí.
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

          {isScanning ? (
            <div className="space-y-3">
              <p className="text-sm">
                Abre WhatsApp en tu móvil → <strong>Ajustes</strong> →{' '}
                <strong>Dispositivos vinculados</strong> →{' '}
                <strong>Vincular un dispositivo</strong> y escanea este código.
              </p>
              <div className="flex justify-center rounded-lg border bg-white p-4">
                {config.qr_data_url ? (
                  <img
                    src={config.qr_data_url}
                    alt="QR de WhatsApp"
                    className="h-64 w-64 object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-64 items-center justify-center text-sm text-muted-foreground">
                    {fetchQr.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Button size="sm" onClick={() => fetchQr.mutate()}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Obtener QR
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                El estado se actualiza solo cada pocos segundos.
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
                    La sesión Waha no está activa.
                  </p>
                  <p className="text-xs">
                    Pulsa "Iniciar sesión" para arrancarla en el servidor Waha.
                    Después aparecerá un código QR que tendrás que escanear
                    desde tu móvil.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isWorking ? (
              <Button onClick={handleStart} disabled={sessionStart.isPending}>
                <Power className="mr-2 h-4 w-4" />
                {sessionStart.isPending ? 'Iniciando…' : 'Iniciar sesión'}
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
