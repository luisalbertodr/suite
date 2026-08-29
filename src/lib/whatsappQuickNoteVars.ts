import { supabase } from '@/lib/supabase';
import {
  appointmentDisplayTitle,
  appointmentYmd,
  normalizeHm,
} from '@/lib/agendaAppointmentDisplay';
import { stripCombiningMarks } from '@/lib/unicodeText';

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

const EMPTY_APPT_VARS: Pick<
  WhatsappQuickNoteVarContext,
  'fecha_cita' | 'hora_cita' | 'titulo' | 'profesional'
> = {
  fecha_cita: '',
  hora_cita: '',
  titulo: '',
  profesional: '',
};

/** Alias aceptados en plantillas (además de las keys oficiales). */
const VAR_ALIASES: Record<string, keyof typeof EMPTY_APPT_VARS | 'nombre' | 'nombre_completo'> = {
  nombre: 'nombre',
  nombre_completo: 'nombre_completo',
  fecha_cita: 'fecha_cita',
  fecha: 'fecha_cita',
  date: 'fecha_cita',
  dia: 'fecha_cita',
  día: 'fecha_cita',
  hora_cita: 'hora_cita',
  hora: 'hora_cita',
  time: 'hora_cita',
  horario: 'hora_cita',
  titulo: 'titulo',
  título: 'titulo',
  servicio: 'titulo',
  profesional: 'profesional',
  empleado: 'profesional',
};

function madridTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Interpreta fecha+hora de agenda como reloj de pared en Europe/Madrid.
 * Evita el bug de `new Date('YYYY-MM-DDTHH:mm:00')` (zona del navegador).
 */
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

  // Buscar el instante UTC cuya hora local Madrid coincide con ymd+hm.
  const [yy, mo, dd] = ymd.split('-').map(Number);
  const [hh, mi] = hm.split(':').map(Number);
  if (![yy, mo, dd, hh, mi].every((n) => Number.isFinite(n))) return null;

  let guess = Date.UTC(yy!, mo! - 1, dd!, hh!, mi!, 0);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? NaN);
    const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), 0);
    const targetAsUtc = Date.UTC(yy!, mo! - 1, dd!, hh!, mi!, 0);
    const delta = targetAsUtc - localAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  const out = new Date(guess);
  return Number.isNaN(out.getTime()) ? null : out;
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

type ApptRow = {
  id: string;
  description?: string | null;
  appointment_date?: string | null;
  start_time?: string | null;
  status?: string | null;
  legacy_codemp?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  title?: string | null;
};

async function resolveEmployeeName(
  companyId: string | null | undefined,
  row: ApptRow,
): Promise<string> {
  if (row.employee_name?.trim()) return row.employee_name.trim();
  if (!companyId) return '';
  if (row.employee_id) {
    const { data } = await supabase
      .from('agenda_employees')
      .select('name')
      .eq('id', row.employee_id)
      .maybeSingle();
    if (data?.name?.trim()) return data.name.trim();
  }
  const code = String(row.legacy_codemp ?? '').trim();
  if (code) {
    const { data } = await supabase
      .from('agenda_employees')
      .select('name')
      .eq('company_id', companyId)
      .eq('dunasoft_codemp', code)
      .limit(1)
      .maybeSingle();
    if (data?.name?.trim()) return data.name.trim();
  }
  return '';
}

function pickUpcoming(rows: ApptRow[]): { row: ApptRow; start: Date } | null {
  const now = Date.now() - 15 * 60 * 1000;
  const upcoming = rows
    .filter((r) => String(r.status ?? '').toLowerCase() !== 'cancelled')
    .map((row) => ({ row, start: parseAppointmentStart(row) }))
    .filter((x): x is { row: ApptRow; start: Date } => !!x.start && x.start.getTime() >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  return upcoming ?? null;
}

/** Carga variables de la próxima cita del cliente (si existe). */
export async function loadWhatsappQuickNoteAppointmentVars(
  customerId: string | null | undefined,
): Promise<Pick<WhatsappQuickNoteVarContext, 'fecha_cita' | 'hora_cita' | 'titulo' | 'profesional'>> {
  if (!customerId) return { ...EMPTY_APPT_VARS };

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('company_id, legacy_codcli')
      .eq('id', customerId)
      .maybeSingle();
    const companyId = customer?.company_id ?? null;
    const legacyCod = String(customer?.legacy_codcli ?? '').trim();
    const today = madridTodayYmd();

    const selectCols =
      'id, description, appointment_date, start_time, status, legacy_codemp, employee_id, client_name';

    // Preferir citas futuras/hoy ordenadas ASC (evita que el historial pasado llene el límite).
    let upcoming: { row: ApptRow; start: Date } | null = null;

    const tryByCustomer = async () => {
      const { data, error } = await supabase
        .from('agenda_appointments')
        .select(selectCols)
        .eq('customer_id', customerId)
        .neq('status', 'cancelled')
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(15);
      if (error) throw error;
      return pickUpcoming((data ?? []) as ApptRow[]);
    };

    const tryByLegacy = async () => {
      if (!legacyCod) return null;
      const { data, error } = await supabase
        .from('agenda_appointments')
        .select(selectCols)
        .eq('legacy_codcli', legacyCod)
        .neq('status', 'cancelled')
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(15);
      if (error) throw error;
      return pickUpcoming((data ?? []) as ApptRow[]);
    };

    upcoming = await tryByCustomer();
    if (!upcoming) upcoming = await tryByLegacy();

    // Fallback: citas con appointment_date null pero start_time ISO futuro.
    if (!upcoming) {
      const { data } = await supabase
        .from('agenda_appointments')
        .select(selectCols)
        .eq('customer_id', customerId)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })
        .limit(40);
      upcoming = pickUpcoming((data ?? []) as ApptRow[]);
    }

    if (!upcoming) return { ...EMPTY_APPT_VARS };

    const title =
      appointmentDisplayTitle(upcoming.row.description, []) ||
      String(upcoming.row.title ?? '').trim() ||
      '';
    const profesional = await resolveEmployeeName(companyId, upcoming.row);

    return {
      fecha_cita: formatFechaCita(upcoming.start),
      hora_cita: formatHoraCita(upcoming.start),
      titulo: title,
      profesional,
    };
  } catch (e) {
    console.warn('loadWhatsappQuickNoteAppointmentVars:', e);
    return { ...EMPTY_APPT_VARS };
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
  return body.replace(/\{([^{}]+)\}/g, (match, rawKey: string) => {
    const k = stripCombiningMarks(String(rawKey).trim()).toLowerCase();
    const alias = VAR_ALIASES[k];
    if (alias && Object.prototype.hasOwnProperty.call(vars, alias)) {
      return vars[alias] ?? '';
    }
    if (Object.prototype.hasOwnProperty.call(vars, k)) return vars[k] ?? '';
    return match;
  });
}

/** Placeholders de fecha/hora presentes en la plantilla. */
export function quickNoteUsesAppointmentSchedule(body: string): boolean {
  return /\{(fecha_cita|fecha|date|dia|día|hora_cita|hora|time|horario)\}/i.test(body);
}

export function quickNoteMissingScheduleVars(
  body: string,
  ctx: Pick<WhatsappQuickNoteVarContext, 'fecha_cita' | 'hora_cita'>,
): string[] {
  if (!quickNoteUsesAppointmentSchedule(body)) return [];
  const missing: string[] = [];
  if (!String(ctx.fecha_cita ?? '').trim()) missing.push('fecha');
  if (!String(ctx.hora_cita ?? '').trim()) missing.push('hora');
  return missing;
}
