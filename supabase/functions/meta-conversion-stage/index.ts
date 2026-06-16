import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emitMetaConversionForLeadStage } from '../_shared/metaConversionEmit.ts';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'No autorizado' }, 401);
  }

  let body: { lead_id?: string; company_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const leadId = body.lead_id?.trim();
  if (!leadId) {
    return json({ error: 'lead_id requerido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: 'Sesión inválida' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: leadRow, error: leadErr } = await admin
    .from('marketing_leads')
    .select('id, company_id')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr || !leadRow) {
    return json({ error: 'Lead no encontrado' }, 404);
  }

  const companyId = body.company_id?.trim() ?? leadRow.company_id;
  if (leadRow.company_id !== companyId) {
    return json({ error: 'Empresa no coincide' }, 400);
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (profile?.company_id !== companyId) {
    const { data: roleRow } = await admin
      .from('user_company_roles')
      .select('company_id')
      .eq('user_id', userData.user.id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!roleRow) {
      return json({ error: 'Sin acceso a esta empresa' }, 403);
    }
  }

  try {
    const emitted = await emitMetaConversionForLeadStage(
      admin,
      companyId,
      leadId,
    );
    return json({ ok: true, emitted });
  } catch (e) {
    console.error('meta-conversion-stage failed:', e);
    return json({
      error: e instanceof Error ? e.message : 'Error al emitir conversión',
    }, 500);
  }
});
