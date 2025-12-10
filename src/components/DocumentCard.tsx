
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Eye, 
  Trash2, 
  FileText, 
  Calendar, 
  Tag 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

interface DocumentCardProps {
  document: DocumentData;
  onDelete: (document: DocumentData) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onDelete }) => {
  const { toast } = useToast();

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return <FileText className="w-8 h-8 text-green-500" />;
    } else if (mimeType.includes('image')) {
      return <FileText className="w-8 h-8 text-purple-500" />;
    }
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDirectDownload = async () => {
    try {
      console.log('🔽 Starting direct download for:', document.original_name);
      
      // Opción 1: Usar URL pública directa
      const publicUrl = `https://kztelbnarzrpbjlqastg.supabase.co/storage/v1/object/public/documents/${document.file_path}`;
      
      // Crear enlace de descarga directo
      const link = window.document.createElement('a');
      link.href = publicUrl;
      link.download = document.original_name;
      link.target = '_blank';
      
      // Agregar al DOM temporalmente
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      toast({
        title: 'Descarga iniciada',
        description: `Descargando ${document.original_name}`,
      });
      
    } catch (error) {
      console.error('❌ Error en descarga directa:', error);
      
      // Fallback: usar método tradicional de Supabase
      try {
        const { data, error: downloadError } = await supabase.storage
          .from('documents')
          .download(document.file_path);

        if (downloadError) throw downloadError;

        const url = URL.createObjectURL(data);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.original_name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Descarga completada',
          description: `${document.original_name} descargado correctamente.`,
        });
      } catch (fallbackError) {
        console.error('❌ Error en descarga fallback:', fallbackError);
        toast({
          title: 'Error al descargar',
          description: 'No se pudo descargar el archivo. Intenta de nuevo.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDirectView = () => {
    try {
      console.log('👁️ Opening document in new tab:', document.original_name);
      
      // URL pública directa para visualización
      const publicUrl = `https://kztelbnarzrpbjlqastg.supabase.co/storage/v1/object/public/documents/${document.file_path}`;
      
      // Abrir en nueva pestaña
      window.open(publicUrl, '_blank');
      
      toast({
        title: 'Documento abierto',
        description: `${document.original_name} se ha abierto en una nueva pestaña.`,
      });
      
    } catch (error) {
      console.error('❌ Error al abrir documento:', error);
      toast({
        title: 'Error al abrir',
        description: 'No se pudo abrir el documento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          {getFileIcon(document.mime_type)}
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDirectView}
              title="Ver documento"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDirectDownload}
              title="Descargar documento"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-500 hover:text-red-700"
              onClick={() => onDelete(document)}
              title="Eliminar documento"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 truncate" title={document.name}>
          {document.name}
        </h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{new Date(document.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">{formatFileSize(document.file_size)}</span>
            <span className="mx-2">•</span>
            <span className="text-blue-600">{document.category}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1">
          {document.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
