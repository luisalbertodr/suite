import { supabase } from '@/lib/supabase';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import { countCatalogCustomers } from '@/lib/customerSearch';
import {
  fetchAgendaAppointmentsForDay,
  type AgendaAppointmentDayRow,
} from '@/lib/agendaAppointmentsQuery';
import { parseAppointmentIdFromSaleNotes } from '@/lib/appointmentChargeTotals';
import { isSchemaColumnError } from '@/lib/appointmentSales';
import type { PostgrestError } from '@supabase/supabase-js';

export type BonosSoldByEmployee = {
  employeeName: string;
  soldCount: number;
};

export type DashboardCardStats = {
  todayAppointments: number;
  todayAppointmentsCharged: number;
  totalClients: number;
  newClientsThisMonth: number;
  newClientsSameMonthLastYear: number;
  newClientsSameMonthTwoYearsAgo: number;
  bonosSoldThisMonth: number;
  bonosSoldSameMonthLastYear: number;
  bonosSoldSameMonthTwoYearsAgo: number;
  bonosSoldByEmployee: BonosSoldByEmployee[];
};

const isMissingRelation = (error: PostgrestError | null) =>
  Boolean(
    error &&
      (error.code === '42P01' ||
        (error.message || '').toLowerCase().includes('relation') ||
        (error.message || '').toLowerCase().includes('does not exist')),
  );

function monthDateRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

