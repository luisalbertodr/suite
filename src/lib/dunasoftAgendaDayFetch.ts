import { supabase } from '@/lib/supabase';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import {
  attachCustomerIdsToAppointments,
  chunkArray,
  mapPlan2009ToAppointments,
  type DunasoftPlan2009Row,
  type DunasoftPlanArtRow,
} from '@/lib/dunasoftAgendaMap';
import { resolveCustomerIdsByLegacyCodcli } from '@/lib/appointmentCustomerResolve';
import type { Appointment, Employee } from '@/types/agenda';

type DayBundlePlanArtRow = DunasoftPlanArtRow & { desart?: string | null };

type DayBundleResponse = {
  plans: DunasoftPlan2009Row[];
  planart: DayBundlePlanArtRow[];
};

function buildPlanArtMaps(planArtRows: DayBundlePlanArtRow[]) {
  const planArtByPlan = new Map<string, DunasoftPlanArtRow[]>();
  const articles = new Map<string, string>();

  for (const row of planArtRows) {
    const key = String(row.idplan ?? '').trim();
    if (key) {
      const list = planArtByPlan.get(key) ?? [];
      list.push(row);
      planArtByPlan.set(key, list);
    }
    const code = String(row.codart ?? '').trim();
    if (code) {
      const des = String(row.desart ?? '').trim();
      articles.set(code, des || code);
    }
  }

  return { planArtByPlan, articles };
}

async function fetchDunasoftDayAppointmentsViaRpc(
  dateYmd: string,
  companyId: string | null,
  employees: Employee[],
): Promise<Appointment[] | null> {
  // La firma aún no está en los types generados; fallback legacy si la RPC no existe.
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: { p_date: string },
    ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  }).rpc('agenda_dunasoft_day_bundle', {
    p_date: dateYmd,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') return null;
    throw error;
  }

  const bundle = (data ?? { plans: [], planart: [] }) as DayBundleResponse;
  const plans = Array.isArray(bundle.plans) ? bundle.plans : [];
  const planArtRows = Array.isArray(bundle.planart) ? bundle.planart : [];
  const { planArtByPlan, articles } = buildPlanArtMaps(planArtRows);

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

  return appointments;
}

async function fetchDunasoftDayAppointmentsLegacy(
  dateYmd: string,
  companyId: string | null,
  employees: Employee[],
): Promise<Appointment[]> {
  // schema dunasoft no está tipado en el cliente generado.
  const ds = dunasoftSupabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: unknown; error: { message?: string } | null }>;
        in: (col: string, vals: string[]) => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };

  const planRes = await ds
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
      const artRes = await ds.from('planart').select('idplan,codart,hora').in('idplan', chunk);
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
      if (!chunk.length) return [] as Array<{ codart?: string; desart?: string }>;
      const artRes = await ds.from('articulos').select('codart,desart').in('codart', chunk);
      if (artRes.error) throw artRes.error;
      return (artRes.data ?? []) as Array<{ codart?: string; desart?: string }>;
    }),
  );
  for (const rows of articleResults) {
    for (const row of rows) {
      const code = String(row.codart ?? '').trim();
      const des = String(row.desart ?? '').trim();
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

  return appointments;
}

export async function fetchDunasoftDayAppointments(
  dateYmd: string,
  companyId: string | null,
  employees: Employee[],
): Promise<Appointment[]> {
  try {
    const viaRpc = await fetchDunasoftDayAppointmentsViaRpc(dateYmd, companyId, employees);
    if (viaRpc) return viaRpc;
  } catch (rpcError) {
    console.warn('[dunasoftAgendaDay] RPC bundle falló, usando fetch legacy:', rpcError);
  }
  return fetchDunasoftDayAppointmentsLegacy(dateYmd, companyId, employees);
}
