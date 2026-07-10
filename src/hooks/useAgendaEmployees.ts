
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

export interface AgendaEmployee {
  id: string;
  name: string;
  color: string | null;
  company_id: string;
  billing_company_id?: string | null;
  dunasoft_codemp?: string | null;
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

const AGENDA_EMPLOYEE_SELECT =
  'id,name,color,company_id,billing_company_id,dunasoft_codemp,is_active,agenda_sort_order,weekly_hours,unavailability,created_at,updated_at';

const STYLE_EMPLOYEE_SYNC_KEY = 'agenda-employees-style-sync-at';
const STYLE_EMPLOYEE_SYNC_INTERVAL_MS = 5 * 60_000;

async function maybeSyncAgendaEmployeesFromStyle(scopeCompanyId: string) {
  const lastRaw = sessionStorage.getItem(`${STYLE_EMPLOYEE_SYNC_KEY}:${scopeCompanyId}`);
  const last = lastRaw ? Number(lastRaw) : 0;
  if (last && Date.now() - last < STYLE_EMPLOYEE_SYNC_INTERVAL_MS) return;

  try {
    const { error: syncError } = await supabase.rpc('sync_agenda_employees_from_style', {
      p_company_id: scopeCompanyId,
    });
    if (syncError) {
      console.warn('Error syncing agenda employees from Style:', syncError);
      return;
    }
    sessionStorage.setItem(`${STYLE_EMPLOYEE_SYNC_KEY}:${scopeCompanyId}`, String(Date.now()));
  } catch (syncError) {
    console.warn('Unexpected error syncing agenda employees from Style:', syncError);
  }
}
const normalizeStyleEmployeeCode = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/^0+/, '') || '0';

const isAgendaPseudoEmployee = (row: { dunasoft_codemp?: string | null; name?: string | null }): boolean => {
  const codemp = normalizeStyleEmployeeCode(row.dunasoft_codemp);
  if (codemp === '9999999') return true;
  return String(row.name ?? '').trim().toUpperCase() === 'TPV';
};

export const useAgendaEmployees = (options?: UseAgendaEmployeesOptions) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const scopeCompanyId = operationalCompanyId ?? companyId;
  const agendaOnly = options?.agendaOnly !== false;

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['agenda-employees', scopeCompanyId, agendaOnly ? 'active' : 'all'],
    queryFn: async () => {
      if (!scopeCompanyId) return [];

      await maybeSyncAgendaEmployeesFromStyle(scopeCompanyId);

      const baseQuery = () =>
        supabase
          .from('agenda_employees')
          .select(AGENDA_EMPLOYEE_SELECT)
          .eq('company_id', scopeCompanyId)
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

      return (data || [])
        .map((row: any) => ({
          ...row,
          active: row.active ?? row.is_active ?? true,
        }))
        .filter((row: AgendaEmployee) => !isAgendaPseudoEmployee(row));
    },
    enabled: !!scopeCompanyId && !wcLoading,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

  const createEmployee = useMutation({
    mutationFn: async (employee: {
      name: string;
      color?: string;
      active?: boolean;
      agenda_sort_order?: number;
      billing_company_id?: string | null;
    }) => {
      if (!scopeCompanyId) throw new Error('No company ID available');
      const { active, billing_company_id, ...rest } = employee;
      const row: Record<string, unknown> = {
        ...rest,
        company_id: scopeCompanyId,
        is_active: active,
      };
      if (billing_company_id) row.billing_company_id = billing_company_id;
      let data: any = null;
      let error: any = null;

      ({ data, error } = await supabase
        .from('agenda_employees')
        .insert([row])
        .select()
        .single());
      if (error?.code === '42703') {
        const fallback: Record<string, unknown> = { ...rest, active, company_id: scopeCompanyId };
        ({ data, error } = await supabase
          .from('agenda_employees')
          .insert([fallback])
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
