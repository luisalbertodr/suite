
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentData {
  id: string;
  name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string;
  tags: string[];
  company_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SimpleDocumentViewerProps {
  document: DocumentData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SimpleDocumentViewer: React.FC<SimpleDocumentViewerProps> = ({
  document,
  isOpen,
  onClose
}) => {
  const { toast } = useToast();

  if (!document) return null;

  const publicUrl = `https://kztelbnarzrpbjlqastg.supabase.co/storage/v1/object/public/documents/${document.file_path}`;

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = publicUrl;
    link.download = document.original_name;
    link.target = '_blank';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    
    toast({
      title: 'Descarga iniciada',
      description: `Descargando ${document.original_name}`,
    });
  };

  const handleOpenExternal = () => {
    window.open(publicUrl, '_blank');
    toast({
      title: 'Documento abierto',
      description: 'El documento se ha abierto en una nueva pestaña.',
    });
  };

  const isPdf = document.mime_type === 'application/pdf';
  const isImage = document.mime_type.startsWith('image/');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold truncate pr-4">
            {document.original_name}
          </DialogTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Descargar
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenExternal}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir en pestaña
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 mt-4">
          {isPdf ? (
            <div className="w-full h-[70vh] border rounded-lg">
              <iframe
                src={`${publicUrl}#toolbar=1`}
                className="w-full h-full rounded-lg"
                title={document.original_name}
              />
            </div>
          ) : isImage ? (
            <div className="flex justify-center items-center bg-gray-50 rounded-lg p-4">
              <img
                src={publicUrl}
                alt={document.original_name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Vista previa no disponible</h3>
              <p className="text-gray-500 mb-4">
                Este tipo de archivo no se puede visualizar directamente.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar archivo
                </Button>
                <Button variant="outline" onClick={handleOpenExternal}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir en nueva pestaña
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
