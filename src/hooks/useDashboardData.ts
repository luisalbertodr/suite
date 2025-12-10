import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const useDashboardData = () => {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping dashboard stats');
        return {
          activeClients: 0,
          totalStock: 0,
          monthlyQuotes: 0,
          monthlyRevenue: 0
        };
      }

      console.log('Obteniendo estadísticas del dashboard para empresa:', companyId);
      
      // Obtener clientes de la empresa
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', companyId);
      
      if (customersError) {
        console.error('Error obteniendo clientes:', customersError);
        throw customersError;
      }

      // Obtener artículos en stock de la empresa
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id, stock_actual')
        .eq('company_id', companyId);
      
      if (articlesError) {
        console.error('Error obteniendo artículos:', articlesError);
        throw articlesError;
      }

      // Obtener presupuestos del mes actual de la empresa
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      console.log('Buscando presupuestos entre:', firstDayOfMonth.toISOString(), 'y', lastDayOfMonth.toISOString());

      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('id, total_amount')
        .eq('company_id', companyId)
        .gte('created_at', firstDayOfMonth.toISOString())
        .lte('created_at', lastDayOfMonth.toISOString());
      
      if (quotesError) {
        console.error('Error obteniendo presupuestos:', quotesError);
        throw quotesError;
      }

      // Obtener facturas del mes actual de la empresa
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('company_id', companyId)
        .gte('created_at', firstDayOfMonth.toISOString())
        .lte('created_at', lastDayOfMonth.toISOString());
      
      if (invoicesError) {
        console.error('Error obteniendo facturas:', invoicesError);
        throw invoicesError;
      }

      // Calcular totales
      const totalStock = articles?.reduce((sum, article) => sum + (article.stock_actual || 0), 0) || 0;
      const monthlyRevenue = invoices?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

      console.log('Datos calculados para empresa', companyId, ':', {
        clientes: customers?.length || 0,
        stock: totalStock,
        presupuestos: quotes?.length || 0,
        facturacion: monthlyRevenue
      });

      return {
        activeClients: customers?.length || 0,
        totalStock: totalStock,
        monthlyQuotes: quotes?.length || 0,
        monthlyRevenue: monthlyRevenue
      };
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 5 * 60 * 1000 // Auto-refrescar cada 5 minutos
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['dashboard-chart-data', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping chart data');
        return [];
      }

      console.log('Obteniendo datos del gráfico para empresa:', companyId);
      const chartResults = [];

      // Obtener datos de los últimos 6 meses para la empresa
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthName = date.toLocaleDateString('es-ES', { month: 'short' });
        const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        // Ventas del mes para la empresa
        const { data: monthlyInvoices } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('company_id', companyId)
          .gte('created_at', firstDay.toISOString())
          .lte('created_at', lastDay.toISOString());

        const monthlySales = monthlyInvoices?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

        // Presupuestos del mes para la empresa
        const { data: monthlyQuotes } = await supabase
          .from('quotes')
          .select('total_amount')
          .eq('company_id', companyId)
          .gte('created_at', firstDay.toISOString())
          .lte('created_at', lastDay.toISOString());

        const monthlyQuotesTotal = monthlyQuotes?.reduce((sum, quote) => sum + (quote.total_amount || 0), 0) || 0;

        chartResults.push({
          name: formattedMonth,
          ventas: monthlySales,
          presupuestos: monthlyQuotesTotal
        });
      }

      console.log('Datos del gráfico para empresa', companyId, ':', chartResults);
      return chartResults;
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000 // Refrescar cada 10 minutos
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-recent-activity', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping recent activity');
        return [];
      }

      console.log('Obteniendo actividad reciente para empresa:', companyId);
      const activities = [];

      // Últimas 3 facturas de la empresa
      const { data: recentInvoices } = await supabase
        .from('invoices')
        .select('number, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      recentInvoices?.forEach(invoice => {
        activities.push({
          type: 'factura',
          description: `Nueva factura ${invoice.number} creada`,
          time: getTimeAgo(invoice.created_at)
        });
      });

      // Últimos 3 presupuestos de la empresa
      const { data: recentQuotes } = await supabase
        .from('quotes')
        .select('number, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      recentQuotes?.forEach(quote => {
        activities.push({
          type: 'presupuesto',
          description: `Presupuesto ${quote.number} creado`,
          time: getTimeAgo(quote.created_at)
        });
      });

      // Últimos 3 artículos de la empresa
      const { data: recentArticles } = await supabase
        .from('articles')
        .select('codigo, descripcion, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      recentArticles?.forEach(article => {
        activities.push({
          type: 'articulo',
          description: `Artículo ${article.codigo} - ${article.descripcion} creado`,
          time: getTimeAgo(article.created_at)
        });
      });

      // Últimos 3 proveedores de la empresa
      const { data: recentSuppliers } = await supabase
        .from('suppliers')
        .select('name, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      recentSuppliers?.forEach(supplier => {
        activities.push({
          type: 'proveedor',
          description: `Proveedor ${supplier.name} creado`,
          time: getTimeAgo(supplier.created_at)
        });
      });

      // Últimos 3 albaranes de entrega de la empresa
      const { data: recentDeliveryNotes } = await supabase
        .from('delivery_notes')
        .select('number, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      recentDeliveryNotes?.forEach(note => {
        activities.push({
          type: 'albaran',
          description: `Albarán ${note.number} creado`,
          time: getTimeAgo(note.created_at)
        });
      });

      // Ordenar por fecha más reciente
      const sortedActivities = activities.sort((a, b) => {
        const timeA = parseTimeAgo(a.time);
        const timeB = parseTimeAgo(b.time);
        return timeA - timeB;
      }).slice(0, 8); // Aumentar a 8 elementos para mostrar más actividad

      console.log('Actividad reciente para empresa', companyId, ':', sortedActivities);
      return sortedActivities;
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchInterval: 2 * 60 * 1000 // Refrescar cada 2 minutos
  });

  return {
    stats,
    chartData,
    recentActivity,
    isLoading: statsLoading || chartLoading || activityLoading || companyLoading
  };
};

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'hace unos segundos';
  } else if (diffInMinutes < 60) {
    return `hace ${diffInMinutes} min`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `hace ${days} día${days > 1 ? 's' : ''}`;
  }
}

function parseTimeAgo(timeString: string): number {
  if (timeString === 'hace unos segundos') return 0;
  
  const match = timeString.match(/hace (\d+) (min|hora|día)/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'min': return value;
    case 'hora': return value * 60;
    case 'día': return value * 1440;
    default: return 0;
  }
}
