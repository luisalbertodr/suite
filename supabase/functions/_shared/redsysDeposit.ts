import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createRedsysSignature,
  decodeMerchantParameters,
  encodeMerchantParameters,
  generateRedsysOrder,
  isRedsysResponseAuthorized,
  parseRedsysApiKey,
  redsysRedirectUrl,
  verifyRedsysSignature,
  type RedsysSignatureVersion,
} from './redsysCrypto.ts';
import {
  buildPublicPaymentUrl,
  ensureDepositSessionForLead,
  formatEurosFromCents,
  loadStripeConfig,
  markDepositPaid,
  type StripeConfigRow,
} from './stripeDeposit.ts';

export type RedsysConfigRow = {
  company_id: string;
  merchant_code: string | null;
  terminal: string;
  signature_key: string | null;
  signature_version: RedsysSignatureVersion;
  environment: 'live' | 'test';
  enabled: boolean;
  bizum_enabled: boolean;
  currency: string;
  default_deposit_amount_cents: number;
  public_app_url: string | null;
  confirmed_stage_id: string | null;
  payment_success_whatsapp_message: string | null;
  product_description: string | null;
};

export type RedsysPayMethod = 'card' | 'bizum';

export async function loadRedsysConfig(
  admin: SupabaseClient,
  companyId: string,
): Promise<RedsysConfigRow | null> {
  const { data, error } = await admin
    .from('redsys_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as RedsysConfigRow | null) ?? null;
}

export function isRedsysOnlineReady(cfg: RedsysConfigRow | null | undefined): boolean {
  return !!(
    cfg?.enabled &&
    cfg.signature_key?.trim() &&
    cfg.merchant_code?.trim()
  );
}

export function isStripeOnlineReady(cfg: StripeConfigRow | null | undefined): boolean {
  return !!(cfg?.enabled && cfg.secret_key?.trim());
}

/** Importe a mostrar/cobrar: override de formulario, luego Redsys, luego Stripe. */
export function resolveUnifiedDepositAmountCents(
  stripeCfg: StripeConfigRow | null,
  redsysCfg: RedsysConfigRow | null,
  form?: { stripe_deposit_enabled?: boolean; stripe_deposit_amount_cents?: number | null } | null,
): number | null {
  if (form?.stripe_deposit_enabled === false) return null;
  if (form?.stripe_deposit_amount_cents) return form.stripe_deposit_amount_cents;
  if (redsysCfg && redsysCfg.default_deposit_amount_cents > 0) {
    return redsysCfg.default_deposit_amount_cents;
  }
  if (stripeCfg && stripeCfg.default_deposit_amount_cents > 0) {
    return stripeCfg.default_deposit_amount_cents;
  }
  return null;
}

export function resolvePublicAppUrl(
  stripeCfg: StripeConfigRow | null,
  redsysCfg: RedsysConfigRow | null,
  fallbackOrigin?: string | null,
): string {
  const fromRedsys = redsysCfg?.public_app_url?.trim().replace(/\/+$/, '');
  if (fromRedsys) return fromRedsys;
  const fromStripe = stripeCfg?.public_app_url?.trim().replace(/\/+$/, '');
  if (fromStripe) return fromStripe;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '');
  return '';
}

export function applyRedsysApiKeyToRow(
  apiKey: string,
  row: Record<string, unknown>,
): void {
  const parsed = parseRedsysApiKey(apiKey);
  if (!parsed) throw new Error('API Key Redsys no válida');
  row.environment = parsed.environment;
  row.merchant_code = parsed.merchant_code;
  row.terminal = parsed.terminal;
  row.signature_key = parsed.signature_key;
  // La API Key del portal incorpora la clave sha256 → firma clásica V1
  row.signature_version = 'HMAC_SHA256_V1';
}

