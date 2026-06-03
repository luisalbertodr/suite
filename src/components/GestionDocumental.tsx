import React, { useMemo, useState } from 'react';
import { 
  Upload, 
  Search, 
  FolderOpen,
  FileText,
  Plus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { DocumentCard } from './DocumentCard';
import { SimpleDocumentViewer } from './SimpleDocumentViewer';
import { CategoryManager } from './CategoryManager';
import { useDocumentCategories } from '@/hooks/useDocumentCategories';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';

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

export const GestionDocumental: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [viewerDocument, setViewerDocument] = useState<DocumentData | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories } = useDocumentCategories();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: async () => {
      console.log('📁 Fetching documents for company:', companyId);
      
      if (!companyId) {
        console.log('⚠️ No company ID, returning empty array');
        return [];
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching documents:', error);
        throw error;
      }

      console.log('✅ Documents loaded:', data?.length || 0);
      return data as DocumentData[];
    },
    enabled: !!companyId && !companyLoading,
    retry: 1,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, category, tags }: { file: File; category: string; tags: string[] }) => {
      console.log('📤 Starting upload:', file.name);
      
      if (!category) throw new Error('Debe seleccionar una categoría');
      if (!companyId) throw new Error('No se ha podido identificar la empresa');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Subir archivo
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL for the file
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);

      // Insertar registro
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type,
          category_id: category || null,
          tags: tags.length > 0 ? tags : null,
          description: '',
          company_id: companyId
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: 'Documento subido',
        description: 'El documento se ha subido correctamente.',
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadCategory('');
      setUploadTags('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error al subir documento',
        description: error.message || 'Ha ocurrido un error al subir el documento.',
        variant: 'destructive',
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (document: DocumentData) => {
      // Extract filename from file_url
      const urlParts = document.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      await supabase.storage.from('documents').remove([fileName]);
      await supabase.from('documents').delete().eq('id', document.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: 'Documento eliminado',
        description: 'El documento se ha eliminado correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error al eliminar documento',
        description: 'Ha ocurrido un error al eliminar el documento.',
        variant: 'destructive',
      });
    }
  });

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No se encontró información de empresa</h2>
          <p className="text-gray-500 mt-2">Por favor, contacta con el administrador para configurar tu perfil de empresa.</p>
        </div>
      </div>
    );
  }

  const categoryOptions = [
    { id: 'todos', name: 'Todos', count: documents.length },
    ...categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      count: documents.filter(d => d.category_id === cat.id).length
    }))
  ];

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'todos' || 
                           doc.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUpload = () => {
    if (!selectedFile || !uploadCategory) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar un archivo y una categoría.',
        variant: 'destructive',
      });
      return;
    }

    const tags = uploadTags.split(',').map(tag => tag.trim()).filter(tag => tag);
    uploadMutation.mutate({ file: selectedFile, category: uploadCategory, tags });
  };

  const handleViewDocument = (document: DocumentData) => {
    setViewerDocument(document);
    setViewerOpen(true);
  };

  const totalSize = documents.reduce((acc, doc) => acc + doc.file_size, 0);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const topBarActions = useMemo(() => (
    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
      <DialogTrigger asChild>
        <Button className="flex h-7 items-center space-x-1.5 px-2 text-xs">
          <Upload className="w-3.5 h-3.5" />
          <span>Subir Documento</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir Nuevo Documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Archivo</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
            />
          </div>
          <div>
            <Label htmlFor="category">Categoría *</Label>
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tags">Etiquetas (separadas por comas)</Label>
            <Input
              id="tags"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="etiqueta1, etiqueta2, etiqueta3"
            />
          </div>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !uploadCategory || uploadMutation.isPending}
            className="w-full"
          >
            {uploadMutation.isPending ? 'Subiendo...' : 'Subir Documento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ), [categories, handleUpload, selectedFile, uploadCategory, uploadDialogOpen, uploadMutation.isPending, uploadTags]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-500" />
          Gestión Documental
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions],
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Error al cargar documentos</h2>
          <p className="text-gray-500 mt-2">Ha ocurrido un error al cargar los documentos. Por favor, intenta de nuevo.</p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
            className="mt-4"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  console.log('📊 Estado actual:', {
    companyId,
    documentsCount: documents.length,
    filteredCount: filteredDocuments.length,
    isLoading
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Documentos</p>
                <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Categorías</p>
                <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Subidos Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {documents.filter(d => 
                    new Date(d.created_at).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <Upload className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Espacio Usado</p>
                <p className="text-2xl font-bold text-gray-900">{formatFileSize(totalSize)}</p>
              </div>
              <FileText className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar documentos por nombre o etiquetas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex space-x-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categoryOptions.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Grid */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Cargando documentos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onDelete={(doc) => deleteMutation.mutate(doc)}
                />
              ))}
            </div>
          )}

          {filteredDocuments.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron documentos</h3>
                <p className="text-gray-600">Intenta cambiar los filtros o sube un nuevo documento.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryManager documents={documents} />
        </TabsContent>
      </Tabs>

      {/* Simple Document Viewer */}
      <SimpleDocumentViewer
        document={viewerDocument}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
};
