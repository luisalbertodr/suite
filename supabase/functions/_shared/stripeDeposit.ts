import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emitMetaConversion, emitMetaConversionForLeadStage, parseMetaLeadId } from './metaConversionEmit.ts';
import {
  buildWhatsappTemplateVars,
  renderWhatsappTemplate,
  type WhatsappTemplateContext,
} from './marketingWhatsappAutomation.ts';
import {
  loadAutomationSettings,
  isWhatsappTestChatId,
} from './whatsappAutomationDispatch.ts';
import { providerSendText } from './whatsappProviderClient.ts';
import { resolveWhatsappCredentials, type WhatsappProviderConfig } from './whatsappProviderTypes.ts';
import { loadMarketingIntakeStageId } from './marketingIntakeStage.ts';

export type StripeConfigRow = {
  company_id: string;
  publishable_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  enabled: boolean;
  currency: string;
  default_deposit_amount_cents: number;
  public_app_url: string | null;
  confirmed_stage_id: string | null;
  payment_success_whatsapp_message: string | null;
  deposit_request_whatsapp_message: string | null;
};

export type DepositSessionRow = {
  id: string;
  company_id: string;
  marketing_lead_id: string | null;
  public_token: string;
  amount_cents: number;
  currency: string;
  status: string;
  stripe_checkout_session_id: string | null;
  checkout_url: string | null;
  paid_at: string | null;
};

type MetaFormDeposit = {
  stripe_deposit_enabled?: boolean;
  stripe_deposit_amount_cents?: number | null;
};

const STRIPE_API = 'https://api.stripe.com/v1';

export const DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE =
  '¡Perfecto {nombre}! Para confirmar tu cita, la señal es de {importe_senal}.\n\nOpciones de pago:\n• Tarjeta (enlace seguro): {link_pago}\n• Bizum al XXX XXX XXX (indica tu nombre)\n• Transferencia: ESXX XXXX XXXX XXXX XXXX (concepto: tu nombre)\n\nCuando recibamos el pago te confirmamos por aquí.';