export async function getDepositPaymentMethods(
  admin: SupabaseClient,
  companyId: string,
): Promise<{
  stripe: boolean;
  redsys_card: boolean;
  redsys_bizum: boolean;
}> {
  const [stripeCfg, redsysCfg] = await Promise.all([
    loadStripeConfig(admin, companyId),
    loadRedsysConfig(admin, companyId),
  ]);
  const redsysReady = isRedsysOnlineReady(redsysCfg);
  return {
    stripe: isStripeOnlineReady(stripeCfg),
    redsys_card: redsysReady,
    redsys_bizum: redsysReady && !!redsysCfg?.bizum_enabled,
  };
}

type RedirectForm = {
  endpoint: string;
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
};

export async function startRedsysCheckoutForDepositToken(
  admin: SupabaseClient,
  token: string,
  origin: string | null,
  payMethod: RedsysPayMethod,
): Promise<{
  status: string;
  amount_cents: number;
  currency: string;
  form?: RedirectForm;
}> {
  const { data: session, error } = await admin
    .from('stripe_deposit_sessions')
    .select('*, marketing_leads(first_name, last_name, email, form_name, campaign)')
    .eq('public_token', token)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error('Enlace de pago no válido');

  const row = session as {
    id: string;
    company_id: string;
    marketing_lead_id: string | null;
    amount_cents: number;
    currency: string;
    status: string;
    marketing_leads?: {
      first_name?: string | null;
      last_name?: string | null;
      campaign?: string | null;
      form_name?: string | null;
    } | null;
  };

  if (row.status === 'paid') {
    return {
      status: 'paid',
      amount_cents: row.amount_cents,
      currency: row.currency,
    };
  }

  const redsysCfg = await loadRedsysConfig(admin, row.company_id);
  if (!isRedsysOnlineReady(redsysCfg) || !redsysCfg) {
    throw new Error('Redsys no está configurado para esta empresa');
  }
  if (payMethod === 'bizum' && !redsysCfg.bizum_enabled) {
    throw new Error('Bizum no está activo en la configuración Redsys');
  }

  const stripeCfg = await loadStripeConfig(admin, row.company_id);
  const base = resolvePublicAppUrl(stripeCfg, redsysCfg, origin);
  if (!base) {
    throw new Error('Falta URL pública de la app en Configuración → Pagos');
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  if (!supabaseUrl) throw new Error('SUPABASE_URL no configurada');

  const order = generateRedsysOrder();
  const terminal = String(redsysCfg.terminal || '1').replace(/^0+/, '') || '1';
  const merchantCode = String(redsysCfg.merchant_code).trim();
  const product =
    redsysCfg.product_description?.trim() ||
    (row.marketing_leads?.campaign?.trim()
      ? `Señal · ${row.marketing_leads.campaign.trim()}`
      : 'Señal reserva cita');

  const merchantParams: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(row.amount_cents),
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_MERCHANTCODE: merchantCode,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_TERMINAL: terminal,
    DS_MERCHANT_MERCHANTURL:
      `${supabaseUrl}/functions/v1/redsys-notification?company_id=${row.company_id}`,
    DS_MERCHANT_URLOK: `${base}/pago/${token}/exito`,
    DS_MERCHANT_URLKO: `${base}/pago/${token}`,
    DS_MERCHANT_PRODUCTDESCRIPTION: product.slice(0, 125),
  };

  if (payMethod === 'bizum') {
    merchantParams.DS_MERCHANT_PAYMETHODS = 'z';
  }

  const encoded = encodeMerchantParameters(merchantParams);
  const version = redsysCfg.signature_version || 'HMAC_SHA512_V2';
  const signature = await createRedsysSignature(
    redsysCfg.signature_key!.trim(),
    order,
    encoded,
    version,
  );

  await admin
    .from('stripe_deposit_sessions')
    .update({
      payment_provider: 'redsys',
      redsys_order: order,
      redsys_pay_method: payMethod,
      checkout_url: null,
      metadata: {
        source: 'redsys_redirect',
        pay_method: payMethod,
        order,
      },
    })
    .eq('id', row.id);

  return {
    status: 'pending',
    amount_cents: row.amount_cents,
    currency: row.currency,
    form: {
      endpoint: redsysRedirectUrl(redsysCfg.environment),
      Ds_SignatureVersion: version,
      Ds_MerchantParameters: encoded,
      Ds_Signature: signature,
    },
  };
}

