import React, { useMemo, useState } from 'react';
import {
  Users, Calendar, Receipt, TrendingUp,
  Loader2, AlertCircle, RefreshCw, CreditCard, BarChart3, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardData } from '../hooks/useDashboardData';
import { Reportes } from './Reportes';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';

const YEAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

function toggleYear(selected: number[], year: number): number[] {
  if (selected.includes(year)) {
    const next = selected.filter((y) => y !== year);
    return next.length ? next : selected;
  }
  return [...selected, year].sort((a, b) => a - b);
}

export const Dashboard: React.FC = () => {
  const nowYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = nowYear; y >= nowYear - 12; y -= 1) years.push(y);
    return years;
  }, [nowYear]);
  const [selectedYears, setSelectedYears] = useState<number[]>([nowYear, nowYear - 1]);

  const { stats, yearBilling, recentActivity, isLoading } = useDashboardData(selectedYears);
  const topBarActions = useMemo(() => (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex h-7 items-center rounded-md border bg-card px-2 text-xs transition-colors hover:bg-muted"
    >
      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
    </button>
  ), []);

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

  const currencyTooltip = (v: number, name: string) => [
    `€${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
    name,
  ];

  if (isLoading) {
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
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-12 h-12 text-orange-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Sin datos disponibles</h3>
          <button onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <RefreshCw className="w-4 h-4 mr-2" /> Refrescar
          </button>
        </div>
      </div>
    );
  }

  const statsCards = [
    { title: 'Citas Hoy', value: stats.todayAppointments.toString(), icon: Calendar, color: 'from-blue-500 to-blue-600' },
    { title: 'Clientes Activos', value: stats.activeClients.toString(), icon: Users, color: 'from-pink-500 to-pink-600' },
    { title: 'Bonos Activos', value: stats.activeVouchers.toString(), icon: CreditCard, color: 'from-purple-500 to-purple-600' },
    {
      title: 'Facturación Mes',
      value: `€${stats.monthlyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      icon: Receipt,
      color: 'from-emerald-500 to-emerald-600',
    },
  ];

  const chartRows = yearBilling ?? [];
  const showPresupuestos = selectedYears.includes(nowYear);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="resumen" className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList className="h-9">
              <TabsTrigger value="resumen" className="text-sm px-3">
                <TrendingUp className="w-4 h-4 mr-1.5" />
                Resumen
              </TabsTrigger>
              <TabsTrigger value="reportes" className="text-sm px-3">
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Reportes
              </TabsTrigger>
            </TabsList>
            <span className="text-xs text-muted-foreground hidden sm:block tabular-nums">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <TabsContent value="resumen" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-card rounded-xl shadow-lg hover:shadow-xl transition-shadow p-5 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl shadow-lg p-6 border">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-semibold text-foreground">Facturación por mes</h3>
                {yearSelector}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(v: number, name: string) => currencyTooltip(v, `Facturación ${name}`)}
                  />
                  <Legend />
                  {selectedYears.map((year, idx) => (
                    <Line
                      key={year}
                      type="monotone"
                      dataKey={String(year)}
                      name={String(year)}
                      stroke={YEAR_COLORS[idx % YEAR_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl shadow-lg p-6 border">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-semibold text-foreground">Comparativa anual</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" /> IVA incl.
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(v: number, name: string) => {
                      if (name === 'presupuestos') return currencyTooltip(v, 'Presupuestos');
                      return currencyTooltip(v, `Facturación ${name}`);
                    }}
                  />
                  <Legend />
                  {selectedYears.map((year, idx) => (
                    <Bar
                      key={year}
                      dataKey={String(year)}
                      name={String(year)}
                      fill={YEAR_COLORS[idx % YEAR_COLORS.length]}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                  {showPresupuestos && (
                    <Bar dataKey="presupuestos" name="Presupuestos" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-muted-foreground mt-2">
                Facturación fiscal Style sync (serie A). Selecciona varios años para comparar.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border">
            <h3 className="text-base font-semibold text-foreground mb-4">Actividad Reciente</h3>
            <div className="space-y-3">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      a.type === 'factura' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                      a.type === 'cita' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                      'bg-pink-100 dark:bg-pink-900/30 text-pink-600'
                    }`}>
                      {a.type === 'factura' && <Receipt className="w-4 h-4" />}
                      {a.type === 'cita' && <Calendar className="w-4 h-4" />}
                      {a.type === 'cliente' && <Users className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.description}</p>
                      <p className="text-xs text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Activity className="w-7 h-7 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividad reciente</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reportes" className="mt-0">
          <Reportes embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};
