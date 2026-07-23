import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  filterCustomersBySearch,
  isCustomerSearchQueryReady,
  type CustomerSearchRow,
} from '@/lib/customerSearch';

const DEBOUNCE_MS = 300;

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
    queryFn: async () => {
      const q = debouncedQuery.trim();
      if (mode === 'archived') {
        const { data, error } = await supabase.rpc('search_archived_customers', {
          p_catalog_company_id: companyId!,
          p_query: q || null,
          p_limit: 100,
        });
        if (error) throw error;
        const rows = (data ?? []) as CustomerSearchRow[];
        return q ? filterCustomersBySearch(rows, q) : rows;
      }

      if (!isCustomerSearchQueryReady(q)) return [];
      const { data, error } = await supabase.rpc('search_customers', {
        p_catalog_company_id: companyId!,
        p_query: q,
        p_limit: 100,
      });
      if (error) throw error;
      return filterCustomersBySearch((data ?? []) as CustomerSearchRow[], q);
    },
    staleTime: 30_000,
  });

  return {
    customers: queryReady ? (query.data ?? []) : [],
    isLoading: queryReady && query.isLoading,
    isFetching: queryReady && query.isFetching,
    isReady: queryReady,
    debouncedQuery,
  };
}
