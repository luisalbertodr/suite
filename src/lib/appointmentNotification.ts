import { supabase } from '@/lib/supabase';

export async function sendAppointmentNotification(params: {
  companyId: string;
  fromUserId: string;
  recipientUserId: string;
  appointmentId: string;
  appointmentDate: string;
  clientName: string;
  message: string;
  titlePrefix?: string;
}): Promise<void> {
  const link = `/agenda?date=${params.appointmentDate}&appointment=${params.appointmentId}`;
  const title =
    params.titlePrefix?.trim() ||
    `Aviso · ${params.clientName}`;

  let { error } = await supabase.from('notifications').insert({
    company_id: params.companyId,
    user_id: params.recipientUserId,
    from_user_id: params.fromUserId,
    appointment_id: params.appointmentId,
    title,
    message: params.message,
    type: 'appointment',
    link,
    read: false,
    metadata: { appointment_id: params.appointmentId, appointment_date: params.appointmentDate },
  });

  if (error?.code === '42703') {
    ({ error } = await supabase.from('notifications').insert({
      company_id: params.companyId,
      user_id: params.recipientUserId,
      title,
      message: params.message,
      type: 'info',
      link,
      read: false,
    }));
  }

  if (error) throw error;
}

/** Prioriza recepción (Gemma) si está en la lista de destinatarios. */
export function defaultReceptionNotifyUserId(
  recipients: Array<{ userId: string; label: string }>,
): string {
  if (!recipients.length) return '';
  const gemma = recipients.find((r) => /gemma/i.test(r.label));
  return gemma?.userId ?? recipients[0]!.userId;
}
