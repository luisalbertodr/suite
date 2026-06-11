import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import {
  downloadInbodyReport,
  loadInbodyReportTemplate,
  renderInbodyReportCanvas,
  shareInbodyReport,
} from '@/lib/inbodyReportExport';

interface Props {
  measurement: InbodyMeasurement;
  customerName?: string;
  compact?: boolean;
}

export const InbodyReportExport: React.FC<Props> = ({ measurement, customerName, compact }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const template = await loadInbodyReportTemplate();
        if (cancelled) return;
        const canvas = renderInbodyReportCanvas(template, measurement);
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
  }, [measurement]);

  const handleDownload = async () => {
    setBusy('download');
    try {
      await downloadInbodyReport(measurement, customerName);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('share');
    try {
      await shareInbodyReport(measurement, customerName);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-emerald-100/60 dark:border-emerald-900/30">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-sm">Informe para cliente (JPG)</CardTitle>
        <CardDescription className="text-xs">
          Plantilla oficial InBody rellena con la medición seleccionada. Descárgala o compártela por WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-white overflow-hidden flex justify-center max-h-[min(80vh,900px)] relative min-h-[120px]">
          <canvas
            ref={canvasRef}
            className={`max-w-full h-auto object-contain transition-opacity ${loading ? 'opacity-0' : 'opacity-100'}`}
            aria-label="Vista previa informe InBody"
            aria-hidden={loading}
          />
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando vista previa…
            </div>
          ) : null}
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size={compact ? 'sm' : 'default'}
            disabled={loading || busy != null}
            onClick={() => void handleDownload()}
          >
            {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Descargar JPG
          </Button>
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            disabled={loading || busy != null}
            onClick={() => void handleShare()}
          >
            {busy === 'share' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
            Compartir / WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
