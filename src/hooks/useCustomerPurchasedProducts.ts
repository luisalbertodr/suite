import { useQuery } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { fetchCustomerPurchasedProducts } from '@/lib/customerPurchasedProducts';

export function useCustomerPurchasedProducts(customerId: string) {
  const { companyId } = useCompanyFilter();

  return useQuery({
    queryKey: ['customer_purchased_products', customerId, companyId],
    enabled: Boolean(customerId && companyId),
    queryFn: () => fetchCustomerPurchasedProducts(customerId, companyId!),
  });
}
