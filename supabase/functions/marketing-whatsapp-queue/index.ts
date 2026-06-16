import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadAutomationSettings } from '../_shared/whatsappAutomationDispatch.ts';
import {
  enqueueEligibleMarketingLeads,
  getMarketingWhatsappQueueStats,
  resendWelcomeWhatsappForLeads,
  type MarketingWhatsappQueueSettings,
} from '../_shared/marketingWhatsappQueue.ts';

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

type Body = {
  action?: 'stats' | 'enqueue_all' | 'cancel' | 'resend_welcome';
  company_id?: string;
  queue_ids?: string[];
  lead_ids?: string[];
};

async function resolveCompanyId(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requested?: string,
): Promise<string | null> {
  if (requested) {
    const { data: role } = await admin
      .from('user_company_roles')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', requested)
      .maybeSingle();
    if (role) return requested;
    const { data: profile } = await admin
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile?.company_id === requested) return requested;
    return null;
  }
  const { data: profile } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();
  return profile?.company_id ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'No autorizado' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const action = body.action ?? 'stats';
  const admin = createClient(supabaseUrl, serviceKey);

  if (serviceKey && token === serviceKey && action === 'resend_welcome') {
    const companyId = body.company_id?.trim() ?? '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
    const leadIds = (body.lead_ids ?? []).filter(Boolean);
    if (leadIds.length === 0) return json({ error: 'lead_ids vacío' }, 400);
    const settings = await loadAutomationSettings(admin, companyId) as MarketingWhatsappQueueSettings;
    const result = await resendWelcomeWhatsappForLeads(admin, companyId, leadIds);
    const stats = await getMarketingWhatsappQueueStats(admin, companyId, settings);
    return json({ ok: true, ...result, stats });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Sesión inválida' }, 401);

  const companyId = await resolveCompanyId(admin, userData.user.id, body.company_id?.trim());
  if (!companyId) return json({ error: 'Sin empresa activa' }, 400);

  const { data: canWrite } = await admin.rpc('user_has_effective_permission', {
    p_user_id: userData.user.id,
    p_resource: 'marketing',
    p_action: 'write',
  });
  if (!canWrite) return json({ error: 'Sin permiso marketing:write' }, 403);

  const settings = await loadAutomationSettings(admin, companyId) as MarketingWhatsappQueueSettings;

  if (action === 'stats') {
    const stats = await getMarketingWhatsappQueueStats(admin, companyId, settings);
    return json({ ok: true, ...stats });
  }

  if (action === 'enqueue_all') {
    const result = await enqueueEligibleMarketingLeads(
      admin,
      companyId,
      userData.user.id,
    );
    const stats = await getMarketingWhatsappQueueStats(admin, companyId, settings);
    return json({ ok: true, ...result, stats });
  }

  if (action === 'cancel') {
    const ids = (body.queue_ids ?? []).filter(Boolean);
    if (ids.length === 0) return json({ error: 'queue_ids vacío' }, 400);
    const { error } = await admin
      .from('marketing_whatsapp_queue')
      .update({ status: 'cancelled', error: 'Cancelado manualmente' })
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .in('id', ids);
    if (error) return json({ error: error.message }, 500);
    const stats = await getMarketingWhatsappQueueStats(admin, companyId, settings);
    return json({ ok: true, cancelled: ids.length, stats });
  }

  if (action === 'resend_welcome') {
    const leadIds = (body.lead_ids ?? []).filter(Boolean);
    if (leadIds.length === 0) return json({ error: 'lead_ids vacío' }, 400);
    const result = await resendWelcomeWhatsappForLeads(admin, companyId, leadIds);
    const stats = await getMarketingWhatsappQueueStats(admin, companyId, settings);
    return json({ ok: true, ...result, stats });
  }

  return json({ error: 'Acción desconocida' }, 400);
});
