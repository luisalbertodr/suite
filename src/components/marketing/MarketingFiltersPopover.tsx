import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter as FilterIcon,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { MarketingFieldConfig } from '@/hooks/useMarketingFieldConfig';

export type SortField =
  | 'created_at'
  | 'external_created_at'
  | 'updated_at'
  | 'first_name'
  | 'phone'
  | 'value'
  | 'form_name';

export type SortDir = 'asc' | 'desc';

export type DateFilterField = 'external_created_at' | 'created_at' | 'updated_at';

export type WinStatusFilter = 'all' | 'open' | 'won' | 'lost';

export type MarketingFilters = {
  dateField: DateFilterField;
  dateFrom: string;
  dateTo: string;
  formName: string;
  source: string;
  winStatus: WinStatusFilter;
  valueMin: string;
  valueMax: string;
  hideLinked: boolean;
  fieldKey: string;
  fieldContains: string;
};

export const DEFAULT_MARKETING_FILTERS: MarketingFilters = {
  dateField: 'external_created_at',
  dateFrom: '',
  dateTo: '',
  formName: '',
  source: '',
  winStatus: 'all',
  valueMin: '',
  valueMax: '',
  hideLinked: false,
  fieldKey: '',
  fieldContains: '',
};

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'external_created_at', label: 'Fecha del lead (Meta)' },
  { value: 'created_at', label: 'Fecha de importación' },
  { value: 'updated_at', label: 'Última actualización' },
  { value: 'first_name', label: 'Nombre' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'value', label: 'Valor del cliente' },
  { value: 'form_name', label: 'Formulario' },
];

const DATE_FIELD_OPTIONS: Array<{ value: DateFilterField; label: string }> = [
  { value: 'external_created_at', label: 'Fecha del lead (Meta)' },
  { value: 'created_at', label: 'Fecha de importación' },
  { value: 'updated_at', label: 'Última actualización' },
];

export function countActiveMarketingFilters(filters: MarketingFilters): number {
  let n = 0;
  if (filters.dateFrom || filters.dateTo) n++;
  if (filters.formName) n++;
  if (filters.source) n++;
  if (filters.winStatus !== 'all') n++;
  if (filters.valueMin || filters.valueMax) n++;
  if (filters.hideLinked) n++;
  if (filters.fieldKey && filters.fieldContains.trim()) n++;
  return n;
}

type MarketingFiltersPopoverProps = {
  sortField: SortField;
  sortDir: SortDir;
  onSortFieldChange: (field: SortField) => void;
  onSortDirChange: (dir: SortDir) => void;
  filters: MarketingFilters;
  onFiltersChange: (filters: MarketingFilters) => void;
  formNames: string[];
  sources: string[];
  filterableFields: MarketingFieldConfig[];
  compactCards: boolean;
  onCompactCardsChange: (value: boolean) => void;
};

export const MarketingFiltersPopover: React.FC<MarketingFiltersPopoverProps> = ({
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirChange,
  filters,
  onFiltersChange,
  formNames,
  sources,
  filterableFields,
  compactCards,
  onCompactCardsChange,
}) => {
  const activeCount = countActiveMarketingFilters(filters);

  const patch = (partial: Partial<MarketingFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const resetFilters = () => {
    onFiltersChange(DEFAULT_MARKETING_FILTERS);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Filtros y ordenación">
          <FilterIcon className="mr-2 h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 ? (
            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="max-h-[min(70vh,520px)] overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground">Campo</Label>
                <Select value={sortField} onValueChange={(v) => onSortFieldChange(v as SortField)}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant={sortDir === 'asc' ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => onSortDirChange('asc')}
              >
                <ArrowUp className="mr-1 h-3 w-3" /> Asc
              </Button>
              <Button
                type="button"
                variant={sortDir === 'desc' ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => onSortDirChange('desc')}
              >
                <ArrowDown className="mr-1 h-3 w-3" /> Desc
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Fechas</p>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Campo de fecha</Label>
                <Select
                  value={filters.dateField}
                  onValueChange={(v) => patch({ dateField: v as DateFilterField })}
                >
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FIELD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Desde</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => patch({ dateFrom: e.target.value })}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Hasta</Label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => patch({ dateTo: e.target.value })}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Origen y formulario</p>
            {formNames.length > 0 ? (
              <div>
                <Label className="text-[10px] text-muted-foreground">Formulario</Label>
                <Select
                  value={filters.formName || '__all__'}
                  onValueChange={(v) => patch({ formName: v === '__all__' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">Todos</SelectItem>
                    {formNames.map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {sources.length > 0 ? (
              <div>
                <Label className="text-[10px] text-muted-foreground">Origen</Label>
                <Select
                  value={filters.source || '__all__'}
                  onValueChange={(v) => patch({ source: v === '__all__' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">Todos</SelectItem>
                    {sources.map((src) => (
                      <SelectItem key={src} value={src} className="text-xs">
                        {src}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label className="text-[10px] text-muted-foreground">Estado</Label>
              <Select
                value={filters.winStatus}
                onValueChange={(v) => patch({ winStatus: v as WinStatusFilter })}
              >
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  <SelectItem value="open" className="text-xs">En curso</SelectItem>
                  <SelectItem value="won" className="text-xs">Ganados</SelectItem>
                  <SelectItem value="lost" className="text-xs">Perdidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Valor del cliente</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Mínimo (€)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={filters.valueMin}
                  onChange={(e) => patch({ valueMin: e.target.value })}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Máximo (€)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="∞"
                  value={filters.valueMax}
                  onChange={(e) => patch({ valueMax: e.target.value })}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            </div>
          </div>

          {filterableFields.length > 0 ? (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Campo personalizado</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Campo</Label>
                    <Select
                      value={filters.fieldKey || '__none__'}
                      onValueChange={(v) => patch({ fieldKey: v === '__none__' ? '' : v })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-0.5">
                        <SelectValue placeholder="Seleccionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">—</SelectItem>
                        {filterableFields.map((f) => (
                          <SelectItem key={f.id} value={f.field_key} className="text-xs">
                            {f.display_label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Contiene</Label>
                    <Input
                      value={filters.fieldContains}
                      onChange={(e) => patch({ fieldContains: e.target.value })}
                      placeholder="Texto a buscar…"
                      className="h-8 text-xs mt-0.5"
                      disabled={!filters.fieldKey}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="hide-linked" className="text-xs cursor-pointer">
                Ocultar leads ya clientes
              </Label>
              <Switch
                id="hide-linked"
                checked={filters.hideLinked}
                onCheckedChange={(v) => patch({ hideLinked: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="compact-cards" className="text-xs cursor-pointer">
                  Vista compacta
                </Label>
                <p className="text-[10px] text-muted-foreground">Kanban más rápido al cargar y arrastrar</p>
              </div>
              <Switch
                id="compact-cards"
                checked={compactCards}
                onCheckedChange={onCompactCardsChange}
              />
            </div>
          </div>
        </div>

        {activeCount > 0 ? (
          <div className="border-t px-4 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={resetFilters}
            >
              <RotateCcw className="mr-2 h-3 w-3" /> Limpiar filtros
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
