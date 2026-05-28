import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AGENDA_APPOINTMENT_SELECT_Z } from '@/lib/agendaResourceColors';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCustomerPhoneLabels } from '@/lib/legacyCustomerPhones';
import { filterCustomersBySearch, type CustomerSearchRow } from '@/lib/customerSearch';

export type AppointmentClientPick =
  | { kind: 'customer'; customerId: string; displayName: string }
  | { kind: 'manual'; name: string };

type Props = {
  customers: CustomerSearchRow[];
  value: AppointmentClientPick | null;
  onChange: (next: AppointmentClientPick | null) => void;
  disabled?: boolean;
};

function pickLabel(p: AppointmentClientPick | null): string {
  if (!p) return 'Buscar por nombre, DNI, teléfono o email…';
  if (p.kind === 'manual') return p.name;
  return p.displayName;
}

export const AppointmentClientePicker: React.FC<Props> = ({ customers, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => filterCustomersBySearch(customers, search), [customers, search]);

  const manualPreview = search.trim();
  const showManualRow = manualPreview.length > 0;

  return (
    <div>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('mt-1 h-9 w-full justify-between font-normal', !value && 'text-muted-foreground')}
          >
            <span className="truncate text-left">{pickLabel(value)}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn('p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]', AGENDA_APPOINTMENT_SELECT_Z)} align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Nombre, apellidos, DNI, teléfono o email…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No se encontraron clientes.</CommandEmpty>
              <CommandGroup>
                {filtered.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      onChange({
                        kind: 'customer',
                        customerId: customer.id,
                        displayName: customer.name,
                      });
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value?.kind === 'customer' && value.customerId === customer.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{customer.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[
                          customer.tax_id,
                          ...formatCustomerPhoneLabels(customer),
                          customer.email,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Sin datos de contacto'}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {showManualRow && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Sin ficha">
                    <CommandItem
                      value={`__manual__:${manualPreview}`}
                      onSelect={() => {
                        onChange({ kind: 'manual', name: manualPreview });
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <span className="text-sm">
                        Usar «<span className="font-medium">{manualPreview}</span>» como nombre (sin vincular ficha)
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
