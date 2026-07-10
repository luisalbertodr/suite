import React, { useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DashboardFamilySelectorProps = {
  families: string[];
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
};

export function DashboardFamilySelector({
  families,
  value,
  onChange,
  disabled = false,
}: DashboardFamilySelectorProps) {
  const label = useMemo(() => {
    if (!families.length) return 'Sin familias';
    if (value === null || value.length === families.length) return `Todas (${families.length})`;
    if (value.length === 0) return 'Ninguna familia';
    return `${value.length} de ${families.length} familias`;
  }, [families.length, value]);

  const isSelected = (name: string) => value === null || value.includes(name);

  const toggleFamily = (name: string) => {
    if (value === null) {
      const next = families.filter((family) => family !== name);
      onChange(next.length === families.length ? null : next);
      return;
    }
    const set = new Set(value);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    const next = [...set];
    if (next.length === 0 || next.length === families.length) onChange(null);
    else onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-[180px] justify-between text-xs font-normal"
          disabled={disabled || families.length === 0}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-medium text-foreground">Familias</span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(null)}>
              Todas
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
              Ninguna
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {families.map((family) => (
            <label
              key={family}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted cursor-pointer"
            >
              <Checkbox checked={isSelected(family)} onCheckedChange={() => toggleFamily(family)} />
              <span className="truncate" title={family}>
                {family}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
