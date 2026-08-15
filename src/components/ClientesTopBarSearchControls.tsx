/**
 * Campo de búsqueda de clientes para la TopBar (solo pestaña Clientes).
 * Estado local al teclear; `getInitialSearchTerm` restaura al volver al panel keep-alive.
 */
import React, { startTransition, useCallback, useState } from 'react';
import { Archive, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CUSTOMER_SEARCH_MIN_CHARS } from '@/lib/customerSearch';
import type { CustomerListMode } from '@/hooks/useCustomerSearch';

type Props = {
  listMode: CustomerListMode;
  /** Lee el término persistido en Clientes al montar (p. ej. tras cambiar de pestaña). */
  getInitialSearchTerm?: () => string;
  onListModeChange: (mode: CustomerListMode) => void;
  onSearchTermChange: (term: string) => void;
};

export function ClientesTopBarSearchControls({
  listMode,
  getInitialSearchTerm,
  onListModeChange,
  onSearchTermChange,
}: Props) {
  const [text, setText] = useState(() => getInitialSearchTerm?.() ?? '');
  const isArchivedMode = listMode === 'archived';

  const onChange = useCallback(
    (value: string) => {
      setText(value);
      startTransition(() => onSearchTermChange(value));
    },
    [onSearchTermChange],
  );

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5">
      <div className="relative w-[min(100%,16rem)] min-w-[9rem] sm:w-52 md:w-64 shrink">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={
            isArchivedMode
              ? 'Buscar archivados…'
              : `Buscar (mín. ${CUSTOMER_SEARCH_MIN_CHARS})…`
          }
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 pl-7 text-xs"
          aria-label={isArchivedMode ? 'Buscar clientes archivados' : 'Buscar clientes'}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <Button
        type="button"
        variant={isArchivedMode ? 'default' : 'outline'}
        onClick={() => {
          const next: CustomerListMode = isArchivedMode ? 'active' : 'archived';
          setText('');
          onSearchTermChange('');
          onListModeChange(next);
        }}
        className="h-7 shrink-0 px-2 text-xs"
      >
        <Archive className="mr-1 h-3.5 w-3.5" />
        {isArchivedMode ? 'Ver activos' : 'Archivados'}
      </Button>
    </div>
  );
}
