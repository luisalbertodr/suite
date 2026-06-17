import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildMarketingFieldTemplateVars } from './marketingWhatsappFieldVars.ts';
import {
  loadAutomationSettings,
  logAutomationSend,
  resolveRecipientPhone,
  wrapMessageForTestMode,
  isWhatsappTestChatId,
  type AutomationSendType,
} from './whatsappAutomationDispatch.ts';

export type WhatsappConfigRow = {
  company_id: string;
  base_url: string | null;
  api_key: string | null;
  session_name: string;
  default_country_code: string | null;
  enabled: boolean;
  last_status: string | null;
  me_jid: string | null;
};

export type MetaFormAutomation = {
  id: string;
  form_id: string;
  form_name: string | null;
  whatsapp_automation_enabled: boolean;
  whatsapp_initial_message: string | null;
  whatsapp_reply_1_message: string | null;
  whatsapp_reply_2_message: string | null;
  whatsapp_reply_invalid_message: string | null;
  whatsapp_reminder_message: string | null;
  whatsapp_reminder_delay_hours?: number | null;
  whatsapp_reminder_enabled?: boolean | null;
  stripe_deposit_enabled?: boolean;
  stripe_deposit_amount_cents?: number | null;
};

export type MarketingLeadAutomationRow = {
  id: string;
  company_id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  campaign?: string | null;
  form_name?: string | null;
  appointment_at?: string | null;
  appointment_label?: string | null;
  source?: string | null;
  meta_form_id: string | null;
  field_data?: unknown;
  wa_automation_status: string;
  wa_automation_initial_sent_at?: string | null;
  wa_automation_reminder_sent_at?: string | null;
};

export type WhatsappTemplateContext = Pick<
  MarketingLeadAutomationRow,
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'campaign'
  | 'form_name'
  | 'appointment_at'
  | 'appointment_label'
  | 'source'
  | 'field_data'
>;

/** Variables documentadas en Configuración → Meta. */
export const WHATSAPP_TEMPLATE_VAR_KEYS = [
  'nombre',
  'nombre_completo',
  'apellido',
  'telefono',
  'email',
  'oferta',
  'campana',
  'campaña',
  'formulario',
  'cita',
  'fecha_cita',
  'origen',
] as const;

function normalizeTemplateKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function formatSourceLabel(source: string | null | undefined): string {
  const s = (source ?? '').trim().toLowerCase();
  if (s === 'facebook') return 'Facebook';
  if (s === 'instagram') return 'Instagram';
  if (s === 'meta') return 'Meta';
  return source?.trim() ?? '';
}

function formatAppointmentDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveAppointmentText(ctx: WhatsappTemplateContext): string {
  const label = ctx.appointment_label?.trim();
  const dateText = formatAppointmentDate(ctx.appointment_at);
  if (label && dateText) return `${dateText} (${label})`;
  return label || dateText || '';
}

export function buildWhatsappTemplateVars(
  ctx: WhatsappTemplateContext,
  form?: Pick<MetaFormAutomation, 'form_name' | 'form_id'>,
): Record<string, string> {
  const fullName = [ctx.first_name, ctx.last_name].filter(Boolean).join(' ').trim();
  const firstName = ctx.first_name?.trim() || fullName.split(/\s+/)[0] || '';
  const campaign = ctx.campaign?.trim() ?? '';
  const formName = ctx.form_name?.trim() || form?.form_name?.trim() || '';

  return {
    nombre: firstName,
    nombre_completo: fullName,
    apellido: ctx.last_name?.trim() ?? '',
    telefono: ctx.phone?.trim() ?? '',
    email: ctx.email?.trim() ?? '',
    oferta: campaign,
    campana: campaign,
    campaña: campaign,
    formulario: formName,
    cita: resolveAppointmentText(ctx),
    fecha_cita: formatAppointmentDate(ctx.appointment_at),
    origen: formatSourceLabel(ctx.source),
  };
}

