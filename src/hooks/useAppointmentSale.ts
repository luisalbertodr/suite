import { useQuery } from '@tanstack/react-query';
import { fetchAppointmentSale, fetchAppointmentSales } from '@/lib/appointmentSales';

export function useAppointmentSale(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointment-sale', appointmentId],
    queryFn: () => fetchAppointmentSale(appointmentId!),
    enabled: Boolean(appointmentId && !appointmentId.startsWith('draft-')),
    staleTime: 15_000,
  });
}

export function useAppointmentSales(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointment-sales', appointmentId],
    queryFn: () => fetchAppointmentSales(appointmentId!),
    enabled: Boolean(appointmentId && !appointmentId.startsWith('draft-')),
    staleTime: 15_000,
  });
}
