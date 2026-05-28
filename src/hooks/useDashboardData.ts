import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';
import type { PostgrestError } from '@supabase/supabase-js';

import { isSchemaColumnError } from '@/lib/appointmentSales';
import { fetchPeriodRevenue, fetchMonthlyRevenueSeries } from '@/lib/salesRevenue';

const isMissingRelation = (error: PostgrestError | null) =>
  Boolean(
    error &&
      (error.code === '42P01' ||
        (error.message || '').toLowerCase().includes('relation') ||
        (error.message || '').toLowerCase().includes('does not exist'))
  );

export const useDashboardData = () => {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // Parallel fetches
      const [customersRes, appointmentsRes, vouchersRes, revenueRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('agenda_appointments').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`),
        supabase.from('customer_vouchers').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('is_active', true),
        fetchPeriodRevenue(
          companyId,
          firstDayOfMonth.toISOString(),
          new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate(), 23, 59, 59, 999).toISOString(),
        ),
      ]);

      const bonosRes = await supabase.from('bonos').select('id', { count: 'exact', head: true })
        .eq('company_id', companyId).eq('estado', 'activo');
      const bonosCount = isMissingRelation(bonosRes.error) ? 0 : (bonosRes.count || 0);

      const monthlyRevenue = revenueRes.total;

      return {
        activeClients: customersRes.count || 0,
        todayAppointments: appointmentsRes.count || 0,
        activeVouchers: (vouchersRes.count || 0) + bonosCount,
        monthlyRevenue,
      };
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['dashboard-chart-data', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const revenueSeries = await fetchMonthlyRevenueSeries(companyId, 5);
      const results = [];
      for (const { monthStart, monthEnd, total } of revenueSeries) {
        const monthName = monthStart.toLocaleDateString('es-ES', { month: 'short' });
        const quo = await supabase.from('quotes').select('total_amount').eq('company_id', companyId)
          .gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString());

        results.push({
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          ventas: total,
          presupuestos: quo.data?.reduce((s, x) => s + (x.total_amount || 0), 0) || 0,
        });
      }
      return results;
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-recent-activity', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const activities: { type: string; description: string; time: string }[] = [];

      const [invRes, cusRes] = await Promise.all([
        supabase.from('invoices').select('number, created_at').eq('company_id', companyId)
          .order('created_at', { ascending: false }).limit(3),
        supabase.from('customers').select('name, created_at').eq('company_id', companyId)
          .order('created_at', { ascending: false }).limit(3),
      ]);

      let aptRows: Array<{ created_at: string; title?: string | null; description?: string | null }> = [];
      for (const select of ['description, created_at', 'created_at', 'title, created_at'] as const) {
        const aptRes = await supabase
          .from('agenda_appointments')
          .select(select)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(3);
        if (!aptRes.error) {
          aptRows = (aptRes.data || []) as typeof aptRows;
          break;
        }
        if (!isSchemaColumnError(aptRes.error)) break;
      }

      invRes.data?.forEach(i => activities.push({
        type: 'factura', description: `Factura ${i.number} creada`, time: getTimeAgo(i.created_at),
      }));
      aptRows.forEach((a) => activities.push({
        type: 'cita',
        description: `Cita: ${a.title || a.description || 'Nueva cita'}`,
        time: getTimeAgo(a.created_at),
      }));
      cusRes.data?.forEach(c => activities.push({
        type: 'cliente', description: `Cliente ${c.name} registrado`, time: getTimeAgo(c.created_at),
      }));

      return activities.sort((a, b) => parseTimeAgo(a.time) - parseTimeAgo(b.time)).slice(0, 8);
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 2 * 60 * 1000,
  });

  return {
    stats,
    chartData,
    recentActivity,
    isLoading: statsLoading || chartLoading || activityLoading || companyLoading,
  };
};

function getTimeAgo(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diff < 1) return 'hace unos segundos';
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) { const h = Math.floor(diff / 60); return `hace ${h} hora${h > 1 ? 's' : ''}`; }
  const d = Math.floor(diff / 1440); return `hace ${d} día${d > 1 ? 's' : ''}`;
}

function parseTimeAgo(t: string): number {
  if (t === 'hace unos segundos') return 0;
  const m = t.match(/hace (\d+) (min|hora|día)/);
  if (!m) return 0;
  const v = parseInt(m[1]);
  return m[2] === 'min' ? v : m[2] === 'hora' ? v * 60 : v * 1440;
}
