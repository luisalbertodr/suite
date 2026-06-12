import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadWhatsappConfig,
  normalizeChatId,
  type WhatsappConfigRow,
} from './marketingWhatsappAutomation.ts';

export type WhatsappAutomationSettings = {
  company_id: string;
  test_mode_enabled: boolean;
  test_phone: string;
  appointment_reminders_enabled: boolean;
  appointment_reminder_day_before_enabled: boolean;
  appointment_reminder_day_before_message: string | null;
  appointment_reminder_hour_before_enabled: boolean;
  appointment_reminder_hour_before_message: string | null;
  appointment_reminder_send_hour_start: number;
  phone_missed_whatsapp_enabled: boolean;
  phone_missed_whatsapp_phone: string;
};

export type AutomationSendType =
  | 'appointment_day_before'
  | 'appointment_hour_before'
  | 'meta_initial'
  | 'meta_reply_1'
  | 'meta_reply_2'
  | 'meta_invalid'
  | 'meta_payment_success'
  | 'test_manual'
  | 'phone_missed'
  | 'phone_voicemail';

const DEFAULT_DAY_BEFORE =
  'Hola {nombre}, te recordamos tu cita mañana {fecha_cita} a las {hora_cita} en Lipoout. Si necesitas cambiarla, responde a este mensaje.';
const DEFAULT_HOUR_BEFORE =
  'Hola {nombre}, tu cita es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.';

export function defaultDayBeforeMessage(): string {
  return DEFAULT_DAY_BEFORE;
}

export function defaultHourBeforeMessage(): string {
  return DEFAULT_HOUR_BEFORE;
}

