import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildCustomerLookupIndex,
  fetchCustomerLookupRowsForCompanies,
  type CustomerLookupIndex,
} from '@/lib/customerLookupMatch';
import { MARKETING_ACCESS_COMPANY_IDS } from '@/lib/marketingScope';

/** Clientes Estética + Medicina para enlazar leads de marketing con agenda y facturación. */
export const useMarketingCustomerLookup = (enabled = true): {
  index: CustomerLookupIndex;
  isLoading: boolean;
} => {
  const query = useQuery({
    queryKey: ['marketing-customer-lookup', ...MARKETING_ACCESS_COMPANY_IDS],
    enabled,
    staleTime: 60_000,
    queryFn: () => fetchCustomerLookupRowsForCompanies(MARKETING_ACCESS_COMPANY_IDS),
  });

  const index = useMemo<CustomerLookupIndex>(
    () => buildCustomerLookupIndex(query.data ?? []),
    [query.data],
  );

  return { index, isLoading: query.isLoading };
};
