import { useQuery } from '@tanstack/react-query';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import {
  buildEmployeeAgendaHoursMap,
  type DunasoftEmployeeHoursRow,
} from '@/lib/dunasoftAgendaHours';
import {
  chunkArray,
  mapDunasoftEmployees,
  mapPlan2009ToAppointments,
  type DunasoftEmpleadoRow,
  type DunasoftPlan2009Row,
  type DunasoftPlanArtRow,
} from '@/lib/dunasoftAgendaMap';
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

async function fetchDunasoftAgendaDay(dateYmd: string): Promise<DunasoftAgendaDayData> {
  const empRes = await dunasoftSupabase
    .from('empleados')
    .select(
      'codemp,nomemp,ape1emp,ape2emp,verplan,ordplan,obsoleto,colorpf,colorpl,lunes,martes,miercoles,jueves,viernes,sabado,domingo,dia1a,dia1b,dia1c,dia1d,dia2a,dia2b,dia2c,dia2d,dia3a,dia3b,dia3c,dia3d,dia4a,dia4b,dia4c,dia4d,dia5a,dia5b,dia5c,dia5d,dia6a,dia6b,dia6c,dia6d,dia7a,dia7b,dia7c,dia7d'
    );

  if (empRes.error) throw empRes.error;
  const rawEmployees = (empRes.data ?? []) as DunasoftEmpleadoRow[];
  const employees = mapDunasoftEmployees(rawEmployees);

  const planRes = await dunasoftSupabase
    .from('plan2009')
    .select(
      '_row_id,idplan,codemp,codcli,fecha,horini,horfin,texto,nomcli,tel1cli,colfon,collet,facturado,codrec'
    )
    .eq('fecha', dateYmd);

  if (planRes.error) throw planRes.error;
  const plans = (planRes.data ?? []) as DunasoftPlan2009Row[];

  const idplans = [
    ...new Set(
      plans
        .map((p) => (p.idplan != null ? String(p.idplan).trim() : ''))
        .filter(Boolean)
    ),
  ];

  const planArtRows: DunasoftPlanArtRow[] = [];
  for (const chunk of chunkArray(idplans, 150)) {
    if (!chunk.length) continue;
    const artRes = await dunasoftSupabase
      .from('planart')
      .select('idplan,codart,hora')
      .in('idplan', chunk);
    if (artRes.error) throw artRes.error;
    planArtRows.push(...((artRes.data ?? []) as DunasoftPlanArtRow[]));
  }

  const codarts = [
    ...new Set(planArtRows.map((r) => String(r.codart ?? '').trim()).filter(Boolean)),
  ];
  const articles = new Map<string, string>();
  for (const chunk of chunkArray(codarts, 200)) {
    if (!chunk.length) continue;
    const artRes = await dunasoftSupabase.from('articulos').select('codart,desart').in('codart', chunk);
    if (artRes.error) throw artRes.error;
    for (const row of artRes.data ?? []) {
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

  const appointments = mapPlan2009ToAppointments(plans, employees, planArtByPlan, articles);

  const employeeAgendaById: DunasoftAgendaDayData['employeeAgendaById'] = {};
  for (const row of rawEmployees) {
    const id = String(row.codemp).trim();
    employeeAgendaById[id] = {
      weekly: buildEmployeeAgendaHoursMap(row as DunasoftEmployeeHoursRow),
      blocks: [],
    };
  }

  return { employees, appointments, employeeAgendaById, rawEmployees };
}

export function useDunasoftAgendaDay(dateYmd: string) {
  return useQuery({
    queryKey: ['dunasoft-agenda-day', dateYmd],
    queryFn: () => fetchDunasoftAgendaDay(dateYmd),
    staleTime: 30_000,
  });
}
