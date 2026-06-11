import React, { memo, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type MarketingSearchInputProps = {
  onQueryChange: (query: string) => void;
  debounceMs?: number;
};

/** Búsqueda local: el input no bloquea el kanban (debounce al padre). */
export const MarketingSearchInput = memo(function MarketingSearchInput({
  onQueryChange,
  debounceMs = 280,
}: MarketingSearchInputProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => onQueryChange(value.trim()), debounceMs);
    return () => window.clearTimeout(timer);
  }, [value, debounceMs, onQueryChange]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar leads…"
        className="h-7 w-[170px] pl-8 text-xs lg:w-[220px]"
      />
    </div>
  );
});
