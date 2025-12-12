
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { toast } from 'sonner';

export interface PlanillaFormData {
  fecha: string;
  supplier_id?: string;
}

export interface PlanillaItem {
  id?: string;
  planilla_id?: string;
  article_id?: string | null;
  customer_id?: string | null;
  description?: string | null;
  notes?: string | null;
  quantity: number;
  row_index: number;
  created_at?: string;
  updated_at?: string;
}

interface Planilla {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  company_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const usePlanillas = () => {
  const { companyId } = useCompanyFilter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: planillas = [], isLoading: loading } = useQuery({
    queryKey: ['planillas', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available for planillas query');
        return [];
      }

      console.log('Fetching planillas for company:', companyId);
      
      const { data, error } = await supabase
        .from('planillas')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching planillas:', error);
        throw error;
      }

      console.log('Planillas fetched:', data?.length || 0);
      return data as Planilla[];
    },
    enabled: !!companyId,
  });

  const createPlanilla = async (formData: PlanillaFormData) => {
    if (!companyId) {
      console.error('No company ID available for creating planilla');
      toast.error('Error: No se pudo obtener la información de la empresa');
      throw new Error('No company ID available');
    }

    setIsCreating(true);
    
    try {
      console.log('Creating planilla with data:', { ...formData, company_id: companyId });
      
      // First generate the planilla code using correct parameter name
      const { data: codigoData, error: codigoError } = await supabase
        .rpc('generate_planilla_code', { p_company_id: companyId });

      if (codigoError) {
        console.error('Error generating planilla code:', codigoError);
        throw codigoError;
      }

      const name = codigoData;
      console.log('Generated planilla code:', name);

      // Create the planilla with the generated code
      const planillaData = {
        name,
        description: `Planilla ${formData.fecha}`,
        start_date: formData.fecha,
        company_id: companyId,
        status: 'active',
      };

      console.log('Inserting planilla with data:', planillaData);

      const { data, error } = await supabase
        .from('planillas')
        .insert([planillaData])
        .select()
        .single();

      if (error) {
        console.error('Error creating planilla:', error);
        toast.error(`Error al crear la planilla: ${error.message}`);
        throw error;
      }

      console.log('Planilla created successfully:', data);
      
      // Invalidate and refetch planillas
      await queryClient.invalidateQueries({ queryKey: ['planillas', companyId] });
      
      toast.success('Planilla creada exitosamente');
      return data;
    } finally {
      setIsCreating(false);
    }
  };

  const updatePlanilla = async ({ id, data }: { id: string; data: Partial<Planilla> }) => {
    if (!companyId) {
      console.error('No company ID available for updating planilla');
      throw new Error('No company ID available');
    }

    console.log('Updating planilla:', id, 'with data:', data);

    const { error } = await supabase
      .from('planillas')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error updating planilla:', error);
      toast.error(`Error al actualizar la planilla: ${error.message}`);
      throw error;
    }

    // Invalidate and refetch planillas
    await queryClient.invalidateQueries({ queryKey: ['planillas', companyId] });
    toast.success('Planilla actualizada exitosamente');
  };

  const deletePlanilla = async (id: string) => {
    if (!companyId) {
      console.error('No company ID available for deleting planilla');
      throw new Error('No company ID available');
    }

    console.log('Deleting planilla:', id);

    const { error } = await supabase
      .from('planillas')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting planilla:', error);
      toast.error(`Error al eliminar la planilla: ${error.message}`);
      throw error;
    }

    // Invalidate and refetch planillas
    await queryClient.invalidateQueries({ queryKey: ['planillas', companyId] });
    toast.success('Planilla eliminada exitosamente');
  };

  return {
    planillas,
    loading,
    createPlanilla,
    updatePlanilla,
    deletePlanilla,
    isCreating,
  };
};
