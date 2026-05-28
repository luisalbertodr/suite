import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  filterCustomersBySearch,
  isCustomerSearchQueryReady,
  type CustomerSearchRow,
} from '@/lib/customerSearch';

const DEBOUNCE_MS = 300;

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

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
      const pattern = `%${escapeIlike(q)}%`;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId!)
        .or(
          [
            `name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `tax_id.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `phone_mobile.ilike.${pattern}`,
            `phone_home.ilike.${pattern}`,
            `legacy_codcli.ilike.${pattern}`,
          ].join(','),
        )
        .order('name')
        .limit(100);
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
