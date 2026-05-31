import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { format } from 'date-fns';
import type { PostgrestError } from '@supabase/supabase-js';

import { countCatalogCustomers } from '@/lib/customerSearch';
import { isSchemaColumnError } from '@/lib/appointmentSales';
import { fetchDashboardBilling, monthKey } from '@/lib/salesRevenue';

const isMissingRelation = (error: PostgrestError | null) =>
  Boolean(
    error &&
      (error.code === '42P01' ||
        (error.message || '').toLowerCase().includes('relation') ||
        (error.message || '').toLowerCase().includes('does not exist'))
  );

export const useDashboardData = () => {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const opCompanyId = operationalCompanyId ?? companyId;

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: main, isLoading: mainLoading } = useQuery({
    queryKey: ['dashboard-main', companyId, opCompanyId],
    queryFn: async () => {
      if (!companyId || !opCompanyId) return null;

      const billingPromise = fetchDashboardBilling(companyId, 5);
      const customersCountPromise = countCatalogCustomers(supabase, opCompanyId);
      const countsPromise = Promise.all([
        customersCountPromise,
        supabase.from('agenda_appointments').select('id', { count: 'exact', head: true })
          .eq('company_id', opCompanyId)
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`),
        supabase.from('customer_vouchers').select('id', { count: 'exact', head: true })
          .eq('company_id', opCompanyId).eq('is_active', true),
        supabase.from('bonos').select('id', { count: 'exact', head: true })
          .eq('company_id', opCompanyId).eq('estado', 'activo'),
      ]);

      const [billing, [customersCount, appointmentsRes, vouchersRes, bonosRes]] = await Promise.all([
        billingPromise,
        countsPromise,
      ]);

      const bonosCount = isMissingRelation(bonosRes.error) ? 0 : (bonosRes.count || 0);

      const rangeStart = billing.series[0]?.monthStart;
      const rangeEnd = billing.series[billing.series.length - 1]?.monthEnd;
      const quoRes = rangeStart && rangeEnd
        ? await supabase.from('quotes').select('total_amount, created_at').eq('company_id', companyId)
            .gte('created_at', rangeStart.toISOString()).lte('created_at', rangeEnd.toISOString())
        : { data: [] as { total_amount: number | null; created_at: string }[] };

      const quoteBuckets = new Map<string, number>();
      for (const q of quoRes.data ?? []) {
        const key = monthKey(q.created_at);
        quoteBuckets.set(key, (quoteBuckets.get(key) ?? 0) + Number(q.total_amount ?? 0));
      }

      const chartData = billing.series.map(({ monthStart, total }) => {
        const monthName = monthStart.toLocaleDateString('es-ES', { month: 'short' });
        const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        return {
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          ventas: total,
          presupuestos: quoteBuckets.get(key) ?? 0,
        };
      });

      return {
        stats: {
          activeClients: customersCount,
          todayAppointments: appointmentsRes.count || 0,
          activeVouchers: (vouchersRes.count || 0) + bonosCount,
          monthlyRevenue: billing.currentMonth.total,
        },
        chartData,
      };
    },
    enabled: !!companyId && !!opCompanyId && !companyLoading && !wcLoading,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-recent-activity', companyId, opCompanyId],
    queryFn: async () => {
      if (!companyId || !opCompanyId) return [];
      const activities: { type: string; description: string; time: string }[] = [];

      const [invRes, cusRes] = await Promise.all([
        supabase.from('invoices').select('number, created_at').eq('company_id', companyId)
          .order('created_at', { ascending: false }).limit(3),
        supabase.rpc('recent_catalog_customers', {
          p_catalog_company_id: opCompanyId,
          p_limit: 3,
        }),
      ]);

      let aptRows: Array<{ created_at: string; title?: string | null; description?: string | null }> = [];
      for (const select of ['description, created_at', 'created_at', 'title, created_at'] as const) {
        const aptRes = await supabase
          .from('agenda_appointments')
          .select(select)
          .eq('company_id', opCompanyId)
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
      cusRes.data?.forEach((c: { name: string; created_at: string }) => activities.push({
        type: 'cliente', description: `Cliente ${c.name} registrado`, time: getTimeAgo(c.created_at),
      }));

      return activities.sort((a, b) => parseTimeAgo(a.time) - parseTimeAgo(b.time)).slice(0, 8);
    },
    enabled: !!companyId && !!opCompanyId && !companyLoading && !wcLoading,
    staleTime: 2 * 60 * 1000,
  });

  return {
    stats: main?.stats,
    chartData: main?.chartData,
    recentActivity,
    isLoading: mainLoading || activityLoading || companyLoading || wcLoading,
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
