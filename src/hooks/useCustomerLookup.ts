import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  buildCustomerLookupIndex,
  type CustomerLookupIndex,
  type CustomerLookupRow,
} from '@/lib/customerLookupMatch';

export type { CustomerLookupRow, CustomerLookupIndex };

export const useCustomerLookup = (): {
  index: CustomerLookupIndex;
  isLoading: boolean;
} => {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const query = useQuery({
    queryKey: ['customer-lookup', companyId],
    enabled: !!companyId && !companyLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<CustomerLookupRow[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, phone_mobile, phone_home')
        .eq('company_id', companyId)
        .is('archived_at', null);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const index = useMemo<CustomerLookupIndex>(
    () => buildCustomerLookupIndex(query.data ?? []),
    [query.data],
  );

  return { index, isLoading: query.isLoading };
};
