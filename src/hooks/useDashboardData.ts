import { useEffect, useMemo, useRef } from 'react';
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { format } from 'date-fns';

import { familiesCacheKey } from '@/lib/dashboardBillingCache';
import {
  fetchDashboardRecentActivity,
  type DashboardRecentActivity,
  type DashboardRecentActivityFilter,
} from '@/lib/dashboardRecentActivity';
import { type DashboardCardStats, fetchDashboardCardStats } from '@/lib/dashboardStats';
import {
  dashboardQueryCacheOptions,
  readDashboardQueryCache,
  writeDashboardQueryCache,
} from '@/lib/dashboardQueryCache';
import { fetchReportFamilyNames } from '@/lib/reportCatalogScope';
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

export type { DashboardRecentActivity, DashboardRecentActivityFilter } from '@/lib/dashboardRecentActivity';

type DashboardMainData = {
  stats: DashboardCardStats & { monthlyRevenue: number };
  chartData: Array<{ name: string; ventas: number }>;
};

export const useDashboardData = (
  compareYears?: number[],
  billingView: BillingEntityView = 'both',
  comparisonPeriod?: ComparisonPeriod,
  selectedFamilies: string[] | null = null,
  activityTypeFilter: DashboardRecentActivityFilter = 'all',
) => {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const {
    operationalCompanyId,
    catalogHostCompanyId,
    assignedBillingCompanies,
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
    () => assignedBillingCompanies.map((company) => company.id),
    [assignedBillingCompanies],
  );

  const familiesQueryKey = ['dashboard-families', catalogCompanyId, billingCompanyIds.join(',')] as const;
  const mainQueryKey = ['dashboard-main', companyId, opCompanyId, billingView] as const;
  const activityQueryKey = ['dashboard-recent-activity', companyId, opCompanyId, activityTypeFilter] as const;
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
      return fetchDashboardRecentActivity(companyId, opCompanyId, { typeFilter: activityTypeFilter });
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
