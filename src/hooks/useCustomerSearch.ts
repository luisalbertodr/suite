import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  isCustomerSearchQueryReady,
  type CustomerSearchRow,
} from '@/lib/customerSearch';

const DEBOUNCE_MS = 180;

export type CustomerListMode = 'active' | 'archived';

export function useCustomerSearch(
  companyId: string | null | undefined,
  rawQuery: string,
  mode: CustomerListMode = 'active',
) {
  const [debouncedQuery, setDebouncedQuery] = useState(rawQuery.trim());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const queryReady =
    mode === 'archived'
      ? Boolean(companyId)
      : Boolean(companyId) && isCustomerSearchQueryReady(debouncedQuery);

  const query = useQuery({
    queryKey: ['customers-search', mode, companyId, debouncedQuery],
    enabled: queryReady,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const q = debouncedQuery.trim();
      if (mode === 'archived') {
        const { data, error } = await supabase.rpc('search_archived_customers', {
          p_catalog_company_id: companyId!,
          p_query: q || null,
          p_limit: 80,
        });
        if (error) throw error;
        return (data ?? []) as CustomerSearchRow[];
      }

      if (!isCustomerSearchQueryReady(q)) return [];
      const { data, error } = await supabase.rpc('search_customers', {
        p_catalog_company_id: companyId!,
        p_query: q,
        p_limit: 80,
      });
      if (error) throw error;
      // El RPC ya filtra por tokens; no refiltrar en cliente (ahorra trabajo y evita desajustes).
      return (data ?? []) as CustomerSearchRow[];
    },
    staleTime: 60_000,
  });

  return {
    customers: queryReady ? (query.data ?? []) : [],
    isLoading: queryReady && query.isLoading,
    isFetching: queryReady && query.isFetching,
    isReady: queryReady,
    isError: queryReady && query.isError,
    error: query.error,
    debouncedQuery,
  };
}
