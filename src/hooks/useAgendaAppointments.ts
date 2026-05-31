
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

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

/** Una fila por legacy_idplan (misma cita lógica). */
function dedupeByLegacyIdPlan<T extends AgendaAppointment>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const p = r.legacy_idplan != null ? String(r.legacy_idplan).trim() : '';
    if (!p) continue;
    const cur = best.get(p);
    if (!cur) {
      best.set(p, r);
      continue;
    }
    const tNew = new Date(r.updated_at || 0).getTime();
    const tOld = new Date(cur.updated_at || 0).getTime();
    if (tNew >= tOld) best.set(p, r);
  }
  return rows.filter((r) => {
    const p = r.legacy_idplan != null ? String(r.legacy_idplan).trim() : '';
    if (!p) return true;
    const chosen = best.get(p);
    return chosen?.id === r.id;
  });
}

/** Evita mostrar la misma cita legacy dos veces si la BD tiene filas duplicadas. */
function dedupeByLegacyPlanincId<T extends AgendaAppointment>(rows: T[]): T[] {
  const best = new Map<number, T>();
  for (const r of rows) {
    const lid = r.legacy_planinc_id;
    if (lid == null || lid === undefined) continue;
    const n = typeof lid === 'number' ? lid : Number(lid);
    if (!Number.isFinite(n)) continue;
    const cur = best.get(n);
    if (!cur) {
      best.set(n, r);
      continue;
    }
    const tNew = new Date(r.updated_at || 0).getTime();
    const tOld = new Date(cur.updated_at || 0).getTime();
    if (tNew >= tOld) best.set(n, r);
  }
  return rows.filter((r) => {
    const lid = r.legacy_planinc_id;
    if (lid == null || lid === undefined) return true;
    const n = typeof lid === 'number' ? lid : Number(lid);
    if (!Number.isFinite(n)) return true;
    const chosen = best.get(n);
    return chosen?.id === r.id;
  });
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

const parseMissingColumnFromPostgrestError = (
  error: { code?: string; message?: string } | null | undefined
): string | null => {
  if (!error) return null;
  if (error.code !== '42703' && error.code !== 'PGRST204') return null;
  const msg = String(error.message || '');
  // Ej: Could not find the 'title' column of 'agenda_appointments' in the schema cache
  const m = msg.match(/'([^']+)' column of 'agenda_appointments'/i);
  return m?.[1] ?? null;
};

async function insertAgendaAppointmentWithFallback(
  payload: Record<string, unknown>
) {
  let candidate = { ...payload };
  // Evita bucles infinitos si el esquema devuelve varios faltantes.
  for (let i = 0; i < 8; i += 1) {
    const result = await supabase
      .from('agenda_appointments')
      .insert([candidate])
      .select()
      .single();
    if (!result.error) return result;
    const missing = parseMissingColumnFromPostgrestError(result.error);
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
  let candidate = { ...payload };
  for (let i = 0; i < 8; i += 1) {
    const result = await supabase
      .from('agenda_appointments')
      .update(candidate)
      .eq('id', id)
      .select()
      .single();
    if (!result.error) return result;
    const missing = parseMissingColumnFromPostgrestError(result.error);
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

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['agenda-appointments', date, scopeCompanyId],
    queryFn: async () => {
      if (!scopeCompanyId) return [];

      const base = supabase
        .from('agenda_appointments')
        .select('*')
        .eq('company_id', scopeCompanyId);

      // Soporta ambos esquemas:
      // - Legacy: appointment_date + start_time(HH:mm)
      // - Moderno: start_time/end_time TIMESTAMP
      // Si existe appointment_date pero las citas importadas tienen solo start_time, legacy devuelve 0 filas: se usa moderno.
      const nextCalendarDay = (ymd: string) => {
        const [y, mo, d] = ymd.split('-').map(Number);
        const dt = new Date(y, mo - 1, d);
        dt.setDate(dt.getDate() + 1);
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      if (date) {
        const legacyResult = await base
          .eq('appointment_date', date)
          .order('start_time');

        if (!legacyResult.error) {
          const legacyRows = (legacyResult.data || []) as AgendaAppointment[];
          if (legacyRows.length > 0) {
            return dedupeByLegacyPlanincId(dedupeByLegacyIdPlan(legacyRows));
          }
        } else if (legacyResult.error.code !== '42703') {
          console.error('Error fetching appointments (legacy mode):', legacyResult.error);
          throw legacyResult.error;
        }
      }

      let modernQuery = base.order('start_time');
      if (date) {
        const next = nextCalendarDay(date);
        modernQuery = modernQuery
          .gte('start_time', `${date}T00:00:00`)
          .lt('start_time', `${next}T00:00:00`);
      }

      const modernResult = await modernQuery;
      if (modernResult.error) {
        console.error('Error fetching appointments (modern mode):', modernResult.error);
        throw modernResult.error;
      }

      return dedupeByLegacyPlanincId(
        dedupeByLegacyIdPlan((modernResult.data || []) as AgendaAppointment[]),
      );
    },
    enabled: !!scopeCompanyId && !wcLoading,
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
        title: titleValue || clientNameValue || 'Cita',
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
            ? {
                title: titleValue || clientNameValue,
                client_name: clientNameValue || titleValue,
              }
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
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  };
};
