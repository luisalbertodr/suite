import { supabase } from '@/lib/supabase';
import type {
  DunasoftCreateAppointmentPayload,
  DunasoftCreateAppointmentResult,
  DunasoftUpdateAppointmentPayload,
} from '@/lib/dunasoftDualWrite';

export async function createDunasoftAppointmentDual(
  payload: DunasoftCreateAppointmentPayload
): Promise<DunasoftCreateAppointmentResult> {
  const { data, error } = await supabase.rpc('agenda_dual_create', { p_payload: payload });
  if (error) throw error;
  return data as DunasoftCreateAppointmentResult;
}

export async function updateDunasoftAppointmentDual(
  idplan: string,
  payload: DunasoftUpdateAppointmentPayload
): Promise<{ legacy_idplan: number; outbox_id: number; dbf_status: string }> {
  const { data, error } = await supabase.rpc('agenda_dual_update', {
    p_idplan: idplan,
    p_payload: payload,
  });
  if (error) throw error;
  return data as { legacy_idplan: number; outbox_id: number; dbf_status: string };
}

export async function deleteDunasoftAppointmentDual(
  idplan: string
): Promise<{ legacy_idplan: number; outbox_id: number; dbf_status: string }> {
  const { data, error } = await supabase.rpc('agenda_dual_delete', { p_idplan: idplan });
  if (error) throw error;
  return data as { legacy_idplan: number; outbox_id: number; dbf_status: string };
}

/** Exporta cita Suite multi-segmento a N citas Style (split por recurso/tramo). */
export async function syncAgendaAppointmentToStyle(
  appointmentId: string
): Promise<{ ok: boolean; segments?: unknown; dbf_status?: string }> {
  const { data, error } = await supabase.rpc('agenda_dual_sync_appointment', {
    p_appointment_id: appointmentId,
  });
  if (error) throw error;
  return data as { ok: boolean; segments?: unknown; dbf_status?: string };
}
