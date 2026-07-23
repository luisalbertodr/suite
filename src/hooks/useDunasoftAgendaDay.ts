import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import {
  buildEmployeeAgendaHoursMap,
  type DunasoftEmployeeHoursRow,
} from '@/lib/dunasoftAgendaHours';
import {
  attachCustomerIdsToAppointments,
  chunkArray,
  mapDunasoftEmployees,
  mapPlan2009ToAppointments,
  type DunasoftEmpleadoRow,
  type DunasoftPlan2009Row,
  type DunasoftPlanArtRow,
} from '@/lib/dunasoftAgendaMap';
import {
  CUSTOMER_CODCLI_MAP_QUERY_KEY,
  resolveCustomerIdsByLegacyCodcli,
} from '@/lib/appointmentCustomerResolve';
import type { Appointment, Employee } from '@/types/agenda';
import type { AgendaDayHoursMap, AgendaUnavailabilityEntry } from '@/lib/agendaHours';

export type DunasoftAgendaDayData = {
  employees: Employee[];
  appointments: Appointment[];
  employeeAgendaById: Record<
    string,
    { weekly: AgendaDayHoursMap | null; blocks: AgendaUnavailabilityEntry[] }
  >;
  rawEmployees: DunasoftEmpleadoRow[];
};

const EMPLOYEE_SELECT =
  'codemp,nomemp,ape1emp,ape2emp,verplan,ordplan,obsoleto,colorpf,colorpl,lunes,martes,miercoles,jueves,viernes,sabado,domingo,dia1a,dia1b,dia1c,dia1d,dia2a,dia2b,dia2c,dia2d,dia3a,dia3b,dia3c,dia3d,dia4a,dia4b,dia4c,dia4d,dia5a,dia5b,dia5c,dia5d,dia6a,dia6b,dia6c,dia6d,dia7a,dia7b,dia7c,dia7d';

const EMPLOYEES_STALE_MS = 10 * 60_000;

export async function fetchDunasoftEmployees(): Promise<{
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

export async function fetchDunasoftDayAppointments(
  dateYmd: string,
  companyId: string | null,
  employees: Employee[],
): Promise<Pick<DunasoftAgendaDayData, 'appointments'>> {
  const planRes = await dunasoftSupabase
    .from('plan2009')
    .select(
      '_row_id,idplan,codemp,codcli,fecha,horini,horfin,texto,nomcli,tel1cli,colfon,collet,facturado,codrec',
    )
    .eq('fecha', dateYmd);

  if (planRes.error) throw planRes.error;
  const plans = (planRes.data ?? []) as DunasoftPlan2009Row[];

  const idplans = [
    ...new Set(
      plans
        .map((p) => (p.idplan != null ? String(p.idplan).trim() : ''))
        .filter(Boolean),
    ),
  ];

  const planArtChunks = chunkArray(idplans, 150);
  const planArtResults = await Promise.all(
    planArtChunks.map(async (chunk) => {
      if (!chunk.length) return [] as DunasoftPlanArtRow[];
      const artRes = await dunasoftSupabase
        .from('planart')
        .select('idplan,codart,hora')
        .in('idplan', chunk);
      if (artRes.error) throw artRes.error;
      return (artRes.data ?? []) as DunasoftPlanArtRow[];
    }),
  );
  const planArtRows = planArtResults.flat();

  const codarts = [
    ...new Set(planArtRows.map((r) => String(r.codart ?? '').trim()).filter(Boolean)),
  ];
  const articles = new Map<string, string>();
  const articleChunks = chunkArray(codarts, 200);
  const articleResults = await Promise.all(
    articleChunks.map(async (chunk) => {
      if (!chunk.length) return [];
      const artRes = await dunasoftSupabase.from('articulos').select('codart,desart').in('codart', chunk);
      if (artRes.error) throw artRes.error;
      return artRes.data ?? [];
    }),
  );
  for (const rows of articleResults) {
    for (const row of rows) {
      const code = String((row as { codart?: string }).codart ?? '').trim();
      const des = String((row as { desart?: string }).desart ?? '').trim();
      if (code) articles.set(code, des || code);
    }
  }

  const planArtByPlan = new Map<string, DunasoftPlanArtRow[]>();
  for (const row of planArtRows) {
    const key = String(row.idplan ?? '').trim();
    if (!key) continue;
    const list = planArtByPlan.get(key) ?? [];
    list.push(row);
    planArtByPlan.set(key, list);
  }

  let appointments = mapPlan2009ToAppointments(plans, employees, planArtByPlan, articles);

  if (companyId) {
    const legacyCodes = appointments
      .map((a) => a.legacyClientCode)
      .filter((c): c is string => Boolean(c?.trim()));
    if (legacyCodes.length) {
      const legacyMap = await resolveCustomerIdsByLegacyCodcli(companyId, legacyCodes);
      appointments = attachCustomerIdsToAppointments(appointments, legacyMap);
    }
  }

  return { appointments };
}

export function useDunasoftAgendaEmployees(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: ['dunasoft-agenda-employees'],
    queryFn: fetchDunasoftEmployees,
    enabled,
    staleTime: EMPLOYEES_STALE_MS,
    gcTime: 30 * 60_000,
  });
}

