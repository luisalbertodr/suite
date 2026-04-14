
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export interface AgendaEmployee {
  id: string;
  name: string;
  color: string | null;
  email: string | null;
  phone: string | null;
  company_id: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export const useAgendaEmployees = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['agenda-employees', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('agenda_employees')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Error fetching agenda employees:', error);
        throw error;
      }

      return (data || []).map(d => ({ ...d, is_active: d.active })) as unknown as AgendaEmployee[];
    },
    enabled: !!companyId,
  });

  const createEmployee = useMutation({
    mutationFn: async (employee: { name: string; color?: string; email?: string; phone?: string; is_active?: boolean }) => {
      if (!companyId) throw new Error('No company ID available');
      
      const { data, error } = await supabase
        .from('agenda_employees')
        .insert([{ ...employee, company_id: companyId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-employees'] });
      toast({
        title: 'Empleado creado',
        description: 'El empleado ha sido creado exitosamente.',
      });
    },
    onError: (error: any) => {
      console.error('Error creating employee:', error);
      toast({
        title: 'Error al crear empleado',
        description: error.message || 'Ha ocurrido un error al crear el empleado.',
        variant: 'destructive',
      });
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgendaEmployee> & { id: string }) => {
      const { data, error } = await supabase
        .from('agenda_employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-employees'] });
      toast({
        title: 'Empleado actualizado',
        description: 'El empleado ha sido actualizado exitosamente.',
      });
    },
    onError: (error: any) => {
      console.error('Error updating employee:', error);
      toast({
        title: 'Error al actualizar empleado',
        description: error.message || 'Ha ocurrido un error al actualizar el empleado.',
        variant: 'destructive',
      });
    },
  });

  return {
    employees,
    isLoading,
    error,
    createEmployee,
    updateEmployee,
  };
};
