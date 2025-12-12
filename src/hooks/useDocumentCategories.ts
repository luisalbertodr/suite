
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface DocumentCategory {
  id: string;
  name: string;
  description?: string;
  company_id: string;
  parent_id?: string;
  created_at: string;
}

export const useDocumentCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['document-categories', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      return data as DocumentCategory[] || [];
    },
    enabled: !!companyId,
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!companyId) throw new Error('No company ID available');
      
      const { data, error } = await supabase
        .from('document_categories')
        .insert({ name, description, company_id: companyId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-categories'] });
      toast({
        title: 'Categoría creada',
        description: 'La categoría se ha creado correctamente.',
      });
    },
    onError: (error) => {
      console.error('Create category error:', error);
      toast({
        title: 'Error al crear categoría',
        description: 'Ha ocurrido un error al crear la categoría.',
        variant: 'destructive',
      });
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('document_categories')
        .update({ name, description })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-categories'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: 'Categoría actualizada',
        description: 'La categoría se ha actualizado correctamente.',
      });
    },
    onError: (error) => {
      console.error('Update category error:', error);
      toast({
        title: 'Error al actualizar categoría',
        description: 'Ha ocurrido un error al actualizar la categoría.',
        variant: 'destructive',
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-categories'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: 'Categoría eliminada',
        description: 'La categoría se ha eliminado correctamente.',
      });
    },
    onError: (error) => {
      console.error('Delete category error:', error);
      toast({
        title: 'Error al eliminar categoría',
        description: 'Ha ocurrido un error al eliminar la categoría.',
        variant: 'destructive',
      });
    }
  });

  return {
    categories,
    isLoading,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
};