async function countBonosSoldInMonth(companyId: string, year: number, month: number): Promise<number> {
  const { from, to } = monthDateRange(year, month);
  const [bonosRes, vouchersRes] = await Promise.all([
    supabase
      .from('bonos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('fecha_compra', from)
      .lte('fecha_compra', to),
    supabase
      .from('customer_vouchers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('purchase_date', from)
      .lte('purchase_date', to),
  ]);

  const bonosCount = isMissingRelation(bonosRes.error) ? 0 : (bonosRes.count ?? 0);
  const vouchersCount = isMissingRelation(vouchersRes.error) ? 0 : (vouchersRes.count ?? 0);
  return bonosCount + vouchersCount;
}

async function countStyleNewClientsForMonth(
  catalogCompanyId: string,
  year: number,
  month: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('count_style_new_customers_for_month', {
    p_catalog_company_id: catalogCompanyId,
    p_year: year,
    p_month: month,
  });
  if (error) {
    if (year === new Date().getFullYear() && month === new Date().getMonth() + 1) {
      const { data: fallback, error: fallbackError } = await supabase.rpc(
        'count_style_new_customers_this_month',
        { p_catalog_company_id: catalogCompanyId },
      );
      if (!fallbackError) return Number(fallback ?? 0);
    }
    return 0;
  }
  return Number(data ?? 0);
}

async function fetchBonosSoldByEmployee(
  companyId: string,
  year: number,
  month: number,
): Promise<BonosSoldByEmployee[]> {
  const { data, error } = await supabase.rpc('dashboard_bonos_sold_by_employee', {
    p_company_id: companyId,
    p_year: year,
    p_month: month,
  });
  if (error) {
    if (isMissingRelation(error)) return [];
    return [];
  }
  return (data ?? []).map((row: { employee_name: string; sold_count: number | string }) => ({
    employeeName: String(row.employee_name ?? 'Sin asignar'),
    soldCount: Number(row.sold_count ?? 0),
  }));
}

async function countChargedFromSales(
  appointmentIds: string[],
  companyId: string,
  today: string,
): Promise<Set<string>> {
  const chargedIds = new Set<string>();
  if (appointmentIds.length === 0) return chargedIds;

  const chunkSize = 100;

  for (let i = 0; i < appointmentIds.length; i += chunkSize) {
    const chunk = appointmentIds.slice(i, i + chunkSize);
    const salesRes = await supabase
      .from('sales')
      .select('appointment_id, status, notes')
      .in('appointment_id', chunk)
      .eq('status', 'completed');
    if (!salesRes.error) {
      for (const row of salesRes.data ?? []) {
        if (row.appointment_id) chargedIds.add(String(row.appointment_id));
      }
      continue;
    }
    if (!isSchemaColumnError(salesRes.error)) break;
  }

  if (chargedIds.size < appointmentIds.length) {
    const notesRes = await supabase
      .from('sales')
      .select('appointment_id, status, notes')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (!notesRes.error) {
      const aptSet = new Set(appointmentIds);
      for (const row of notesRes.data ?? []) {
        const aptId =
          (row.appointment_id ? String(row.appointment_id) : null) ??
          parseAppointmentIdFromSaleNotes(row.notes ?? null);
        if (aptId && aptSet.has(aptId)) chargedIds.add(aptId);
      }
    }
  }

  return chargedIds;
}

/** Citas cobradas en Style (plan2009.facturado), enlazadas por legacy_idplan. */
async function countFacturadoFromPlan2009(
  rows: AgendaAppointmentDayRow[],
  today: string,
): Promise<Set<string>> {
  const chargedIds = new Set<string>();
  const idplanToAppointmentId = new Map<string, string>();

  for (const row of rows) {
    const idplan = row.legacy_idplan?.trim();
    if (idplan) idplanToAppointmentId.set(idplan, row.id);
  }
  if (idplanToAppointmentId.size === 0) return chargedIds;

  const idplans = [...idplanToAppointmentId.keys()]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (idplans.length === 0) return chargedIds;

  const chunkSize = 150;
  for (let i = 0; i < idplans.length; i += chunkSize) {
    const chunk = idplans.slice(i, i + chunkSize);
    const { data, error } = await dunasoftSupabase
      .from('plan2009')
      .select('idplan')
      .eq('fecha', today)
      .eq('facturado', true)
      .in('idplan', chunk);
    if (error) {
      console.warn('countFacturadoFromPlan2009:', error);
      break;
    }
    for (const planRow of data ?? []) {
      const aptId = idplanToAppointmentId.get(String(planRow.idplan));
      if (aptId) chargedIds.add(aptId);
    }
  }

  return chargedIds;
}

async function fetchTodayAppointmentChargeStats(
  opCompanyId: string,
  today: string,
): Promise<{ total: number; charged: number }> {
  const appointments = await fetchAgendaAppointmentsForDay(opCompanyId, today);
  const total = appointments.length;
  const activeAppointments = appointments.filter((row) => row.status !== 'cancelled');
  const activeIds = activeAppointments.map((row) => row.id);
  const [chargedFromSales, chargedFromStyle] = await Promise.all([
    countChargedFromSales(activeIds, opCompanyId, today),
    countFacturadoFromPlan2009(activeAppointments, today),
  ]);
  const charged = new Set([...chargedFromSales, ...chargedFromStyle]).size;
  return { total, charged };
}

export async function fetchDashboardCardStats(opts: {
  opCompanyId: string;
  catalogCompanyId: string;
  today?: string;
}): Promise<DashboardCardStats> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    totalClients,
    newClientsThisMonth,
    newClientsSameMonthLastYear,
    newClientsSameMonthTwoYearsAgo,
    todayAppointments,
    bonosSoldThisMonth,
    bonosSoldSameMonthLastYear,
    bonosSoldSameMonthTwoYearsAgo,
    bonosSoldByEmployee,
  ] = await Promise.all([
    countCatalogCustomers(supabase, opts.catalogCompanyId),
    countStyleNewClientsForMonth(opts.catalogCompanyId, year, month),
    countStyleNewClientsForMonth(opts.catalogCompanyId, year - 1, month),
    countStyleNewClientsForMonth(opts.catalogCompanyId, year - 2, month),
    fetchTodayAppointmentChargeStats(opts.opCompanyId, today),
    countBonosSoldInMonth(opts.opCompanyId, year, month),
    countBonosSoldInMonth(opts.opCompanyId, year - 1, month),
    countBonosSoldInMonth(opts.opCompanyId, year - 2, month),
    fetchBonosSoldByEmployee(opts.opCompanyId, year, month),
  ]);

  return {
    todayAppointments: todayAppointments.total,
    todayAppointmentsCharged: todayAppointments.charged,
    totalClients,
    newClientsThisMonth,
    newClientsSameMonthLastYear,
    newClientsSameMonthTwoYearsAgo,
    bonosSoldThisMonth,
    bonosSoldSameMonthLastYear,
    bonosSoldSameMonthTwoYearsAgo,
    bonosSoldByEmployee,
  };
}
