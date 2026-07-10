import { useEffect, useMemo, useRef } from 'react';
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { format } from 'date-fns';

import { isSchemaColumnError } from '@/lib/appointmentSales';
import { buildAgendaAppointmentUrl, buildCustomerProfileUrl } from '@/lib/agendaCustomerNavigation';
import { familiesCacheKey } from '@/lib/dashboardBillingCache';
import { type DashboardCardStats, fetchDashboardCardStats } from '@/lib/dashboardStats';
import {
  dashboardQueryCacheOptions,
  readDashboardQueryCache,
  writeDashboardQueryCache,
} from '@/lib/dashboardQueryCache';
import { fetchReportFamilyNames } from '@/lib/reportCatalogScope';
import { repairStyleText } from '@/lib/styleTextEncoding';
import {
  comparisonPeriodCacheKey,
  fetchDailyBillingComparison,
  fetchDashboardBilling,
  fetchLiveMonthBillingForView,
  fetchMonthBillingForView,
  fetchYearBillingSingleYear,
  mergeYearBillingRows,
  type BillingEntityView,
  type ComparisonPeriod,
  type DailyBillingRow,
  type DashboardBillingFamiliesFilter,
  type YearBillingRow,
  type YearBillingYearData,
} from '@/lib/salesRevenue';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';

async function fetchDashboardFamilyNames(
  companyId: string,
  catalogCompanyId: string,
  billingCompanyIds: string[],
  isMultiEntity: boolean,
): Promise<string[]> {
  if (isMultiEntity && billingCompanyIds.length > 0) {
    return fetchReportFamilyNames(catalogCompanyId, billingCompanyIds);
  }
  const { data, error } = await supabase
    .from('article_families')
    .select('name')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row) => String(row.name));
}

export type DashboardRecentActivity = {
  type: 'factura' | 'cita' | 'cliente';
  description: string;
  time: string;
  createdAt: string;
  href: string;
};

type DashboardMainData = {
  stats: DashboardCardStats & { monthlyRevenue: number };
  chartData: Array<{ name: string; ventas: number }>;
};

function appointmentActivityDate(row: {
  appointment_date?: string | null;
  start_time?: string | null;
  created_at: string;
}): string {
  if (row.appointment_date) return String(row.appointment_date).slice(0, 10);
  const start = String(row.start_time ?? '');
  if (start.includes('T')) return start.split('T')[0]!;
  return row.created_at.slice(0, 10);
}

