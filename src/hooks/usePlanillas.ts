
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  articulo: string;
  color: string;
  precio: number;
  descripcion?: string;
  talla_16?: number;
  talla_17?: number;
  talla_18?: number;
  talla_19?: number;
  talla_20?: number;
  talla_21?: number;
  talla_22?: number;
  talla_23?: number;
  talla_24?: number;
  talla_25?: number;
  talla_26?: number;
  talla_27?: number;
  talla_28?: number;
  talla_29?: number;
  talla_30?: number;
  talla_31?: number;
  talla_32?: number;
  talla_33?: number;
  talla_34?: number;
  talla_35?: number;
  talla_36?: number;
  talla_37?: number;
  talla_38?: number;
  talla_39?: number;
  talla_40?: number;
  talla_41?: number;
  talla_42?: number;
  talla_43?: number;
  talla_44?: number;
  talla_45?: number;
  talla_46?: number;
  created_at?: string;
  updated_at?: string;
}

interface Planilla {
  id: string;
  codigo: string;
  fecha: string;
  supplier_id?: string;
  company_id: string;
  estado: 'activa' | 'procesada' | 'cancelada';
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
        .select(`
          *,
          suppliers(name)
        `)
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
      
      // First generate the planilla code
      const { data: codigoData, error: codigoError } = await supabase
        .rpc('generate_planilla_code', { company_id: companyId });

      if (codigoError) {
        console.error('Error generating planilla code:', codigoError);
        throw codigoError;
      }

      const codigo = codigoData;
      console.log('Generated planilla code:', codigo);

      // Create the planilla with the generated code
      const planillaData = {
        codigo,
        fecha: formData.fecha,
        supplier_id: formData.supplier_id || null,
        company_id: companyId,
        estado: 'activa' as const,
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
      .eq('company_id', companyId); // Ensure we can only update our company's planillas

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
      .eq('company_id', companyId); // Ensure we can only delete our company's planillas

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
