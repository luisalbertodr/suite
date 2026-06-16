/** URL de agenda para abrir una cita concreta (opcional: volver al historial del cliente). */
export function buildAgendaAppointmentUrl(
  dateYmd: string,
  appointmentId: string,
  returnCustomerId?: string | null,
): string {
  const params = new URLSearchParams({ date: dateYmd, appointment: appointmentId });
  if (returnCustomerId) params.set('returnCustomer', returnCustomerId);
  return `/agenda?${params.toString()}`;
}

/** URL de ficha cliente (pestaña timeline por defecto). */
export function buildCustomerProfileUrl(customerId: string, tab = 'ficha'): string {
  const params = new URLSearchParams({ customer: customerId, tab });
  return `/clientes?${params.toString()}`;
}

/** URL de ficha cliente con pestaña de historial. */
export function buildCustomerHistoryUrl(customerId: string): string {
  return buildCustomerProfileUrl(customerId, 'timeline');
}
