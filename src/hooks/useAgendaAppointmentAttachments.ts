import { useQuery } from '@tanstack/react-query';
import { fetchAppointmentAttachmentHintsByIds } from '@/lib/appointmentAttachmentHints';

export function useAgendaAppointmentAttachments(appointmentIds: string[]) {
  const key = appointmentIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['agenda-appointment-attachments', key],
    queryFn: () => fetchAppointmentAttachmentHintsByIds(appointmentIds),
    enabled: appointmentIds.length > 0,
    staleTime: 30_000,
  });
}
