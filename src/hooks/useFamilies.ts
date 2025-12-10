
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const useFamilies = () => {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const queryClient = useQueryClient();

  console.log('useFamilies: companyId', companyId, 'loading', companyLoading);

  const { data: families = [], isLoading: loading, error } = useQuery({
    queryKey: ['article-families', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping families query');
        return [];
      }

      console.log('Fetching article families for company:', companyId);

      const { data, error } = await supabase
        .from('article_families')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) {
        console.error('Error fetching article families:', error);
        throw error;
      }

      console.log('Fetched article families:', data?.length || 0, data);
      return data?.map(family => family.name) || [];
    },
    enabled: !!companyId && !companyLoading,
  });

  const createFamilyMutation = useMutation({
    mutationFn: async (familyName: string) => {
      if (!companyId) {
        console.error('No company ID available for creating family');
        throw new Error('No company ID available');
      }

      console.log('Creating family:', familyName, 'for company:', companyId);

      const { data, error } = await supabase
        .from('article_families')
        .insert({
          company_id: companyId,
          name: familyName.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating family:', error);
        throw error;
      }

      console.log('Family created successfully:', data);
      return data;
    },
    onSuccess: () => {
      console.log('Invalidating families cache');
      queryClient.invalidateQueries({ queryKey: ['article-families', companyId] });
    },
  });

  const updateFamilyMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      if (!companyId) throw new Error('No company ID available');

      console.log('Updating family from', oldName, 'to', newName);

      const { data, error } = await supabase
        .from('article_families')
        .update({ name: newName.trim() })
        .eq('company_id', companyId)
        .eq('name', oldName)
        .select()
        .single();

      if (error) {
        console.error('Error updating family:', error);
        throw error;
      }

      console.log('Family updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-families', companyId] });
    },
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: async (familyName: string) => {
      if (!companyId) throw new Error('No company ID available');

      console.log('Deleting family:', familyName);

      const { error } = await supabase
        .from('article_families')
        .delete()
        .eq('company_id', companyId)
        .eq('name', familyName);

      if (error) {
        console.error('Error deleting family:', error);
        throw error;
      }

      console.log('Family deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-families', companyId] });
    },
  });

  const ensureVariosFamilyExists = async (): Promise<void> => {
    if (!companyId) {
      console.error('No company ID available for ensuring Varios family');
      throw new Error('No company ID available');
    }

    console.log('Ensuring Varios family exists for company:', companyId);

    // Check if "Varios" family already exists
    const { data: existingFamily, error: checkError } = await supabase
      .from('article_families')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', 'Varios')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if family doesn't exist
      console.error('Error checking for Varios family:', checkError);
      throw checkError;
    }

    // If family doesn't exist, create it
    if (!existingFamily) {
      console.log('Varios family does not exist, creating it');
      const { error: insertError } = await supabase
        .from('article_families')
        .insert({
          company_id: companyId,
          name: 'Varios',
          description: 'Familia por defecto para artículos varios'
        });

      if (insertError) {
        console.error('Error creating Varios family:', insertError);
        throw insertError;
      }
      
      console.log('Varios family created successfully');
      // Invalidate cache to refresh the families list
      queryClient.invalidateQueries({ queryKey: ['article-families', companyId] });
    } else {
      console.log('Varios family already exists');
    }
  };

  const addFamily = async (familyName: string): Promise<boolean> => {
    if (!familyName.trim() || families.includes(familyName.trim())) {
      console.log('Family name is empty or already exists:', familyName);
      return false;
    }

    try {
      await createFamilyMutation.mutateAsync(familyName);
      return true;
    } catch (error) {
      console.error('Error adding family:', error);
      throw error;
    }
  };

  const removeFamily = async (familyName: string): Promise<void> => {
    try {
      await deleteFamilyMutation.mutateAsync(familyName);
    } catch (error) {
      console.error('Error removing family:', error);
      throw error;
    }
  };

  const updateFamily = async (oldName: string, newName: string): Promise<boolean> => {
    if (!newName.trim() || families.includes(newName.trim())) {
      return false;
    }

    try {
      await updateFamilyMutation.mutateAsync({ oldName, newName });
      return true;
    } catch (error) {
      console.error('Error updating family:', error);
      throw error;
    }
  };

  // Legacy method for compatibility
  const saveFamilies = async (newFamilies: string[]) => {
    // This method is kept for backwards compatibility but is not used
    console.warn('saveFamilies is deprecated, use addFamily/removeFamily/updateFamily instead');
  };

  // Log current state
  console.log('useFamilies state:', {
    families,
    familiesCount: families.length,
    loading: companyLoading || loading,
    error,
    companyId
  });

  return {
    families,
    loading: companyLoading || loading,
    saveFamilies,
    addFamily,
    removeFamily,
    updateFamily,
    ensureVariosFamilyExists,
    error
  };
};
