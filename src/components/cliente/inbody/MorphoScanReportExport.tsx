import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import { useToast } from '@/hooks/use-toast';
import { useWorkCenterBranding } from '@/hooks/useWorkCenterBranding';
import {
  downloadMorphoScanReport,
  isMorphoScanReportTemplateReady,
  loadMorphoScanReportLogo,
  loadMorphoScanReportTemplate,
  MORPHOSCAN_REPORT_TEMPLATE_VERSION,
  morphoscanReportSessionKey,
  renderMorphoScanReportCanvas,
  shareMorphoScanReport,
} from '@/lib/morphoscanReportExport';

interface Props {
  measurement: InbodyMeasurement;
  customerId?: string;
  customerName?: string;
  compact?: boolean;
}

function clearPreviewCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx && canvas.width > 0 && canvas.height > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}

export const MorphoScanReportExport: React.FC<Props> = ({
  measurement,
  customerId,
  customerName,
  compact,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { logoUrlLight } = useWorkCenterBranding();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = isMorphoScanReportTemplateReady();
  const sessionKey = morphoscanReportSessionKey(measurement);

  useEffect(() => {
    if (!ready) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    clearPreviewCanvas(canvasRef.current);

    (async () => {
      try {
        const [template, logo] = await Promise.all([
          loadMorphoScanReportTemplate(sessionKey),
          loadMorphoScanReportLogo(logoUrlLight),
        ]);
        if (cancelled) return;
        const canvas = renderMorphoScanReportCanvas(template, measurement, {
          customerName,
          logo,
          logoUrl: logoUrlLight,
        });
        const preview = canvasRef.current;
        if (preview) {
          preview.width = canvas.width;
          preview.height = canvas.height;
          const ctx = preview.getContext('2d');
          ctx?.drawImage(canvas, 0, 0);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al generar informe');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, customerName, logoUrlLight, measurement, ready, sessionKey, MORPHOSCAN_REPORT_TEMPLATE_VERSION]);

  const handleDownload = async () => {
    setBusy('download');
    setError(null);
    try {
      await downloadMorphoScanReport(measurement, customerName, { logoUrl: logoUrlLight });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('share');
    setError(null);
    try {
      const result = await shareMorphoScanReport(measurement, customerName, {
        logoUrl: logoUrlLight,
      });
      if (result === 'downloaded') {
        toast({
          title: 'Informe descargado',
          description:
            'Tu navegador no permite compartir archivos en este equipo; se ha guardado el JPG.',
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-violet-100/60 dark:border-violet-900/30">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-sm">Informe MorphoScan (JPG)</CardTitle>
        <CardDescription className="text-xs">
          Plantilla MorphoScan rellena con la medición seleccionada (v{MORPHOSCAN_REPORT_TEMPLATE_VERSION}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ready ? (
          <div className="relative rounded-lg border bg-muted/20 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">Generando vista previa…</span>
              </div>
            ) : null}
            <canvas
              ref={canvasRef}
              className="w-full h-auto block"
              style={{ display: loading ? 'none' : 'block' }}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground">
            Vista previa no disponible.
          </div>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size={compact ? 'sm' : 'default'}
            disabled={!ready || busy != null || loading}
            onClick={() => void handleDownload()}
          >
            {busy === 'download' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Descargar JPG
          </Button>
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            disabled={!ready || busy != null || loading}
            onClick={() => void handleShare()}
          >
            {busy === 'share' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            Compartir / WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