export async function processRedsysNotification(
  admin: SupabaseClient,
  companyId: string,
  payload: {
    Ds_SignatureVersion?: string;
    Ds_MerchantParameters?: string;
    Ds_Signature?: string;
  },
): Promise<{ ok: boolean; authorized: boolean; order?: string }> {
  const merchantParamsEncoded = payload.Ds_MerchantParameters?.trim();
  const signature = payload.Ds_Signature?.trim();
  if (!merchantParamsEncoded || !signature) {
    throw new Error('Notificación Redsys incompleta');
  }

  const redsysCfg = await loadRedsysConfig(admin, companyId);
  if (!redsysCfg?.signature_key) {
    throw new Error('Redsys no configurado');
  }

  const params = decodeMerchantParameters(merchantParamsEncoded);
  const order =
    params.Ds_Order ||
    params.DS_ORDER ||
    params.Ds_Merchant_Order ||
    '';
  if (!order) throw new Error('Notificación sin número de pedido');

  const version = (payload.Ds_SignatureVersion?.trim() ||
    redsysCfg.signature_version ||
    'HMAC_SHA512_V2') as RedsysSignatureVersion;

  const valid = await verifyRedsysSignature(
    redsysCfg.signature_key.trim(),
    order,
    merchantParamsEncoded,
    signature,
    version === 'HMAC_SHA256_V1' ? 'HMAC_SHA256_V1' : 'HMAC_SHA512_V2',
  );
  if (!valid) throw new Error('Firma Redsys inválida');

  const dsResponse = params.Ds_Response ?? params.DS_RESPONSE ?? '';
  const authorized = isRedsysResponseAuthorized(dsResponse);
  const authCode = params.Ds_AuthorisationCode ?? params.DS_AUTHORISATIONCODE ?? null;

  await admin
    .from('redsys_config')
    .update({ last_notification_at: new Date().toISOString() })
    .eq('company_id', companyId);

  const { data: session } = await admin
    .from('stripe_deposit_sessions')
    .select('id, status, marketing_lead_id, amount_cents, currency')
    .eq('company_id', companyId)
    .eq('redsys_order', order)
    .maybeSingle();

  if (!session) {
    console.warn('Redsys notification: order not found', order);
    return { ok: true, authorized, order };
  }

  if (authorized && session.status === 'pending') {
    await admin
      .from('stripe_deposit_sessions')
      .update({
        redsys_auth_code: authCode,
        payment_provider: 'redsys',
      })
      .eq('id', session.id);

    await markDepositPaid(admin, session.id, authCode ? `redsys:${authCode}` : 'redsys');

    // markDepositPaid usa la etapa de Stripe; si Redsys tiene la suya, prevalece
    if (redsysCfg.confirmed_stage_id && session.marketing_lead_id) {
      await admin
        .from('marketing_leads')
        .update({ stage_id: redsysCfg.confirmed_stage_id })
        .eq('id', session.marketing_lead_id);
    }

    const successMsg =
      redsysCfg.payment_success_whatsapp_message?.trim() ||
      (await loadStripeConfig(admin, companyId))?.payment_success_whatsapp_message?.trim() ||
      null;

    if (successMsg && session.marketing_lead_id) {
      try {
        const { sendDepositConfirmationWhatsapp } = await import('./stripeDeposit.ts');
        // sendDepositConfirmationWhatsapp uses stripe template; send inline if redsys-only template
        if (redsysCfg.payment_success_whatsapp_message?.trim()) {
          await sendRedsysSuccessWhatsapp(
            admin,
            companyId,
            session.marketing_lead_id,
            redsysCfg.payment_success_whatsapp_message.trim(),
            Number(session.amount_cents ?? 0),
            session.currency ?? 'eur',
          );
        } else {
          await sendDepositConfirmationWhatsapp(
            admin,
            companyId,
            session.marketing_lead_id,
            Number(session.amount_cents ?? 0),
            session.currency ?? 'eur',
          );
        }
      } catch (e) {
        console.error('Redsys post-payment WhatsApp failed:', e);
      }
    }
  }

  return { ok: true, authorized, order };
}

