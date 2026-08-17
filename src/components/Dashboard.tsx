import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Receipt, TrendingUp, Scale, Megaphone, ShoppingBag, MessageSquare,
  Loader2, AlertCircle, RefreshCw, CreditCard, BarChart3, Activity, Calculator,
} from 'lucide-react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  DASHBOARD_ACTIVITY_TYPE_OPTIONS,
  DASHBOARD_RECENT_ACTIVITY_LIMIT,
  type DashboardRecentActivityFilter,
  type DashboardRecentActivityType,
} from '@/lib/dashboardRecentActivity';
import { Reportes } from './Reportes';
import { DashboardFamilySelector } from './DashboardFamilySelector';
import { DashboardCommandBoard } from './DashboardCommandBoard';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import {
  currentMonthRange,
  fetchDashboardCommandBoardStats,
  normalizeCommandBoardStats,
  type CommandBoardStats,
} from '@/lib/dashboardCommandBoard';
import {
  dashboardQueryCacheOptions,
  writeDashboardQueryCache,
} from '@/lib/dashboardQueryCache';
import {
  type BillingEntityView,
  type ComparisonPeriod,
  COMPARISON_MONTH_NAMES,
  comparisonPeriodLabel,
} from '@/lib/salesRevenue';
import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
} from '@/lib/workCenterBilling';
import {
  assignedCompanyIds,
  billingViewFromCompanyId,
  clampBillingView,
  defaultBillingViewForAssigned,
  resolveAllowedBillingViews,
} from '@/lib/billingEntityAccess';
import {
  DashboardSeriesLegend,
  defaultDashboardSeriesVisibility,
  seriesForBillingView,
  type DashboardSeriesId,
  type DashboardSeriesMeta,
} from '@/components/dashboard/DashboardSeriesLegend';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { IncentiveDashboardBoard } from '@/components/incentives/IncentiveDashboardBoard';

function billingCompanyIdForView(view: BillingEntityView): string | null {
  if (view === 'medicina') return MEDICINA_COMPANY_ID;
  if (view === 'estetica') return ESTETICA_COMPANY_ID;
  return null;
}
const YEAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

function yearColorForIndex(idx: number): string {
  return YEAR_COLORS[idx % YEAR_COLORS.length];
}

function seriesLabelFromDataKey(key: string): string {
  if (/_gasto_medicina$/.test(key)) return 'Gasto M';
  if (/_gasto_estetica$/.test(key)) return 'Gasto E';
  if (/_gasto$/.test(key)) return 'Gasto T';
  if (/_beneficio_medicina$/.test(key)) return 'Benef. M';
  if (/_beneficio_estetica$/.test(key)) return 'Benef. E';
  if (/_beneficio$/.test(key)) return 'Benef. T';
  if (/_medicina$/.test(key)) return 'Fact. M';
  if (/_estetica$/.test(key)) return 'Fact. E';
  if (/^\d{4}$/.test(key)) return 'Fact. T';
  return key;
}

