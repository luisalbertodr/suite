import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadStripeConfig,
  startCheckoutForDepositToken,
  testStripeConnection,
} from '../_shared/stripeDeposit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

type Body =
  | { action: 'deposit.public_info'; token: string }
  | { action: 'deposit.public_checkout'; token: string; origin?: string }
  | { action: 'config.test'; company_id?: string }
  | {
      action: 'config.save';
      company_id?: string;
      publishable_key?: string | null;
      enabled?: boolean;
      default_deposit_amount_cents?: number;
      public_app_url?: string | null;
      confirmed_stage_id?: string | null;
      payment_success_whatsapp_message?: string | null;
      secret_key?: string | null;
      webhook_secret?: string | null;
    }
  | { action: 'deposit.create_for_lead'; company_id?: string; lead_id: string };

async function resolveAuthCompanyId(
  req: Request,
  admin: ReturnType<typeof createClient>,
  bodyCompanyId?: string,
): Promise<{ companyId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return err('No autorizado', 401);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return err('Sesión inválida', 401);

  const { data: profile } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('id', userData.user.id)
    .maybeSingle();
  const companyId = bodyCompanyId ?? profile?.company_id;
  if (!companyId) return err('Sin empresa activa');
  return { companyId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') return err('Método no permitido', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido');
  }

  const publicAction =
    body.action === 'deposit.public_info' || body.action === 'deposit.public_checkout';

  if (body.action === 'deposit.public_info') {
    if (!body.token?.trim()) return err('Falta token');
    const { data, error } = await admin
      .from('stripe_deposit_sessions')
      .select(
        'amount_cents, currency, status, paid_at, marketing_leads(first_name, last_name, campaign, form_name)',
      )
      .eq('public_token', body.token.trim())
      .maybeSingle();
    if (error) return err(error.message, 500);
    if (!data) return err('Enlace no válido', 404);
    const lead = data.marketing_leads as {
      first_name?: string | null;
      last_name?: string | null;
      campaign?: string | null;
      form_name?: string | null;
    } | null;
    const leadName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim();
    return json({
      ok: true,
      amount_cents: data.amount_cents,
      currency: data.currency,
      status: data.status,
      paid_at: data.paid_at,
      lead_name: leadName || null,
      offer_name: lead?.campaign ?? lead?.form_name ?? null,
    });
  }

  if (body.action === 'deposit.public_checkout') {
    if (!body.token?.trim()) return err('Falta token');
    try {
      const result = await startCheckoutForDepositToken(
        admin,
        body.token.trim(),
        body.origin ?? null,
      );
      return json({ ok: true, ...result });
    } catch (e) {
      return err(e instanceof Error ? e.message : 'No se pudo iniciar el pago', 502);
    }
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return err('No autorizado', 401);
  }
  const auth = await resolveAuthCompanyId(req, admin, body.company_id);
  if (auth instanceof Response) return auth;
  const companyId = auth.companyId;

  if (body.action === 'config.save') {
    const { data: existing } = await admin
      .from('stripe_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    const incomingSecret =
      typeof body.secret_key === 'string' ? body.secret_key.trim() : '';
    const incomingWebhook =
      typeof body.webhook_secret === 'string' ? body.webhook_secret.trim() : '';

    const row: Record<string, unknown> = {
      company_id: companyId,
      publishable_key:
        body.publishable_key !== undefined
          ? body.publishable_key?.trim() || null
          : existing?.publishable_key ?? null,
      enabled: body.enabled ?? existing?.enabled ?? false,
      currency: existing?.currency ?? 'eur',
      default_deposit_amount_cents:
        body.default_deposit_amount_cents ??
        existing?.default_deposit_amount_cents ??
        0,
      public_app_url:
        body.public_app_url !== undefined
          ? body.public_app_url?.trim() || null
          : existing?.public_app_url ?? null,
      confirmed_stage_id:
        body.confirmed_stage_id !== undefined
          ? body.confirmed_stage_id
          : existing?.confirmed_stage_id ?? null,
      payment_success_whatsapp_message:
        body.payment_success_whatsapp_message !== undefined
          ? body.payment_success_whatsapp_message?.trim() || null
          : existing?.payment_success_whatsapp_message ?? null,
      secret_key: incomingSecret || existing?.secret_key || null,
      webhook_secret: incomingWebhook || existing?.webhook_secret || null,
    };

    const { data, error } = await admin
      .from('stripe_config')
      .upsert(row, { onConflict: 'company_id' })
      .select(
        'company_id, publishable_key, enabled, currency, default_deposit_amount_cents, public_app_url, confirmed_stage_id, payment_success_whatsapp_message, last_webhook_at, created_at, updated_at',
      )
      .single();
    if (error) return err(error.message, 500);

    return json({
      ok: true,
      config: {
        ...data,
        has_secret_key: !!(incomingSecret || existing?.secret_key),
        has_webhook_secret: !!(incomingWebhook || existing?.webhook_secret),
      },
    });
  }

  if (body.action === 'config.test') {
    const cfg = await loadStripeConfig(admin, companyId);
    if (!cfg?.secret_key) return err('Falta clave secreta de Stripe');
    try {
      const account = await testStripeConnection(cfg.secret_key);
      return json({ ok: true, account_id: account.account_id ?? null });
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Conexión fallida', 502);
    }
  }

  if (body.action === 'deposit.create_for_lead') {
    if (!body.lead_id) return err('Falta lead_id');
    const cfg = await loadStripeConfig(admin, companyId);
    if (!cfg?.enabled || !cfg.secret_key) {
      return err('Stripe no está configurado');
    }
    const { data: lead } = await admin
      .from('marketing_leads')
      .select('id, meta_form_id')
      .eq('id', body.lead_id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!lead) return err('Lead no encontrado', 404);

    let form: { stripe_deposit_enabled?: boolean; stripe_deposit_amount_cents?: number | null } | null =
      null;
    if (lead.meta_form_id) {
      const { data: f } = await admin
        .from('meta_forms')
        .select('stripe_deposit_enabled, stripe_deposit_amount_cents')
        .eq('id', lead.meta_form_id)
        .maybeSingle();
      form = f;
    }

    const { resolveDepositAmountCents, ensureDepositSessionForLead, buildPublicPaymentUrl } =
      await import('../_shared/stripeDeposit.ts');
    const amount = resolveDepositAmountCents(cfg, form);
    if (!amount) return err('Importe de señal no configurado');

    const session = await ensureDepositSessionForLead(
      admin,
      companyId,
      lead.id,
      amount,
      cfg.currency ?? 'eur',
      cfg.public_app_url,
    );
    if (!session) return err('No se pudo crear la sesión de pago');
    return json({
      ok: true,
      token: session.public_token,
      payment_url: buildPublicPaymentUrl(cfg, session.public_token, cfg.public_app_url),
      amount_cents: session.amount_cents,
    });
  }

  if (!publicAction) return err(`Acción desconocida: ${(body as { action?: string }).action}`);
  return err('Acción no procesada');
});
