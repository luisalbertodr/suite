
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgendaEmployee {
  id: string;
  name: string;
  color: string;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useAgendaEmployees = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['agenda-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_employees')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching agenda employees:', error);
        throw error;
      }

      return data as AgendaEmployee[];
    },
  });

  const createEmployee = useMutation({
    mutationFn: async (employee: Omit<AgendaEmployee, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('agenda_employees')
        .insert([employee])
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
