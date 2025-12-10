
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string;
  tags: string[];
  uploaded_by: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentViewerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  isOpen,
  onClose
}) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (document && isOpen) {
      loadDocument();
    } else {
      cleanup();
    }

    return cleanup;
  }, [document, isOpen]);

  const cleanup = () => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    }
    setError(null);
    setZoom(1);
    setRotation(0);
  };

  const loadDocument = async () => {
    if (!document) return;

    console.log('Loading document:', document.file_path, 'for company:', document.company_id);
    setLoading(true);
    setError(null);
    
    try {
      // Verify user access before attempting download
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      console.log('User authenticated, downloading document...');

      // Try to get the public URL first if the bucket is public
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(document.file_path);

      if (publicUrlData?.publicUrl) {
        console.log('Using public URL for document:', publicUrlData.publicUrl);
        setFileUrl(publicUrlData.publicUrl);
        setLoading(false);
        return;
      }

      // Fallback to download method
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) {
        console.error('Storage download error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('not found')) {
          throw new Error('El documento no fue encontrado en el servidor');
        } else if (error.message.includes('access')) {
          throw new Error('No tienes permisos para acceder a este documento');
        } else {
          throw new Error(`Error al descargar el archivo: ${error.message}`);
        }
      }

      if (!data) {
        throw new Error('No se recibieron datos del documento');
      }

      console.log('Document downloaded successfully, size:', data.size);
      
      // Clean up previous URL
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      
      const url = URL.createObjectURL(data);
      console.log('Created object URL for viewing');
      setFileUrl(url);
    } catch (error: any) {
      console.error('Error loading document:', error);
      setError(error.message || 'Error al cargar el documento');
      toast({
        title: 'Error al cargar documento',
        description: error.message || 'No se pudo cargar el documento para visualizar.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) {
      toast({
        title: 'Error',
        description: 'No hay documento disponible para descargar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Starting download for:', document.original_name);
      
      // Get fresh download link from Supabase
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) {
        console.error('Download error:', error);
        throw new Error(`Error al descargar: ${error.message}`);
      }

      if (!data) {
        throw new Error('No se recibieron datos del documento');
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.original_name;
      link.style.display = 'none';
      
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Descarga iniciada',
        description: `Descargando ${document.original_name}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: 'Error al descargar',
        description: error.message || 'Ha ocurrido un error al descargar el documento.',
        variant: 'destructive',
      });
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const isImage = document?.mime_type.startsWith('image/');
  const isPdf = document?.mime_type === 'application/pdf';
  const isText = document?.mime_type.startsWith('text/');

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Cargando documento...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-red-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar documento</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={loadDocument} variant="outline">Reintentar</Button>
              <Button onClick={handleDownload} variant="outline">Descargar</Button>
            </div>
          </div>
        </div>
      );
    }

    if (!fileUrl) {
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No se pudo cargar el documento para vista previa</p>
            <Button onClick={handleDownload} variant="outline">Descargar archivo</Button>
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="w-full h-full min-h-[600px] bg-gray-50 rounded-lg">
          <iframe
            src={fileUrl}
            className="w-full h-full rounded-lg border-0"
            style={{ minHeight: '600px' }}
            title={document?.original_name}
            onLoad={() => console.log('PDF iframe loaded successfully')}
            onError={(e) => {
              console.error('PDF iframe error:', e);
              setError('Error al cargar el PDF');
            }}
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="overflow-auto max-h-full w-full flex items-center justify-center p-4 bg-gray-50 rounded-lg">
          <img
            src={fileUrl}
            alt={document?.original_name}
            className="max-w-none rounded-lg shadow-lg"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-in-out'
            }}
            onLoad={() => console.log('Image loaded successfully')}
            onError={(e) => {
              console.error('Image load error:', e);
              setError('Error al cargar la imagen');
            }}
          />
        </div>
      );
    }

    if (isText) {
      return (
        <div className="w-full h-full min-h-[500px] p-4 bg-gray-50 rounded-lg">
          <iframe
            src={fileUrl}
            className="w-full h-full rounded-lg border"
            title={document?.original_name}
            style={{ minHeight: '500px' }}
          />
        </div>
      );
    }

    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Vista previa no disponible</h3>
        <p className="text-gray-500 mb-4">
          Este tipo de archivo ({document?.mime_type}) no se puede visualizar directamente en el navegador.
        </p>
        <Button onClick={handleDownload} className="flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Descargar archivo</span>
        </Button>
      </div>
    );
  };

  if (!isOpen || !document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-lg font-semibold truncate">
            {document.original_name}
          </DialogTitle>
          <DialogDescription>
            Visualizador de documentos - {document.category}
          </DialogDescription>
          
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Tamaño: {Math.round(document.file_size / 1024)} KB • Tipo: {document.mime_type}
            </div>
            
            <div className="flex items-center space-x-2">
              {isImage && fileUrl && (
                <>
                  <Button variant="outline" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-500 min-w-[60px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button variant="outline" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRotate}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetView}>
                    Reset
                  </Button>
                </>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 p-6 pt-2">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