/** Sustituye {nombre}, {oferta}, etc. en plantillas de WhatsApp automático. */
export function renderWhatsappTemplate(
  template: string,
  ctx: WhatsappTemplateContext,
  form?: Pick<MetaFormAutomation, 'form_name' | 'form_id'>,
  fieldData?: unknown,
): string {
  const vars = {
    ...buildWhatsappTemplateVars(ctx, form),
    ...buildMarketingFieldTemplateVars(fieldData ?? (ctx as { field_data?: unknown }).field_data),
  };
  return template.replace(/\{([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+)\}/g, (match, rawKey: string) => {
    const key = normalizeTemplateKey(rawKey);
    if (key in vars) return vars[key];
    return match;
  });
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function normalizeChatId(raw: string, defaultCountryCode: string | null): string {
  let s = String(raw ?? '').trim();
  if (!s) return s;
  if (s.includes('@')) return s;
  s = s.replace(/[^0-9]/g, '');
  if (!s) return raw;
  if (defaultCountryCode && s.length <= 9) s = `${defaultCountryCode}${s}`;
  return `${s}@c.us`;
}

export function leadDisplayName(lead: Pick<MarketingLeadAutomationRow, 'first_name' | 'last_name'>): string | null {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return name || null;
}

export function parseReplyChoice(body: string | null | undefined): '1' | '2' | null {
  if (!body) return null;
  const t = body.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  if (t === '1' || t === 'uno' || t === 'opcion1' || t === 'opción1' || /^1[.!]?$/.test(t)) return '1';
  if (t === '2' || t === 'dos' || t === 'opcion2' || t === 'opción2' || /^2[.!]?$/.test(t)) return '2';
  return null;
}

async function wahaFetch(
  cfg: WhatsappConfigRow,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!cfg.base_url) throw new Error('WhatsApp no configurado: falta base_url');
  const headers = new Headers(init.headers ?? {});
  if (cfg.api_key) headers.set('X-Api-Key', cfg.api_key);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const url = `${trimSlash(cfg.base_url)}${path}`;
  return await fetch(url, { ...init, headers });
}

async function wahaJson<T = unknown>(
  cfg: WhatsappConfigRow,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const resp = await wahaFetch(cfg, path, init);
  const text = await resp.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Respuesta no JSON de Waha (HTTP ${resp.status}) en ${path}`);
  }
  if (!resp.ok) {
    const msg =
      (data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).message)
        : null) ?? `HTTP ${resp.status}`;
    throw new Error(`Waha (${resp.status}) en ${path}: ${msg}`);
  }
  return data as T;
}

function resolveOutgoingWahaId(
  res: {
    id?: { id?: string; _serialized?: string; remote?: string };
    _data?: { id?: { id?: string; _serialized?: string; remote?: string }; to?: string };
    to?: string;
  },
  chatId: string,
): string | null {
  const serialized =
    res?.id?._serialized ??
    res?._data?.id?._serialized ??
    null;
  if (typeof serialized === 'string' && serialized.trim()) return serialized.trim();
  const keyId = res?.id?.id ?? res?._data?.id?.id ?? null;
  const remote =
    res?.id?.remote ??
    res?._data?.id?.remote ??
    res?.to ??
    res?._data?.to ??
    chatId;
  if (keyId && typeof remote === 'string' && remote.includes('@')) {
    return `true_${remote}_${keyId}`;
  }
  return null;
}

export async function loadWhatsappConfig(
  admin: SupabaseClient,
  companyId: string,
): Promise<WhatsappConfigRow | null> {
  const { data, error } = await admin
    .from('whatsapp_config')
    .select(
      'company_id, base_url, api_key, session_name, default_country_code, enabled, last_status, me_jid',
    )
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as WhatsappConfigRow | null) ?? null;
}

export async function loadMetaFormAutomation(
  admin: SupabaseClient,
  metaFormId: string,
): Promise<MetaFormAutomation | null> {
  const { data, error } = await admin
    .from('meta_forms')
    .select(
      'id, form_id, form_name, whatsapp_automation_enabled, whatsapp_initial_message, whatsapp_reply_1_message, whatsapp_reply_2_message, whatsapp_reply_invalid_message, whatsapp_reminder_message, whatsapp_reminder_delay_hours, whatsapp_reminder_enabled, stripe_deposit_enabled, stripe_deposit_amount_cents',
    )
    .eq('id', metaFormId)
    .maybeSingle();
  if (error) throw error;
  return (data as MetaFormAutomation | null) ?? null;
}

async function sendWhatsappText(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  chatId: string,
  text: string,
): Promise<{ chatId: string; wahaId: string | null }> {
  const sessionName = cfg.session_name || 'default';
  let resolvedChatId = chatId;
  const res = await wahaJson<{
    id?: { id?: string; _serialized?: string; remote?: string };
    _data?: { id?: { _serialized?: string; remote?: string }; to?: string };
    to?: string;
    timestamp?: number;
  }>(cfg, '/api/sendText', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionName,
      chatId: resolvedChatId,
      text,
    }),
  });

  const wahaId = resolveOutgoingWahaId(res, resolvedChatId);
  const ts = res?.timestamp
    ? new Date(res.timestamp * 1000).toISOString()
    : new Date().toISOString();

  const detectedRemote =
    res?.id?.remote ??
    res?._data?.id?.remote ??
    res?.to ??
    res?._data?.to ??
    null;
  const fromSerialized = (() => {
    const s = res?.id?._serialized ?? res?._data?.id?._serialized;
    if (!s) return null;
    const m = /^(?:true|false)_(.+?)_/.exec(s);
    return m ? m[1] : null;
  })();
  const realRemote = detectedRemote ?? fromSerialized ?? null;
  if (realRemote && realRemote.includes('@') && realRemote !== resolvedChatId) {
    await admin
      .from('whatsapp_messages')
      .update({ chat_id: realRemote })
      .eq('company_id', companyId)
      .eq('chat_id', resolvedChatId);
    await admin
      .from('whatsapp_chats')
      .update({ chat_id: realRemote })
      .eq('company_id', companyId)
      .eq('chat_id', resolvedChatId);
    resolvedChatId = realRemote;
  }

  if (wahaId) {
    await admin.from('whatsapp_messages').upsert(
      {
        company_id: companyId,
        chat_id: resolvedChatId,
        waha_message_id: wahaId,
        from_jid: cfg.me_jid ?? null,
        from_me: true,
        type: 'text',
        body: text,
        ack: 0,
        timestamp: ts,
        raw: res as unknown,
      },
      { onConflict: 'company_id,waha_message_id', ignoreDuplicates: false },
    );
  }

  await admin.from('whatsapp_chats').upsert(
    {
      company_id: companyId,
      chat_id: resolvedChatId,
      is_group: false,
      last_message_preview: text.slice(0, 200),
      last_message_at: ts,
      last_message_from_me: true,
    },
    { onConflict: 'company_id,chat_id', ignoreDuplicates: false },
  );

  return { chatId: resolvedChatId, wahaId };
}

async function sendAutomatedLeadMessage(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  intendedPhone: string,
  text: string,
  meta: {
    automation_type: AutomationSendType;
    reference_id: string;
    contactName?: string | null;
  },
): Promise<{ chatId: string; wahaId: string | null }> {
  const settings = await loadAutomationSettings(admin, companyId);
  const { chatPhone, intendedLabel } = resolveRecipientPhone(intendedPhone, settings);
  const body = wrapMessageForTestMode(
    text,
    settings,
    meta.contactName ?? intendedLabel,
  );
  const chatId = normalizeChatId(chatPhone, cfg.default_country_code);
  try {
    const sent = await sendWhatsappText(admin, cfg, companyId, chatId, body);
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: body,
      success: true,
    });
    return sent;
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
    throw e;
  }
}

async function linkChatToLead(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  leadId: string,
  contactName: string | null,
): Promise<void> {
  const settings = await loadAutomationSettings(admin, companyId);
  if (isWhatsappTestChatId(chatId, settings)) {
    // Modo prueba: todos los envíos van al mismo número; no mezclar leads en ese chat.
    return;
  }

  const { data: existing } = await admin
    .from('whatsapp_chats')
    .select('id, marketing_lead_id, customer_id, name')
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    company_id: companyId,
    chat_id: chatId,
    marketing_lead_id: leadId,
  };
  if (contactName && !existing?.name) updates.name = contactName;
  if (!existing?.customer_id) {
    await admin.from('whatsapp_chats').upsert(updates, {
      onConflict: 'company_id,chat_id',
      ignoreDuplicates: false,
    });
  } else if (!existing.marketing_lead_id) {
    await admin
      .from('whatsapp_chats')
      .update({ marketing_lead_id: leadId })
      .eq('id', existing.id);
  }
}

export async function sendInitialAutomationForLead(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  lead: WhatsappTemplateContext &
    Pick<MarketingLeadAutomationRow, 'phone' | 'meta_form_id'>,
  form: MetaFormAutomation,
): Promise<{ ok: boolean; status: string; error?: string }> {
  if (!form.whatsapp_automation_enabled) {
    await admin
      .from('marketing_leads')
      .update({ wa_automation_status: 'none' })
      .eq('id', leadId);
    return { ok: true, status: 'none' };
  }

  const initialRaw = form.whatsapp_initial_message?.trim();
  if (!initialRaw) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'skipped',
        wa_automation_error: 'Falta mensaje inicial en la configuración del formulario',
      })
      .eq('id', leadId);
    return { ok: false, status: 'skipped', error: 'Falta mensaje inicial' };
  }

  if (!lead.phone?.trim()) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'skipped',
        wa_automation_error: 'Lead sin teléfono',
      })
      .eq('id', leadId);
    return { ok: false, status: 'skipped', error: 'Sin teléfono' };
  }

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: 'WhatsApp no configurado o deshabilitado',
      })
      .eq('id', leadId);
    return { ok: false, status: 'failed', error: 'WhatsApp no configurado' };
  }

  if ((cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: `Sesión WhatsApp no conectada (${cfg.last_status ?? 'desconocido'})`,
      })
      .eq('id', leadId);
    return { ok: false, status: 'failed', error: 'Sesión WhatsApp no conectada' };
  }

  try {
    const contactName = leadDisplayName(lead);
    const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
    const initialText = await renderWhatsappTemplateWithPaymentLinks(
      admin,
      companyId,
      leadId,
      initialRaw,
      lead,
      form,
      null,
    );
    const sent = await sendAutomatedLeadMessage(
      admin,
      cfg,
      companyId,
      lead.phone!,
      initialText,
      {
        automation_type: 'meta_initial',
        reference_id: leadId,
        contactName,
      },
    );
    await linkChatToLead(admin, companyId, sent.chatId, leadId, contactName);
    const now = new Date().toISOString();
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'awaiting_reply',
        wa_automation_error: null,
        wa_automation_initial_sent_at: now,
        last_contacted_at: now,
      })
      .eq('id', leadId);
    return { ok: true, status: 'awaiting_reply' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar WhatsApp';
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: msg.slice(0, 500),
      })
      .eq('id', leadId);
    return { ok: false, status: 'failed', error: msg };
  }
}

async function findAwaitingLeadForChat(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  marketingLeadId: string | null,
): Promise<MarketingLeadAutomationRow | null> {
  const settings = await loadAutomationSettings(admin, companyId);
  const isTestChat = isWhatsappTestChatId(chatId, settings);

  if (marketingLeadId && !isTestChat) {
    const { data } = await admin
      .from('marketing_leads')
      .select(
        'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
      )
      .eq('id', marketingLeadId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (data) return data as MarketingLeadAutomationRow;
  }

  if (isTestChat) {
    const { data: leads } = await admin
      .from('marketing_leads')
      .select(
        'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
      )
      .eq('company_id', companyId)
      .eq('wa_automation_status', 'awaiting_reply')
      .order('wa_automation_initial_sent_at', { ascending: false })
      .limit(1);
    return (leads?.[0] as MarketingLeadAutomationRow | undefined) ?? null;
  }

  const { data: suffix } = await admin.rpc('whatsapp_resolve_chat_phone_last9', {
    p_company_id: companyId,
    p_chat_id: chatId,
  });

  if (typeof suffix !== 'string' || !suffix) return null;

  const { data: leads } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
    )
    .eq('company_id', companyId)
    .eq('wa_automation_status', 'awaiting_reply')
    .eq('phone_norm', suffix)
    .order('wa_automation_initial_sent_at', { ascending: false })
    .limit(1);

  return (leads?.[0] as MarketingLeadAutomationRow | undefined) ?? null;
}

export async function processAutomationReply(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  messageBody: string | null,
  marketingLeadId: string | null,
): Promise<{ handled: boolean; action?: string }> {
  const lead = await findAwaitingLeadForChat(admin, companyId, chatId, marketingLeadId);
  if (!lead || lead.wa_automation_status !== 'awaiting_reply') {
    return { handled: false };
  }

  if (!lead.meta_form_id) return { handled: false };

  const form = await loadMetaFormAutomation(admin, lead.meta_form_id);
  if (!form?.whatsapp_automation_enabled) return { handled: false };

  const choice = parseReplyChoice(messageBody);
  if (!choice) {
    const trimmed = (messageBody ?? '').trim();
    const usesNumericMenu =
      !!form.whatsapp_reply_1_message?.trim() || !!form.whatsapp_reply_2_message?.trim();
    if (!usesNumericMenu && trimmed.length >= 2) {
      await admin
        .from('marketing_leads')
        .update({
          wa_automation_status: 'completed',
          wa_automation_completed_at: new Date().toISOString(),
          wa_automation_error: null,
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
        .eq('wa_automation_status', 'awaiting_reply');
      return { handled: true, action: 'human_takeover' };
    }

    const invalidRaw = form.whatsapp_reply_invalid_message?.trim();
    if (!invalidRaw) return { handled: false };

    const cfg = await loadWhatsappConfig(admin, companyId);
    if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
      return { handled: false };
    }
    try {
      const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
      const invalidText = await renderWhatsappTemplateWithPaymentLinks(
        admin,
        companyId,
        lead.id,
        invalidRaw,
        lead,
        form,
        null,
      );
      await sendAutomatedLeadMessage(
        admin,
        cfg,
        companyId,
        lead.phone ?? chatId.replace(/@.*/, ''),
        invalidText,
        {
          automation_type: 'meta_invalid',
          reference_id: `${lead.id}:invalid:${Date.now()}`,
          contactName: leadDisplayName(lead),
        },
      );
      return { handled: true, action: 'invalid_reply' };
    } catch (e) {
      console.error('processAutomationReply invalid message failed:', e);
      return { handled: false };
    }
  }

  const replyRaw =
    choice === '1'
      ? form.whatsapp_reply_1_message?.trim()
      : form.whatsapp_reply_2_message?.trim();

  if (!replyRaw) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: `Falta mensaje de respuesta para opción ${choice}`,
      })
      .eq('id', lead.id)
      .eq('wa_automation_status', 'awaiting_reply');
    return { handled: true, action: 'missing_reply_template' };
  }

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { handled: false };
  }

  try {
    await linkChatToLead(admin, companyId, chatId, lead.id, leadDisplayName(lead));
    const { renderWhatsappTemplateWithPaymentLinks, loadStripeConfig, resolveDepositAmountCents } =
      await import('./stripeDeposit.ts');
    const replyText = await renderWhatsappTemplateWithPaymentLinks(
      admin,
      companyId,
      lead.id,
      replyRaw,
      lead,
      form,
      null,
    );
    await sendAutomatedLeadMessage(
      admin,
      cfg,
      companyId,
      lead.phone ?? chatId.replace(/@.*/, ''),
      replyText,
      {
        automation_type: choice === '1' ? 'meta_reply_1' : 'meta_reply_2',
        reference_id: `${lead.id}:reply_${choice}`,
        contactName: leadDisplayName(lead),
      },
    );

    const stripeCfg = await loadStripeConfig(admin, companyId);
    const depositAmount = stripeCfg ? resolveDepositAmountCents(stripeCfg, form) : null;
    const waitsPayment = choice === '1' && !!depositAmount && !!stripeCfg?.enabled;

    const { data: locked } = await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: waitsPayment ? 'awaiting_payment' : 'completed',
        wa_automation_completed_at: waitsPayment ? null : new Date().toISOString(),
        wa_automation_error: null,
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
      .eq('wa_automation_status', 'awaiting_reply')
      .select('id')
      .maybeSingle();

    if (!locked) return { handled: false };
    return { handled: true, action: `reply_${choice}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar respuesta';
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_error: msg.slice(0, 500),
      })
      .eq('id', lead.id)
      .eq('wa_automation_status', 'awaiting_reply');
    console.error('processAutomationReply send failed:', e);
    return { handled: true, action: 'send_failed' };
  }
}

