
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
  Building2,
  DollarSign,
  FileText,
  Calendar,
  Target,
  Truck,
  PieChart,
  LineChart
} from 'lucide-react';
import { ReporteModal } from './ReporteModal';

interface ReportCategory {
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  reports: Report[];
}

interface Report {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  filters: string[];
  columns: string[];
}

export const Reportes: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showModal, setShowModal] = useState(false);

  const reportCategories: ReportCategory[] = [
    {
      title: "Reportes de Ventas",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      reports: [
        {
          id: "facturas-cobrar",
          title: "Facturas por Cobrar",
          description: "Control de facturas pendientes de cobro con análisis de vencimientos",
          icon: FileText,
          filters: ["fechas", "cliente", "estado-pago", "rango-importes"],
          columns: ["Número", "Cliente", "Fecha Emisión", "Vencimiento", "Importe", "Días Vencido"]
        },
        {
          id: "facturacion-mensual",
          title: "Facturación Mensual",
          description: "Análisis mensual de facturación con comparativas y tendencias",
          icon: Calendar,
          filters: ["año", "mes", "cliente", "serie-factura"],
          columns: ["Mes", "Total Facturado", "Num. Facturas", "Variación"]
        },
        {
          id: "facturacion-cliente",
          title: "Facturación por Cliente",
          description: "Ranking y análisis de facturación por cliente",
          icon: Users,
          filters: ["fechas", "cliente", "ranking"],
          columns: ["Cliente", "Total Facturado", "Num. Facturas", "Promedio"]
        },
        {
          id: "ventas-articulo",
          title: "Ventas por Artículo",
          description: "Análisis de ventas por producto con márgenes",
          icon: Package,
          filters: ["fechas", "familia", "articulo"],
          columns: ["Artículo", "Cantidad", "Importe", "Margen"]
        }
      ]
    },
    {
      title: "Reportes de Presupuestos",
      icon: Target,
      color: "from-green-500 to-green-600",
      reports: [
        {
          id: "presupuestos-aceptados",
          title: "Presupuestos Aceptados",
          description: "Seguimiento de presupuestos convertidos en ventas",
          icon: Target,
          filters: ["fechas", "cliente", "estado"],
          columns: ["Número", "Cliente", "Fecha", "Importe", "Estado"]
        },
        {
          id: "presupuestos-pendientes",
          title: "Presupuestos Pendientes",
          description: "Control de presupuestos sin respuesta del cliente",
          icon: FileText,
          filters: ["fechas", "cliente", "dias-pendiente"],
          columns: ["Número", "Cliente", "Días Pendiente", "Importe", "Acciones"]
        },
        {
          id: "ratio-conversion",
          title: "Ratio de Conversión",
          description: "Análisis de efectividad de presupuestos enviados",
          icon: PieChart,
          filters: ["periodo", "cliente", "comercial"],
          columns: ["Periodo", "Enviados", "Aceptados", "% Conversión"]
        }
      ]
    },
    {
      title: "Reportes de Clientes",
      icon: Users,
      color: "from-purple-500 to-purple-600",
      reports: [
        {
          id: "listado-clientes",
          title: "Listado de Clientes",
          description: "Información completa y estado de todos los clientes",
          icon: Users,
          filters: ["provincia", "forma-pago", "estado"],
          columns: ["Cliente", "Contacto", "Última Compra", "Total Facturado", "Estado"]
        },
        {
          id: "clientes-inactivos",
          title: "Clientes sin Actividad",
          description: "Identificación de clientes inactivos para reactivación",
          icon: Users,
          filters: ["dias-inactividad", "importe-minimo"],
          columns: ["Cliente", "Última Factura", "Días Inactivo", "Total Histórico"]
        },
        {
          id: "clientes-top",
          title: "Análisis Clientes Top",
          description: "Ranking de mejores clientes por facturación",
          icon: TrendingUp,
          filters: ["periodo", "num-clientes"],
          columns: ["Ranking", "Cliente", "Facturación", "Frecuencia", "Margen"]
        }
      ]
    },
    {
      title: "Reportes de Inventario",
      icon: Package,
      color: "from-orange-500 to-orange-600",
      reports: [
        {
          id: "stock-actual",
          title: "Stock Actual",
          description: "Estado actual del inventario con valoraciones",
          icon: Package,
          filters: ["familia", "stock-minimo", "valoracion"],
          columns: ["Artículo", "Stock Actual", "Stock Mínimo", "Valor Stock"]
        },
        {
          id: "movimientos-stock",
          title: "Movimientos de Stock",
          description: "Historial de entradas y salidas de inventario",
          icon: Truck,
          filters: ["fechas", "articulo", "tipo-movimiento"],
          columns: ["Fecha", "Artículo", "Tipo", "Cantidad", "Stock Resultante"]
        },
        {
          id: "articulos-sin-movimiento",
          title: "Artículos sin Movimiento",
          description: "Productos con stock pero sin actividad reciente",
          icon: Package,
          filters: ["dias-sin-movimiento", "familia"],
          columns: ["Artículo", "Último Movimiento", "Stock Actual", "Valor"]
        }
      ]
    },
    {
      title: "Reportes de Proveedores",
      icon: Building2,
      color: "from-red-500 to-red-600",
      reports: [
        {
          id: "facturas-pagar",
          title: "Facturas por Pagar",
          description: "Control de pagos pendientes a proveedores",
          icon: FileText,
          filters: ["fechas", "proveedor", "estado-pago"],
          columns: ["Proveedor", "Factura", "Fecha", "Vencimiento", "Importe"]
        },
        {
          id: "compras-proveedor",
          title: "Compras por Proveedor",
          description: "Análisis de compras y relación con proveedores",
          icon: Building2,
          filters: ["periodo", "proveedor"],
          columns: ["Proveedor", "Total Comprado", "Num. Facturas", "Forma Pago"]
        }
      ]
    },
    {
      title: "Reportes Financieros",
      icon: DollarSign,
      color: "from-emerald-500 to-emerald-600",
      reports: [
        {
          id: "flujo-caja",
          title: "Flujo de Caja",
          description: "Análisis de ingresos, gastos y proyecciones",
          icon: LineChart,
          filters: ["fechas", "incluir-proyecciones"],
          columns: ["Periodo", "Ingresos", "Gastos", "Saldo", "Proyección"]
        },
        {
          id: "analisis-margenes",
          title: "Análisis de Márgenes",
          description: "Rentabilidad por productos y clientes",
          icon: BarChart3,
          filters: ["periodo", "familia", "cliente"],
          columns: ["Concepto", "Ventas", "Costos", "Margen Bruto", "% Margen"]
        },
        {
          id: "resumen-fiscal",
          title: "Resumen Fiscal",
          description: "Información fiscal para declaraciones tributarias",
          icon: FileText,
          filters: ["trimestre", "año-fiscal"],
          columns: ["Concepto", "Base Imponible", "IVA", "Total", "Tipo IVA"]
        }
      ]
    }
  ];

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedReport(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-2">Centro de reportes y análisis empresarial</p>
        </div>
      </div>

      <div className="space-y-8">
        {reportCategories.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <div key={category.title} className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${category.color}`}>
                  <CategoryIcon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">{category.title}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.reports.map((report) => {
                  const ReportIcon = report.icon;
                  return (
                    <Card 
                      key={report.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                      onClick={() => handleReportClick(report)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-3 text-lg">
                          <ReportIcon className="w-5 h-5 text-blue-600" />
                          <span>{report.title}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-600 text-sm mb-3">{report.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {report.columns.slice(0, 3).map((column, index) => (
                            <span 
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {column}
                            </span>
                          ))}
                          {report.columns.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              +{report.columns.length - 3} más
                            </span>
                          )}
                        </div>
                        <Button 
                          className="w-full mt-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                          onClick={() => handleReportClick(report)}
                        >
                          Generar Reporte
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && selectedReport && (
        <ReporteModal
          report={selectedReport}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
