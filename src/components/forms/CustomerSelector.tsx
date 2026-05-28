
import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterCustomersBySearch, type CustomerSearchRow } from '@/lib/customerSearch';
import { formatCustomerPhoneLabels } from '@/lib/legacyCustomerPhones';

export type { CustomerSearchRow };

interface CustomerSelectorProps {
  customers?: CustomerSearchRow[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  htmlFor?: string;
  /** Filas fijas al inicio (p. ej. «Todos los clientes» en informes) */
  topOptions?: { value: string; label: string }[];
  /** Muestra la opción para deseleccionar (vacío) */
  allowEmptyOption?: boolean;
  emptyOptionLabel?: string;
  /** Texto en el botón si el id no está en la lista cargada */
  valueLabelFallback?: string;
  disabled?: boolean;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  customers,
  value,
  onChange,
  required: _required = true,
  label = 'Cliente',
  htmlFor = 'customer_id',
  topOptions,
  allowEmptyOption = true,
  emptyOptionLabel = 'Seleccionar cliente…',
  valueLabelFallback,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => filterCustomersBySearch(customers ?? [], search), [customers, search]);

  const selectedTop = topOptions?.find((o) => o.value === value);
  const selectedCustomer = customers?.find((c) => c.id === value);
  const triggerText =
    selectedTop?.label ??
    selectedCustomer?.name ??
    (value && valueLabelFallback ? valueLabelFallback : null) ??
    (allowEmptyOption ? emptyOptionLabel : 'Seleccionar cliente…');

  return (
    <div>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={htmlFor}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
          >
            <span className="truncate text-left">{triggerText}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Nombre, apellidos, DNI, teléfono o email…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No se encontraron clientes.</CommandEmpty>
              <CommandGroup>
                {topOptions?.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
                {allowEmptyOption ? (
                  <CommandItem
                    value="__empty__"
                    onSelect={() => {
                      onChange('');
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === '' ? 'opacity-100' : 'opacity-0')} />
                    {emptyOptionLabel}
                  </CommandItem>
                ) : null}
                {filtered.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      onChange(customer.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === customer.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{customer.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[customer.tax_id, ...formatCustomerPhoneLabels(customer), customer.email]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
