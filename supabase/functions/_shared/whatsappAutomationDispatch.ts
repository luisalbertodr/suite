import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isWithinAutomationHours } from './whatsappAutomationHours.ts';
import {
  loadWhatsappConfig,
  normalizeChatId,
  type WhatsappConfigRow,
} from './marketingWhatsappAutomation.ts';
import {
  resolveWhatsappCredentials,
} from './whatsappProviderTypes.ts';
import { providerSendText } from './whatsappProviderClient.ts';
import {
  classifyAppointmentReminderCategory,
  pickHighestPriorityCategory,
  resolveTreatmentReminderTemplate,
  type AppointmentReminderCategory,
} from './appointmentReminderTemplates.ts';
import { ensureWhatsappSessionReadyForSend } from './whatsappSessionStatus.ts';

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
  appointment_reminder_templates?: import('./appointmentReminderTemplates.ts').AppointmentReminderTemplates | null;
  marketing_queue_hour_start?: number | null;
  marketing_queue_hour_end?: number | null;
  phone_missed_whatsapp_enabled: boolean;
  phone_missed_whatsapp_phone: string;
};

export type AutomationSendType =
  | 'appointment_day_before'
  | 'appointment_hour_before'
  | 'meta_initial'
  | 'meta_initial_audio'
  | 'meta_initial_audio_link'
  | 'meta_queue_initial'
  | 'meta_reply_1'
  | 'meta_reply_2'
  | 'meta_invalid'
  | 'meta_reminder'
  | 'meta_payment_success'
  | 'test_manual'
  | 'phone_missed'
  | 'phone_voicemail';

const DEFAULT_DAY_BEFORE =
  'Buenos días {nombre}.\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita}.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.';
const DEFAULT_HOUR_BEFORE =
  'Hola {nombre}, tu cita es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.';

export function defaultDayBeforeMessage(): string {
  return DEFAULT_DAY_BEFORE;
}

export function defaultHourBeforeMessage(): string {
  return DEFAULT_HOUR_BEFORE;
}

