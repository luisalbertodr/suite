import { supabase } from '@/lib/supabase';
import { fetchAppointmentSales } from '@/lib/appointmentSales';
import { cancelSaleTicket } from '@/lib/tpvSaleOperations';
import type { AppointmentItemDraft } from '@/types/agenda';

export type AppointmentPaymentLock = 'open' | 'charged' | 'invoiced';

export function resolveAppointmentPaymentLock(
  paymentStatus?: 'paid' | 'invoiced' | 'pending_charge' | 'none' | null,
): AppointmentPaymentLock {
  if (paymentStatus === 'invoiced') return 'invoiced';
  if (paymentStatus === 'paid') return 'charged';
  return 'open';
}

export function isAppointmentFinanciallyClosed(
  paymentStatus?: 'paid' | 'invoiced' | 'pending_charge' | 'none' | null,
): boolean {
  const lock = resolveAppointmentPaymentLock(paymentStatus);
  return lock === 'charged' || lock === 'invoiced';
}

export type CancelAppointmentWithRefundResult = {
  appointmentCancelled: boolean;
  salesCancelled: string[];
  salesSkippedInvoiced: string[];
  errors: string[];
};

/** Marca la cita como cancelada (sin borrar) y anula tickets TPV no facturados. */
export async function cancelAppointmentWithRefund(
  appointmentId: string,
  opts?: { reason?: string },
): Promise<CancelAppointmentWithRefundResult> {
  const sales = await fetchAppointmentSales(appointmentId);
  const result: CancelAppointmentWithRefundResult = {
    appointmentCancelled: false,
    salesCancelled: [],
    salesSkippedInvoiced: [],
    errors: [],
  };

  const completed = sales.filter((s) => s.status === 'completed');
  for (const sale of completed) {
    if (sale.invoice_id) {
      result.salesSkippedInvoiced.push(sale.id);
      continue;
    }
    try {
      await cancelSaleTicket(sale.id, opts?.reason ?? 'cancelacion_cita_agenda');
      result.salesCancelled.push(sale.id);
    } catch (err) {
      result.errors.push((err as Error).message || 'Error al anular ticket');
    }
  }

  const { error } = await supabase
    .from('agenda_appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId);

  if (error) throw error;
  result.appointmentCancelled = true;
  return result;
}

/** Borrado físico solo para citas abiertas (sin cobro cerrado). Queda en audit_events vía trigger. */
export async function deleteOpenAppointment(appointmentId: string): Promise<void> {
  const sales = await fetchAppointmentSales(appointmentId);
  const hasCompleted = sales.some((s) => s.status === 'completed');
  if (hasCompleted) {
    throw new Error(
      'La cita tiene cobros registrados. Usa «Cancelar y devolver» en lugar de eliminar.',
    );
  }

  const { error } = await supabase
    .from('agenda_appointments')
    .delete()
    .eq('id', appointmentId);

  if (error) throw error;
}

export function describeCancelRefundResult(
  result: CancelAppointmentWithRefundResult,
  invoiced: boolean,
  openingCorrectiveForm = false,
): { title: string; description: string; variant?: 'destructive' } {
  if (result.errors.length) {
    return {
      title: 'Cancelación incompleta',
      description: result.errors.join(' '),
      variant: 'destructive',
    };
  }

  const parts: string[] = ['La cita queda marcada como cancelada (historial conservado).'];
  if (result.salesCancelled.length) {
    parts.push(
      `Tickets anulados: ${result.salesCancelled.length}.`,
    );
  }
  if (openingCorrectiveForm) {
    parts.push('Se abre el borrador de factura rectificativa para revisar y guardar.');
  } else if (result.salesSkippedInvoiced.length || invoiced) {
    parts.push(
      'Los cobros facturados requieren factura rectificativa (no se encontró la factura original).',
    );
  }

  return {
    title: 'Cita cancelada',
    description: parts.join(' '),
  };
}

export function cloneItemsForNewAppointment(items: AppointmentItemDraft[]): AppointmentItemDraft[] {
  return items.map((it) => ({
    ...it,
    clientKey:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `k-${Date.now()}-${Math.random()}`,
  }));
}
