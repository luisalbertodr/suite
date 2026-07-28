import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import {
  buildEmployeeAgendaHoursMap,
  type DunasoftEmployeeHoursRow,
} from '@/lib/dunasoftAgendaHours';
import {
  mapDunasoftEmployees,
  type DunasoftEmpleadoRow,
} from '@/lib/dunasoftAgendaMap';
import { fetchDunasoftDayAppointments } from '@/lib/dunasoftAgendaDayFetch';
import type { Employee } from '@/types/agenda';
import type { AgendaDayHoursMap, AgendaUnavailabilityEntry } from '@/lib/agendaHours';

export type DunasoftAgendaDayData = {
  employees: Employee[];
  appointments: import('@/types/agenda').Appointment[];
  employeeAgendaById: Record<
    string,
    { weekly: AgendaDayHoursMap | null; blocks: AgendaUnavailabilityEntry[] }
  >;
  rawEmployees: DunasoftEmpleadoRow[];
};

const EMPLOYEE_SELECT =
  'codemp,nomemp,ape1emp,ape2emp,verplan,ordplan,obsoleto,colorpf,colorpl,lunes,martes,miercoles,jueves,viernes,sabado,domingo,dia1a,dia1b,dia1c,dia1d,dia2a,dia2b,dia2c,dia2d,dia3a,dia3b,dia3c,dia3d,dia4a,dia4b,dia4c,dia4d,dia5a,dia5b,dia5c,dia5d,dia6a,dia6b,dia6c,dia6d,dia7a,dia7b,dia7c,dia7d';

async function fetchDunasoftEmployees(): Promise<{
  employees: Employee[];
  rawEmployees: DunasoftEmpleadoRow[];
  employeeAgendaById: DunasoftAgendaDayData['employeeAgendaById'];
}> {
  const empRes = await dunasoftSupabase.from('empleados').select(EMPLOYEE_SELECT);
  if (empRes.error) throw empRes.error;

  const rawEmployees = (empRes.data ?? []) as DunasoftEmpleadoRow[];
  const employees = mapDunasoftEmployees(rawEmployees);
  const employeeAgendaById: DunasoftAgendaDayData['employeeAgendaById'] = {};
  for (const row of rawEmployees) {
    const id = String(row.codemp).trim();
    employeeAgendaById[id] = {
      weekly: buildEmployeeAgendaHoursMap(row as DunasoftEmployeeHoursRow),
      blocks: [],
    };
  }

  return { employees, rawEmployees, employeeAgendaById };
}

export function useDunasoftAgendaEmployees() {
  return useQuery({
    queryKey: ['dunasoft-agenda-employees'],
    queryFn: fetchDunasoftEmployees,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useDunasoftAgendaDay(dateYmd: string, companyId: string | null) {
  const employeesQuery = useDunasoftAgendaEmployees();

  const dayQuery = useQuery({
    queryKey: ['dunasoft-agenda-day', dateYmd, companyId],
    queryFn: () =>
      fetchDunasoftDayAppointments(dateYmd, companyId, employeesQuery.data?.employees ?? []),
    enabled: !!dateYmd && !!employeesQuery.data,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === dateYmd ? previousData : undefined,
  });

  const mergedData: DunasoftAgendaDayData | undefined = employeesQuery.data
    ? {
        employees: employeesQuery.data.employees,
        rawEmployees: employeesQuery.data.rawEmployees,
        employeeAgendaById: employeesQuery.data.employeeAgendaById,
        appointments: dayQuery.data ?? [],
      }
    : undefined;

  const refetchEmployees = employeesQuery.refetch;
  const refetchDay = dayQuery.refetch;
  const refetch = useCallback(async () => {
    await Promise.all([refetchEmployees(), refetchDay()]);
  }, [refetchEmployees, refetchDay]);

  return {
    data: mergedData,
    isLoading: employeesQuery.isLoading || (dayQuery.isLoading && !dayQuery.data),
    isError: employeesQuery.isError || dayQuery.isError,
    error: employeesQuery.error ?? dayQuery.error,
    refetch,
    isFetching: employeesQuery.isFetching || dayQuery.isFetching,
    isDayLoading: dayQuery.isFetching && !dayQuery.data,
    isDayRefreshing: dayQuery.isFetching && !!dayQuery.data,
  };
}

export { fetchDunasoftDayAppointments };

export function usePrefetchAdjacentDunasoftAgendaDays(
  selectedDateYmd: string,
  companyId: string | null,
) {
  const queryClient = useQueryClient();
  const employeesQuery = useDunasoftAgendaEmployees();

  useEffect(() => {
    const employees = employeesQuery.data?.employees;
    if (!companyId || !selectedDateYmd || !employees?.length) return;

    const prefetchDay = (ymd: string) => {
      void queryClient.prefetchQuery({
        queryKey: ['dunasoft-agenda-day', ymd, companyId],
        queryFn: () => fetchDunasoftDayAppointments(ymd, companyId, employees),
        staleTime: 30_000,
      });
    };

    const base = new Date(`${selectedDateYmd}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;

    const prev = new Date(base);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(base);
    next.setDate(next.getDate() + 1);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    prefetchDay(fmt(prev));
    prefetchDay(fmt(next));
  }, [companyId, employeesQuery.data?.employees, queryClient, selectedDateYmd]);
}
