
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgendaAppointment {
  id: string;
  employee_id: string; // UUID from agenda_employees table
  client_name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  appointment_date: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

// Create a type for appointment creation that doesn't require company_id
type CreateAppointmentInput = Omit<AgendaAppointment, 'id' | 'created_at' | 'updated_at' | 'company_id'>;

export const useAgendaAppointments = (date?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['agenda-appointments', date],
    queryFn: async () => {
      let query = supabase
        .from('agenda_appointments')
        .select('*')
        .order('start_time');

      if (date) {
        query = query.eq('appointment_date', date);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching appointments:', error);
        throw error;
      }

      return data as AgendaAppointment[];
    },
  });

  const createAppointment = useMutation({
    mutationFn: async (appointment: CreateAppointmentInput) => {
      const { data, error } = await supabase
        .from('agenda_appointments')
        .insert([appointment])
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
