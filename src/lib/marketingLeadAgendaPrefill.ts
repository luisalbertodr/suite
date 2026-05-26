import { format } from 'date-fns';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import type { AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import { resolveLeadAppointmentParts } from '@/lib/marketingLeadAppointment';

/** Fila mínima de marketing_leads para abrir la agenda con datos del lead */
export type MarketingLeadPrefillRow = {
  id: string;
  customer_id?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  form_name?: string | null;
  campaign?: string | null;
  notes?: string | null;
  field_data?: unknown;
  appointment_at?: string | null;
  appointment_label?: string | null;
};

function digits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Coincide el teléfono del lead con un cliente cargado en el picker de agenda. */
export function buildAgendaClientPickFromLead(
  lead: MarketingLeadPrefillRow,
  customers: CustomerSearchRow[],
): AppointmentClientPick | null {
  if (lead.customer_id) {
    const c = customers.find((x) => x.id === lead.customer_id);
    if (c) return { kind: 'customer', customerId: c.id, displayName: c.name };
  }
  const leadDigits = digits(lead.phone);
  if (leadDigits.length >= 9) {
    const tail = leadDigits.slice(-9);
    const match = customers.find((c) => {
      const ph = [c.phone, c.phone_home, c.phone_mobile].filter(Boolean).join('');
      const d = digits(ph);
      return d.length >= 9 && (d.endsWith(tail) || d.includes(tail));
    });
    if (match) return { kind: 'customer', customerId: match.id, displayName: match.name };
  }
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  if (name) return { kind: 'manual', name };
  return null;
}

export function buildAgendaPrefillFromLead(
  lead: MarketingLeadPrefillRow,
  customers: CustomerSearchRow[],
): {
  date: string;
  startTime: string;
  description: string;
  clientPick: AppointmentClientPick | null;
} {
  const parts = resolveLeadAppointmentParts(lead);
  const today = format(new Date(), 'yyyy-MM-dd');
  let date = today;
  let startTime = '09:00';
  if (parts.atIso) {
    const d = new Date(parts.atIso);
    date = format(d, 'yyyy-MM-dd');
    startTime = format(d, 'HH:mm');
  }
  const clientPick = buildAgendaClientPickFromLead(lead, customers);
  const ficticia =
    parts.atIso != null
      ? new Intl.DateTimeFormat('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(parts.atIso))
      : (parts.label?.trim() || '');
  const bits = [
    'Cita en agenda (lead marketing)',
    ficticia ? `Preferencia indicada en formulario: ${ficticia}` : null,
    lead.form_name ? `Formulario: ${lead.form_name}` : null,
    lead.campaign ? `Campaña: ${lead.campaign}` : null,
  ].filter(Boolean);
  const description = bits.join(' · ');
  return { date, startTime, description, clientPick };
}
