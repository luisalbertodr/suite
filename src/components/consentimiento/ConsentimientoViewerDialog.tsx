import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Consentimiento } from '@/lib/consentimientoTypes';
import { consentDocumentPublicUrl } from '@/lib/consentimientoStorage';
import { supabase } from '@/lib/supabase';

type Props = {
  consent: Consentimiento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ConsentimientoViewerDialog({ consent, open, onOpenChange }: Props) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    if (!open || !consent?.documento_pdf_url) {
      setPdfBlobUrl(null);
      return;
    }
    let revoked: string | null = null;
    setLoadingPdf(true);
    void (async () => {
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .download(consent.documento_pdf_url!);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        revoked = url;
        setPdfBlobUrl(url);
      } catch {
        setPdfBlobUrl(null);
      } finally {
        setLoadingPdf(false);
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
      setPdfBlobUrl(null);
    };
  }, [open, consent?.documento_pdf_url]);

  if (!consent) return null;

  const pdfPublic = consentDocumentPublicUrl(consent.documento_pdf_url);
  const firmaPublic = consentDocumentPublicUrl(consent.firma_url);
  const fecha = consent.fecha_firma || consent.created_at;

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = `${consent.titulo || 'consentimiento'}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileText className="w-5 h-5" />
            {consent.titulo}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {consent.tipo}
            {fecha ? ` · ${format(new Date(fecha), "d MMM yyyy, HH:mm", { locale: es })}` : ''}
          </p>
        </DialogHeader>

        {consent.documento_pdf_url ? (
          <div className="flex-1 min-h-[320px] rounded-md border overflow-hidden bg-muted/30">
            {loadingPdf ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Cargando PDF…
              </div>
            ) : pdfBlobUrl ? (
              <iframe title="Consentimiento PDF" src={pdfBlobUrl} className="w-full h-[min(60vh,520px)]" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-sm text-muted-foreground">
                <p>No se pudo cargar la vista previa.</p>
                {pdfPublic ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={pdfPublic} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1" /> Abrir PDF
                    </a>
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[min(50vh,400px)] rounded-md border p-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{consent.contenido}</div>
            {firmaPublic ? (
              <div className="mt-6">
                <p className="text-xs text-muted-foreground mb-2">Firma</p>
                <img src={firmaPublic} alt="Firma" className="max-h-24 border rounded bg-white p-2" />
              </div>
            ) : null}
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          {pdfBlobUrl ? (
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1" /> Descargar PDF
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
