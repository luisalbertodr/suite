
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Filter, Download, Mail, FileText, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReporteResults } from './ReporteResults';
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

interface ReporteModalProps {
  report: Report;
  onClose: () => void;
}

interface FilterValues {
  fechaDesde?: Date;
  fechaHasta?: Date;
  cliente?: string;
  proveedor?: string;
  estado?: string;
  familia?: string;
  articulo?: string;
  importeDesde?: number;
  importeHasta?: number;
  [key: string]: any;
}

export const ReporteModal: React.FC<ReporteModalProps> = ({ report, onClose }) => {
  const [showFilters, setShowFilters] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [loading, setLoading] = useState(false);

  // Consultas para obtener datos reales para los filtros
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: families } = useQuery({
    queryKey: ['article-families'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('familia')
        .order('familia');
      if (error) throw error;
      // Obtener familias únicas
      const uniqueFamilies = [...new Set(data?.map(item => item.familia))];
      return uniqueFamilies;
    },
  });

  const quickDateRanges = [
    { label: "Hoy", value: "today" },
    { label: "Esta semana", value: "week" },
    { label: "Este mes", value: "month" },
    { label: "Este trimestre", value: "quarter" },
    { label: "Este año", value: "year" }
  ];

  const estadosFactura = [
    { value: "draft", label: "Borrador" },
    { value: "sent", label: "Enviada" },
    { value: "paid", label: "Pagada" },
    { value: "overdue", label: "Vencida" },
    { value: "cancelled", label: "Cancelada" }
  ];

  const estadosPresupuesto = [
    { value: "draft", label: "Borrador" },
    { value: "sent", label: "Enviado" },
    { value: "accepted", label: "Aceptado" },
    { value: "rejected", label: "Rechazado" },
    { value: "expired", label: "Expirado" }
  ];

  const handleQuickDate = (range: string) => {
    const today = new Date();
    let fechaDesde: Date;
    let fechaHasta: Date = today;

    switch (range) {
      case "today":
        fechaDesde = today;
        break;
      case "week":
        fechaDesde = new Date(today.setDate(today.getDate() - 7));
        break;
      case "month":
        fechaDesde = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "quarter":
        const quarterStart = Math.floor(today.getMonth() / 3) * 3;
        fechaDesde = new Date(today.getFullYear(), quarterStart, 1);
        break;
      case "year":
        fechaDesde = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    setFilters(prev => ({ ...prev, fechaDesde, fechaHasta }));
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    // Simular carga
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setShowFilters(false);
    setShowResults(true);
  };

  const handleBackToFilters = () => {
    setShowResults(false);
    setShowFilters(true);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const renderFilterInput = (filterType: string) => {
    switch (filterType) {
      case "fechas":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.fechaDesde && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaDesde ? format(filters.fechaDesde, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.fechaDesde}
                      onSelect={(date) => setFilters(prev => ({ ...prev, fechaDesde: date }))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.fechaHasta && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaHasta ? format(filters.fechaHasta, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.fechaHasta}
                      onSelect={(date) => setFilters(prev => ({ ...prev, fechaHasta: date }))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickDateRanges.map((range) => (
                <Button
                  key={range.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDate(range.value)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
        );

      case "cliente":
        return (
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select onValueChange={(value) => setFilters(prev => ({ ...prev, cliente: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "estado-pago":
        return (
          <div className="space-y-2">
            <Label>Estado de Pago</Label>
            <Select onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {estadosFactura.map((estado) => (
                  <SelectItem key={estado.value} value={estado.value}>
                    {estado.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "rango-importes":
        return (
          <div className="space-y-2">
            <Label>Rango de Importes</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Desde €"
                value={filters.importeDesde || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, importeDesde: Number(e.target.value) }))}
              />
              <Input
                type="number"
                placeholder="Hasta €"
                value={filters.importeHasta || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, importeHasta: Number(e.target.value) }))}
              />
            </div>
          </div>
        );

      case "familia":
        return (
          <div className="space-y-2">
            <Label>Familia de Artículos</Label>
            <Select onValueChange={(value) => setFilters(prev => ({ ...prev, familia: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar familia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las familias</SelectItem>
                {families?.map((familia) => (
                  <SelectItem key={familia} value={familia}>
                    {familia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "proveedor":
        return (
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select onValueChange={(value) => setFilters(prev => ({ ...prev, proveedor: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los proveedores</SelectItem>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  };

  if (showResults) {
    return (
      <ReporteResults
        report={report}
        filters={filters}
        onBack={handleBackToFilters}
      />
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>{report.title} - Filtros</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">{report.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {report.filters.map((filter) => (
              <div key={filter} className="space-y-2">
                {renderFilterInput(filter)}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="incluir-totales"
                checked={filters.incluirTotales || false}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, incluirTotales: checked }))}
              />
              <Label htmlFor="incluir-totales">Incluir totales y subtotales</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="mostrar-graficos"
                checked={filters.mostrarGraficos || false}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, mostrarGraficos: checked }))}
              />
              <Label htmlFor="mostrar-graficos">Mostrar gráficos</Label>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleClearFilters}>
                Limpiar Filtros
              </Button>
              <Button variant="outline">
                Guardar Filtros
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerateReport}
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {loading ? "Generando..." : "Generar Reporte"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
