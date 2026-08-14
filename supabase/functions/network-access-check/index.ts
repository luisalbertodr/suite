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

/** Peer de Kong hacia Nginx (no es IP de usuario). */
function isKongPeerHop(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const v = ip.trim();
  return v === '192.168.99.112' || v === '192.168.99.110';
}

function isLoopbackOrDockerGw(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const v = ip.trim();
  if (!v) return true;
  if (v === '127.0.0.1' || v === '::1') return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.1$/.test(v)) return true;
  if (/^192\.168\.(48|64|128|176|208)\.1$/.test(v)) return true;
  return false;
}

function isTrailingProxyHop(ip: string): boolean {
  return isKongPeerHop(ip) || isLoopbackOrDockerGw(ip);
}

/**
 * Extrae la IP del cliente.
 *
 * Cadena: navegador → firewall(10.10.10.1) → Nginx(112) → Kong → edge.
 * XFF típico: "<IP que vio Nginx>, 192.168.99.112" (+ a veces gateway Docker).
 * Tras quitar hops de proxy al final, el último hop restante es el $remote_addr
 * de Nginx (no el primer hop, falsificable por el cliente).
 */
function extractClientIp(req: Request): {
  ip: string | null;
  source: string;
  debug: Record<string, string | null>;
} {
  const xff = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip')?.trim() || null;
  const cf = req.headers.get('cf-connecting-ip')?.trim() || null;
  const debug = {
    'x-forwarded-for': xff,
    'x-real-ip': realIp,
    'cf-connecting-ip': cf,
  };

  const hops = (xff ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let end = hops.length;
  while (end > 0 && isTrailingProxyHop(hops[end - 1])) {
    end -= 1;
  }

  if (end > 0) {
    const asserted = hops[end - 1];
    if (asserted && !isTrailingProxyHop(asserted)) {
      return { ip: asserted, source: 'x-forwarded-for-nginx-asserted', debug };
    }
  }

  if (realIp && !isTrailingProxyHop(realIp)) {
    return { ip: realIp, source: 'x-real-ip', debug };
  }

  if (cf && !isLoopbackOrDockerGw(cf)) {
    return { ip: cf, source: 'cf-connecting-ip', debug };
  }

  return { ip: null, source: 'none', debug };
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
      return json({ error: 'Missing Supabase env', allowed: false }, 500);
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
    const extracted = extractClientIp(req);
    const clientIp = extracted.ip;

    console.log(
      JSON.stringify({
        msg: 'network-access-check',
        userId: user.id,
        clientIp,
        source: extracted.source,
        debug: extracted.debug,
      }),
    );

    const { count, error: countError } = await admin
      .from('user_allowed_networks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('network-access-check count error', countError);
      return json({ error: countError.message, allowed: false, clientIp }, 500);
    }

    const restricted = (count ?? 0) > 0;

    if (!restricted) {
      return json({
        allowed: true,
        restricted: false,
        clientIp,
        ipSource: extracted.source,
        userId: user.id,
      });
    }

    if (!clientIp) {
      return json({
        allowed: false,
        restricted: true,
        clientIp: null,
        ipSource: extracted.source,
        userId: user.id,
        reason: 'ip_unknown',
      });
    }

    const { data: allowed, error: rpcError } = await admin.rpc('user_client_ip_allowed', {
      p_user_id: user.id,
      p_ip: clientIp,
    });

    if (rpcError) {
      console.error('network-access-check rpc error', rpcError);
      return json(
        {
          error: rpcError.message,
          allowed: false,
          restricted: true,
          clientIp,
          ipSource: extracted.source,
          reason: 'check_error',
        },
        200,
      );
    }

    return json({
      allowed: allowed === true,
      restricted: true,
      clientIp,
      ipSource: extracted.source,
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
