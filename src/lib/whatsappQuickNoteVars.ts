import { fetchAppointmentsForCustomer } from '@/lib/agendaCustomerAppointments';
import {
  appointmentDisplayTitle,
  appointmentYmd,
  normalizeHm,
} from '@/lib/agendaAppointmentDisplay';

/** Variables disponibles en Notas rápidas de WhatsApp. */
export const WHATSAPP_QUICK_NOTE_VARS = [
  { key: 'nombre', description: 'Nombre del cliente' },
  { key: 'fecha_cita', description: 'Fecha de la próxima cita' },
  { key: 'hora_cita', description: 'Hora de la próxima cita' },
  { key: 'titulo', description: 'Título / servicio de la cita' },
  { key: 'profesional', description: 'Profesional asignado' },
] as const;

export type WhatsappQuickNoteVarContext = {
  nombre?: string;
  nombre_completo?: string;
  fecha_cita?: string;
  hora_cita?: string;
  titulo?: string;
  profesional?: string;
};

function parseAppointmentStart(row: {
  appointment_date?: string | null;
  start_time?: string | null;
}): Date | null {
  const st = String(row.start_time ?? '').trim();
  if (st.includes('T')) {
    const d = new Date(st);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ymd = appointmentYmd(row);
  const hm = normalizeHm(st);
  if (!ymd || !hm) return null;
  const d = new Date(`${ymd}T${hm}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFechaCita(start: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(start);
}

function formatHoraCita(start: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start);
}

/** Carga variables de la próxima cita del cliente (si existe). */
export async function loadWhatsappQuickNoteAppointmentVars(
  customerId: string | null | undefined,
): Promise<Pick<WhatsappQuickNoteVarContext, 'fecha_cita' | 'hora_cita' | 'titulo' | 'profesional'>> {
  if (!customerId) {
    return { fecha_cita: '', hora_cita: '', titulo: '', profesional: '' };
  }

  try {
    const page = await fetchAppointmentsForCustomer(customerId, {
      limit: 40,
      includeItems: false,
    });
    const now = Date.now() - 15 * 60 * 1000;
    const upcoming = page.rows
      .filter((r) => String(r.status ?? '').toLowerCase() !== 'cancelled')
      .map((row) => ({ row, start: parseAppointmentStart(row) }))
      .filter((x): x is { row: (typeof page.rows)[number]; start: Date } => !!x.start && x.start.getTime() >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

    if (!upcoming) {
      return { fecha_cita: '', hora_cita: '', titulo: '', profesional: '' };
    }

    const title =
      appointmentDisplayTitle(upcoming.row.description, upcoming.row.service_lines) ||
      upcoming.row.title ||
      '';

    return {
      fecha_cita: formatFechaCita(upcoming.start),
      hora_cita: formatHoraCita(upcoming.start),
      titulo: title,
      profesional: upcoming.row.employee_name?.trim() || '',
    };
  } catch {
    return { fecha_cita: '', hora_cita: '', titulo: '', profesional: '' };
  }
}

export function applyWhatsappQuickNoteVars(
  body: string,
  ctx: WhatsappQuickNoteVarContext,
): string {
  const full = ctx.nombre_completo?.trim() || ctx.nombre?.trim() || 'cliente';
  const first = full.split(/\s+/)[0] || full;
  const vars: Record<string, string> = {
    nombre: first,
    nombre_completo: full,
    fecha_cita: ctx.fecha_cita ?? '',
    hora_cita: ctx.hora_cita ?? '',
    titulo: ctx.titulo ?? '',
    profesional: ctx.profesional ?? '',
  };
  return body.replace(/\{([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+)\}/g, (match, key: string) => {
    const k = key.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : match;
  });
}
