import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Extrae la IP del cliente desde cabeceras de proxy (Kong/Nginx). */
function extractClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Missing Supabase env' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized', allowed: false }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Unauthorized', allowed: false }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Superusers de Suite no se restringen por red (usa auth.uid() del JWT).
    const { data: isSuperAsUser } = await userClient.rpc('current_user_is_superuser');
    if (isSuperAsUser === true) {
      const clientIp = extractClientIp(req);
      return json({
        allowed: true,
        restricted: false,
        bypass: 'superuser',
        clientIp,
        userId: user.id,
      });
    }

    const { count, error: countError } = await admin
      .from('user_allowed_networks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('network-access-check count error', countError);
      return json({ error: countError.message, allowed: false }, 500);
    }

    const restricted = (count ?? 0) > 0;
    const clientIp = extractClientIp(req);

    if (!restricted) {
      return json({
        allowed: true,
        restricted: false,
        clientIp,
        userId: user.id,
      });
    }

    const { data: allowed, error: rpcError } = await admin.rpc('user_client_ip_allowed', {
      p_user_id: user.id,
      p_ip: clientIp ?? '',
    });

    if (rpcError) {
      console.error('network-access-check rpc error', rpcError);
      return json({ error: rpcError.message, allowed: false, restricted: true, clientIp }, 500);
    }

    return json({
      allowed: allowed === true,
      restricted: true,
      clientIp,
      userId: user.id,
      reason: allowed === true ? null : 'ip_not_allowed',
    });
  } catch (e) {
    console.error('network-access-check', e);
    return json(
      { error: e instanceof Error ? e.message : 'Internal error', allowed: false },
      500,
    );
  }
});
