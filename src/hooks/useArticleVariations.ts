
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ArticleVariation {
  id?: string;
  article_id?: string;
  talla: string;
  color: string;
  stock_actual: number;
  stock_minimo: number;
  precio: number;
  precio_compra: number;
  codigo_barras?: string;
  estado: 'activo' | 'inactivo';
  iva_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export const useArticleVariations = (articleId?: string) => {
  const [variations, setVariations] = useState<ArticleVariation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVariations = async () => {
    if (!articleId) {
      console.log('❌ fetchVariations: No articleId provided');
      return;
    }

    console.log('🔄 fetchVariations: Starting fetch for articleId:', articleId);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('article_variations')
        .select('*')
        .eq('article_id', articleId)
        .order('talla', { ascending: true });

      console.log('📊 fetchVariations: Supabase response:', { data, error });

      if (error) {
        console.error('❌ fetchVariations: Supabase error:', error);
        throw error;
      }
      
      // Type cast the data to ensure estado is properly typed
      const typedData = (data || []).map(item => ({
        ...item,
        estado: item.estado as 'activo' | 'inactivo'
      }));
      
      console.log('✅ fetchVariations: Processed variations:', typedData);
      setVariations(typedData);
    } catch (error) {
      console.error('❌ fetchVariations: Final error:', error);
      toast.error('Error al cargar las variaciones');
    } finally {
      setLoading(false);
    }
  };

  const createVariations = async (articleId: string, variationsData: Omit<ArticleVariation, 'id' | 'article_id'>[]) => {
    console.log('🔄 createVariations: Starting creation');
    console.log('📝 createVariations: articleId:', articleId);
    console.log('📝 createVariations: variationsData:', variationsData);

    if (variationsData.length === 0) {
      console.log('⚠️ createVariations: No variations data provided');
      return;
    }

    try {
      const variationsWithArticleId = variationsData.map(variation => {
        const processedVariation = {
          ...variation,
          article_id: articleId
        };
        console.log('🔧 createVariations: Processed variation:', processedVariation);
        return processedVariation;
      });

      console.log('📤 createVariations: Sending to Supabase:', variationsWithArticleId);

      const { data, error } = await supabase
        .from('article_variations')
        .insert(variationsWithArticleId)
        .select();

      console.log('📊 createVariations: Supabase response:', { data, error });

      if (error) {
        console.error('❌ createVariations: Supabase error:', error);
        throw error;
      }
      
      // Type cast the returned data
      const typedData = (data || []).map(item => ({
        ...item,
        estado: item.estado as 'activo' | 'inactivo'
      }));
      
      console.log('✅ createVariations: Success, returning:', typedData);
      return typedData;
    } catch (error) {
      console.error('❌ createVariations: Final error:', error);
      console.error('❌ createVariations: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint
      });
      throw error;
    }
  };

  const updateVariation = async (id: string, data: Partial<ArticleVariation>) => {
    console.log('🔄 updateVariation: Starting update for id:', id);
    console.log('📝 updateVariation: data:', data);

    try {
      const { error } = await supabase
        .from('article_variations')
        .update(data)
        .eq('id', id);

      console.log('📊 updateVariation: Supabase response error:', error);

      if (error) {
        console.error('❌ updateVariation: Supabase error:', error);
        throw error;
      }
      
      await fetchVariations();
      toast.success('Variación actualizada exitosamente');
      console.log('✅ updateVariation: Success');
    } catch (error) {
      console.error('❌ updateVariation: Final error:', error);
      toast.error('Error al actualizar la variación');
      throw error;
    }
  };

  const deleteVariation = async (id: string) => {
    console.log('🔄 deleteVariation: Starting delete for id:', id);

    try {
      const { error } = await supabase
        .from('article_variations')
        .delete()
        .eq('id', id);

      console.log('📊 deleteVariation: Supabase response error:', error);

      if (error) {
        console.error('❌ deleteVariation: Supabase error:', error);
        throw error;
      }
      
      await fetchVariations();
      toast.success('Variación eliminada exitosamente');
      console.log('✅ deleteVariation: Success');
    } catch (error) {
      console.error('❌ deleteVariation: Final error:', error);
      toast.error('Error al eliminar la variación');
      throw error;
    }
  };

  useEffect(() => {
    if (articleId) {
      console.log('🔄 useEffect: ArticleId changed, fetching variations for:', articleId);
      fetchVariations();
    }
  }, [articleId]);

  return {
    variations,
    loading,
    createVariations,
    updateVariation,
    deleteVariation,
    refetch: fetchVariations
  };
};
