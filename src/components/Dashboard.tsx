import React from 'react';
import {
  Users, Calendar, Receipt, TrendingUp, DollarSign, Activity,
  Loader2, AlertCircle, RefreshCw, CreditCard, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardData } from '../hooks/useDashboardData';
import { Reportes } from './Reportes';

export const Dashboard: React.FC = () => {
  const { stats, chartData, recentActivity, isLoading } = useDashboardData();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de la clínica</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.location.reload()}
            className="inline-flex items-center px-3 py-2 text-sm bg-card border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </button>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="reportes">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6 mt-4">
          {/* Stats Cards */}
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

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl shadow-lg p-6 border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Evolución de Ventas</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="w-3.5 h-3.5" /> 6 meses
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(v: number) => [`€${v.toLocaleString('es-ES')}`, 'Ventas']}
                  />
                  <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl shadow-lg p-6 border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Presupuestos vs Ventas</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" /> Comparativa
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(v: number, n: string) => [`€${v.toLocaleString('es-ES')}`, n === 'presupuestos' ? 'Presupuestos' : 'Ventas']}
                  />
                  <Bar dataKey="presupuestos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
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

        <TabsContent value="reportes" className="mt-4">
          <Reportes />
        </TabsContent>
      </Tabs>
    </div>
  );
};
