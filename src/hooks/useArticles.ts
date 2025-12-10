
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  descripcion_larga: string | null;
  familia: string;
  precio: number;
  stock_actual: number;
  stock_minimo: number;
  codigo_barras: string | null;
  codigo_serie: string | null;
  foto_url: string | null;
  estado: 'activo' | 'inactivo';
  tipo_producto: 'textil' | 'calzado' | 'standard';
  company_id: string | null;
  iva_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleFormData {
  codigo: string;
  descripcion: string;
  descripcion_larga: string;
  familia: string;
  precio: number;
  stock_actual: number;
  stock_minimo: number;
  codigo_barras: string;
  codigo_serie: string;
  estado: 'activo' | 'inactivo';
  talla: string; // Keep for backward compatibility but won't be used
  color: string; // Keep for backward compatibility but won't be used
  tipo_producto: 'textil' | 'calzado' | 'standard';
  iva_percentage: number;
  foto_url?: string;
}

export const useArticles = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { companyId, loading: companyLoading } = useCompanyFilter();

  console.log('useArticles: companyId', companyId, 'companyLoading', companyLoading);

  const fetchArticles = async () => {
    if (companyLoading) {
      console.log('useArticles: Company still loading, waiting...');
      return;
    }

    if (!companyId) {
      console.log('useArticles: No company ID available');
      setArticles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('useArticles: Fetching articles for company:', companyId);
      
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useArticles: Error fetching articles:', error);
        throw error;
      }
      
      console.log('useArticles: Articles fetched:', data?.length || 0);
      const typedData = (data || []) as Article[];
      setArticles(typedData);
      setError(null);
    } catch (err) {
      console.error('useArticles: Error in fetchArticles:', err);
      setError(err instanceof Error ? err.message : 'Error fetching articles');
      toast.error('Error al cargar los artículos');
    } finally {
      setLoading(false);
    }
  };

  const createArticle = async (articleData: ArticleFormData, imageFile?: File) => {
    try {
      console.log('useArticles: Creating article:', articleData);

      if (!companyId) {
        throw new Error('No company ID available for creating article');
      }

      let foto_url = null;

      // Upload image if provided
      if (imageFile) {
        console.log('useArticles: Uploading image:', imageFile.name);
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${articleData.codigo}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('article-photos')
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error('useArticles: Error uploading image:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('article-photos')
          .getPublicUrl(fileName);
        
        foto_url = publicUrl;
        console.log('useArticles: Image uploaded successfully:', foto_url);
      }

      // Remove talla and color from the data since they're no longer in the table
      const { talla, color, ...dataToInsert } = articleData;
      
      console.log('useArticles: Inserting article data:', { ...dataToInsert, foto_url, company_id: companyId });

      const { data, error } = await supabase
        .from('articles')
        .insert([{ ...dataToInsert, foto_url, company_id: companyId }])
        .select()
        .single();

      if (error) {
        console.error('useArticles: Error creating article:', error);
        throw error;
      }

      console.log('useArticles: Article created successfully:', data);
      const typedData = data as Article;
      setArticles(prev => [typedData, ...prev]);
      toast.success('Artículo creado exitosamente');
      return typedData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error creating article';
      console.error('useArticles: Error in createArticle:', err);
      toast.error('Error al crear el artículo: ' + message);
      throw err;
    }
  };

  const updateArticle = async (id: string, articleData: Partial<ArticleFormData>, imageFile?: File) => {
    try {
      console.log('useArticles: Updating article:', id, articleData);
      let foto_url = undefined;

      // Upload new image if provided
      if (imageFile) {
        console.log('useArticles: Uploading new image for article update');
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${articleData.codigo || id}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('article-photos')
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error('useArticles: Error uploading image for update:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('article-photos')
          .getPublicUrl(fileName);
        
        foto_url = publicUrl;
        console.log('useArticles: New image uploaded successfully:', foto_url);
      }

      // Remove talla and color from the data since they're no longer in the table
      const { talla, color, ...updateData } = articleData;
      
      if (foto_url) {
        updateData.foto_url = foto_url;
      }

      console.log('useArticles: Updating article with data:', updateData);

      const { data, error } = await supabase
        .from('articles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('useArticles: Error updating article:', error);
        throw error;
      }

      console.log('useArticles: Article updated successfully:', data);
      const typedData = data as Article;
      setArticles(prev => prev.map(article => 
        article.id === id ? typedData : article
      ));
      toast.success('Artículo actualizado exitosamente');
      return typedData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating article';
      console.error('useArticles: Error in updateArticle:', err);
      toast.error('Error al actualizar el artículo: ' + message);
      throw err;
    }
  };

  const deleteArticle = async (id: string) => {
    try {
      console.log('useArticles: Deleting article:', id);
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('useArticles: Error deleting article:', error);
        throw error;
      }

      console.log('useArticles: Article deleted successfully');
      setArticles(prev => prev.filter(article => article.id !== id));
      toast.success('Artículo eliminado exitosamente');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting article';
      console.error('useArticles: Error in deleteArticle:', err);
      toast.error('Error al eliminar el artículo: ' + message);
      throw err;
    }
  };

  const generateCode = (familia: string) => {
    const familiaCode = familia.substring(0, 2).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const generatedCode = `${familiaCode}${timestamp}`;
    console.log('useArticles: Generated code for familia', familia, ':', generatedCode);
    return generatedCode;
  };

  useEffect(() => {
    console.log('useArticles: useEffect triggered, companyId:', companyId, 'companyLoading:', companyLoading);
    fetchArticles();
  }, [companyId, companyLoading]);

  console.log('useArticles: Current state:', {
    articlesCount: articles.length,
    loading: companyLoading || loading,
    error,
    companyId
  });

  return {
    articles,
    loading: companyLoading || loading,
    error,
    createArticle,
    updateArticle,
    deleteArticle,
    generateCode,
    refetch: fetchArticles
  };
};