export function useDunasoftAgendaDay(
  dateYmd: string,
  companyId: string | null,
  opts?: { enabled?: boolean },
) {
  const panelActive = opts?.enabled ?? true;
  const queryClient = useQueryClient();
  const employeesQuery = useDunasoftAgendaEmployees({ enabled: panelActive && !!dateYmd });

  const dayQuery = useQuery({
    queryKey: ['dunasoft-agenda-day', dateYmd, companyId],
    queryFn: () =>
      fetchDunasoftDayAppointments(dateYmd, companyId, employeesQuery.data?.employees ?? []),
    enabled: panelActive && !!dateYmd && !!employeesQuery.data,
    staleTime: 30_000,
    refetchInterval: panelActive ? 60_000 : false,
    refetchIntervalInBackground: false,
    // Solo conservar datos previos al refrescar el mismo día; al cambiar de fecha no mezclar citas.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === dateYmd ? previousData : undefined,
  });

  const mergedData: DunasoftAgendaDayData | undefined = employeesQuery.data
    ? {
        employees: employeesQuery.data.employees,
        rawEmployees: employeesQuery.data.rawEmployees,
        employeeAgendaById: employeesQuery.data.employeeAgendaById,
        appointments: dayQuery.data?.appointments ?? [],
      }
    : undefined;

  const refetchEmployees = employeesQuery.refetch;
  const refetchDay = dayQuery.refetch;

  /** Actualizar operativo: día siempre; empleados solo si stale (>10 min). */
  const refetch = useCallback(async () => {
    const empUpdatedAt = employeesQuery.dataUpdatedAt ?? 0;
    const employeesStale = !empUpdatedAt || Date.now() - empUpdatedAt > EMPLOYEES_STALE_MS;
    const tasks: Array<Promise<unknown>> = [refetchDay()];
    if (employeesStale) tasks.push(refetchEmployees());
    if (companyId) {
      void queryClient.invalidateQueries({ queryKey: [CUSTOMER_CODCLI_MAP_QUERY_KEY, companyId] });
    }
    await Promise.all(tasks);
  }, [companyId, employeesQuery.dataUpdatedAt, queryClient, refetchDay, refetchEmployees]);

  return {
    data: mergedData,
    isLoading: employeesQuery.isLoading || (dayQuery.isLoading && !dayQuery.data),
    isError: employeesQuery.isError || dayQuery.isError,
    error: employeesQuery.error ?? dayQuery.error,
    refetch,
    refetchDay,
    refetchEmployees,
    isFetching: employeesQuery.isFetching || dayQuery.isFetching,
    isDayLoading: dayQuery.isFetching && !dayQuery.data,
    isDayRefreshing: dayQuery.isFetching && !!dayQuery.data,
    employeesDataUpdatedAt: employeesQuery.dataUpdatedAt,
  };
}
