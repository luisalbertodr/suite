import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAppointmentAsset } from '@/lib/appointmentAssets';
import { fetchCustomerAttachments } from '@/lib/customerAttachments';

export function useCustomerAttachments(customerId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['customer_attachments', customerId];

  const query = useQuery({
    queryKey,
    enabled: !!customerId,
    queryFn: () => fetchCustomerAttachments(customerId!),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointmentAsset,
    onSuccess: () => {
      if (customerId) {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      }
    },
  });

  return {
    ...query,
    removeAttachment: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
  };
}
