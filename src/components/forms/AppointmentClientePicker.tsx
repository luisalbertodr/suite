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
import {
  CUSTOMER_SEARCH_MIN_CHARS,
  filterCustomersBySearch,
  isCustomerSearchQueryReady,
  type CustomerSearchRow,
} from '@/lib/customerSearch';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

export type AppointmentClientPick =
  | { kind: 'customer'; customerId: string; displayName: string }
  | { kind: 'manual'; name: string };

type Props = {
  /** Listado local (edición). Si `lazySearch`, no se usa hasta tener búsqueda remota. */
  customers?: CustomerSearchRow[];
  /** Búsqueda en servidor solo tras escribir ≥3 caracteres (nueva cita). */
  lazySearch?: boolean;
  value: AppointmentClientPick | null;
  onChange: (next: AppointmentClientPick | null) => void;
  disabled?: boolean;
};

function pickLabel(p: AppointmentClientPick | null): string {
  if (!p) return 'Buscar por nombre, DNI, teléfono o email…';
  if (p.kind === 'manual') return p.name;
  return p.displayName;
}

export const AppointmentClientePicker: React.FC<Props> = ({
  customers = [],
  lazySearch = false,
  value,
  onChange,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const remote = useCustomerSearch(lazySearch ? catalogCompanyId : null, search);

  const filtered = useMemo(() => {
    if (lazySearch) return remote.customers;
    return filterCustomersBySearch(customers, search);
  }, [lazySearch, remote.customers, customers, search]);

  const searchReady = !lazySearch || remote.isReady;
  const manualPreview = search.trim();
  const showManualRow = searchReady && manualPreview.length > 0;

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
              placeholder={
                lazySearch
                  ? `Mín. ${CUSTOMER_SEARCH_MIN_CHARS} letras o números…`
                  : 'Nombre, apellidos, DNI, teléfono o email…'
              }
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {lazySearch && !isCustomerSearchQueryReady(search) ? (
                <p className="py-6 text-center text-xs text-muted-foreground px-3">
                  Escribe al menos {CUSTOMER_SEARCH_MIN_CHARS} letras o {CUSTOMER_SEARCH_MIN_CHARS} números para buscar.
                </p>
              ) : lazySearch && remote.isLoading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Buscando…</p>
              ) : (
                <>
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
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