function comparisonTooltipFormatter(
  v: number,
  _name: string,
  item: { dataKey?: string | number },
): [string, string] {
  const key = String(item.dataKey ?? '');
  const year = key.match(/^(\d{4})/)?.[1] ?? key;
  const metric = seriesLabelFromDataKey(key);
  return [
    `€${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
    `${year} ${metric}`,
  ];
}

function activityVisual(type: DashboardRecentActivityType): {
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (type) {
    case 'factura':
      return {
        className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
        Icon: Receipt,
      };
    case 'cita':
      return {
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
        Icon: Calendar,
      };
    case 'cliente':
      return {
        className: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600',
        Icon: Users,
      };
    case 'bascula':
      return {
        className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
        Icon: Scale,
      };
    case 'venta':
      return {
        className: 'bg-green-100 dark:bg-green-900/30 text-green-600',
        Icon: ShoppingBag,
      };
    case 'marketing':
      return {
        className: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
        Icon: Megaphone,
      };
    case 'nota_marketing':
      return {
        className: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600',
        Icon: MessageSquare,
      };
  }
}

function renderDashboardSeriesLines(params: {
  years: number[];
  series: DashboardSeriesMeta[];
  visibility: Record<DashboardSeriesId, boolean>;
  keySuffix: string;
}) {
  const { years, series, visibility, keySuffix } = params;

  return years.flatMap((year, idx) => {
    const yearColor = yearColorForIndex(idx);
    return series
      .filter((meta) => visibility[meta.id])
      .map((meta) => (
        <Line
          key={`${meta.id}-${year}-${keySuffix}`}
          type="monotone"
          dataKey={meta.dataKey(year)}
          name={meta.label}
          stroke={meta.strokeForYear(yearColor)}
          strokeWidth={meta.strokeWidth}
          strokeDasharray={meta.strokeDasharray}
          dot={meta.entity === 'total' ? false : { r: 2 }}
          legendType="none"
          connectNulls
        />
      ));
  });
}

function toggleYear(selected: number[], year: number): number[] {
  if (selected.includes(year)) {
    const next = selected.filter((y) => y !== year);
    return next.length ? next : selected;
  }
  return [...selected, year].sort((a, b) => a - b);
}

const BILLING_VIEW_OPTIONS: { id: BillingEntityView; label: string }[] = [
  { id: 'both', label: 'Ambas' },
  { id: 'medicina', label: 'Medicina' },
  { id: 'estetica', label: 'Estética' },
];

type ComparisonPeriodPreset = 'days15' | 'days30' | 'month';

function presetToPeriod(preset: ComparisonPeriodPreset, month: number): ComparisonPeriod {
  if (preset === 'days15') return { mode: 'rolling', days: 15 };
  if (preset === 'days30') return { mode: 'rolling', days: 30 };
  return { mode: 'month', month };
}

function ChartLoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/35 backdrop-blur-[1px]"
      aria-hidden
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nowYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = nowYear; y >= nowYear - 12; y -= 1) years.push(y);
    return years;
  }, [nowYear]);
  const [selectedYears, setSelectedYears] = useState<number[]>([nowYear, nowYear - 1]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[] | null>(null);
  const [activityTypeFilter, setActivityTypeFilter] = useState<DashboardRecentActivityFilter>('all');
  const [seriesVisibility, setSeriesVisibility] = useState<Record<DashboardSeriesId, boolean>>(() =>
    defaultDashboardSeriesVisibility(true, 'both'),
  );
  const defaultRange = useMemo(() => currentMonthRange(), []);
  const [boardFromDate, setBoardFromDate] = useState(defaultRange.from);
  const [boardToDate, setBoardToDate] = useState(defaultRange.to);
  const boardRangeValid = Boolean(boardFromDate && boardToDate && boardFromDate <= boardToDate);

  const { companyId, accessibleCompanies, loading: companyLoading } = useCompanyFilter();
  const { operationalCompanyId, catalogHostCompanyId, loading: wcLoading } = useWorkCenter();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { isSuperuser } = useAuth();
  const { data: isAdminRpc = false } = useQuery({
    queryKey: ['dashboard-is-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        console.warn('is_admin:', error.message);
        return false;
      }
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
  const canSeeCombinedBilling = isSuperuser || isAdminRpc;
  const canSeeReports = hasPermission('reports', 'read');
  const canSeeStatistics = hasPermission('statistics', 'read');
  const canSeeRecentActivity = hasPermission('recent_activity', 'read');
  const canSeeIncentivesBoard = hasPermission('incentives_board', 'read') || hasPermission('incentives', 'read');
  const canSeeResumen = canSeeStatistics || canSeeRecentActivity || canSeeIncentivesBoard;
  const dashboardTabs = useMemo(() => {
    const tabs: Array<'resumen' | 'reportes'> = [];
    if (canSeeResumen) tabs.push('resumen');
    if (canSeeReports) tabs.push('reportes');
    return tabs;
  }, [canSeeResumen, canSeeReports]);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'resumen' | 'reportes'>('resumen');

  useEffect(() => {
    if (permissionsLoading || dashboardTabs.length === 0) return;
    setActiveDashboardTab((prev) => (dashboardTabs.includes(prev) ? prev : dashboardTabs[0]!));
  }, [dashboardTabs, permissionsLoading]);

  const opCompanyId = operationalCompanyId ?? companyId;
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const commandBoardReady = Boolean(
    opCompanyId && catalogCompanyId && !companyLoading && !wcLoading && canSeeStatistics,
  );

  const assignedIds = useMemo(
    () => assignedCompanyIds(accessibleCompanies),
    [accessibleCompanies],
  );
  const billingAccessOpts = useMemo(
    () => ({ canSeeCombined: canSeeCombinedBilling, activeCompanyId: companyId }),
    [canSeeCombinedBilling, companyId],
  );
  const allowedBillingViews = useMemo(
    () => resolveAllowedBillingViews(assignedIds, billingAccessOpts),
    [assignedIds, billingAccessOpts],
  );
  const [billingView, setBillingView] = useState<BillingEntityView>('both');
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPeriodPreset>('days15');
  const [comparisonMonth, setComparisonMonth] = useState(new Date().getMonth() + 1);

  // Admins: pueden Ambas; el resto se ancla a la empresa activa del TopBar (M|E).
  useEffect(() => {
    if (companyLoading || assignedIds.length === 0) return;
    setBillingView((prev) => {
      const allowed = resolveAllowedBillingViews(assignedIds, billingAccessOpts);
      if (!canSeeCombinedBilling) {
        const fromActive = billingViewFromCompanyId(companyId);
        if (fromActive && allowed.includes(fromActive)) return fromActive;
        return defaultBillingViewForAssigned(assignedIds, billingAccessOpts);
      }
      if (allowed.length === 1) return allowed[0]!;
      return allowed.includes(prev) ? prev : defaultBillingViewForAssigned(assignedIds, billingAccessOpts);
    });
  }, [assignedIds, companyLoading, companyId, canSeeCombinedBilling, billingAccessOpts]);

  const commandBoardBillingCompanyId = billingCompanyIdForView(billingView);
  const commandBoardQueryKey = [
    'dashboard-command-board',
    opCompanyId,
    catalogCompanyId,
    boardFromDate,
    boardToDate,
    commandBoardBillingCompanyId ?? 'both',
  ] as const;

  const commandBoardCacheOptions = useMemo(() => {
    const opts = dashboardQueryCacheOptions<CommandBoardStats>(commandBoardQueryKey);
    if (opts.initialData === undefined) return opts;
    const normalized = normalizeCommandBoardStats(opts.initialData);
    if (!normalized) return {};
    return {
      initialData: normalized,
      initialDataUpdatedAt: opts.initialDataUpdatedAt,
    };
  }, [commandBoardQueryKey]);

  const {
    data: commandBoard,
    isLoading: commandBoardLoading,
    isFetching: commandBoardFetching,
    isError: commandBoardError,
    error: commandBoardErrorDetail,
    refetch: refetchCommandBoard,
  } = useQuery({
    queryKey: commandBoardQueryKey,
    queryFn: () =>
      fetchDashboardCommandBoardStats({
        companyId: opCompanyId!,
        catalogCompanyId: catalogCompanyId!,
        fromDate: boardFromDate,
        toDate: boardToDate,
        billingCompanyId: commandBoardBillingCompanyId,
      }),
    enabled: commandBoardReady && boardRangeValid && canSeeStatistics,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    retry: 1,
    placeholderData: keepPreviousData,
    select: (data) => normalizeCommandBoardStats(data) ?? data,
    ...commandBoardCacheOptions,
  });

  useEffect(() => {
    if (commandBoard) writeDashboardQueryCache(commandBoardQueryKey, commandBoard);
  }, [commandBoard, commandBoardQueryKey]);

  const commandBoardShowLoading =
    !commandBoardReady || (commandBoardLoading && !commandBoard);

  const comparisonPeriod = useMemo(
    () => presetToPeriod(comparisonPreset, comparisonMonth),
    [comparisonPreset, comparisonMonth],
  );

  const { stats, yearBilling, dailyComparison, availableFamilies, isMultiEntity, recentActivity, isInitialLoading, isChartsFetching, isBackgroundRefreshing } = useDashboardData(
    selectedYears,
    billingView,
    comparisonPeriod,
    selectedFamilies,
    activityTypeFilter,
  );

  const activityFilterLabel = DASHBOARD_ACTIVITY_TYPE_OPTIONS.find(
    (option) => option.value === activityTypeFilter,
  )?.label ?? 'Todos los tipos';

  const refreshDashboard = () => {
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const root = query.queryKey[0];
        return typeof root === 'string' && root.startsWith('dashboard');
      },
    });
  };

  const topBarActions = useMemo(() => (
    <button
      type="button"
      onClick={refreshDashboard}
      className="inline-flex h-7 items-center rounded-md border bg-card px-2 text-xs transition-colors hover:bg-muted"
    >
      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isBackgroundRefreshing || commandBoardFetching ? 'animate-spin' : ''}`} />
      Actualizar
    </button>
  ), [isBackgroundRefreshing, commandBoardFetching]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-red-500" />
          Inicio
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions],
  );

  const yearSelector = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Años:</span>
      {availableYears.map((year) => {
        const active = selectedYears.includes(year);
        return (
          <button
            key={year}
            type="button"
            onClick={() => setSelectedYears(toggleYear(selectedYears, year))}
            className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {year}
          </button>
        );
      })}
    </div>
  );

  const entitySelector =
    isMultiEntity && canSeeCombinedBilling && allowedBillingViews.length > 1 ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Empresa:</span>
      {BILLING_VIEW_OPTIONS.filter((o) => allowedBillingViews.includes(o.id)).map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setBillingView(clampBillingView(id, assignedIds, billingAccessOpts))}
          className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
            billingView === id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  const chartControls = (
    <div className="flex flex-col items-end gap-2">
      {entitySelector}
      <DashboardFamilySelector
        families={availableFamilies}
        value={selectedFamilies}
        onChange={setSelectedFamilies}
      />
      {yearSelector}
    </div>
  );

  const monthlyRevenueLabel =
    billingView === 'medicina'
      ? 'Facturación Mes (Medicina)'
      : billingView === 'estetica'
        ? 'Facturación Mes (Estética)'
        : 'Facturación Mes';

  const chartRows = yearBilling ?? [];
  const comparisonRows = dailyComparison ?? [];
  const activeSeries = useMemo(
    () => seriesForBillingView(Boolean(isMultiEntity), billingView),
    [isMultiEntity, billingView],
  );

  useEffect(() => {
    setSeriesVisibility(defaultDashboardSeriesVisibility(Boolean(isMultiEntity), billingView));
  }, [isMultiEntity, billingView]);

  const toggleSeries = (id: DashboardSeriesId) => {
    setSeriesVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const legendProps = {
    years: selectedYears,
    yearColor: yearColorForIndex,
    visibility: seriesVisibility,
    onToggle: toggleSeries,
    series: activeSeries,
  };

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Cargando Dashboard</h3>
          <p className="text-muted-foreground mt-1">Obteniendo datos...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    if (canSeeIncentivesBoard) {
      return (
        <div className="space-y-4">
          <IncentiveDashboardBoard />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-12 h-12 text-orange-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Sin datos disponibles</h3>
          <button onClick={refreshDashboard}
            className="mt-3 inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <RefreshCw className="w-4 h-4 mr-2" /> Refrescar
          </button>
        </div>
      </div>
    );
  }

  const bonosByEmployeeLabel = (stats.bonosSoldByEmployee ?? [])
    .filter((row) => row.soldCount > 0)
    .map((row) => `${row.employeeName}: ${row.soldCount}`)
    .join(' · ');

  const statsCards = [
    {
      title: 'Citas Hoy',
      value: `${stats.todayAppointments} / ${stats.todayAppointmentsCharged}`,
      subtitle: 'Agendadas / Cobradas',
      icon: Calendar,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Clientes',
      value: stats.totalClients.toLocaleString('es-ES'),
      subtitle: `${stats.newClientsThisMonth} nuevos (${stats.newClientsSameMonthLastYear} ${nowYear - 1}, ${stats.newClientsSameMonthTwoYearsAgo} ${nowYear - 2})`,
      icon: Users,
      color: 'from-pink-500 to-pink-600',
    },
    {
      title: 'Bonos vendidos',
      value: stats.bonosSoldThisMonth.toString(),
      subtitle: [
        bonosByEmployeeLabel || 'Sin ventas por empleada',
        `${stats.bonosSoldSameMonthLastYear} (${nowYear - 1}) · ${stats.bonosSoldSameMonthTwoYearsAgo} (${nowYear - 2})`,
      ].join(' · '),
      icon: CreditCard,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: monthlyRevenueLabel,
      value: `€${stats.monthlyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      icon: Receipt,
      color: 'from-emerald-500 to-emerald-600',
    },
  ];

  return (
    <div className="relative space-y-4">
      {isBackgroundRefreshing ? (
        <div className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-md border border-border/60 bg-card/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Actualizando…
        </div>
      ) : null}
      <Tabs
        value={activeDashboardTab}
        onValueChange={(value) => setActiveDashboardTab(value as 'resumen' | 'reportes')}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {dashboardTabs.length > 1 ? (
              <TabsList className="h-9">
                {canSeeResumen ? (
                  <TabsTrigger value="resumen" className="text-sm px-3">
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    Resumen
                  </TabsTrigger>
                ) : null}
                {canSeeReports ? (
                  <TabsTrigger value="reportes" className="text-sm px-3">
                    <BarChart3 className="w-4 h-4 mr-1.5" />
                    Reportes
                  </TabsTrigger>
                ) : null}
              </TabsList>
            ) : null}
            <span className="text-xs text-muted-foreground hidden sm:block tabular-nums">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {canSeeResumen ? (
        <TabsContent value="resumen" className="space-y-6 mt-0">
          {canSeeIncentivesBoard ? <IncentiveDashboardBoard /> : null}
          {canSeeStatistics ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-card rounded-xl shadow-lg hover:shadow-xl transition-shadow p-5 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                      {'subtitle' in stat && stat.subtitle ? (
                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">{stat.subtitle}</p>
                      ) : null}
                    </div>
                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : null}

          {canSeeStatistics ? (
          <div className="rounded-xl border bg-card p-5 shadow-lg">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Cuadro de mandos</h3>
                <p className="text-xs text-muted-foreground">Estadísticas al estilo Style para el periodo seleccionado</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Desde</label>
                  <Input
                    type="date"
                    value={boardFromDate}
                    onChange={(e) => setBoardFromDate(e.target.value)}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hasta</label>
                  <Input
                    type="date"
                    value={boardToDate}
                    onChange={(e) => setBoardToDate(e.target.value)}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={!boardRangeValid || commandBoardFetching}
                  onClick={() => void refetchCommandBoard()}
                >
                  {commandBoardFetching ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Calculator className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Calcular
                </Button>
              </div>
            </div>
            {commandBoardShowLoading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : commandBoardError ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  No se pudo cargar el cuadro de mandos.
                  {commandBoardErrorDetail instanceof Error
                    ? ` ${commandBoardErrorDetail.message}`
                    : ''}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => void refetchCommandBoard()}>
                  Reintentar
                </Button>
              </div>
            ) : commandBoard ? (
              <DashboardCommandBoard
                data={commandBoard}
                billingView={billingView}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos para el periodo seleccionado.</p>
            )}
          </div>
          ) : null}

          {canSeeStatistics ? (
          <>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {chartControls}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="relative bg-card rounded-xl shadow-lg p-6 border">
              <ChartLoadingOverlay show={isChartsFetching} />
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">Facturación y beneficio por mes</h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Beneficio = facturación − gastos bancarios importados.
                </p>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={comparisonTooltipFormatter}
                      />
                      {renderDashboardSeriesLines({
                        years: selectedYears,
                        series: activeSeries,
                        visibility: seriesVisibility,
                        keySuffix: 'monthly',
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <DashboardSeriesLegend {...legendProps} />
              </div>
            </div>

            <div className="relative bg-card rounded-xl shadow-lg p-6 border">
              <ChartLoadingOverlay show={isChartsFetching} />
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">Comparativa</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={comparisonPreset}
                      onValueChange={(value) => setComparisonPreset(value as ComparisonPeriodPreset)}
                    >
                      <SelectTrigger className="h-8 w-[200px] text-xs">
                        <SelectValue placeholder="Periodo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days15">Últimos 15 días</SelectItem>
                        <SelectItem value="days30">Último mes (30 días)</SelectItem>
                        <SelectItem value="month">Mes comparativo</SelectItem>
                      </SelectContent>
                    </Select>
                    {comparisonPreset === 'month' ? (
                      <Select
                        value={String(comparisonMonth)}
                        onValueChange={(value) => setComparisonMonth(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPARISON_MONTH_NAMES.map((label, idx) => (
                            <SelectItem key={label} value={String(idx + 1)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" /> IVA incl.
                </div>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={comparisonRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={comparisonTooltipFormatter}
                      />
                      {renderDashboardSeriesLines({
                        years: selectedYears,
                        series: activeSeries,
                        visibility: seriesVisibility,
                        keySuffix: 'daily',
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <DashboardSeriesLegend {...legendProps} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {isMultiEntity
                  ? `Medicina: familias 025, 23-BMED, 33-SKYMEDIC y Fotrej/manchas de 09-Facial. El resto es Estética. ${comparisonPeriodLabel(comparisonPeriod)}. Activa/desactiva curvas en la leyenda (común a ambos gráficos).`
                  : `${comparisonPeriodLabel(comparisonPeriod)}. Selecciona varios años para comparar día a día.`}
              </p>
            </div>
          </div>
          </>
          ) : null}

          {canSeeRecentActivity ? (
          <div className="bg-card rounded-xl shadow-lg p-6 border">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">Actividad Reciente</h3>
                {recentActivity && recentActivity.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {activityTypeFilter === 'all'
                      ? `Últimos ${Math.min(recentActivity.length, DASHBOARD_RECENT_ACTIVITY_LIMIT)} movimientos`
                      : `Últimos ${Math.min(recentActivity.length, DASHBOARD_RECENT_ACTIVITY_LIMIT)} de ${activityFilterLabel.toLowerCase()}`}
                  </p>
                )}
              </div>
              <Select
                value={activityTypeFilter}
                onValueChange={(value) => setActivityTypeFilter(value as DashboardRecentActivityFilter)}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Tipo de evento" />
                </SelectTrigger>
                <SelectContent>
                  {DASHBOARD_ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[min(70vh,720px)] space-y-2 overflow-y-auto pr-1">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((a) => {
                  const { className, Icon } = activityVisual(a.type);
                  return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => navigate(a.href)}
                    className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground">{a.time}</p>
                    </div>
                  </button>
                  );
                })
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <Activity className="mx-auto mb-2 h-7 w-7 opacity-50" />
                  <p className="text-sm">
                    {activityTypeFilter === 'all'
                      ? 'Sin actividad reciente'
                      : `Sin actividad reciente de ${activityFilterLabel.toLowerCase()}`}
                  </p>
                </div>
              )}
            </div>
          </div>
          ) : null}
        </TabsContent>
        ) : null}

        {canSeeReports ? (
        <TabsContent value="reportes" className="mt-0">
          <Reportes embedded />
        </TabsContent>
        ) : null}

        {!permissionsLoading && dashboardTabs.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No tienes permisos para ver reportes, estadísticas ni actividad reciente.
          </div>
        ) : null}
      </Tabs>
    </div>
  );
};
