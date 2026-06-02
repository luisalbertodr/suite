import { useQuery } from '@tanstack/react-query';
import { fetchCustomerAttachments } from '@/lib/customerAttachments';

export function useCustomerAttachments(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer_attachments', customerId],
    enabled: !!customerId,
    queryFn: () => fetchCustomerAttachments(customerId!),
    staleTime: 60_000,
  });
}
