
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
  active: boolean | null;
  /** Orden en la cuadrícula de agenda (menor = más a la izquierda). */
  agenda_sort_order?: number | null;
  weekly_hours: unknown | null;
  unavailability: unknown | null;
  created_at: string;
  updated_at: string;
}

export type UseAgendaEmployeesOptions = {
  /**
   * true (defecto): solo empleados activos (columnas de agenda, asistencia, etc.).
   * false: todos los registros (pantallas de configuración).
   */
  agendaOnly?: boolean;
};

export const useAgendaEmployees = (options?: UseAgendaEmployeesOptions) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const agendaOnly = options?.agendaOnly !== false;

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['agenda-employees', companyId, agendaOnly ? 'active' : 'all'],
    queryFn: async () => {
      if (!companyId) return [];

      const baseQuery = () =>
        supabase
          .from('agenda_employees')
          .select('*')
          .eq('company_id', companyId)
          .order('agenda_sort_order', { ascending: true })
          .order('name');

      let result = agendaOnly ? await baseQuery().eq('is_active', true) : await baseQuery();
      if (agendaOnly && result.error?.code === '42703') {
        // Compatibilidad con esquemas antiguos que aún usan `active`.
        result = await baseQuery().eq('active', true);
      }
      const { data, error } = result;

      if (error) {
        console.error('Error fetching agenda employees:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        ...row,
        active: row.active ?? row.is_active ?? true,
      })) as AgendaEmployee[];
    },
    enabled: !!companyId,
    retry: false,
  });

  const createEmployee = useMutation({
    mutationFn: async (employee: {
      name: string;
      color?: string;
      email?: string;
      phone?: string;
      active?: boolean;
      agenda_sort_order?: number;
    }) => {
      if (!companyId) throw new Error('No company ID available');
      const { active, ...rest } = employee;
      let data: any = null;
      let error: any = null;

      ({ data, error } = await supabase
        .from('agenda_employees')
        .insert([{ ...rest, is_active: active, company_id: companyId }])
        .select()
        .single());
      if (error?.code === '42703') {
        ({ data, error } = await supabase
          .from('agenda_employees')
          .insert([{ ...rest, active, company_id: companyId }])
          .select()
          .single());
      }

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
      const { active, ...rest } = updates;
      let data: any = null;
      let error: any = null;
      ({ data, error } = await supabase
        .from('agenda_employees')
        .update({ ...rest, ...(active !== undefined ? { is_active: active } : {}) })
        .eq('id', id)
        .select()
        .single());
      if (error?.code === '42703') {
        ({ data, error } = await supabase
          .from('agenda_employees')
          .update({ ...rest, ...(active !== undefined ? { active } : {}) })
          .eq('id', id)
          .select()
          .single());
      }

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
