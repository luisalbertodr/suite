import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MultiSelectOption = {
  value: string;
  label: string;
};

interface ReportFilterMultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

export const ReportFilterMultiSelect: React.FC<ReportFilterMultiSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Todos',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabels = useMemo(
    () => options.filter((o) => value.includes(o.value)).map((o) => o.label),
    [options, value],
  );

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const clear = () => onChange([]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn('w-full justify-between font-normal h-auto min-h-10', !value.length && 'text-muted-foreground')}
          >
            <span className="truncate text-left flex-1">
              {value.length === 0
                ? emptyLabel
                : value.length === 1
                  ? selectedLabels[0]
                  : `${value.length} seleccionados`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[200]" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-3">Sin resultados</p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted"
                >
                  <Checkbox checked={value.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))
            )}
          </div>
          {value.length > 0 && (
            <div className="p-2 border-t">
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clear}>
                <X className="h-3 w-3 mr-1" />
                Limpiar selección
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
