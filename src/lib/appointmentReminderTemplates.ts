/**
 * Categorías de recordatorio de cita por tratamiento.
 * Prioridad (mayor gana) si el cliente tiene varias citas el mismo día:
 * laser_fotodepilacion > micropigmentacion > medicina > otros
 */

export type AppointmentReminderCategory =
  | 'laser_fotodepilacion'
  | 'micropigmentacion'
  | 'medicina'
  | 'otros';

export type AppointmentReminderTemplatePair = {
  day_before?: string | null;
  hour_before?: string | null;
};

export type AppointmentReminderTemplates = Partial<
  Record<AppointmentReminderCategory, AppointmentReminderTemplatePair>
>;

export const APPOINTMENT_REMINDER_CATEGORY_ORDER: AppointmentReminderCategory[] = [
  'laser_fotodepilacion',
  'micropigmentacion',
  'medicina',
  'otros',
];

export const APPOINTMENT_REMINDER_CATEGORY_LABELS: Record<AppointmentReminderCategory, string> = {
  laser_fotodepilacion: 'Láser / fotodepilación',
  micropigmentacion: 'Micropigmentación',
  medicina: 'Medicina',
  otros: 'Resto de tratamientos',
};

export const APPOINTMENT_REMINDER_CATEGORY_PRIORITY: Record<AppointmentReminderCategory, number> = {
  laser_fotodepilacion: 40,
  micropigmentacion: 30,
  medicina: 20,
  otros: 10,
};

export const DEFAULT_TREATMENT_REMINDER_TEMPLATES: Record<
  AppointmentReminderCategory,
  Required<AppointmentReminderTemplatePair>
> = {
  laser_fotodepilacion: {
    day_before:
      'Hola, {nombre}.\n\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita} h para tu sesión de fotodepilación / láser fraccionado.\n\nSi has estado expuesta al sol o estás tomando algún medicamento, especialmente antibióticos, tendremos que reprogramar tu cita.\n\nRecuerda confirmar tu asistencia respondiendo a este mensaje o la cita será liberada.\n\nUn saludo.',
    hour_before:
      'Hola {nombre}, tu sesión de fotodepilación / láser es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.',
  },
  micropigmentacion: {
    day_before:
      'Buenos días {nombre}.\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita} para tu sesión de micropigmentación.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.',
    hour_before:
      'Hola {nombre}, tu cita de micropigmentación es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.',
  },
  medicina: {
    day_before:
      'Buenos días {nombre}.\nTe recordamos tu cita de mañana con {profesional} en Lipoout a las {hora_cita}.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.',
    hour_before:
      'Hola {nombre}, tu cita con {profesional} es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.',
  },
  otros: {
    day_before:
      'Buenos días {nombre}.\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita}.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.',
    hour_before:
      'Hola {nombre}, tu cita es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.',
  },
};

function normalizeMatchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

const LASER_RE =
  /\b(laser|laser\s*fraccionado|fotodepil|foto\s*depil|ipl|diodo|shr|soprano|alexandrita)\b/;
const MICRO_RE =
  /\b(micropigment|microblading|dermopigment|micro\s*pigment|micro)\b/;
const MEDICINA_RE =
  /\b(medicina|botox|relleno|acido\s*hialuronico|hialuronico|infiltr|mesoterapia|consulta\s+medica|dra\.?|dr\.?)\b/;

/** Clasifica texto de servicios/título/descripción en una categoría. */
export function classifyAppointmentReminderCategory(
  texts: Array<string | null | undefined>,
): AppointmentReminderCategory {
  const blob = normalizeMatchText(texts.filter(Boolean).join(' | '));
  if (!blob.trim()) return 'otros';
  if (LASER_RE.test(blob)) return 'laser_fotodepilacion';
  if (MICRO_RE.test(blob)) return 'micropigmentacion';
  if (MEDICINA_RE.test(blob)) return 'medicina';
  return 'otros';
}

export function pickHighestPriorityCategory(
  categories: AppointmentReminderCategory[],
): AppointmentReminderCategory {
  if (categories.length === 0) return 'otros';
  return categories.reduce((best, cur) =>
    APPOINTMENT_REMINDER_CATEGORY_PRIORITY[cur] > APPOINTMENT_REMINDER_CATEGORY_PRIORITY[best]
      ? cur
      : best,
  );
}

export function resolveTreatmentReminderTemplate(
  templates: AppointmentReminderTemplates | null | undefined,
  category: AppointmentReminderCategory,
  kind: 'day_before' | 'hour_before',
  globalFallback?: string | null,
): string {
  const fromCat = templates?.[category]?.[kind]?.trim();
  if (fromCat) return fromCat;
  const fromOtros = templates?.otros?.[kind]?.trim();
  if (fromOtros) return fromOtros;
  const def = DEFAULT_TREATMENT_REMINDER_TEMPLATES[category][kind];
  if (def?.trim()) return def;
  return globalFallback?.trim() || DEFAULT_TREATMENT_REMINDER_TEMPLATES.otros[kind];
}

export function mergeAppointmentReminderTemplates(
  stored: AppointmentReminderTemplates | null | undefined,
): Record<AppointmentReminderCategory, Required<AppointmentReminderTemplatePair>> {
  const out = { ...DEFAULT_TREATMENT_REMINDER_TEMPLATES };
  for (const cat of APPOINTMENT_REMINDER_CATEGORY_ORDER) {
    const s = stored?.[cat];
    out[cat] = {
      day_before: s?.day_before?.trim() || DEFAULT_TREATMENT_REMINDER_TEMPLATES[cat].day_before,
      hour_before: s?.hour_before?.trim() || DEFAULT_TREATMENT_REMINDER_TEMPLATES[cat].hour_before,
    };
  }
  return out;
}
