/** Filtro de vista en agenda por empresa emisora (centro laboral). */

export type AgendaBillingView = 'all' | string;

export const AGENDA_BILLING_VIEW_STORAGE_KEY = 'agenda-billing-view';

export function loadAgendaBillingView(userId: string | null | undefined): AgendaBillingView {
  if (!userId || typeof window === 'undefined') return 'all';
  try {
    const raw = localStorage.getItem(`${AGENDA_BILLING_VIEW_STORAGE_KEY}:${userId}`);
    return raw && raw.length > 0 ? raw : 'all';
  } catch {
    return 'all';
  }
}

export function saveAgendaBillingView(userId: string | null | undefined, view: AgendaBillingView): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${AGENDA_BILLING_VIEW_STORAGE_KEY}:${userId}`, view);
  } catch {
    /* ignore */
  }
}

/** Empleados visibles: compartidos (sin emisor) + los de la empresa seleccionada. */
export function filterEmployeesForAgendaView<
  T extends { id: string; billing_company_id?: string | null },
>(employees: T[], view: AgendaBillingView): T[] {
  if (view === 'all') return employees;
  return employees.filter((e) => !e.billing_company_id || e.billing_company_id === view);
}

export function filterAppointmentsForAgendaView<
  T extends { employeeId: string },
>(appointments: T[], visibleEmployeeIds: Set<string>): T[] {
  if (visibleEmployeeIds.size === 0) return appointments;
  return appointments.filter((a) => !a.employeeId || visibleEmployeeIds.has(a.employeeId));
}
