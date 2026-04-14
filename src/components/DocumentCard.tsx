
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
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface DocumentData {
  id: string;
  name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  category_id: string | null;
  description: string | null;
  tags: string[] | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

interface DocumentCardProps {
  document: DocumentData;
  onDelete: (document: DocumentData) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onDelete }) => {
  const { toast } = useToast();

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileText className="w-8 h-8 text-gray-500" />;
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDirectDownload = async () => {
    try {
      console.log('🔽 Starting direct download for:', document.name);
      
      // Use file_url directly
      const link = window.document.createElement('a');
      link.href = document.file_url;
      link.download = document.name;
      link.target = '_blank';
      
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      toast({
        title: 'Descarga iniciada',
        description: `Descargando ${document.name}`,
      });
      
    } catch (error) {
      console.error('❌ Error en descarga directa:', error);
      toast({
        title: 'Error al descargar',
        description: 'No se pudo descargar el archivo. Intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const handleDirectView = () => {
    try {
      console.log('👁️ Opening document in new tab:', document.name);
      
      window.open(document.file_url, '_blank');
      
      toast({
        title: 'Documento abierto',
        description: `${document.name} se ha abierto en una nueva pestaña.`,
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
          {getFileIcon(document.file_type)}
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
            {document.file_type && (
              <>
                <span className="mx-2">•</span>
                <span className="text-blue-600">{document.file_type}</span>
              </>
            )}
          </div>
        </div>

        {document.tags && document.tags.length > 0 && (
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
        )}
      </CardContent>
    </Card>
  );
};
