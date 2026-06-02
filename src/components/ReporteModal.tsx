
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { fetchCatalogCustomers } from '@/lib/customerSearch';
import { CustomerSelector } from '@/components/forms/CustomerSelector';
import { ReportFilterMultiSelect } from '@/components/reports/ReportFilterMultiSelect';
import { REPORT_DATE_PRESETS, resolveDatePresetRange, type DatePresetId } from '@/lib/reportDatePresets';

const REPORT_SELECT_CONTENT_CLASS = 'z-[200]';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2024, i, 1), 'MMMM', { locale: es }),
}));

const nativeSelectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

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
  familias?: string[];
  articulo?: string;
  articulos?: string[];
  importeDesde?: number;
  importeHasta?: number;
  empresaEmisora?: string;
  [key: string]: any;
}

export const ReporteModal: React.FC<ReporteModalProps> = ({ report, onClose }) => {
  const [showFilters, setShowFilters] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(() => {
    if (report.id === 'listado-facturas-emitidas') {
      const { fechaDesde, fechaHasta } = resolveDatePresetRange('month');
      return { fechaDesde, fechaHasta, incluirTotales: true };
    }
    return {};
  });
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, billingCompanies, companyLabels, operationalCompanyId } = useWorkCenter();
  const catalogCompanyId = operationalCompanyId ?? companyId;

  const { data: customers } = useQuery({
    queryKey: ['customers', catalogCompanyId, 'reporte-modal'],
    queryFn: async () => {
      if (!catalogCompanyId) return [];
      return fetchCatalogCustomers(supabase, catalogCompanyId);
    },
    enabled: !!catalogCompanyId && !companyLoading,
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
    queryKey: ['article-families', catalogCompanyId],
    queryFn: async () => {
      if (!catalogCompanyId) return [];
      const { data, error } = await supabase
        .from('article_families')
        .select('name')
        .eq('company_id', catalogCompanyId)
        .order('name');
      if (error) throw error;
      return (data ?? []).map((f) => f.name as string);
    },
    enabled: !!catalogCompanyId && !companyLoading,
  });

  const needsArticles = report.filters.includes('articulos') || report.filters.includes('articulo');

  const { data: catalogArticles } = useQuery({
    queryKey: ['articles', catalogCompanyId, 'reporte-modal'],
    queryFn: async () => {
      if (!catalogCompanyId) return [];
      const { data, error } = await supabase
        .from('articles')
        .select('id, codigo, descripcion, familia, estado')
        .eq('company_id', catalogCompanyId)
        .eq('estado', 'activo')
        .order('descripcion');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!catalogCompanyId && !companyLoading && needsArticles,
  });

  const quickDateRanges = REPORT_DATE_PRESETS;

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

  const handleQuickDate = (range: DatePresetId) => {
    const { fechaDesde, fechaHasta } = resolveDatePresetRange(range);
    setFilters((prev) => ({ ...prev, fechaDesde, fechaHasta }));
  };

  const handleGenerateReport = () => {
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
      case "periodo":
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
          <CustomerSelector
            customers={customers}
            value={filters.cliente ?? 'todos'}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, cliente: value === '' ? 'todos' : value }))
            }
            label="Cliente"
            htmlFor="reporte-cliente"
            topOptions={[{ value: 'todos', label: 'Todos los clientes' }]}
            allowEmptyOption={false}
            emptyOptionLabel="Todos los clientes"
          />
        );

      case "estado-pago":
        return (
          <div className="space-y-2">
            <Label>Estado de cobro</Label>
            <Select modal={false} onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value === 'all' ? undefined : value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Cobradas</SelectItem>
                <SelectItem value="pending">Pendientes de cobro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case "estado":
        return (
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select modal={false} onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                {estadosPresupuesto.map((estado) => (
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

      case "familias":
        return (
          <ReportFilterMultiSelect
            label="Familias de artículos"
            options={(families ?? []).map((name) => ({ value: name, label: name }))}
            value={filters.familias ?? []}
            onChange={(familias) => setFilters((prev) => ({ ...prev, familias }))}
            emptyLabel="Todas las familias"
            searchPlaceholder="Buscar familia…"
          />
        );

      case "familia":
        return (
          <div className="space-y-2">
            <Label>Familia de Artículos</Label>
            <Select modal={false} onValueChange={(value) => setFilters(prev => ({ ...prev, familia: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar familia" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
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

      case "articulos":
        return (
          <ReportFilterMultiSelect
            label="Artículos"
            options={(catalogArticles ?? []).map((a) => ({
              value: a.id as string,
              label: a.codigo ? `${a.codigo} - ${a.descripcion}` : String(a.descripcion),
            }))}
            value={filters.articulos ?? []}
            onChange={(articulos) => setFilters((prev) => ({ ...prev, articulos }))}
            emptyLabel="Todos los artículos"
            searchPlaceholder="Buscar artículo…"
          />
        );

      case "proveedor":
        return (
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select modal={false} onValueChange={(value) => setFilters(prev => ({ ...prev, proveedor: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
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

      case "empresa-emisora":
        if (!isMultiEntity || billingCompanies.length <= 1) return null;
        return (
          <div className="space-y-2">
            <Label>Empresa emisora</Label>
            <Select
              modal={false}
              value={filters.empresaEmisora ?? 'all'}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, empresaEmisora: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las empresas" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                <SelectItem value="all">Todas (centro laboral)</SelectItem>
                {billingCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {companyLabels.get(c.id) ?? c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "dias-inactividad":
      case "dias-pendiente":
      case "dias-sin-movimiento":
        return (
          <div className="space-y-2">
            <Label>Días</Label>
            <Input
              type="number"
              min={1}
              placeholder="90"
              value={String(filters[filterType] ?? filters.diasInactividad ?? '')}
              onChange={(e) => setFilters((prev) => ({
                ...prev,
                [filterType]: Number(e.target.value),
                diasInactividad: Number(e.target.value),
                diasSinMovimiento: Number(e.target.value),
              }))}
            />
          </div>
        );

      case "num-clientes":
      case "ranking":
        return (
          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={1}
              placeholder="10"
              value={String(filters.numClientes ?? filters.ranking ?? '')}
              onChange={(e) => setFilters((prev) => ({
                ...prev,
                numClientes: Number(e.target.value),
                ranking: Number(e.target.value),
              }))}
            />
          </div>
        );

      case "año-fiscal":
      case "año":
        return (
          <div className="space-y-2">
            <Label>Año</Label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={String(filters.año ?? filters['año-fiscal'] ?? new Date().getFullYear())}
              onChange={(e) => {
                const y = Number(e.target.value);
                setFilters((prev) => ({
                  ...prev,
                  año: y,
                  fechaDesde: new Date(y, 0, 1),
                  fechaHasta: new Date(y, 11, 31),
                }));
              }}
            />
          </div>
        );

      case "trimestre": {
        const year = Number(filters.año ?? new Date().getFullYear());
        return (
          <div className="space-y-2">
            <Label>Trimestre</Label>
            <Select
              modal={false}
              onValueChange={(value) => {
                const q = Number(value);
                const startMonth = (q - 1) * 3;
                setFilters((prev) => ({
                  ...prev,
                  trimestre: q,
                  fechaDesde: new Date(year, startMonth, 1),
                  fechaHasta: new Date(year, startMonth + 3, 0),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar trimestre" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>{`T${q} ${year}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      case "mes": {
        const year = Number(filters.año ?? new Date().getFullYear());
        return (
          <div className="space-y-2">
            <Label htmlFor="reporte-mes">Mes</Label>
            <select
              id="reporte-mes"
              className={nativeSelectClass}
              value={filters.mes ? String(filters.mes) : ''}
              onChange={(e) => {
                const m = Number(e.target.value);
                if (!m) return;
                setFilters((prev) => ({
                  ...prev,
                  mes: m,
                  año: year,
                  fechaDesde: new Date(year, m - 1, 1),
                  fechaHasta: new Date(year, m, 0),
                }));
              }}
            >
              <option value="">Seleccionar mes</option>
              {MONTH_OPTIONS.map(({ value, label }) => (
                <option key={value} value={String(value)}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case "stock-minimo":
      case "incluir-proyecciones":
      case "valoracion":
        return (
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id={filterType}
              checked={Boolean(filters[filterType])}
              onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, [filterType]: checked }))}
            />
            <Label htmlFor={filterType}>Activar filtro</Label>
          </div>
        );

      case "serie-factura":
      case "articulo":
      case "comercial":
      case "tipo-movimiento":
        return (
          <div className="space-y-2">
            <Label className="capitalize">{filterType.replace(/-/g, ' ')}</Label>
            <Input
              value={String(filters[filterType] ?? '')}
              onChange={(e) => setFilters((prev) => ({ ...prev, [filterType]: e.target.value }))}
            />
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
          <DialogDescription className="sr-only">{report.description}</DialogDescription>
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
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                Generar Reporte
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