export function formatEurosFromCents(cents: number, currency = 'eur'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

export function resolveDepositAmountCents(
  stripeCfg: StripeConfigRow,
  form?: MetaFormDeposit | null,
): number | null {
  if (!stripeCfg.enabled) return null;
  if (form?.stripe_deposit_enabled === false) return null;
  if (form?.stripe_deposit_amount_cents) return form.stripe_deposit_amount_cents;
  if (stripeCfg.default_deposit_amount_cents > 0) return stripeCfg.default_deposit_amount_cents;
  return null;
}

/** Importe a mostrar en mensajes (Bizum/transferencia) aunque Stripe esté desactivado. */
export function resolveDisplayDepositAmountCents(
  stripeCfg: StripeConfigRow | null,
  form?: MetaFormDeposit | null,
): number | null {
  if (!stripeCfg) return null;
  if (form?.stripe_deposit_enabled === false) return null;
  if (form?.stripe_deposit_amount_cents) return form.stripe_deposit_amount_cents;
  if (stripeCfg.default_deposit_amount_cents > 0) return stripeCfg.default_deposit_amount_cents;
  return null;
}

function phoneDigitsLast9(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

export function phoneFromWhatsappChatId(chatId: string): string | null {
  const at = chatId.indexOf('@');
  const local = at >= 0 ? chatId.slice(0, at) : chatId;
  const d = local.replace(/\D/g, '');
  if (d.length < 9) return null;
  return `+${d}`;
}

async function getIntakeStageId(
  admin: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  return loadMarketingIntakeStageId(admin, companyId);
}

type LeadDepositRow = WhatsappTemplateContext & {
  id: string;
  meta_form_id: string | null;
  stripe_deposit_paid_at: string | null;
  field_data?: unknown;
};

export type ResolveWhatsappMarketingLeadOptions = {
  /** Origen del lead al crearlo. Por defecto `whatsapp`. */
  source?: string | null;
  campaign?: string | null;
  form_name?: string | null;
  meta_form_id?: string | null;
  ctwa_campaign_id?: string | null;
  tags?: string[] | null;
  field_data?: unknown;
  external_id?: string | null;
  external_created_at?: string | null;
  /**
   * Si true y ya hay cliente vinculado/por teléfono, no crea lead nuevo
   * (devuelve created=false sin lead). Útil para auto-promoción CTWA.
   */
  skipIfCustomer?: boolean;
  /** Si true, no lanza cuando no hay lead y skipIfCustomer aplica. */
  allowMissing?: boolean;
};

export type ResolveWhatsappMarketingLeadResult = {
  lead: LeadDepositRow | null;
  created: boolean;
  skippedReason?: 'customer' | 'no_phone' | 'test_chat' | 'group';
};

/** Busca o crea lead de marketing para un chat WhatsApp 1:1. */
export async function resolveMarketingLeadForWhatsappChat(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  linkedLeadId?: string | null,
  chatDisplayName?: string | null,
  customerId?: string | null,
  options?: ResolveWhatsappMarketingLeadOptions & { allowMissing?: false; skipIfCustomer?: false },
): Promise<{ lead: LeadDepositRow; created: boolean }>;
export async function resolveMarketingLeadForWhatsappChat(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  linkedLeadId?: string | null,
  chatDisplayName?: string | null,
  customerId?: string | null,
  options?: ResolveWhatsappMarketingLeadOptions,
): Promise<ResolveWhatsappMarketingLeadResult>;
export async function resolveMarketingLeadForWhatsappChat(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  linkedLeadId?: string | null,
  chatDisplayName?: string | null,
  customerId?: string | null,
  options?: ResolveWhatsappMarketingLeadOptions,
): Promise<ResolveWhatsappMarketingLeadResult> {
  const leadSelect =
    'id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, field_data, meta_form_id, stripe_deposit_paid_at, customer_id';

  const settings = await loadAutomationSettings(admin, companyId);
  const isTestChat = isWhatsappTestChatId(chatId, settings);

  if (/@g\.us$/i.test(chatId)) {
    if (options?.allowMissing) return { lead: null, created: false, skippedReason: 'group' };
    throw new Error('No se puede crear un lead desde un grupo de WhatsApp');
  }

  const phone = phoneFromWhatsappChatId(chatId);
  const phoneN9 = phone ? phoneDigitsLast9(phone) : null;

  let effectiveCustomerId = customerId?.trim() || null;
  if (!effectiveCustomerId && phoneN9 && !isTestChat) {
    const { data: cust } = await admin
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone_norm', phoneN9)
      .maybeSingle();
    if (cust?.id) effectiveCustomerId = cust.id as string;
  }

  if (linkedLeadId) {
    const { data } = await admin
      .from('marketing_leads')
      .select(leadSelect)
      .eq('id', linkedLeadId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (data) {
      if (isTestChat) return { lead: data as LeadDepositRow, created: false };
      const leadN9 = data.phone ? phoneDigitsLast9(data.phone as string) : null;
      const phoneOk = !phoneN9 || !leadN9 || phoneN9 === leadN9;
      if (phoneOk) return { lead: data as LeadDepositRow, created: false };
    }
  }

  if (isTestChat) {
    if (options?.allowMissing) {
      return { lead: null, created: false, skippedReason: 'test_chat' };
    }
    throw new Error(
      'Este chat es el número de prueba de WhatsApp. Abre el lead en Marketing o usa el chat con el teléfono real del cliente.',
    );
  }

  if (effectiveCustomerId) {
    const { data: leadByCustomer } = await admin
      .from('marketing_leads')
      .select(leadSelect)
      .eq('company_id', companyId)
      .eq('customer_id', effectiveCustomerId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (leadByCustomer) return { lead: leadByCustomer as LeadDepositRow, created: false };
  }

  if (phoneN9) {
    const { data: leadByPhone } = await admin
      .from('marketing_leads')
      .select(leadSelect)
      .eq('company_id', companyId)
      .eq('phone_norm', phoneN9)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (leadByPhone) {
      await admin
        .from('whatsapp_chats')
        .update({
          marketing_lead_id: leadByPhone.id,
          ...(effectiveCustomerId ? { customer_id: effectiveCustomerId } : {}),
        })
        .eq('company_id', companyId)
        .eq('chat_id', chatId);
      return { lead: leadByPhone as LeadDepositRow, created: false };
    }
  }

  if (options?.skipIfCustomer && effectiveCustomerId) {
    return { lead: null, created: false, skippedReason: 'customer' };
  }

  if (!phone) {
    if (options?.allowMissing) {
      return { lead: null, created: false, skippedReason: 'no_phone' };
    }
    throw new Error('Este chat no tiene un número de teléfono válido');
  }

  let firstName: string | null = null;
  let lastName: string | null = null;

  if (effectiveCustomerId) {
    const { data: cust } = await admin
      .from('customers')
      .select('name')
      .eq('id', effectiveCustomerId)
      .eq('company_id', companyId)
      .maybeSingle();
    const custName = cust?.name?.trim();
    if (custName) {
      const parts = custName.split(/\s+/).filter(Boolean);
      firstName = parts[0] ?? null;
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
    }
  }

  if (!firstName) {
    const name = chatDisplayName?.trim() ?? '';
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? null;
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  const stageId = await getIntakeStageId(admin, companyId);
  const source = (options?.source?.trim() || 'whatsapp').toLowerCase();
  const tags = Array.isArray(options?.tags)
    ? options!.tags!.map((t) => String(t).trim()).filter(Boolean)
    : source === 'ctwa'
      ? ['CTWA']
      : ['WhatsApp'];

  const insertRow: Record<string, unknown> = {
    company_id: companyId,
    phone,
    first_name: firstName,
    last_name: lastName,
    source,
    stage_id: stageId,
    customer_id: effectiveCustomerId,
    tags,
  };
  if (options?.campaign?.trim()) insertRow.campaign = options.campaign.trim();
  else if (source === 'ctwa') insertRow.campaign = 'WhatsApp Meta (CTWA)';
  else if (source === 'whatsapp') insertRow.campaign = 'WhatsApp entrante';

  if (options?.form_name?.trim()) insertRow.form_name = options.form_name.trim();
  else if (source === 'ctwa') insertRow.form_name = 'Click to WhatsApp';

  if (options?.meta_form_id?.trim()) insertRow.meta_form_id = options.meta_form_id.trim();
  if (options?.ctwa_campaign_id?.trim()) insertRow.ctwa_campaign_id = options.ctwa_campaign_id.trim();
  if (options?.external_id?.trim()) insertRow.external_id = options.external_id.trim();
  if (options?.external_created_at) insertRow.external_created_at = options.external_created_at;
  if (options?.field_data != null) insertRow.field_data = options.field_data;

  const { data: inserted, error } = await admin
    .from('marketing_leads')
    .insert(insertRow)
    .select(leadSelect)
    .single();
  if (error) {
    // Colisión por teléfono o external_id: reutilizar el lead existente.
    if (phoneN9) {
      const { data: existing } = await admin
        .from('marketing_leads')
        .select(leadSelect)
        .eq('company_id', companyId)
        .eq('phone_norm', phoneN9)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await admin
          .from('whatsapp_chats')
          .update({
            marketing_lead_id: existing.id,
            ...(effectiveCustomerId ? { customer_id: effectiveCustomerId } : {}),
          })
          .eq('company_id', companyId)
          .eq('chat_id', chatId);
        return { lead: existing as LeadDepositRow, created: false };
      }
    }
    if (options?.external_id?.trim()) {
      const { data: byExt } = await admin
        .from('marketing_leads')
        .select(leadSelect)
        .eq('company_id', companyId)
        .eq('external_id', options.external_id.trim())
        .maybeSingle();
      if (byExt) {
        await admin
          .from('whatsapp_chats')
          .update({ marketing_lead_id: byExt.id })
          .eq('company_id', companyId)
          .eq('chat_id', chatId);
        return { lead: byExt as LeadDepositRow, created: false };
      }
    }
    throw error;
  }

  const chatUpdate: { marketing_lead_id: string; customer_id?: string } = {
    marketing_lead_id: inserted.id,
  };
  if (effectiveCustomerId) chatUpdate.customer_id = effectiveCustomerId;

  await admin
    .from('whatsapp_chats')
    .update(chatUpdate)
    .eq('company_id', companyId)
    .eq('chat_id', chatId);

  return { lead: inserted as LeadDepositRow, created: true };
}

export type DepositRequestMessageResult = {
  text: string;
  already_paid: boolean;
  amount_cents: number | null;
  payment_url: string | null;
  lead_id: string;
  lead_created: boolean;
};

export async function buildDepositRequestWhatsappMessage(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  leadCreated = false,
  options?: { allowIfPaid?: boolean },
): Promise<DepositRequestMessageResult & { paid_at?: string | null }> {
  const cfg = await loadStripeConfig(admin, companyId);
  const { loadRedsysConfig, isRedsysOnlineReady, isStripeOnlineReady, resolveUnifiedDepositAmountCents, resolvePublicAppUrl } =
    await import('./redsysDeposit.ts');
  const redsysCfg = await loadRedsysConfig(admin, companyId);

  if (!cfg && !redsysCfg) throw new Error('Configuración de pagos no encontrada');

  const template =
    cfg?.deposit_request_whatsapp_message?.trim() || DEFAULT_DEPOSIT_REQUEST_WHATSAPP_MESSAGE;
  const needsLink = /\{link_pago\}/i.test(template);
  const needsAmount = /\{importe_senal\}/i.test(template);

  const onlineReady = isStripeOnlineReady(cfg) || isRedsysOnlineReady(redsysCfg);
  if (needsLink && !onlineReady) {
    throw new Error(
      'El mensaje usa {link_pago} pero no hay pasarela activa. Activa Stripe o Redsys en Configuración → Pagos.',
    );
  }

  const { data: lead } = await admin
    .from('marketing_leads')
    .select(
      'id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, field_data, meta_form_id, stripe_deposit_paid_at',
    )
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!lead) throw new Error('Lead no encontrado');

  const paidAt = (lead.stripe_deposit_paid_at as string | null) ?? null;
  if (paidAt && !options?.allowIfPaid) {
    return {
      text: '',
      already_paid: true,
      amount_cents: null,
      payment_url: null,
      lead_id: leadId,
      lead_created: leadCreated,
      paid_at: paidAt,
    };
  }

  let form: MetaFormDeposit | null = null;
  if (lead.meta_form_id) {
    const { data: f } = await admin
      .from('meta_forms')
      .select('stripe_deposit_enabled, stripe_deposit_amount_cents, form_name')
      .eq('id', lead.meta_form_id)
      .maybeSingle();
    form = (f as MetaFormDeposit | null) ?? null;
  }

  const amountCents = resolveUnifiedDepositAmountCents(cfg, redsysCfg, form);
  if ((needsLink || needsAmount) && !amountCents) {
    throw new Error('Importe de señal no configurado en Configuración → Pagos');
  }

  const publicAppUrl = resolvePublicAppUrl(cfg, redsysCfg, cfg?.public_app_url ?? redsysCfg?.public_app_url);

  const text = await renderWhatsappTemplateWithPaymentLinks(
    admin,
    companyId,
    leadId,
    template,
    lead,
    form,
    publicAppUrl,
  );

  let paymentUrl: string | null = null;
  if (needsLink && amountCents && onlineReady) {
    const { data: session } = await admin
      .from('stripe_deposit_sessions')
      .select('public_token')
      .eq('company_id', companyId)
      .eq('marketing_lead_id', leadId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (session?.public_token) {
      const urlCfg = cfg ?? {
        company_id: companyId,
        publishable_key: null,
        secret_key: null,
        webhook_secret: null,
        enabled: false,
        currency: redsysCfg?.currency ?? 'eur',
        default_deposit_amount_cents: amountCents,
        public_app_url: publicAppUrl || null,
        confirmed_stage_id: null,
        payment_success_whatsapp_message: null,
        deposit_request_whatsapp_message: null,
      };
      paymentUrl = buildPublicPaymentUrl(urlCfg, session.public_token as string, publicAppUrl);
    }
  }

  return {
    text,
    already_paid: !!paidAt,
    amount_cents: amountCents,
    payment_url: paymentUrl,
    lead_id: leadId,
    lead_created: leadCreated,
    paid_at: paidAt,
  };
}

export async function loadStripeConfig(
  admin: SupabaseClient,
  companyId: string,
): Promise<StripeConfigRow | null> {
  const { data, error } = await admin
    .from('stripe_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as StripeConfigRow | null) ?? null;
}

/** Devuelve el stage_id solo si sigue existiendo (tras renombres el id se mantiene; si se borró, null). */
export async function resolveExistingStageId(
  admin: SupabaseClient,
  companyId: string,
  stageId: string | null | undefined,
): Promise<string | null> {
  if (!stageId) return null;
  const { data } = await admin
    .from('marketing_lead_stages')
    .select('id')
    .eq('company_id', companyId)
    .eq('id', stageId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

function publicAppBaseUrl(stripeCfg: StripeConfigRow, fallbackOrigin?: string | null): string {
  const configured = stripeCfg.public_app_url?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '');
  return '';
}

export function buildPublicPaymentPath(token: string): string {
  return `/pago/${token}`;
}

export function buildPublicPaymentUrl(
  stripeCfg: StripeConfigRow,
  token: string,
  fallbackOrigin?: string | null,
): string {
  const base = publicAppBaseUrl(stripeCfg, fallbackOrigin);
  const path = buildPublicPaymentPath(token);
  return base ? `${base}${path}` : path;
}

function newPublicToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function stripeFormRequest<T>(
  secretKey: string,
  path: string,
  params: Record<string, string>,
  method: 'POST' | 'GET' = 'POST',
): Promise<T> {
  const body = new URLSearchParams(params);
  const resp = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body : undefined,
  });
  const text = await resp.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Stripe respondió sin JSON (HTTP ${resp.status})`);
  }
  if (!resp.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as { error?: { message?: string } }).error?.message ?? resp.status)
        : `HTTP ${resp.status}`;
    throw new Error(`Stripe: ${msg}`);
  }
  return data as T;
}

export async function createStripeCheckoutSession(
  secretKey: string,
  input: {
    amountCents: number;
    currency: string;
    productName: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string | null;
    metadata: Record<string, string>;
  },
): Promise<{ id: string; url: string | null }> {
  const params: Record<string, string> = {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': input.currency,
    'line_items[0][price_data][unit_amount]': String(input.amountCents),
    'line_items[0][price_data][product_data][name]': input.productName,
    'payment_intent_data[metadata][source]': 'suite_deposit',
  };
  for (const [k, v] of Object.entries(input.metadata)) {
    params[`metadata[${k}]`] = v;
    params[`payment_intent_data[metadata][${k}]`] = v;
  }
  if (input.customerEmail?.trim()) {
    params.customer_email = input.customerEmail.trim();
  }
  const data = await stripeFormRequest<{ id: string; url: string | null }>(
    secretKey,
    '/checkout/sessions',
    params,
  );
  return data;
}

export async function ensureDepositSessionForLead(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  amountCents: number,
  currency: string,
  fallbackOrigin?: string | null,
): Promise<DepositSessionRow | null> {
  const { data: existing } = await admin
    .from('stripe_deposit_sessions')
    .select('*')
    .eq('company_id', companyId)
    .eq('marketing_lead_id', leadId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as DepositSessionRow;

  const token = newPublicToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: inserted, error } = await admin
    .from('stripe_deposit_sessions')
    .insert({
      company_id: companyId,
      marketing_lead_id: leadId,
      public_token: token,
      amount_cents: amountCents,
      currency,
      status: 'pending',
      expires_at: expiresAt,
      metadata: { source: 'marketing_whatsapp' },
    })
    .select('*')
    .single();
  if (error) throw error;
  return inserted as DepositSessionRow;
}

export async function startCheckoutForDepositToken(
  admin: SupabaseClient,
  token: string,
  origin: string | null,
): Promise<{ checkout_url: string; amount_cents: number; currency: string; status: string }> {
  const { data: session, error } = await admin
    .from('stripe_deposit_sessions')
    .select('*, marketing_leads(first_name, last_name, email, form_name, campaign)')
    .eq('public_token', token)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error('Enlace de pago no válido');

  const row = session as DepositSessionRow & {
    marketing_leads?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      form_name?: string | null;
      campaign?: string | null;
    } | null;
  };

  if (row.status === 'paid') {
    return {
      checkout_url: '',
      amount_cents: row.amount_cents,
      currency: row.currency,
      status: 'paid',
    };
  }

  if (row.checkout_url && row.status === 'pending') {
    return {
      checkout_url: row.checkout_url,
      amount_cents: row.amount_cents,
      currency: row.currency,
      status: 'pending',
    };
  }

  const stripeCfg = await loadStripeConfig(admin, row.company_id);
  if (!stripeCfg?.enabled || !stripeCfg.secret_key) {
    throw new Error('Stripe no está configurado para esta empresa');
  }

  const base = publicAppBaseUrl(stripeCfg, origin);
  if (!base) throw new Error('Falta URL pública de la app en Configuración → Stripe');

  const lead = row.marketing_leads;
  const leadName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim();
  const productName = lead?.campaign?.trim()
    ? `Señal reserva · ${lead.campaign.trim()}`
    : 'Señal para reservar cita';

  const checkout = await createStripeCheckoutSession(stripeCfg.secret_key, {
    amountCents: row.amount_cents,
    currency: row.currency,
    productName,
    successUrl: `${base}/pago/${token}/exito`,
    cancelUrl: `${base}/pago/${token}`,
    customerEmail: lead?.email ?? null,
    metadata: {
      company_id: row.company_id,
      deposit_session_id: row.id,
      marketing_lead_id: row.marketing_lead_id ?? '',
      public_token: token,
    },
  });

  await admin
    .from('stripe_deposit_sessions')
    .update({
      stripe_checkout_session_id: checkout.id,
      checkout_url: checkout.url,
    })
    .eq('id', row.id);

  if (!checkout.url) throw new Error('Stripe no devolvió URL de pago');
  return {
    checkout_url: checkout.url,
    amount_cents: row.amount_cents,
    currency: row.currency,
    status: 'pending',
  };
}

export async function markDepositPaid(
  admin: SupabaseClient,
  depositSessionId: string,
  stripePaymentIntentId: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: session, error } = await admin
    .from('stripe_deposit_sessions')
    .update({
      status: 'paid',
      paid_at: now,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq('id', depositSessionId)
    .eq('status', 'pending')
    .select('company_id, marketing_lead_id, amount_cents, currency')
    .maybeSingle();
  if (error) throw error;
  if (!session?.marketing_lead_id) return;

  await admin
    .from('marketing_leads')
    .update({
      stripe_deposit_paid_at: now,
      wa_automation_status: 'completed',
      wa_automation_completed_at: now,
      wa_automation_error: null,
    })
    .eq('id', session.marketing_lead_id);

  const stripeCfg = await loadStripeConfig(admin, session.company_id);
  let stageId = await resolveExistingStageId(
    admin,
    session.company_id,
    stripeCfg?.confirmed_stage_id ?? null,
  );
  if (!stageId) {
    const { data: wonStage } = await admin
      .from('marketing_lead_stages')
      .select('id')
      .eq('company_id', session.company_id)
      .eq('is_won', true)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = wonStage?.id ?? null;
  }
  if (stageId) {
    await admin
      .from('marketing_leads')
      .update({ stage_id: stageId })
      .eq('id', session.marketing_lead_id);
  }

  const { data: lead } = await admin
    .from('marketing_leads')
    .select(
      'id, external_id, email, phone, first_name, last_name, campaign, form_name',
    )
    .eq('id', session.marketing_lead_id)
    .maybeSingle();

  if (lead) {
    const paidEpoch = Math.floor(new Date(now).getTime() / 1000);
    const amountCents = Number(session.amount_cents ?? 0);
    try {
      await emitMetaConversion(admin, session.company_id, {
        event_name: 'Purchase',
        event_id: `${lead.id}-purchase-${paidEpoch}`,
        event_time: paidEpoch,
        email: lead.email,
        phone: lead.phone,
        first_name: lead.first_name,
        last_name: lead.last_name,
        external_id: lead.external_id ?? lead.id,
        meta_lead_id: parseMetaLeadId(lead.external_id),
        campaign: lead.campaign,
        value: amountCents > 0 ? amountCents / 100 : null,
        currency: 'EUR',
      });
    } catch (convErr) {
      console.error('meta conversion Purchase emit failed:', convErr);
    }

    try {
      await emitMetaConversionForLeadStage(
        admin,
        session.company_id,
        session.marketing_lead_id,
      );
    } catch (stageErr) {
      console.error('meta conversion stage emit failed:', stageErr);
    }

    try {
      const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || 'Lead';
      const { notifyStripeDepositPaid } = await import('./companyNotifications.ts');
      await notifyStripeDepositPaid(admin, session.company_id, {
        depositSessionId,
        leadId: lead.id,
        leadName,
        phone: lead.phone,
        amountCents,
        currency: session.currency ?? 'eur',
        formName: lead.form_name,
        campaign: lead.campaign,
      });
    } catch (notifyErr) {
      console.error('stripe deposit notification failed:', notifyErr);
    }
  }
}

export async function sendDepositConfirmationWhatsapp(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  amountCents?: number | null,
  currency?: string | null,
): Promise<{ sent: boolean; skipped_reason?: string }> {
  const stripeCfg = await loadStripeConfig(admin, companyId);
  const template = stripeCfg?.payment_success_whatsapp_message?.trim();
  if (!template) return { sent: false, skipped_reason: 'no_template' };

  const { loadAutomationSettings } = await import('./whatsappAutomationDispatch.ts');
  const { isWithinAutomationHours } = await import('./whatsappAutomationHours.ts');
  const automationSettings = await loadAutomationSettings(admin, companyId);
  if (!isWithinAutomationHours(automationSettings)) {
    return { sent: false, skipped_reason: 'outside_hours' };
  }

  const { data: lead } = await admin
    .from('marketing_leads')
    .select(
      'phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source',
    )
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!lead?.phone?.trim()) return { sent: false, skipped_reason: 'no_phone' };

  const { loadWhatsappConfig, renderWhatsappTemplate, normalizeChatId } = await import(
    './marketingWhatsappAutomation.ts',
  );
  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { sent: false, skipped_reason: 'whatsapp_off' };
  }

  let text = renderWhatsappTemplate(template, lead, undefined);
  if (amountCents && amountCents > 0) {
    const importe = formatEurosFromCents(amountCents, currency ?? 'eur');
    text = text.replace(/\{importe_senal\}/gi, importe);
  }

  const chatId = normalizeChatId(lead.phone, cfg.default_country_code);
  const providerCfg = resolveWhatsappCredentials(cfg);
  try {
    await providerSendText(providerCfg, chatId, text);
  } catch (e) {
    console.error('deposit confirmation WhatsApp failed:', e);
    return { sent: false, skipped_reason: 'send_failed' };
  }
  return { sent: true };
}

export type ManualDepositPaymentMethod = 'bizum' | 'transfer' | 'cash' | 'other';

export async function confirmManualDepositForLead(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  paymentMethod: ManualDepositPaymentMethod,
  confirmedByUserId?: string | null,
): Promise<{
  already_paid: boolean;
  deposit_session_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  whatsapp_sent: boolean;
  whatsapp_skipped_reason?: string;
}> {
  const { data: lead } = await admin
    .from('marketing_leads')
    .select('id, stripe_deposit_paid_at, meta_form_id')
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!lead) throw new Error('Lead no encontrado');

  if (lead.stripe_deposit_paid_at) {
    return {
      already_paid: true,
      deposit_session_id: null,
      amount_cents: null,
      currency: null,
      whatsapp_sent: false,
    };
  }

  const stripeCfg = await loadStripeConfig(admin, companyId);
  const { loadRedsysConfig, resolveUnifiedDepositAmountCents } = await import('./redsysDeposit.ts');
  const redsysCfg = await loadRedsysConfig(admin, companyId);
  if (!stripeCfg && !redsysCfg) throw new Error('Configuración de pagos no encontrada');

  let form: MetaFormDeposit | null = null;
  if (lead.meta_form_id) {
    const { data: f } = await admin
      .from('meta_forms')
      .select('stripe_deposit_enabled, stripe_deposit_amount_cents')
      .eq('id', lead.meta_form_id)
      .maybeSingle();
    form = (f as MetaFormDeposit | null) ?? null;
  }

  const amountCents = resolveUnifiedDepositAmountCents(stripeCfg, redsysCfg, form);
  if (!amountCents) throw new Error('Importe de señal no configurado');

  const currency = redsysCfg?.currency ?? stripeCfg?.currency ?? 'eur';
  const publicUrl = stripeCfg?.public_app_url ?? redsysCfg?.public_app_url ?? null;

  const session = await ensureDepositSessionForLead(
    admin,
    companyId,
    leadId,
    amountCents,
    currency,
    publicUrl,
  );
  if (!session) throw new Error('No se pudo registrar la señal');

  await admin
    .from('stripe_deposit_sessions')
    .update({
      payment_provider: 'manual',
      metadata: {
        source: 'manual',
        payment_method: paymentMethod,
        confirmed_by: confirmedByUserId ?? null,
        confirmed_at: new Date().toISOString(),
      },
    })
    .eq('id', session.id)
    .eq('company_id', companyId);

  await markDepositPaid(admin, session.id, `manual:${paymentMethod}`);

  const wa = await sendDepositConfirmationWhatsapp(
    admin,
    companyId,
    leadId,
    amountCents,
    currency,
  );

  return {
    already_paid: false,
    deposit_session_id: session.id,
    amount_cents: amountCents,
    currency,
    whatsapp_sent: wa.sent,
    whatsapp_skipped_reason: wa.skipped_reason,
  };
}

export async function renderWhatsappTemplateWithPaymentLinks(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  template: string,
  ctx: WhatsappTemplateContext,
  form: MetaFormDeposit | null,
  fallbackOrigin?: string | null,
): Promise<string> {
  const needsLink = /\{link_pago\}/i.test(template);
  const needsAmount = /\{importe_senal\}/i.test(template);

  let linkPago = '';
  let importeSenal = '';

  const stripeCfg = await loadStripeConfig(admin, companyId);
  const { loadRedsysConfig, isRedsysOnlineReady, isStripeOnlineReady, resolveUnifiedDepositAmountCents, resolvePublicAppUrl } =
    await import('./redsysDeposit.ts');
  const redsysCfg = await loadRedsysConfig(admin, companyId);
  const amountCents = resolveUnifiedDepositAmountCents(stripeCfg, redsysCfg, form ?? null);
  const onlineReady = isStripeOnlineReady(stripeCfg) || isRedsysOnlineReady(redsysCfg);
  const currency = redsysCfg?.currency || stripeCfg?.currency || 'eur';
  const publicBase = resolvePublicAppUrl(stripeCfg, redsysCfg, fallbackOrigin);

  if (amountCents) {
    importeSenal = formatEurosFromCents(amountCents, currency);
    if (needsLink && onlineReady && leadId) {
      const deposit = await ensureDepositSessionForLead(
        admin,
        companyId,
        leadId,
        amountCents,
        currency,
        publicBase || fallbackOrigin,
      );
      if (deposit) {
        const urlCfg = stripeCfg ?? {
          company_id: companyId,
          publishable_key: null,
          secret_key: null,
          webhook_secret: null,
          enabled: false,
          currency,
          default_deposit_amount_cents: amountCents,
          public_app_url: publicBase || null,
          confirmed_stage_id: null,
          payment_success_whatsapp_message: null,
          deposit_request_whatsapp_message: null,
        };
        linkPago = buildPublicPaymentUrl(urlCfg, deposit.public_token, publicBase || fallbackOrigin);
      }
    }
  }

  const withExtras = template
    .replace(/\{link_pago\}/gi, linkPago)
    .replace(/\{importe_senal\}/gi, importeSenal);

  return renderWhatsappTemplate(withExtras, ctx, form ?? undefined, ctx.field_data);
}

export async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  webhookSecret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((chunk) => {
      const idx = chunk.indexOf('=');
      if (idx === -1) return [chunk, ''];
      return [chunk.slice(0, idx), chunk.slice(idx + 1)];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = [...new Uint8Array(expectedBuf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function testStripeConnection(secretKey: string): Promise<{ account_id?: string }> {
  const resp = await fetch(`${STRIPE_API}/account`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;
  if (!resp.ok) {
    const msg =
      data?.error?.message ??
      `HTTP ${resp.status}`;
    throw new Error(`Stripe: ${msg}`);
  }
  return { account_id: data?.id as string | undefined };
}

export { buildWhatsappTemplateVars, renderWhatsappTemplate };
