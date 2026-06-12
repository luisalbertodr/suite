import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildWhatsappTemplateVars,
  renderWhatsappTemplate,
  type WhatsappTemplateContext,
} from './marketingWhatsappAutomation.ts';

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
    .select('company_id, marketing_lead_id, amount_cents')
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
  let stageId = stripeCfg?.confirmed_stage_id ?? null;
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
  const amountCents = stripeCfg ? resolveDepositAmountCents(stripeCfg, form ?? null) : null;

  if (amountCents) {
    importeSenal = formatEurosFromCents(amountCents, stripeCfg?.currency ?? 'eur');
    if (needsLink && stripeCfg) {
      const deposit = await ensureDepositSessionForLead(
        admin,
        companyId,
        leadId,
        amountCents,
        stripeCfg.currency ?? 'eur',
        fallbackOrigin,
      );
      if (deposit) {
        linkPago = buildPublicPaymentUrl(stripeCfg, deposit.public_token, fallbackOrigin);
      }
    }
  }

  const withExtras = template
    .replace(/\{link_pago\}/gi, linkPago)
    .replace(/\{importe_senal\}/gi, importeSenal);

  return renderWhatsappTemplate(withExtras, ctx, undefined);
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
