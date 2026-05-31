import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  filterCustomersBySearch,
  isCustomerSearchQueryReady,
  type CustomerSearchRow,
} from '@/lib/customerSearch';

const DEBOUNCE_MS = 300;

export function useCustomerSearch(companyId: string | null | undefined, rawQuery: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(rawQuery.trim());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const ready = Boolean(companyId) && isCustomerSearchQueryReady(debouncedQuery);

  const query = useQuery({
    queryKey: ['customers-search', companyId, debouncedQuery],
    enabled: ready,
    queryFn: async () => {
      const q = debouncedQuery.trim();
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
    customers: ready ? (query.data ?? []) : [],
    isLoading: ready && query.isLoading,
    isFetching: ready && query.isFetching,
    isReady: ready,
    debouncedQuery,
  };
}
