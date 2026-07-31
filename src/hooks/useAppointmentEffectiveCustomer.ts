import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import type { AppointmentCustomerSummary } from '@/lib/appointmentCustomerSummary';
import {
  isWrongInbodyAppointmentLink,
  resolveAppointmentClientPick,
  resolveAppointmentCustomerFromDb,
} from '@/lib/appointmentCustomerResolve';

type AppointmentLike = {
  id: string;
  clientName: string;
  customerId?: string | null;
  legacyClientCode?: string | null;
};

type Options = {
  companyId: string | null | undefined;
  appointment: AppointmentLike | null | undefined;
  customers?: CustomerSearchRow[];
  /** Corrige customer_id en BD si apunta a Paciente InBody y hay ficha real. */
  autoHeal?: boolean;
};

export function useAppointmentEffectiveCustomer({
  companyId,
  appointment,
  customers = [],
  autoHeal = false,
}: Options) {
  const queryClient = useQueryClient();
  const clientName = appointment?.clientName?.trim() ?? '';
  const legacyCodcli = appointment?.legacyClientCode?.trim() || null;
  const storedCustomerId = appointment?.customerId ?? null;

  const inMemoryPick = useMemo(
    () =>
      appointment
        ? resolveAppointmentClientPick(clientName, customers, {
            customerId: storedCustomerId,
            legacyCodcli,
          })
        : null,
    [appointment, clientName, customers, legacyCodcli, storedCustomerId],
  );

  const { data: customerFromDb, isLoading } = useQuery({
    queryKey: [
      'appointment-effective-customer',
      companyId,
      appointment?.id,
      clientName,
      legacyCodcli,
      storedCustomerId,
    ],
    enabled: Boolean(companyId && appointment),
    queryFn: async (): Promise<AppointmentCustomerSummary | null> => {
      return resolveAppointmentCustomerFromDb(companyId!, {
        clientName,
        customerId: storedCustomerId,
        legacyCodcli,
      });
    },
    staleTime: 30_000,
  });

  const effectiveCustomerId =
    customerFromDb?.id ??
    (inMemoryPick?.kind === 'customer' ? inMemoryPick.customerId : null) ??
    null;

  const summaryCustomer: AppointmentCustomerSummary | null = customerFromDb ?? null;

  const wrongInbodyLink = isWrongInbodyAppointmentLink(
    summaryCustomer && storedCustomerId && summaryCustomer.id === storedCustomerId
      ? summaryCustomer
      : null,
    clientName,
    legacyCodcli,
  );

  useEffect(() => {
    if (!autoHeal || !companyId || !appointment?.id || !effectiveCustomerId) return;
    if (effectiveCustomerId === storedCustomerId) return;
    if (!storedCustomerId) return;

    let cancelled = false;
    void (async () => {
      const { data: stored } = await supabase
        .from('customers')
        .select('id, name')
        .eq('id', storedCustomerId)
        .maybeSingle();
      if (cancelled || !stored) return;
      if (!isWrongInbodyAppointmentLink(stored, clientName, legacyCodcli)) return;

      const { error } = await supabase
        .from('agenda_appointments')
        .update({ customer_id: effectiveCustomerId })
        .eq('id', appointment.id);
      if (error || cancelled) return;

      void queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['dunasoft-agenda-day'] });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    autoHeal,
    appointment?.id,
    clientName,
    companyId,
    effectiveCustomerId,
    legacyCodcli,
    queryClient,
    storedCustomerId,
  ]);

  return {
    effectiveCustomerId,
    summaryCustomer,
    isLoading,
    wrongInbodyLink,
  };
}