export async function loadAutomationSettings(
  admin: SupabaseClient,
  companyId: string,
): Promise<WhatsappAutomationSettings> {
  const { data, error } = await admin
    .from('whatsapp_automation_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as WhatsappAutomationSettings;

  const { data: inserted, error: insErr } = await admin
    .from('whatsapp_automation_settings')
    .insert({ company_id: companyId })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return inserted as WhatsappAutomationSettings;
}

export function resolveRecipientPhone(
  intendedPhone: string,
  settings: WhatsappAutomationSettings,
): { chatPhone: string; testMode: boolean; intendedLabel: string } {
  const intended = intendedPhone.trim();
  if (!settings.test_mode_enabled) {
    return { chatPhone: intended, testMode: false, intendedLabel: intended };
  }
  const test = settings.test_phone.replace(/[^0-9+]/g, '') || '667435503';
  return { chatPhone: test, testMode: true, intendedLabel: intended };
}

export function wrapMessageForTestMode(
  text: string,
  settings: WhatsappAutomationSettings,
  intendedLabel: string,
): string {
  if (!settings.test_mode_enabled) return text;
  const who = intendedLabel.trim() || 'cliente';
  return `[PRUEBA — mensaje para ${who}]\n${text}`;
}

export async function logAutomationSend(
  admin: SupabaseClient,
  input: {
    company_id: string;
    automation_type: AutomationSendType;
    reference_id: string;
    intended_phone?: string | null;
    sent_to_phone?: string | null;
    message_preview?: string | null;
    success: boolean;
    error?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from('whatsapp_automation_send_log').upsert(
    {
      company_id: input.company_id,
      automation_type: input.automation_type,
      reference_id: input.reference_id,
      intended_phone: input.intended_phone ?? null,
      sent_to_phone: input.sent_to_phone ?? null,
      message_preview: input.message_preview?.slice(0, 300) ?? null,
      success: input.success,
      error: input.error?.slice(0, 500) ?? null,
    },
    { onConflict: 'company_id,automation_type,reference_id', ignoreDuplicates: false },
  );
  if (error) console.error('logAutomationSend failed:', error.message);
}

async function wahaSendText(
  cfg: WhatsappConfigRow,
  chatId: string,
  text: string,
): Promise<void> {
  const base = (cfg.base_url ?? '').replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.api_key) headers['X-Api-Key'] = cfg.api_key;
  const resp = await fetch(`${base}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session: cfg.session_name || 'default',
      chatId,
      text,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`WAHA HTTP ${resp.status}: ${t.slice(0, 200)}`);
  }
}

export async function sendAutomatedWhatsapp(
  admin: SupabaseClient,
  companyId: string,
  intendedPhone: string,
  text: string,
  meta: {
    automation_type: AutomationSendType;
    reference_id: string;
    intended_label?: string;
  },
): Promise<{ ok: boolean; chatId?: string; error?: string }> {
  const settings = await loadAutomationSettings(admin, companyId);
  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url) {
    return { ok: false, error: 'WhatsApp no configurado' };
  }
  if ((cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { ok: false, error: `Sesión WhatsApp: ${cfg.last_status ?? 'desconocida'}` };
  }

  const { chatPhone, intendedLabel } = resolveRecipientPhone(intendedPhone, settings);
  const body = wrapMessageForTestMode(
    text,
    settings,
    meta.intended_label ?? intendedLabel,
  );
  const chatId = normalizeChatId(chatPhone, cfg.default_country_code);

  try {
    await wahaSendText(cfg, chatId, body);
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: body,
      success: true,
    });
    return { ok: true, chatId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar';
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: body,
      success: false,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

/** Envío directo sin modo prueba (alertas internas de telefonía, etc.). */
export async function sendDirectWhatsapp(
  admin: SupabaseClient,
  companyId: string,
  phone: string,
  text: string,
  meta: {
    automation_type: AutomationSendType;
    reference_id: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url) {
    return { ok: false, error: 'WhatsApp no configurado' };
  }
  if ((cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { ok: false, error: `Sesión WhatsApp: ${cfg.last_status ?? 'desconocida'}` };
  }

  const chatId = normalizeChatId(phone.replace(/\D/g, ''), cfg.default_country_code);
  try {
    await wahaSendText(cfg, chatId, text);
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: phone,
      sent_to_phone: phone,
      message_preview: text,
      success: true,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar';
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: phone,
      sent_to_phone: phone,
      message_preview: text,
      success: false,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

export function renderAppointmentReminderTemplate(
  template: string | null | undefined,
  ctx: {
    customerName: string;
    startTime: Date;
    title?: string | null;
    employeeName?: string | null;
  },
  fallback: string,
): string {
  const raw = template?.trim() || fallback;
  const madrid = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ctx.startTime);
  const hour = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ctx.startTime);
  const firstName = ctx.customerName.trim().split(/\s+/)[0] || ctx.customerName;
  const vars: Record<string, string> = {
    nombre: firstName,
    nombre_completo: ctx.customerName,
    fecha_cita: madrid,
    hora_cita: hour,
    titulo: ctx.title?.trim() ?? '',
    profesional: ctx.employeeName?.trim() ?? '',
    cita: `${madrid} ${hour}`,
  };
  return raw.replace(/\{([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+)\}/g, (match, key: string) => {
    const k = key.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return vars[k] ?? match;
  });
}

function madridParts(d: Date): { y: number; m: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function madridDayKey(d: Date): string {
  const p = madridParts(d);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function addMadridDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function runAppointmentRemindersForCompany(
  admin: SupabaseClient,
  companyId: string,
): Promise<{ day_before: number; hour_before: number; errors: string[] }> {
  const settings = await loadAutomationSettings(admin, companyId);
  if (!settings.appointment_reminders_enabled) {
    return { day_before: 0, hour_before: 0, errors: [] };
  }

  const now = new Date();
  const nowM = madridParts(now);
  const tomorrowKey = madridDayKey(addMadridDays(now, 1));
  const errors: string[] = [];
  let dayBefore = 0;
  let hourBefore = 0;

  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: appointments, error } = await admin
    .from('agenda_appointments')
    .select('id, title, start_time, status, customer_id, client_name, employee_id')
    .eq('company_id', companyId)
    .gte('start_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .not('status', 'eq', 'cancelled');

  if (error) throw error;

  for (const apt of appointments ?? []) {
    const startRaw = apt.start_time as string | null;
    if (!startRaw) continue;
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) continue;

    let phone: string | null = null;
    let customerName = (apt.client_name as string | null)?.trim() ?? '';
    if (apt.customer_id) {
      const { data: cust } = await admin
        .from('customers')
        .select('name, phone, phone_mobile, phone_home')
        .eq('id', apt.customer_id)
        .maybeSingle();
      if (cust) {
        phone = (cust.phone_mobile || cust.phone || cust.phone_home || '').trim() || null;
        customerName = cust.name?.trim() || customerName;
      }
    }
    if (!phone?.trim()) continue;

    const employeeName = apt.employee_id
      ? (
          await admin
            .from('agenda_employees')
            .select('name')
            .eq('id', apt.employee_id)
            .maybeSingle()
        ).data?.name?.trim() ?? null
      : null;
    const aptDayKey = madridDayKey(start);

    if (
      settings.appointment_reminder_day_before_enabled &&
      aptDayKey === tomorrowKey &&
      nowM.hour >= settings.appointment_reminder_send_hour_start
    ) {
      const ref = `${apt.id}:day_before`;
      const { data: sent } = await admin
        .from('whatsapp_automation_send_log')
        .select('id')
        .eq('company_id', companyId)
        .eq('automation_type', 'appointment_day_before')
        .eq('reference_id', ref)
        .maybeSingle();
      if (!sent) {
        const text = renderAppointmentReminderTemplate(
          settings.appointment_reminder_day_before_message,
          { customerName: customerName || 'cliente', startTime: start, title: apt.title, employeeName },
          defaultDayBeforeMessage(),
        );
        const res = await sendAutomatedWhatsapp(admin, companyId, phone, text, {
          automation_type: 'appointment_day_before',
          reference_id: ref,
          intended_label: customerName || phone,
        });
        if (res.ok) dayBefore++;
        else if (res.error) errors.push(res.error);
      }
    }

    const diffMin = (start.getTime() - now.getTime()) / 60_000;
    if (
      settings.appointment_reminder_hour_before_enabled &&
      diffMin >= 50 &&
      diffMin <= 70
    ) {
      const ref = `${apt.id}:hour_before`;
      const { data: sent } = await admin
        .from('whatsapp_automation_send_log')
        .select('id')
        .eq('company_id', companyId)
        .eq('automation_type', 'appointment_hour_before')
        .eq('reference_id', ref)
        .maybeSingle();
      if (!sent) {
        const text = renderAppointmentReminderTemplate(
          settings.appointment_reminder_hour_before_message,
          { customerName: customerName || 'cliente', startTime: start, title: apt.title, employeeName },
          defaultHourBeforeMessage(),
        );
        const res = await sendAutomatedWhatsapp(admin, companyId, phone, text, {
          automation_type: 'appointment_hour_before',
          reference_id: ref,
          intended_label: customerName || phone,
        });
        if (res.ok) hourBefore++;
        else if (res.error) errors.push(res.error);
      }
    }
  }

  return { day_before: dayBefore, hour_before: hourBefore, errors };
}