/** Últimos 9 dígitos de un teléfono (España). */
export function phoneDigitsLast9(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

export function testPhoneSuffix(settings: WhatsappAutomationSettings): string | null {
  const raw = settings.test_phone?.trim() || '667435503';
  return phoneDigitsLast9(raw);
}

/** True si los dígitos (o sufijo 9) coinciden con el teléfono de prueba WA. */
export function isWhatsappTestPhoneDigits(
  digits: string,
  settings: WhatsappAutomationSettings,
): boolean {
  if (!settings.test_mode_enabled) return false;
  const testSuffix = testPhoneSuffix(settings);
  const n9 = phoneDigitsLast9(digits);
  return !!(testSuffix && n9 && testSuffix === n9);
}

/** True si el JID del chat es el número de prueba (modo prueba activo). */
export function isWhatsappTestChatId(
  chatId: string,
  settings: WhatsappAutomationSettings,
): boolean {
  if (!settings.test_mode_enabled) return false;
  const local = chatId.split('@')[0] ?? '';
  return isWhatsappTestPhoneDigits(local, settings);
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

async function providerSendTextFromRow(
  cfg: WhatsappConfigRow,
  chatId: string,
  text: string,
): Promise<void> {
  await providerSendText(resolveWhatsappCredentials(cfg), chatId, text);
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
  const session = await ensureWhatsappSessionReadyForSend(admin, companyId, cfg);
  if (!session.ready) {
    return { ok: false, error: session.error ?? 'Sesión WhatsApp no conectada' };
  }

  const { chatPhone, intendedLabel } = resolveRecipientPhone(intendedPhone, settings);
  const body = wrapMessageForTestMode(
    text,
    settings,
    meta.intended_label ?? intendedLabel,
  );
  const chatId = normalizeChatId(chatPhone, cfg.default_country_code);

  try {
    await providerSendTextFromRow(cfg, chatId, body);
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
  const session = await ensureWhatsappSessionReadyForSend(admin, companyId, cfg);
  if (!session.ready) {
    return { ok: false, error: session.error ?? 'Sesión WhatsApp no conectada' };
  }

  const chatId = normalizeChatId(phone.replace(/\D/g, ''), cfg.default_country_code);
  try {
    await providerSendTextFromRow(cfg, chatId, text);
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

/** Códigos Dunasoft útiles (ignora vacío / "0" = nota interna). */
function legacyCodcliVariants(code: string | null | undefined): string[] {
  const trimmed = String(code ?? '').trim();
  if (!trimmed || trimmed === '0') return [];
  const norm = trimmed.replace(/^0+/, '') || '0';
  if (norm === '0') return [];
  return [...new Set([trimmed, norm, trimmed.padStart(6, '0'), norm.padStart(6, '0')])];
}

type ReminderCustomer = {
  id: string;
  name: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_home: string | null;
  legacy_codcli: string | null;
};

function customerPhone(c: ReminderCustomer | null | undefined): string | null {
  if (!c) return null;
  return (c.phone_mobile || c.phone || c.phone_home || '').trim() || null;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pausa aleatoria entre envíos de recordatorio (15–30 s inclusive). */
function randomReminderGapMs(): number {
  return 15_000 + Math.floor(Math.random() * 15_001);
}

/** Normaliza hora HH:mm desde texto legacy o ISO. */
function normalizeHm(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (s.includes('T')) {
    const part = s.split('T')[1]?.slice(0, 5);
    return part && /^\d{2}:\d{2}$/.test(part) ? part : null;
  }
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/**
 * Convierte fecha agenda (YYYY-MM-DD) + hora HH:mm (Europe/Madrid) a Date UTC.
 * El esquema legacy guarda start_time como "10:00", no timestamptz.
 */
function agendaStartToDate(
  appointmentDate: string | null | undefined,
  startTime: string | null | undefined,
): Date | null {
  const st = String(startTime ?? '').trim();
  if (st.includes('T')) {
    const d = new Date(st);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const ymdRaw = appointmentDate ? String(appointmentDate).slice(0, 10) : '';
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(ymdRaw) ? ymdRaw : null;
  const hm = normalizeHm(st);
  if (!ymd || !hm) return null;

  const [y, m, day] = ymd.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  let guess = Date.UTC(y, m - 1, day, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const parts = madridParts(new Date(guess));
    const asMadrid = Date.UTC(parts.y, parts.m - 1, parts.day, parts.hour, parts.minute);
    const wanted = Date.UTC(y, m - 1, day, hh, mm);
    const diff = wanted - asMadrid;
    guess += diff;
    if (diff === 0) break;
  }
  return new Date(guess);
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
  const todayKey = madridDayKey(now);
  const tomorrowKey = madridDayKey(addMadridDays(now, 1));
  const errors: string[] = [];
  let dayBefore = 0;
  let hourBefore = 0;

  if (!isWithinAutomationHours(settings)) {
    return { day_before: 0, hour_before: 0, errors: [] };
  }

  // start_time es TEXT "HH:mm"; filtrar por appointment_date (no por ISO en start_time).
  const { data: appointments, error } = await admin
    .from('agenda_appointments')
    .select(
      'id, description, appointment_date, start_time, status, customer_id, client_name, employee_id, legacy_codcli',
    )
    .eq('company_id', companyId)
    .in('appointment_date', [todayKey, tomorrowKey])
    .not('status', 'eq', 'cancelled');

  if (error) throw error;

  const customerById = new Map<string, ReminderCustomer>();
  const customerByLegacy = new Map<string, ReminderCustomer>();
  const customerIds = [
    ...new Set(
      (appointments ?? [])
        .map((a) => a.customer_id as string | null)
        .filter((id): id is string => !!id),
    ),
  ];
  if (customerIds.length > 0) {
    const { data: byId, error: byIdErr } = await admin
      .from('customers')
      .select('id, name, phone, phone_mobile, phone_home, legacy_codcli')
      .eq('company_id', companyId)
      .in('id', customerIds);
    if (byIdErr) throw byIdErr;
    for (const c of (byId ?? []) as ReminderCustomer[]) {
      customerById.set(c.id, c);
      for (const v of legacyCodcliVariants(c.legacy_codcli)) customerByLegacy.set(v, c);
    }
  }
  const legacyVariants = [
    ...new Set(
      (appointments ?? []).flatMap((a) =>
        a.customer_id ? [] : legacyCodcliVariants(a.legacy_codcli as string | null),
      ),
    ),
  ];
  if (legacyVariants.length > 0) {
    const { data: byLegacy, error: byLegacyErr } = await admin
      .from('customers')
      .select('id, name, phone, phone_mobile, phone_home, legacy_codcli')
      .eq('company_id', companyId)
      .in('legacy_codcli', legacyVariants);
    if (byLegacyErr) throw byLegacyErr;
    for (const c of (byLegacy ?? []) as ReminderCustomer[]) {
      customerById.set(c.id, c);
      for (const v of legacyCodcliVariants(c.legacy_codcli)) customerByLegacy.set(v, c);
    }
  }

  type EnrichedApt = {
    id: string;
    start: Date;
    dayKey: string;
    phone: string;
    customerName: string;
    customerKey: string;
    title: string | null;
    employeeName: string | null;
    category: AppointmentReminderCategory;
  };

  const enriched: EnrichedApt[] = [];

  for (const apt of appointments ?? []) {
    const start = agendaStartToDate(
      apt.appointment_date as string | null,
      apt.start_time as string | null,
    );
    if (!start) continue;

    let cust: ReminderCustomer | null = null;
    if (apt.customer_id) {
      cust = customerById.get(apt.customer_id as string) ?? null;
    }
    if (!cust) {
      for (const v of legacyCodcliVariants(apt.legacy_codcli as string | null)) {
        cust = customerByLegacy.get(v) ?? null;
        if (cust) break;
      }
    }

    const phone = customerPhone(cust);
    if (!phone?.trim()) continue;
    const customerName =
      cust?.name?.trim() || (apt.client_name as string | null)?.trim() || 'cliente';

    let employeeName: string | null = null;
    if (apt.employee_id) {
      try {
        const { data: emp } = await admin
          .from('agenda_employees')
          .select('name')
          .eq('id', String(apt.employee_id))
          .maybeSingle();
        employeeName = emp?.name?.trim() ?? null;
      } catch {
        employeeName = null;
      }
    }

    let itemTexts: string[] = [];
    try {
      const { data: items } = await admin
        .from('appointment_items')
        .select('label, articles(familia, descripcion)')
        .eq('appointment_id', apt.id);
      for (const it of items ?? []) {
        if (typeof it.label === 'string') itemTexts.push(it.label);
        const art = it.articles as { familia?: string | null; descripcion?: string | null } | null;
        if (art?.familia) itemTexts.push(String(art.familia));
        if (art?.descripcion) itemTexts.push(String(art.descripcion));
      }
    } catch {
      itemTexts = [];
    }

    const category = classifyAppointmentReminderCategory([
      apt.description as string | null,
      apt.client_name as string | null,
      employeeName,
      ...itemTexts,
    ]);

    const digits = phone.replace(/\D/g, '');
    const customerKey =
      cust?.id ||
      (apt.customer_id as string | null) ||
      digits.slice(-9) ||
      (apt.id as string);

    enriched.push({
      id: apt.id as string,
      start,
      dayKey:
        String(apt.appointment_date ?? '').slice(0, 10) || madridDayKey(start),
      phone,
      customerName,
      customerKey,
      title: (apt.description as string | null) ?? null,
      employeeName,
      category,
    });
  }

  /** Una sola cita representante por cliente+día (prioridad tratamiento, luego hora más temprana). */
  function pickRepresentative(list: EnrichedApt[]): EnrichedApt {
    const bestCat = pickHighestPriorityCategory(list.map((a) => a.category));
    const inCat = list.filter((a) => a.category === bestCat);
    return [...inCat].sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? list[0];
  }

  // --- Día anterior: agrupar por cliente + día ---
  if (settings.appointment_reminder_day_before_enabled) {
    const tomorrowApts = enriched.filter((a) => a.dayKey === tomorrowKey);
    const groups = new Map<string, EnrichedApt[]>();
    for (const a of tomorrowApts) {
      const gkey = `${a.customerKey}:${a.dayKey}`;
      const arr = groups.get(gkey) ?? [];
      arr.push(a);
      groups.set(gkey, arr);
    }
    let dayBeforeAttempt = 0;
    for (const [gkey, list] of groups) {
      const rep = pickRepresentative(list);
      const ref = `${gkey}:day_before`;
      const { data: sent } = await admin
        .from('whatsapp_automation_send_log')
        .select('id')
        .eq('company_id', companyId)
        .eq('automation_type', 'appointment_day_before')
        .eq('reference_id', ref)
        .maybeSingle();
      if (sent) continue;

      if (dayBeforeAttempt > 0) await sleepMs(randomReminderGapMs());
      dayBeforeAttempt++;

      const template = resolveTreatmentReminderTemplate(
        settings.appointment_reminder_templates,
        rep.category,
        'day_before',
        settings.appointment_reminder_day_before_message,
      );
      const text = renderAppointmentReminderTemplate(
        template,
        {
          customerName: rep.customerName,
          startTime: rep.start,
          title: rep.title,
          employeeName: rep.employeeName,
        },
        defaultDayBeforeMessage(),
      );
      const res = await sendAutomatedWhatsapp(admin, companyId, rep.phone, text, {
        automation_type: 'appointment_day_before',
        reference_id: ref,
        intended_label: rep.customerName || rep.phone,
      });
      if (res.ok) dayBefore++;
      else if (res.error) errors.push(res.error);
    }
  }

  // --- 1 hora antes: agrupar por cliente (ventana 50–70 min) ---
  if (settings.appointment_reminder_hour_before_enabled) {
    const near = enriched.filter((a) => {
      const diffMin = (a.start.getTime() - now.getTime()) / 60_000;
      return diffMin >= 50 && diffMin <= 70;
    });
    const groups = new Map<string, EnrichedApt[]>();
    for (const a of near) {
      const gkey = `${a.customerKey}:${a.dayKey}`;
      const arr = groups.get(gkey) ?? [];
      arr.push(a);
      groups.set(gkey, arr);
    }
    let hourBeforeAttempt = 0;
    for (const [gkey, list] of groups) {
      const rep = pickRepresentative(list);
      const ref = `${gkey}:hour_before`;
      const { data: sent } = await admin
        .from('whatsapp_automation_send_log')
        .select('id')
        .eq('company_id', companyId)
        .eq('automation_type', 'appointment_hour_before')
        .eq('reference_id', ref)
        .maybeSingle();
      if (sent) continue;

      if (hourBeforeAttempt > 0) await sleepMs(randomReminderGapMs());
      hourBeforeAttempt++;

      const template = resolveTreatmentReminderTemplate(
        settings.appointment_reminder_templates,
        rep.category,
        'hour_before',
        settings.appointment_reminder_hour_before_message,
      );
      const text = renderAppointmentReminderTemplate(
        template,
        {
          customerName: rep.customerName,
          startTime: rep.start,
          title: rep.title,
          employeeName: rep.employeeName,
        },
        defaultHourBeforeMessage(),
      );
      const res = await sendAutomatedWhatsapp(admin, companyId, rep.phone, text, {
        automation_type: 'appointment_hour_before',
        reference_id: ref,
        intended_label: rep.customerName || rep.phone,
      });
      if (res.ok) hourBefore++;
      else if (res.error) errors.push(res.error);
    }
  }

  return { day_before: dayBefore, hour_before: hourBefore, errors };
}
