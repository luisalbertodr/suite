
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { fetchAgendaAppointmentsForDay } from '@/lib/agendaAppointmentsQuery';
import {
  parseMissingTableColumn,
  sanitizeAgendaAppointmentWritePayload,
} from '@/lib/agendaAppointmentWrite';

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
  /** Importación legacy; no debe repetirse por empresa (índice único en migración). */
  legacy_planinc_id?: number | null;
  /** IDPLAN Dunasoft: identifica la cita lógica (historial en planinc). */
  legacy_idplan?: string | null;
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

const nullIfBlank = (value: unknown) => {
  const s = String(value ?? '').trim();
  return s ? s : null;
};

async function insertAgendaAppointmentWithFallback(
  payload: Record<string, unknown>
) {
  let candidate = sanitizeAgendaAppointmentWritePayload(payload);
  // Evita bucles infinitos si el esquema devuelve varios faltantes.
  for (let i = 0; i < 8; i += 1) {
    const result = await supabase
      .from('agenda_appointments')
      .insert([candidate])
      .select()
      .single();
    if (!result.error) return result;
    const missing = parseMissingTableColumn(result.error, 'agenda_appointments');
    if (!missing || !(missing in candidate)) return result;
    const { [missing]: _drop, ...rest } = candidate;
    candidate = rest;
  }
  return await supabase
    .from('agenda_appointments')
    .insert([candidate])
    .select()
    .single();
}

function ymdFromStartTime(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (s.includes('T')) {
    const ymd = s.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function updateAgendaAppointmentWithFallback(
  id: string,
  payload: Record<string, unknown>
) {
  let candidate = sanitizeAgendaAppointmentWritePayload(payload);
  for (let i = 0; i < 8; i += 1) {
    const result = await supabase
      .from('agenda_appointments')
      .update(candidate)
      .eq('id', id)
      .select()
      .single();
    if (!result.error) return result;
    const missing = parseMissingTableColumn(result.error, 'agenda_appointments');
    if (!missing || !(missing in candidate)) return result;
    const { [missing]: _drop, ...rest } = candidate;
    candidate = rest;
  }
  return await supabase
    .from('agenda_appointments')
    .update(candidate)
    .eq('id', id)
    .select()
    .single();
}

export const useAgendaAppointments = (date?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const scopeCompanyId = operationalCompanyId ?? companyId;

  const {
    data: appointments = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['agenda-appointments', date, scopeCompanyId],
    queryFn: () => fetchAgendaAppointmentsForDay(scopeCompanyId!, date),
    enabled: !!scopeCompanyId && !wcLoading,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 0,
    refetchIntervalInBackground: false,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === date ? previousData : undefined,
  });

  const createAppointment = useMutation({
    mutationFn: async (appointment: CreateAppointmentInput) => {
      if (!scopeCompanyId) throw new Error('No company ID available');
      const titleValue = String((appointment as Record<string, unknown>).title ?? '').trim();
      const clientNameValue = String((appointment as Record<string, unknown>).client_name ?? titleValue).trim();
      const appointmentDate =
        ymdFromStartTime((appointment as Record<string, unknown>).start_time) ||
        ymdFromStartTime((appointment as Record<string, unknown>).appointment_date) ||
        null;
      const { data, error } = await insertAgendaAppointmentWithFallback({
        ...appointment,
        customer_id: nullIfBlank((appointment as Record<string, unknown>).customer_id),
        employee_id: nullIfBlank((appointment as Record<string, unknown>).employee_id),
        client_name: clientNameValue || titleValue || 'Cita',
        ...(appointmentDate ? { appointment_date: appointmentDate } : {}),
        company_id: scopeCompanyId,
      });
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
      const titleValue = String((updates as Record<string, unknown>).title ?? '').trim();
      const clientNameValue = String((updates as Record<string, unknown>).client_name ?? titleValue).trim();
      const appointmentDate =
        ymdFromStartTime((updates as Record<string, unknown>).start_time) ||
        ymdFromStartTime((updates as Record<string, unknown>).appointment_date) ||
        null;
      const { data, error } = await updateAgendaAppointmentWithFallback(
        id,
        {
          ...(updates as Record<string, unknown>),
          customer_id: nullIfBlank((updates as Record<string, unknown>).customer_id),
          employee_id: nullIfBlank((updates as Record<string, unknown>).employee_id),
          ...(titleValue || clientNameValue
            ? { client_name: clientNameValue || titleValue }
            : {}),
          ...(appointmentDate ? { appointment_date: appointmentDate } : {}),
        }
      );
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
    isFetching,
    error,
    refetch,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  };
};