export const useDashboardData = (
  compareYears?: number[],
  billingView: BillingEntityView = 'both',
  comparisonPeriod?: ComparisonPeriod,
  selectedFamilies: string[] | null = null,
) => {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const {
    operationalCompanyId,
    catalogHostCompanyId,
    billingCompanies,
    loading: wcLoading,
    isMultiEntity,
  } = useWorkCenter();
  const opCompanyId = operationalCompanyId ?? companyId;
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const panelActive = useRoutePanelActive();
  const queryClient = useQueryClient();
  const wasPanelActiveRef = useRef(panelActive);

  const today = format(new Date(), 'yyyy-MM-dd');
  const nowYear = new Date().getFullYear();
  const yearsSorted = useMemo(() => {
    const years = compareYears?.length ? compareYears : [nowYear, nowYear - 1];
    return [...years].sort((a, b) => a - b);
  }, [compareYears, nowYear]);

  const period: ComparisonPeriod = comparisonPeriod ?? { mode: 'rolling', days: 15 };
  const periodKey = comparisonPeriodCacheKey(period);
  const familiesKey = familiesCacheKey(selectedFamilies);

  const billingCompanyIds = useMemo(
    () => billingCompanies.map((company) => company.id),
    [billingCompanies],
  );

  const familiesQueryKey = ['dashboard-families', catalogCompanyId, billingCompanyIds.join(',')] as const;
  const mainQueryKey = ['dashboard-main', companyId, opCompanyId, billingView] as const;
  const activityQueryKey = ['dashboard-recent-activity', companyId, opCompanyId] as const;
  const dailyComparisonQueryKey = [
    'dashboard-daily-comparison',
    companyId,
    yearsSorted.join(','),
    periodKey,
    billingView,
    familiesKey,
  ] as const;
  const yearBillingSnapshotKey = [
    'dashboard-year-billing-rows',
    companyId,
    yearsSorted.join(','),
    billingView,
    familiesKey,
  ] as const;

  const familiesFilter = useMemo<DashboardBillingFamiliesFilter>(
    () => ({ selectedFamilies, billingView }),
    [selectedFamilies, billingView],
  );

  const { data: availableFamilies = [] } = useQuery({
    queryKey: familiesQueryKey,
    queryFn: () =>
      fetchDashboardFamilyNames(
        companyId!,
        catalogCompanyId!,
        billingCompanyIds,
        isMultiEntity,
      ),
    enabled: !!companyId && !!catalogCompanyId && !companyLoading && !wcLoading,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...dashboardQueryCacheOptions<string[]>(familiesQueryKey),
  });

  const {
    data: main,
    isLoading: mainLoading,
    isFetching: mainFetching,
  } = useQuery({
    queryKey: mainQueryKey,
    queryFn: async (): Promise<DashboardMainData | null> => {
      if (!companyId || !opCompanyId) return null;

      const billingPromise = fetchDashboardBilling(companyId, 5);
      const monthRevenuePromise = fetchLiveMonthBillingForView(companyId, billingView).catch(() =>
        fetchMonthBillingForView(companyId, billingView).catch(() => null),
      );
      const cardStatsPromise = fetchDashboardCardStats({
        opCompanyId,
        catalogCompanyId: catalogCompanyId!,
        today,
      });

      const [billing, monthRevenue, cardStats] = await Promise.all([
        billingPromise,
        monthRevenuePromise,
        cardStatsPromise,
      ]);

      const chartData = billing.series.map(({ monthStart, total }) => {
        const monthName = monthStart.toLocaleDateString('es-ES', { month: 'short' });
        return {
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          ventas: total,
        };
      });

      return {
        stats: {
          ...cardStats,
          monthlyRevenue: monthRevenue ?? billing.currentMonth.total,
        },
        chartData,
      };
    },
    enabled: !!companyId && !!opCompanyId && !companyLoading && !wcLoading,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: panelActive ? 60 * 1000 : false,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    ...dashboardQueryCacheOptions<DashboardMainData | null>(mainQueryKey),
  });

  const yearQueries = useQueries({
    queries: yearsSorted.map((year) => {
      const yearQueryKey = ['dashboard-year-billing-year', companyId, year, billingView, familiesKey] as const;
      return {
        queryKey: yearQueryKey,
        queryFn: async () => {
          if (!companyId) return null;
          return fetchYearBillingSingleYear(companyId, year, familiesFilter);
        },
        enabled: !!companyId && !companyLoading,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: 'always' as const,
        placeholderData: keepPreviousData,
        ...dashboardQueryCacheOptions<YearBillingYearData | null>(yearQueryKey),
      };
    }),
  });

  const cachedYearBilling = useMemo(
    () => readDashboardQueryCache<YearBillingRow[]>(yearBillingSnapshotKey),
    [yearBillingSnapshotKey],
  );

  const yearBilling = useMemo((): YearBillingRow[] | undefined => {
    const byYear = new Map<number, YearBillingYearData | undefined>();
    for (const year of yearsSorted) {
      const match = yearQueries.find((query) => query.data?.year === year);
      byYear.set(year, match?.data ?? undefined);
    }
    if (!yearsSorted.some((year) => byYear.get(year))) return cachedYearBilling;
    return mergeYearBillingRows(yearsSorted, byYear);
  }, [yearQueries, yearsSorted, cachedYearBilling]);

  const {
    data: dailyComparison,
    isFetching: dailyComparisonFetching,
  } = useQuery({
    queryKey: dailyComparisonQueryKey,
    queryFn: async () => {
      if (!companyId) return [] as DailyBillingRow[];
      return fetchDailyBillingComparison(companyId, yearsSorted, period, familiesFilter);
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    ...dashboardQueryCacheOptions<DailyBillingRow[]>(dailyComparisonQueryKey),
  });

  const {
    data: recentActivity,
    isFetching: activityFetching,
  } = useQuery({
    queryKey: activityQueryKey,
    queryFn: async () => {
      if (!companyId || !opCompanyId) return [] as DashboardRecentActivity[];
      const activities: DashboardRecentActivity[] = [];

      const [invRes, cusRes] = await Promise.all([
        supabase.from('invoices').select('id, number, created_at').eq('company_id', companyId)
          .order('created_at', { ascending: false }).limit(3),
        supabase.from('customers').select('id, name, created_at').eq('company_id', opCompanyId)
          .order('created_at', { ascending: false }).limit(3),
      ]);

      let aptRows: Array<{
        id: string;
        created_at: string;
        customer_id?: string | null;
        client_name?: string | null;
        description?: string | null;
        appointment_date?: string | null;
        start_time?: string | null;
      }> = [];
      for (const select of [
        'id, customer_id, client_name, description, appointment_date, start_time, created_at',
        'id, client_name, description, created_at',
        'id, created_at',
      ] as const) {
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
        if (aptRes.error.code === '57014' || aptRes.status === 500) {
          console.warn('agenda_appointments activity query failed:', aptRes.error.message);
          break;
        }
        if (!isSchemaColumnError(aptRes.error)) break;
      }

      invRes.data?.forEach((i) => activities.push({
        type: 'factura',
        description: `Factura ${repairStyleText(i.number)} creada`,
        time: getTimeAgo(i.created_at),
        createdAt: i.created_at,
        href: `/facturacion?invoice=${i.id}`,
      }));
      aptRows.forEach((a) => {
        const label = repairStyleText(a.client_name || a.description || 'Nueva cita');
        const dateYmd = appointmentActivityDate(a);
        activities.push({
          type: 'cita',
          description: `Cita: ${label}`,
          time: getTimeAgo(a.created_at),
          createdAt: a.created_at,
          href: a.id
            ? buildAgendaAppointmentUrl(dateYmd, a.id, a.customer_id ?? undefined)
            : `/agenda?date=${dateYmd}`,
        });
      });
      cusRes.data?.forEach((c) => activities.push({
        type: 'cliente',
        description: `Cliente ${repairStyleText(c.name)} registrado`,
        time: getTimeAgo(c.created_at),
        createdAt: c.created_at,
        href: buildCustomerProfileUrl(c.id),
      }));

      return activities
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);
    },
    enabled: !!companyId && !!opCompanyId && !companyLoading && !wcLoading,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    ...dashboardQueryCacheOptions<DashboardRecentActivity[]>(activityQueryKey),
  });

  useEffect(() => {
    if (main) writeDashboardQueryCache(mainQueryKey, main);
  }, [main, mainQueryKey]);

  useEffect(() => {
    if (availableFamilies.length) writeDashboardQueryCache(familiesQueryKey, availableFamilies);
  }, [availableFamilies, familiesQueryKey]);

  useEffect(() => {
    if (recentActivity?.length) writeDashboardQueryCache(activityQueryKey, recentActivity);
  }, [recentActivity, activityQueryKey]);

  useEffect(() => {
    if (dailyComparison?.length) writeDashboardQueryCache(dailyComparisonQueryKey, dailyComparison);
  }, [dailyComparison, dailyComparisonQueryKey]);

  useEffect(() => {
    if (yearBilling?.length) writeDashboardQueryCache(yearBillingSnapshotKey, yearBilling);
  }, [yearBilling, yearBillingSnapshotKey]);

  useEffect(() => {
    for (const query of yearQueries) {
      if (query.data) writeDashboardQueryCache(query.queryKey, query.data);
    }
  }, [yearQueries]);

  /** Al volver a Inicio: refresco en background sin bloquear la UI. */
  useEffect(() => {
    const wasActive = wasPanelActiveRef.current;
    wasPanelActiveRef.current = panelActive;
    if (!panelActive || wasActive || !companyId) return;
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const root = query.queryKey[0];
        return typeof root === 'string' && root.startsWith('dashboard');
      },
    });
  }, [panelActive, companyId, queryClient]);

  const yearBillingFetching = yearQueries.some((query) => query.isFetching);
  const hasCachedMain = Boolean(main?.stats);
  const isInitialLoading = (companyLoading || wcLoading) || (mainLoading && !hasCachedMain);
  const isChartsFetching = yearBillingFetching || dailyComparisonFetching;
  const isBackgroundRefreshing =
    panelActive &&
    !isInitialLoading &&
    (mainFetching || activityFetching || isChartsFetching);

  return {
    stats: main?.stats,
    chartData: main?.chartData,
    yearBilling,
    dailyComparison,
    availableFamilies,
    compareYears: yearsSorted,
    comparisonPeriod: period,
    isMultiEntity,
    recentActivity,
    isInitialLoading,
    isChartsFetching,
    isBackgroundRefreshing,
    isLoading: isInitialLoading,
  };
};

function getTimeAgo(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diff < 1) return 'hace unos segundos';
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) { const h = Math.floor(diff / 60); return `hace ${h} hora${h > 1 ? 's' : ''}`; }
  const d = Math.floor(diff / 1440); return `hace ${d} día${d > 1 ? 's' : ''}`;
}
