import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadCustomerLogAsset } from '@/lib/appointmentAssets';

export function useCustomerFileUpload(
  customerId: string | undefined,
  companyId: string | undefined,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (!customerId || !companyId) {
        throw new Error('No se puede subir: falta cliente o empresa.');
      }
      await uploadCustomerLogAsset({
        blob: file,
        fileName: file.name,
        mimeType: file.type,
        customerId,
        companyId,
      });
    },
    onSuccess: () => {
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['customer_attachments', customerId] });
        queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      }
    },
  });

  const uploadMany = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      await mutation.mutateAsync(file);
    }
  };

  return {
    upload: mutation.mutateAsync,
    uploadMany,
    isUploading: mutation.isPending,
  };
}