async function sendRedsysSuccessWhatsapp(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  template: string,
  amountCents: number,
  currency: string,
): Promise<void> {
  const { loadAutomationSettings } = await import('./whatsappAutomationDispatch.ts');
  const { isWithinAutomationHours } = await import('./whatsappAutomationHours.ts');
  const automationSettings = await loadAutomationSettings(admin, companyId);
  if (!isWithinAutomationHours(automationSettings)) return;

  const { data: lead } = await admin
    .from('marketing_leads')
    .select(
      'phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source',
    )
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!lead?.phone?.trim()) return;

  const { loadWhatsappConfig, renderWhatsappTemplate, normalizeChatId } = await import(
    './marketingWhatsappAutomation.ts'
  );
  const { resolveWhatsappCredentials } = await import('./whatsappProviderTypes.ts');
  const { providerSendText } = await import('./whatsappProviderClient.ts');

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return;
  }

  let text = renderWhatsappTemplate(template, lead, undefined);
  if (amountCents > 0) {
    text = text.replace(/\{importe_senal\}/gi, formatEurosFromCents(amountCents, currency));
  }
  const chatId = normalizeChatId(lead.phone, cfg.default_country_code);
  await providerSendText(resolveWhatsappCredentials(cfg), chatId, text);
}

/** Asegura sesión + URL pública si Stripe o Redsys están listos para cobro online. */
export async function ensureOnlineDepositLink(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  form?: { stripe_deposit_enabled?: boolean; stripe_deposit_amount_cents?: number | null } | null,
  fallbackOrigin?: string | null,
): Promise<{ payment_url: string; amount_cents: number; currency: string } | null> {
  const [stripeCfg, redsysCfg] = await Promise.all([
    loadStripeConfig(admin, companyId),
    loadRedsysConfig(admin, companyId),
  ]);

  if (!isStripeOnlineReady(stripeCfg) && !isRedsysOnlineReady(redsysCfg)) {
    return null;
  }

  const amountCents = resolveUnifiedDepositAmountCents(stripeCfg, redsysCfg, form);
  if (!amountCents) return null;

  const currency = redsysCfg?.currency || stripeCfg?.currency || 'eur';
  const session = await ensureDepositSessionForLead(
    admin,
    companyId,
    leadId,
    amountCents,
    currency,
    fallbackOrigin,
  );
  if (!session) return null;

  const urlBaseCfg = stripeCfg ?? {
    company_id: companyId,
    publishable_key: null,
    secret_key: null,
    webhook_secret: null,
    enabled: false,
    currency,
    default_deposit_amount_cents: amountCents,
    public_app_url: redsysCfg?.public_app_url ?? null,
    confirmed_stage_id: null,
    payment_success_whatsapp_message: null,
    deposit_request_whatsapp_message: null,
  };

  // Preferir public_app_url de redsys si stripe no tiene
  if (!urlBaseCfg.public_app_url && redsysCfg?.public_app_url) {
    urlBaseCfg.public_app_url = redsysCfg.public_app_url;
  }

  const payment_url = buildPublicPaymentUrl(
    urlBaseCfg as StripeConfigRow,
    session.public_token,
    fallbackOrigin ?? resolvePublicAppUrl(stripeCfg, redsysCfg, null),
  );

  return { payment_url, amount_cents: amountCents, currency };
}
