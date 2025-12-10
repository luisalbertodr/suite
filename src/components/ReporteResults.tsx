import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Download, 
  Mail, 
  FileText, 
  FileSpreadsheet, 
  Search,
  Eye,
  Filter,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Report {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  filters: string[];
  columns: string[];
}

interface FilterValues {
  fechaDesde?: Date;
  fechaHasta?: Date;
  cliente?: string;
  proveedor?: string;
  estado?: string;
  mostrarGraficos?: boolean;
  incluirTotales?: boolean;
  [key: string]: any;
}

interface ReporteResultsProps {
  report: Report;
  filters: FilterValues;
  onBack: () => void;
}

export const ReporteResults: React.FC<ReporteResultsProps> = ({ report, filters, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Consulta para obtener datos según el tipo de reporte
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report-data', report.id, filters],
    queryFn: async () => {
      switch (report.id) {
        case "facturas-cobrar":
          return await fetchFacturasPorCobrar();
        case "facturacion-mensual":
          return await fetchFacturacionMensual();
        case "facturacion-cliente":
          return await fetchFacturacionPorCliente();
        case "ventas-articulo":
          return await fetchVentasPorArticulo();
        case "listado-clientes":
          return await fetchListadoClientes();
        case "clientes-inactivos":
          return await fetchClientesInactivos();
        case "stock-actual":
          return await fetchStockActual();
        case "facturas-pagar":
          return await fetchFacturasPorPagar();
        case "presupuestos-aceptados":
          return await fetchPresupuestosAceptados();
        case "presupuestos-pendientes":
          return await fetchPresupuestosPendientes();
        case "ratio-conversion":
          return await fetchRatioConversion();
        default:
          return [];
      }
    },
  });

  const fetchFacturasPorCobrar = async () => {
    console.log('Filtros aplicados:', filters); // Para debug
    
    let query = supabase
      .from('invoices')
      .select(`
        id,
        number,
        issue_date,
        due_date,
        total_amount,
        paid_status,
        customers:customer_id (name)
      `)
      .eq('paid_status', false);

    // Aplicar filtro por cliente si está seleccionado
    if (filters.cliente && filters.cliente !== "todos") {
      console.log('Aplicando filtro por cliente:', filters.cliente);
      query = query.eq('customer_id', filters.cliente);
    }

    // Aplicar filtros por fecha
    if (filters.fechaDesde) {
      query = query.gte('issue_date', format(filters.fechaDesde, 'yyyy-MM-dd'));
    }
    if (filters.fechaHasta) {
      query = query.lte('issue_date', format(filters.fechaHasta, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener facturas por cobrar:', error);
      throw error;
    }

    console.log('Datos obtenidos:', data); // Para debug

    return data?.map(invoice => ({
      numero: invoice.number,
      cliente: invoice.customers?.name || 'N/A',
      fechaEmision: format(new Date(invoice.issue_date), 'dd/MM/yyyy'),
      vencimiento: format(new Date(invoice.due_date), 'dd/MM/yyyy'),
      importe: invoice.total_amount,
      diasVencido: Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
    })) || [];
  };

  const fetchFacturacionMensual = async () => {
    console.log('Filtros aplicados para facturación mensual:', filters); // Para debug
    
    let query = supabase
      .from('invoices')
      .select(`
        issue_date, 
        total_amount, 
        number,
        customers:customer_id (name)
      `)
      .order('issue_date', { ascending: false });

    // Aplicar filtro por cliente si está seleccionado
    if (filters.cliente && filters.cliente !== "todos") {
      console.log('Aplicando filtro por cliente en facturación mensual:', filters.cliente);
      query = query.eq('customer_id', filters.cliente);
    }

    // Aplicar filtros por fecha
    if (filters.fechaDesde) {
      query = query.gte('issue_date', format(filters.fechaDesde, 'yyyy-MM-dd'));
    }
    if (filters.fechaHasta) {
      query = query.lte('issue_date', format(filters.fechaHasta, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener facturación mensual:', error);
      throw error;
    }

    console.log('Datos de facturación mensual obtenidos:', data); // Para debug

    // Agrupar por mes
    const monthlyData = data?.reduce((acc: any, invoice) => {
      const month = format(new Date(invoice.issue_date), 'MMMM yyyy', { locale: es });
      if (!acc[month]) {
        acc[month] = { 
          totalFacturado: 0, 
          numFacturas: 0,
          cliente: invoice.customers?.name || 'N/A'
        };
      }
      acc[month].totalFacturado += Number(invoice.total_amount);
      acc[month].numFacturas += 1;
      return acc;
    }, {});

    return Object.entries(monthlyData || {}).map(([mes, data]: [string, any]) => ({
      mes,
      cliente: data.cliente,
      totalFacturado: data.totalFacturado,
      numFacturas: data.numFacturas,
      variacion: 'N/A' // Se podría calcular comparando con el mes anterior
    }));
  };

  const fetchFacturacionPorCliente = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        total_amount,
        customers:customer_id (name)
      `);

    if (error) throw error;

    // Agrupar por cliente
    const clientData = data?.reduce((acc: any, invoice) => {
      const clientName = invoice.customers?.name || 'Cliente Desconocido';
      if (!acc[clientName]) {
        acc[clientName] = { totalFacturado: 0, numFacturas: 0 };
      }
      acc[clientName].totalFacturado += Number(invoice.total_amount);
      acc[clientName].numFacturas += 1;
      return acc;
    }, {});

    return Object.entries(clientData || {}).map(([cliente, data]: [string, any]) => ({
      cliente,
      totalFacturado: data.totalFacturado,
      numFacturas: data.numFacturas,
      promedio: data.totalFacturado / data.numFacturas
    }));
  };

  const fetchVentasPorArticulo = async () => {
    const { data, error } = await supabase
      .from('sale_items')
      .select(`
        quantity,
        unit_price,
        total_price,
        description,
        articles:article_id (descripcion, precio_compra)
      `);

    if (error) throw error;

    // Agrupar por artículo
    const articleData = data?.reduce((acc: any, item) => {
      const articleName = item.articles?.descripcion || item.description;
      if (!acc[articleName]) {
        acc[articleName] = { 
          cantidad: 0, 
          importe: 0, 
          costoCompra: item.articles?.precio_compra || 0 
        };
      }
      acc[articleName].cantidad += Number(item.quantity);
      acc[articleName].importe += Number(item.total_price);
      return acc;
    }, {});

    return Object.entries(articleData || {}).map(([articulo, data]: [string, any]) => ({
      articulo,
      cantidad: data.cantidad,
      importe: data.importe,
      margen: data.importe - (data.costoCompra * data.cantidad)
    }));
  };

  const fetchListadoClientes = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');

    if (error) throw error;

    return data?.map(customer => ({
      cliente: customer.name,
      contacto: customer.email || customer.phone || 'N/A',
      ultimaCompra: 'N/A', // Se necesitaría una consulta adicional
      totalFacturado: 'N/A', // Se necesitaría una consulta adicional
      estado: 'Activo'
    })) || [];
  };

  const fetchClientesInactivos = async () => {
    // Obtener clientes que no han tenido facturas en los últimos 90 días
    const fecha90DiasAtras = new Date();
    fecha90DiasAtras.setDate(fecha90DiasAtras.getDate() - 90);

    const { data: activeCustomers } = await supabase
      .from('invoices')
      .select('customer_id')
      .gte('issue_date', format(fecha90DiasAtras, 'yyyy-MM-dd'));

    const activeCustomerIds = activeCustomers?.map(inv => inv.customer_id) || [];

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .not('id', 'in', `(${activeCustomerIds.join(',')})`);

    if (error) throw error;

    return data?.map(customer => ({
      cliente: customer.name,
      ultimaFactura: 'Más de 90 días',
      diasInactivo: '90+',
      totalHistorico: 'N/A'
    })) || [];
  };

  const fetchStockActual = async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('codigo, descripcion, stock_actual, stock_minimo, precio_compra')
      .order('descripcion');

    if (error) throw error;

    return data?.map(article => ({
      articulo: article.descripcion,
      stockActual: article.stock_actual,
      stockMinimo: article.stock_minimo,
      valorStock: article.stock_actual * Number(article.precio_compra || 0)
    })) || [];
  };

  const fetchFacturasPorPagar = async () => {
    // Como no tenemos una tabla de facturas de proveedores, usaremos delivery_notes
    const { data, error } = await supabase
      .from('delivery_notes')
      .select(`
        id,
        number,
        issue_date,
        total_amount,
        suppliers:supplier_id (name)
      `)
      .eq('status', 'pending');

    if (error) throw error;

    return data?.map(note => ({
      proveedor: note.suppliers?.name || 'N/A',
      factura: note.number,
      fecha: format(new Date(note.issue_date), 'dd/MM/yyyy'),
      vencimiento: format(new Date(note.issue_date), 'dd/MM/yyyy'), // Assuming same date for now
      importe: note.total_amount
    })) || [];
  };

  const fetchPresupuestosAceptados = async () => {
    console.log('Filtros aplicados para presupuestos aceptados:', filters);
    
    let query = supabase
      .from('quotes')
      .select(`
        id,
        number,
        issue_date,
        total_amount,
        status,
        invoiced,
        customers:customer_id (name)
      `)
      .eq('status', 'accepted');

    // Aplicar filtro por cliente si está seleccionado
    if (filters.cliente && filters.cliente !== "todos") {
      console.log('Aplicando filtro por cliente en presupuestos aceptados:', filters.cliente);
      query = query.eq('customer_id', filters.cliente);
    }

    // Aplicar filtros por fecha
    if (filters.fechaDesde) {
      query = query.gte('issue_date', format(filters.fechaDesde, 'yyyy-MM-dd'));
    }
    if (filters.fechaHasta) {
      query = query.lte('issue_date', format(filters.fechaHasta, 'yyyy-MM-dd'));
    }

    // Aplicar filtro por estado si está especificado
    if (filters.estado && filters.estado !== "todos") {
      if (filters.estado === "facturado") {
        query = query.eq('invoiced', true);
      } else if (filters.estado === "pendiente-facturar") {
        query = query.eq('invoiced', false);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener presupuestos aceptados:', error);
      throw error;
    }

    console.log('Datos de presupuestos aceptados obtenidos:', data);

    return data?.map(quote => ({
      numero: quote.number,
      cliente: quote.customers?.name || 'N/A',
      fecha: format(new Date(quote.issue_date), 'dd/MM/yyyy'),
      importe: quote.total_amount,
      estado: quote.invoiced ? 'Facturado' : 'Pendiente de Facturar'
    })) || [];
  };

  const fetchPresupuestosPendientes = async () => {
    console.log('Filtros aplicados para presupuestos pendientes:', filters);
    
    let query = supabase
      .from('quotes')
      .select(`
        id,
        number,
        issue_date,
        valid_until,
        total_amount,
        status,
        customers:customer_id (name)
      `)
      .eq('status', 'sent');

    // Aplicar filtro por cliente si está seleccionado
    if (filters.cliente && filters.cliente !== "todos") {
      console.log('Aplicando filtro por cliente en presupuestos pendientes:', filters.cliente);
      query = query.eq('customer_id', filters.cliente);
    }

    // Aplicar filtros por fecha
    if (filters.fechaDesde) {
      query = query.gte('issue_date', format(filters.fechaDesde, 'yyyy-MM-dd'));
    }
    if (filters.fechaHasta) {
      query = query.lte('issue_date', format(filters.fechaHasta, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener presupuestos pendientes:', error);
      throw error;
    }

    console.log('Datos de presupuestos pendientes obtenidos:', data);

    return data?.map(quote => {
      const fechaEnvio = new Date(quote.issue_date);
      const fechaVencimiento = new Date(quote.valid_until);
      const hoy = new Date();
      const diasPendiente = Math.floor((hoy.getTime() - fechaEnvio.getTime()) / (1000 * 60 * 60 * 24));
      const vencido = hoy > fechaVencimiento;

      return {
        numero: quote.number,
        cliente: quote.customers?.name || 'N/A',
        diasPendiente: diasPendiente,
        importe: quote.total_amount,
        acciones: vencido ? 'Vencido' : 'Vigente'
      };
    }) || [];
  };

  const fetchRatioConversion = async () => {
    console.log('Filtros aplicados para ratio de conversión:', filters);
    
    let query = supabase
      .from('quotes')
      .select(`
        id,
        issue_date,
        status,
        total_amount,
        customers:customer_id (name)
      `);

    // Aplicar filtro por cliente si está seleccionado
    if (filters.cliente && filters.cliente !== "todos") {
      console.log('Aplicando filtro por cliente en ratio de conversión:', filters.cliente);
      query = query.eq('customer_id', filters.cliente);
    }

    // Aplicar filtros por fecha
    if (filters.fechaDesde) {
      query = query.gte('issue_date', format(filters.fechaDesde, 'yyyy-MM-dd'));
    }
    if (filters.fechaHasta) {
      query = query.lte('issue_date', format(filters.fechaHasta, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener ratio de conversión:', error);
      throw error;
    }

    console.log('Datos de ratio de conversión obtenidos:', data);

    // Agrupar por período (mes)
    const monthlyData = data?.reduce((acc: any, quote) => {
      const month = format(new Date(quote.issue_date), 'MMMM yyyy', { locale: es });
      if (!acc[month]) {
        acc[month] = { 
          enviados: 0, 
          aceptados: 0,
          totalImporte: 0,
          cliente: quote.customers?.name || 'Varios'
        };
      }
      acc[month].enviados += 1;
      if (quote.status === 'accepted') {
        acc[month].aceptados += 1;
        acc[month].totalImporte += Number(quote.total_amount);
      }
      return acc;
    }, {});

    return Object.entries(monthlyData || {}).map(([periodo, data]: [string, any]) => ({
      periodo,
      enviados: data.enviados,
      aceptados: data.aceptados,
      conversion: data.enviados > 0 ? ((data.aceptados / data.enviados) * 100).toFixed(1) + '%' : '0%'
    }));
  };

  const filteredData = reportData?.filter((item: any) =>
    Object.values(item).some(value => 
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const chartData = filteredData.slice(0, 5).map((item: any, index) => ({
    name: item.cliente || item.mes || item.articulo || item.proveedor || `Item ${index + 1}`,
    value: item.importe || item.totalFacturado || item.valorStock || 0
  }));

  const calculateTotals = () => {
    if (report.id === "facturas-cobrar") {
      const total = filteredData.reduce((sum: number, item: any) => sum + Number(item.importe || 0), 0);
      const vencidas = filteredData.filter((item: any) => item.diasVencido > 0).length;
      return { total: total.toFixed(2), vencidas };
    }
    if (report.id === "stock-actual") {
      const totalValue = filteredData.reduce((sum: number, item: any) => sum + Number(item.valorStock || 0), 0);
      const lowStock = filteredData.filter((item: any) => item.stockActual <= item.stockMinimo).length;
      return { total: totalValue.toFixed(2), lowStock };
    }
    return null;
  };

  const totals = calculateTotals();

  const handleExport = (format: string) => {
    console.log(`Exportando reporte ${report.title} en formato ${format}`);
    // Aquí implementarías la lógica de exportación
  };

  const handleRowAction = (action: string, item: any) => {
    console.log(`Acción ${action} en:`, item);
    // Aquí implementarías las acciones específicas
  };

  const renderTableRow = (item: any, index: number) => {
    const keys = Object.keys(item);
    return (
      <TableRow key={index}>
        {keys.map((key, cellIndex) => (
          <TableCell key={cellIndex} className={cellIndex === 0 ? "font-medium" : ""}>
            {key === 'importe' || key === 'totalFacturado' || key === 'valorStock' || key === 'promedio'
              ? `€${Number(item[key]).toFixed(2)}` 
              : item[key]}
          </TableCell>
        ))}
        <TableCell className="text-right">
          <div className="flex justify-end space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRowAction('view', item)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRowAction('filter', item)}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onBack}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Cargando datos del reporte...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onBack}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <span>{report.title}</span>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('email')}>
                <Mail className="w-4 h-4 mr-1" />
                Email
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtros aplicados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Filtros Aplicados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {filters.fechaDesde && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    Desde: {format(filters.fechaDesde, "dd/MM/yyyy", { locale: es })}
                  </span>
                )}
                {filters.fechaHasta && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    Hasta: {format(filters.fechaHasta, "dd/MM/yyyy", { locale: es })}
                  </span>
                )}
                {filters.cliente && filters.cliente !== "todos" && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Cliente: {filters.cliente}
                  </span>
                )}
                {filters.estado && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                    Estado: {filters.estado}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumen y totales */}
          {totals && filters.incluirTotales && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-blue-600">€{totals.total}</div>
                  <p className="text-sm text-gray-600">
                    {report.id === "facturas-cobrar" ? "Total por Cobrar" : "Valor Total"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-red-600">
                    {totals.vencidas || totals.lowStock || 0}
                  </div>
                  <p className="text-sm text-gray-600">
                    {report.id === "facturas-cobrar" ? "Facturas Vencidas" : "Stock Bajo"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-green-600">{filteredData.length}</div>
                  <p className="text-sm text-gray-600">Total Registros</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Gráfico */}
          {filters.mostrarGraficos && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Análisis Visual</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Importe']} />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Buscador */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar en resultados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <span className="text-sm text-gray-600">
              {filteredData.length} registros encontrados
            </span>
          </div>

          {/* Tabla de resultados */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {report.columns.map((column, index) => (
                      <TableHead key={index}>{column}</TableHead>
                    ))}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={report.columns.length + 1} className="text-center text-gray-500 py-8">
                        No se encontraron resultados con los filtros aplicados
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((item, index) => renderTableRow(item, index))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredData.length)} de {filteredData.length} registros
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="px-3 py-2 text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
