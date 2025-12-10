
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlanillaItem } from './usePlanillas';
import { useCompanyFilter } from './useCompanyFilter';

export const usePlanillaItems = (planillaId?: string) => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { data: items = [], isLoading: loading, error } = useQuery({
    queryKey: ['planilla-items', planillaId],
    queryFn: async () => {
      if (!planillaId) {
        console.log('No planilla ID provided');
        return [];
      }

      console.log('Fetching planilla items for:', planillaId);

      const { data, error } = await supabase
        .from('planilla_items')
        .select('*')
        .eq('planilla_id', planillaId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching planilla items:', error);
        throw error;
      }

      console.log('Fetched planilla items:', data?.length || 0);
      return (data as PlanillaItem[]) || [];
    },
    enabled: !!planillaId,
  });

  const saveItemsMutation = useMutation({
    mutationFn: async (itemsData: PlanillaItem[]) => {
      if (!planillaId) {
        throw new Error('No planilla ID available');
      }

      if (!companyId) {
        throw new Error('No company ID available');
      }

      console.log('Saving planilla items:', itemsData.length, 'for company:', companyId);

      // First, verify that the planilla belongs to the current company
      const { data: planillaData, error: planillaError } = await supabase
        .from('planillas')
        .select('company_id')
        .eq('id', planillaId)
        .single();

      if (planillaError) {
        console.error('Error fetching planilla:', planillaError);
        throw new Error('Error verificando la planilla');
      }

      if (planillaData.company_id !== companyId) {
        throw new Error('No tiene permisos para modificar esta planilla');
      }

      // Delete existing items first
      const { error: deleteError } = await supabase
        .from('planilla_items')
        .delete()
        .eq('planilla_id', planillaId);

      if (deleteError) {
        console.error('Error deleting existing items:', deleteError);
        throw deleteError;
      }

      // Insert new items
      if (itemsData.length > 0) {
        const itemsWithPlanillaId = itemsData.map(item => {
          // Ensure all required fields are present and properly typed
          const cleanItem = {
            planilla_id: planillaId,
            articulo: item.articulo.trim(),
            color: item.color.trim(),
            precio: Number(item.precio) || 0,
            descripcion: item.descripcion?.trim() || null,
          };

          // Add size columns
          SIZE_COLUMNS.forEach(size => {
            (cleanItem as any)[`talla_${size}`] = Number((item as any)[`talla_${size}`]) || 0;
          });

          return cleanItem;
        });

        const { data, error } = await supabase
          .from('planilla_items')
          .insert(itemsWithPlanillaId)
          .select();

        if (error) {
          console.error('Error inserting items:', error);
          throw error;
        }

        console.log('Items saved successfully:', data?.length || 0);
        return data;
      }

      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planilla-items', planillaId] });
      console.log('Items saved and cache invalidated');
    },
    onError: (error) => {
      console.error('Error saving items:', error);
      toast.error(`Error al guardar los items: ${error.message}`);
    },
  });

  return {
    items,
    loading,
    error,
    saveItems: saveItemsMutation.mutateAsync,
    isSaving: saveItemsMutation.isPending,
  };
};

// Size columns constant for consistency
const SIZE_COLUMNS = Array.from({ length: 31 }, (_, i) => i + 16);
