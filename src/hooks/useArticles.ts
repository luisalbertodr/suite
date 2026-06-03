
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import {
  buildFamilyBillingMap,
  filterArticlesForBillingCompany,
} from '@/lib/billingCompany';

export interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  descripcion_larga: string | null;
  familia: string;
  precio: number;
  precio_compra?: number | null;
  stock_actual: number;
  stock_minimo: number;
  codigo_barras: string | null;
  codigo_serie: string | null;
  foto_url: string | null;
  estado: 'activo' | 'inactivo';
  tipo_producto: 'textil' | 'calzado' | 'standard';
  article_kind?: 'producto' | 'servicio' | 'bono';
  duration_minutes?: number;
  company_id: string | null;
  iva_percentage: number;
  /** Código de artículo en el origen (ej. `BONO:<codbon>`) */
  legacy_codart?: string | null;
  /** Plantilla de composición (servicios/productos incluidos en el precio) */
  bonus_definition_id?: string | null;
  recurso_id?: string | null;
  billing_company_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleFormData {
  codigo: string;
  descripcion: string;
  descripcion_larga: string;
  familia: string;
  precio: number;
  precio_compra: number;
  stock_actual: number;
  stock_minimo: number;
  codigo_barras: string;
  codigo_serie: string;
  estado: 'activo' | 'inactivo';
  talla: string; // Keep for backward compatibility but won't be used
  color: string; // Keep for backward compatibility but won't be used
  tipo_producto: 'textil' | 'calzado' | 'standard';
  article_kind: 'producto' | 'servicio' | 'bono';
  duration_minutes: number;
  iva_percentage: number;
  recurso_id?: string | null;
  foto_url?: string;
  billing_company_id?: string | null;
}

export const useArticles = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const {
    isMultiEntity,
    catalogHostCompanyId,
    loading: wcLoading,
  } = useWorkCenter();

  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const billingScopeId = companyId;

  console.log('useArticles: companyId', companyId, 'catalogCompanyId', catalogCompanyId, 'companyLoading', companyLoading);

  const fetchArticles = async () => {
    if (companyLoading || wcLoading) {
      console.log('useArticles: Company still loading, waiting...');
      return;
    }

    if (!catalogCompanyId) {
      console.log('useArticles: No catalog company ID available');
      setArticles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('useArticles: Fetching articles for catalog:', catalogCompanyId, 'billing scope:', billingScopeId);
      
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('company_id', catalogCompanyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useArticles: Error fetching articles:', error);
        throw error;
      }

      let typedData = (data || []) as Article[];

      if (isMultiEntity && billingScopeId) {
        const { data: families, error: familiesError } = await supabase
          .from('article_families')
          .select('name, billing_company_id')
          .eq('company_id', catalogCompanyId);

        if (familiesError && familiesError.code !== '42703') {
          throw familiesError;
        }

        const familyBillingMap = buildFamilyBillingMap(families ?? []);
        typedData = filterArticlesForBillingCompany(
          typedData,
          billingScopeId,
          familyBillingMap,
          catalogCompanyId,
        );
      }
      
      console.log('useArticles: Articles fetched:', typedData.length);
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

      if (!catalogCompanyId) {
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
      
      const insertRow = {
        ...dataToInsert,
        foto_url,
        company_id: catalogCompanyId,
        billing_company_id:
          dataToInsert.billing_company_id ??
          (isMultiEntity && billingScopeId ? billingScopeId : null),
      };

      console.log('useArticles: Inserting article data:', insertRow);

      const { data, error } = await supabase
        .from('articles')
        .insert([insertRow])
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
      console.log('useArticles: Archiving article:', id);
      const { error } = await supabase
        .from('articles')
        .update({ estado: 'inactivo' })
        .eq('id', id);

      if (error) {
        console.error('useArticles: Error archiving article:', error);
        throw error;
      }

      console.log('useArticles: Article archived successfully');
      setArticles(prev => prev.map(article => (
        article.id === id ? { ...article, estado: 'inactivo' } : article
      )));
      toast.success('Artículo enviado a obsoletos');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error archiving article';
      console.error('useArticles: Error in archiveArticle:', err);
      toast.error('Error al enviar el artículo a obsoletos: ' + message);
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
    console.log('useArticles: useEffect triggered, companyId:', companyId, 'catalogCompanyId:', catalogCompanyId, 'companyLoading:', companyLoading, 'wcLoading:', wcLoading);
    fetchArticles();
  }, [catalogCompanyId, billingScopeId, companyLoading, wcLoading, isMultiEntity]);

  console.log('useArticles: Current state:', {
    articlesCount: articles.length,
    loading: companyLoading || wcLoading || loading,
    error,
    companyId
  });

  return {
    articles,
    loading: companyLoading || wcLoading || loading,
    error,
    createArticle,
    updateArticle,
    deleteArticle,
    generateCode,
    refetch: fetchArticles
  };
};
