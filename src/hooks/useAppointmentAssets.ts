import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAppointmentAsset,
  fetchAppointmentAssets,
  uploadAppointmentAsset,
  type AppointmentAssetKind,
} from '@/lib/appointmentAssets';

export function useAppointmentAssets(
  appointmentId: string | undefined,
  opts?: { customerId?: string | null; companyId?: string | null; logDate?: string | null },
) {
  const queryClient = useQueryClient();
  const queryKey = ['appointment_assets', appointmentId];

  const query = useQuery({
    queryKey,
    enabled: !!appointmentId,
    queryFn: () => fetchAppointmentAssets(appointmentId!),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['agenda-appointment-attachments'] });
    if (opts?.customerId) {
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', opts.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_attachments', opts.customerId] });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!appointmentId || !opts?.customerId || !opts?.companyId || !opts?.logDate) {
        throw new Error('Guarda la cita con cliente y fecha antes de adjuntar archivos.');
      }
      return uploadAppointmentAsset({
        file,
        appointmentId,
        customerId: opts.customerId,
        companyId: opts.companyId,
        logDate: opts.logDate,
      });
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointmentAsset,
    onSuccess: invalidate,
  });

  return {
    assets: query.data ?? [],
    isLoading: query.isLoading,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
  };
}

export type { AppointmentAssetKind };
