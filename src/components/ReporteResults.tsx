import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { fetchReportData, resolveBillingScope, REPORT_ROW_KEYS, formatReportCell, type ReportFilters } from '@/lib/reportData';
import { useQuery } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

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
  const [itemsPerPage] = useState(report.id === 'listado-facturas-emitidas' ? 25 : 10);
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, billingCompanies, operationalCompanyId } = useWorkCenter();
  const catalogCompanyId = operationalCompanyId ?? companyId;

  const billingCompanyIds = resolveBillingScope(
    companyId,
    billingCompanies,
    isMultiEntity,
    filters.empresaEmisora as string | undefined,
  );

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report-data', companyId, catalogCompanyId, report.id, filters, billingCompanyIds.join(',')],
    queryFn: async () => {
      if (!companyId || !catalogCompanyId) return [];
      return fetchReportData(
        report.id,
        {
          billingCompanyIds,
          catalogCompanyId,
          allBillingCompanyIds: billingCompanies.map((c) => c.id),
        },
        filters as ReportFilters,
      );
    },
    enabled: !!companyId && !!catalogCompanyId && !companyLoading,
  });

  const filteredData = reportData?.filter((item: Record<string, unknown>) =>
    Object.values(item).some(value => 
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const chartData = filteredData.slice(0, 5).map((item: any, index) => ({
    name: item.cliente || item.mes || item.articulo || item.proveedor || item.numero || `Item ${index + 1}`,
    value: item.importeLinea ?? item.importe ?? item.totalFacturado ?? item.totalFactura ?? item.valorStock ?? 0,
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
    if (report.id === "listado-facturas-emitidas") {
      const lineSum = filteredData.reduce((sum: number, item: any) => {
        const v = item.importeLinea;
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);
      const invoiceNums = new Set(
        filteredData.map((item: any) => item.numero).filter(Boolean),
      );
      const invoiceTotal = [...invoiceNums].reduce((sum, num) => {
        const row = filteredData.find((item: any) => item.numero === num);
        return sum + Number(row?.totalFactura ?? 0);
      }, 0);
      const hasLines = lineSum > 0;
      return {
        total: (hasLines ? lineSum : invoiceTotal).toFixed(2),
        vencidas: hasLines ? filteredData.length : invoiceNums.size,
        labelTotal: hasLines ? 'Importe líneas' : 'Total facturado',
        labelCount: hasLines ? 'Líneas listadas' : 'Facturas',
      };
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

  const rowKeys = REPORT_ROW_KEYS[report.id] ?? [];

  const renderTableRow = (item: Record<string, unknown>, index: number) => {
    const keys = rowKeys.length > 0 ? rowKeys : Object.keys(item);
    return (
      <TableRow key={index}>
        {keys.map((key) => (
          <TableCell key={key} className={key === keys[0] ? 'font-medium' : ''}>
            {formatReportCell(key, item[key])}
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

  if (isLoading || companyLoading) {
    return (
      <Dialog open={true} onOpenChange={onBack}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Cargando reporte</DialogTitle>
            <DialogDescription className="sr-only">Cargando datos del reporte</DialogDescription>
          </DialogHeader>
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
          <DialogDescription className="sr-only">{report.description}</DialogDescription>
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
                    Cobro: {filters.estado === 'paid' ? 'Cobradas' : filters.estado === 'pending' ? 'Pendientes' : filters.estado}
                  </span>
                )}
                {((filters.familias as string[] | undefined)?.length ||
                  (filters.articulos as string[] | undefined)?.length) ? (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    Catálogo:{' '}
                    {[
                      (filters.familias as string[] | undefined)?.length
                        ? `${(filters.familias as string[]).length} fam.`
                        : null,
                      (filters.articulos as string[] | undefined)?.length
                        ? `${(filters.articulos as string[]).length} art.`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Resumen y totales */}
          {totals && (filters.incluirTotales || report.id === 'listado-facturas-emitidas') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-blue-600">€{totals.total}</div>
                  <p className="text-sm text-gray-600">
                    {(totals as { labelTotal?: string }).labelTotal
                      ?? (report.id === "facturas-cobrar" ? "Total por Cobrar" : "Valor Total")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-red-600">
                    {totals.vencidas || totals.lowStock || 0}
                  </div>
                  <p className="text-sm text-gray-600">
                    {(totals as { labelCount?: string }).labelCount
                      ?? (report.id === "facturas-cobrar" ? "Facturas Vencidas" : "Stock Bajo")}
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
