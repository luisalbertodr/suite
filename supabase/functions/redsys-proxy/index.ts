import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  applyRedsysApiKeyToRow,
  loadRedsysConfig,
  startRedsysCheckoutForDepositToken,
  type RedsysPayMethod,
} from '../_shared/redsysDeposit.ts';

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
  | { action: 'deposit.public_checkout'; token: string; origin?: string; pay_method?: RedsysPayMethod }
  | { action: 'config.test'; company_id?: string }
  | {
      action: 'config.save';
      company_id?: string;
      merchant_code?: string | null;
      terminal?: string | null;
      signature_key?: string | null;
      signature_version?: 'HMAC_SHA512_V2' | 'HMAC_SHA256_V1' | null;
      environment?: 'live' | 'test' | null;
      enabled?: boolean;
      bizum_enabled?: boolean;
      default_deposit_amount_cents?: number;
      public_app_url?: string | null;
      confirmed_stage_id?: string | null;
      payment_success_whatsapp_message?: string | null;
      product_description?: string | null;
      api_key?: string | null;
    };

async function resolveCompanyIdForUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string,
): Promise<string | null> {
  const allowed = new Set<string>();

  const { data: active } = await admin
    .from('user_active_company')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (active?.company_id) allowed.add(String(active.company_id));

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', userId);
  for (const row of profiles ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  const { data: roles } = await admin
    .from('user_company_roles')
    .select('company_id')
    .eq('user_id', userId);
  for (const row of roles ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  if (requestedCompanyId && allowed.has(requestedCompanyId)) return requestedCompanyId;
  if (active?.company_id) return String(active.company_id);
  const first = profiles?.find((p) => p.company_id)?.company_id;
  if (first) return String(first);
  const roleCompany = roles?.find((r) => r.company_id)?.company_id;
  return roleCompany ? String(roleCompany) : null;
}

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

  const companyId = await resolveCompanyIdForUser(
    admin,
    userData.user.id,
    bodyCompanyId,
  );
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

  if (body.action === 'deposit.public_checkout') {
    if (!body.token?.trim()) return err('Falta token');
    const payMethod: RedsysPayMethod = body.pay_method === 'bizum' ? 'bizum' : 'card';
    try {
      const result = await startRedsysCheckoutForDepositToken(
        admin,
        body.token.trim(),
        body.origin ?? null,
        payMethod,
      );
      return json({ ok: true, ...result });
    } catch (e) {
      return err(e instanceof Error ? e.message : 'No se pudo iniciar el pago Redsys', 502);
    }
  }

  const auth = await resolveAuthCompanyId(req, admin, body.company_id);
  if (auth instanceof Response) return auth;
  const companyId = auth.companyId;

  if (body.action === 'config.save') {
    const { data: existing } = await admin
      .from('redsys_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    const incomingKey =
      typeof body.signature_key === 'string' ? body.signature_key.trim() : '';
    const incomingApiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    const row: Record<string, unknown> = {
      company_id: companyId,
      merchant_code:
        body.merchant_code !== undefined
          ? body.merchant_code?.trim() || null
          : existing?.merchant_code ?? null,
      terminal:
        body.terminal !== undefined
          ? String(body.terminal ?? '1').trim() || '1'
          : existing?.terminal ?? '1',
      signature_version:
        body.signature_version ?? existing?.signature_version ?? 'HMAC_SHA512_V2',
      environment: body.environment ?? existing?.environment ?? 'live',
      enabled: body.enabled ?? existing?.enabled ?? false,
      bizum_enabled: body.bizum_enabled ?? existing?.bizum_enabled ?? true,
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
      product_description:
        body.product_description !== undefined
          ? body.product_description?.trim() || null
          : existing?.product_description ?? 'Señal reserva cita',
      signature_key: incomingKey || existing?.signature_key || null,
    };

    if (incomingApiKey) {
      try {
        applyRedsysApiKeyToRow(incomingApiKey, row);
      } catch (e) {
        return err(e instanceof Error ? e.message : 'API Key inválida');
      }
    }

    const { data, error } = await admin
      .from('redsys_config')
      .upsert(row, { onConflict: 'company_id' })
      .select(
        'company_id, merchant_code, terminal, signature_version, environment, enabled, bizum_enabled, currency, default_deposit_amount_cents, public_app_url, confirmed_stage_id, payment_success_whatsapp_message, product_description, last_notification_at, created_at, updated_at',
      )
      .single();
    if (error) return err(error.message, 500);

    return json({
      ok: true,
      config: {
        ...data,
        has_signature_key: !!(incomingKey || incomingApiKey || existing?.signature_key),
      },
    });
  }

  if (body.action === 'config.test') {
    const cfg = await loadRedsysConfig(admin, companyId);
    if (!cfg) {
      return json({
        ok: false,
        error:
          'No hay configuración Redsys guardada. Rellena comercio, terminal y clave, y pulsa Guardar.',
      });
    }
    if (!cfg.signature_key || !cfg.merchant_code) {
      return json({
        ok: false,
        error: 'Faltan comercio y/o clave de firma. Guarda la configuración completa.',
      });
    }
    // Si la etapa configurada ya no existe (borrada), avisar sin fallar el test de TPV
    let stageWarning: string | undefined;
    if (cfg.confirmed_stage_id) {
      const { data: stage } = await admin
        .from('marketing_lead_stages')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('id', cfg.confirmed_stage_id)
        .maybeSingle();
      if (!stage) {
        stageWarning =
          'La etapa tras pago ya no existe (¿eliminada?). Elige otra en el desplegable y guarda.';
      }
    }
    return json({
      ok: true,
      merchant_code: cfg.merchant_code,
      terminal: cfg.terminal,
      environment: cfg.environment,
      signature_version: cfg.signature_version,
      bizum_enabled: cfg.bizum_enabled,
      ...(stageWarning ? { stage_warning: stageWarning } : {}),
    });
  }

  return err(`Acción desconocida: ${(body as { action?: string }).action}`);
});
