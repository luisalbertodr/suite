/**
 * Búsqueda rápida de clientes en TopBar (Agenda, TPV, etc.).
 * Al elegir un resultado navega a la ficha en /clientes.
 */
import React, { startTransition, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { CUSTOMER_SEARCH_MIN_CHARS, isCustomerSearchQueryReady } from '@/lib/customerSearch';
import { buildCustomerProfileUrl } from '@/lib/agendaCustomerNavigation';
import { formatCustomerPhoneLabels } from '@/lib/legacyCustomerPhones';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function TopBarCustomerLookup({ className }: Props) {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId } = useWorkCenter();
  const catalogCompanyId = operationalCompanyId ?? companyId;

  const { customers, isFetching, isReady } = useCustomerSearch(catalogCompanyId, query, 'active');

  useEffect(() => {
    if (!isCustomerSearchQueryReady(query)) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [query, customers.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const showPanel = open && isCustomerSearchQueryReady(query);

  const goToCustomer = (customerId: string) => {
    setOpen(false);
    setText('');
    startTransition(() => setQuery(''));
    navigate(buildCustomerProfileUrl(customerId, 'timeline'));
  };

  return (
    <div ref={rootRef} className={cn('relative w-[11rem] sm:w-48 md:w-56 shrink-0', className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          startTransition(() => setQuery(v));
          if (isCustomerSearchQueryReady(v)) setOpen(true);
        }}
        onFocus={() => {
          if (isCustomerSearchQueryReady(text)) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Enter' && customers[0]) {
            e.preventDefault();
            goToCustomer(customers[0].id);
          }
        }}
        placeholder={`Cliente (mín. ${CUSTOMER_SEARCH_MIN_CHARS})…`}
        className="h-7 pl-7 text-xs"
        aria-label="Buscar cliente"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showPanel}
        autoComplete="off"
        spellCheck={false}
      />
      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] max-h-72 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {isFetching && !customers.length ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando…
            </div>
          ) : !isReady || customers.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
          ) : (
            customers.slice(0, 12).map((c) => {
              const phones = formatCustomerPhoneLabels(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToCustomer(c.id)}
                >
                  <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{c.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {[c.tax_id, phones[0] || c.phone].filter(Boolean).join(' · ') || 'Sin DNI/teléfono'}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Rutas del dock donde debe mostrarse la búsqueda rápida de clientes. */
export function topBarShowsCustomerLookup(pathname: string): boolean {
  if (pathname === '/clientes' || pathname.startsWith('/clientes/')) return false;
  return (
    pathname === '/agenda' ||
    pathname === '/agenda-suite' ||
    pathname === '/tpv' ||
    pathname === '/facturacion' ||
    pathname === '/facturas' ||
    pathname === '/presupuestos' ||
    pathname === '/presupuestos-n' ||
    pathname === '/albaranes-entrada' ||
    pathname === '/albaranes-salida' ||
    pathname === '/articulos' ||
    pathname === '/telefono' ||
    pathname === '/whatsapp'
  );
}
