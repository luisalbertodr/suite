
import React from 'react';
import { 
  Users, 
  Package, 
  FileText, 
  Receipt, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Activity,
  Loader2,
  AlertCircle,
  RefreshCw,
  Truck,
  ShoppingCart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useDashboardData } from '../hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';

export const Dashboard: React.FC = () => {
  const { stats, chartData, recentActivity, isLoading } = useDashboardData();

  // Función para refrescar datos manualmente
  const { refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    enabled: false
  });

  const handleRefresh = () => {
    console.log('Refrescando datos del dashboard...');
    refetchStats();
    window.location.reload(); // Forzar recarga completa como último recurso
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Cargando Dashboard</h3>
          <p className="text-gray-600 mt-1">Obteniendo datos del sistema...</p>
        </div>
      </div>
    );
  }

  // Mostrar mensaje si no hay datos
  if (!stats && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-12 h-12 text-orange-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">No se pudieron cargar los datos</h3>
          <p className="text-gray-600 mt-1">Intenta refrescar la página</p>
          <button 
            onClick={handleRefresh}
            className="mt-3 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refrescar
          </button>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Clientes Activos',
      value: stats?.activeClients?.toString() || '0',
      change: '+12%',
      icon: Users,
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Artículos en Stock',
      value: stats?.totalStock?.toLocaleString('es-ES') || '0',
      change: '+8%',
      icon: Package,
      color: 'from-green-500 to-green-600'
    },
    {
      title: 'Presupuestos Mes',
      value: stats?.monthlyQuotes?.toString() || '0',
      change: '+25%',
      icon: FileText,
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Facturación Mensual',
      value: `€${(stats?.monthlyRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      change: '+18%',
      icon: Receipt,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Resumen general del sistema</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </button>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm font-medium text-green-600">{stat.change}</span>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Evolución de Ventas</h3>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">Últimos 6 meses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number) => [`€${value.toLocaleString('es-ES')}`, 'Ventas']}
              />
              <Line 
                type="monotone" 
                dataKey="ventas" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Presupuestos vs Ventas</h3>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600">Comparativa mensual</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number, name: string) => [
                  `€${value.toLocaleString('es-ES')}`, 
                  name === 'presupuestos' ? 'Presupuestos' : 'Ventas'
                ]}
              />
              <Bar dataKey="presupuestos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ver todo
          </button>
        </div>
        <div className="space-y-4">
          {recentActivity && recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === 'factura' ? 'bg-green-100 text-green-600' :
                  activity.type === 'cliente' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'presupuesto' ? 'bg-purple-100 text-purple-600' :
                  activity.type === 'articulo' ? 'bg-orange-100 text-orange-600' :
                  activity.type === 'proveedor' ? 'bg-indigo-100 text-indigo-600' :
                  activity.type === 'albaran' ? 'bg-cyan-100 text-cyan-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {activity.type === 'factura' && <Receipt className="w-5 h-5" />}
                  {activity.type === 'cliente' && <Users className="w-5 h-5" />}
                  {activity.type === 'presupuesto' && <FileText className="w-5 h-5" />}
                  {activity.type === 'articulo' && <Package className="w-5 h-5" />}
                  {activity.type === 'proveedor' && <ShoppingCart className="w-5 h-5" />}
                  {activity.type === 'albaran' && <Truck className="w-5 h-5" />}
                  {activity.type === 'stock' && <Package className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay actividad reciente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