export async function runMarketingLeadRemindersForCompany(
  admin: SupabaseClient,
  companyId: string,
): Promise<{ sent: number; skipped: number; errors: number }> {
  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const { loadAutomationSettings } = await import('./whatsappAutomationDispatch.ts');
  const { isWithinAutomationHours } = await import('./whatsappAutomationHours.ts');
  const automationSettings = await loadAutomationSettings(admin, companyId);
  if (!isWithinAutomationHours(automationSettings)) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const { data: leads, error } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
    )
    .eq('company_id', companyId)
    .eq('wa_automation_status', 'awaiting_reply')
    .is('wa_automation_reminder_sent_at', null)
    .not('wa_automation_initial_sent_at', 'is', null)
    .order('wa_automation_initial_sent_at', { ascending: true })
    .limit(40);

  if (error) throw error;

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of leads ?? []) {
    const lead = row as MarketingLeadAutomationRow;
    if (!lead.meta_form_id || !lead.phone?.trim()) {
      skipped++;
      continue;
    }

    const form = await loadMetaFormAutomation(admin, lead.meta_form_id);
    if (!form?.whatsapp_automation_enabled) {
      skipped++;
      continue;
    }

    if (form.whatsapp_reminder_enabled === false) {
      skipped++;
      continue;
    }

    const reminderRaw = form.whatsapp_reminder_message?.trim();
    if (!reminderRaw) {
      skipped++;
      continue;
    }

    const delayHours = Math.max(1, Number(form.whatsapp_reminder_delay_hours ?? 3));
    const initialAt = lead.wa_automation_initial_sent_at
      ? new Date(lead.wa_automation_initial_sent_at)
      : null;
    if (!initialAt || Number.isNaN(initialAt.getTime())) {
      skipped++;
      continue;
    }
    if (Date.now() - initialAt.getTime() < delayHours * 60 * 60 * 1000) {
      skipped++;
      continue;
    }

    try {
      const contactName = leadDisplayName(lead);
      const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
      const reminderText = await renderWhatsappTemplateWithPaymentLinks(
        admin,
        companyId,
        lead.id,
        reminderRaw,
        lead,
        form,
        null,
      );
      await sendAutomatedLeadMessage(
        admin,
        cfg,
        companyId,
        lead.phone!,
        reminderText,
        {
          automation_type: 'meta_reminder',
          reference_id: `${lead.id}:reminder`,
          contactName,
        },
      );
      const now = new Date().toISOString();
      const { data: locked } = await admin
        .from('marketing_leads')
        .update({
          wa_automation_reminder_sent_at: now,
          last_contacted_at: now,
          wa_automation_error: null,
        })
        .eq('id', lead.id)
        .eq('wa_automation_status', 'awaiting_reply')
        .is('wa_automation_reminder_sent_at', null)
        .select('id')
        .maybeSingle();
      if (locked) sent++;
      else skipped++;
    } catch (e) {
      errors++;
      console.error('marketing lead reminder failed:', lead.id, e);
    }
  }

  return { sent, skipped, errors };
}
