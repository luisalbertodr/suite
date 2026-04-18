
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export interface AgendaAppointment {
  id: string;
  employee_id: string | null;
  customer_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  color: string | null;
  status: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

type CreateAppointmentInput = {
  employee_id?: string | null;
  customer_id?: string | null;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  color?: string | null;
  status?: string;
};

export const useAgendaAppointments = (date?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['agenda-appointments', date, companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const nextCalendarDay = (ymd: string) => {
        const [y, mo, d] = ymd.split('-').map(Number);
        const dt = new Date(y, mo - 1, d);
        dt.setDate(dt.getDate() + 1);
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      let query = supabase
        .from('agenda_appointments')
        .select('*')
        .eq('company_id', companyId)
        .order('start_time');

      if (date) {
        const next = nextCalendarDay(date);
        query = query
          .gte('start_time', `${date}T00:00:00`)
          .lt('start_time', `${next}T00:00:00`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching appointments:', error);
        throw error;
      }

      return (data || []) as AgendaAppointment[];
    },
    enabled: !!companyId,
  });

  const createAppointment = useMutation({
    mutationFn: async (appointment: CreateAppointmentInput) => {
      if (!companyId) throw new Error('No company ID available');
      
      const { data, error } = await supabase
        .from('agenda_appointments')
        .insert([{ ...appointment, company_id: companyId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });
      toast({
        title: 'Cita creada',
        description: 'La cita ha sido creada exitosamente.',
      });
    },
    onError: (error: any) => {
      console.error('Error creating appointment:', error);
      toast({
        title: 'Error al crear cita',
        description: error.message || 'Ha ocurrido un error al crear la cita.',
        variant: 'destructive',
      });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgendaAppointment> & { id: string }) => {
      const { data, error } = await supabase
        .from('agenda_appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });
      toast({
        title: 'Cita actualizada',
        description: 'La cita ha sido actualizada exitosamente.',
      });
    },
    onError: (error: any) => {
      console.error('Error updating appointment:', error);
      toast({
        title: 'Error al actualizar cita',
        description: error.message || 'Ha ocurrido un error al actualizar la cita.',
        variant: 'destructive',
      });
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agenda_appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });
      toast({
        title: 'Cita eliminada',
        description: 'La cita ha sido eliminada exitosamente.',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting appointment:', error);
      toast({
        title: 'Error al eliminar cita',
        description: error.message || 'Ha ocurrido un error al eliminar la cita.',
        variant: 'destructive',
      });
    },
  });

  return {
    appointments,
    isLoading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  };
};
