import { useQuery } from '@tanstack/react-query';
import { fetchCustomerPendingInvoiceDebt } from '@/lib/customerInvoiceDebt';

export function useCustomerPendingInvoiceDebt(
  companyId: string | null | undefined,
  customerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['customer-pending-invoice-debt', companyId, customerId],
    enabled: !!companyId && !!customerId,
    queryFn: () => fetchCustomerPendingInvoiceDebt(companyId!, customerId!),
    staleTime: 60_000,
  });
}
