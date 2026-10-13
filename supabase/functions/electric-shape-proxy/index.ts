/**
 * F6 — Proxy autenticado hacia ElectricSQL.
 * Solo tablas allowlist; requiere JWT Supabase (usuario logueado).
 *
 * Cliente: GET /functions/v1/electric-shape-proxy?table=suite_service_status&...
 * Reenvía a ELECTRIC_URL/v1/shape
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** Tablas permitidas para sync piloto (ampliar con cuidado). */
const ALLOWED_TABLES = new Set(['suite_service_status']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const electricBase = (Deno.env.get('ELECTRIC_URL') || 'http://172.17.0.1:3060').replace(
    /\/+$/,
    '',
  );
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';

  if (!supabaseUrl || !anon) {
    return json({ error: 'supabase_env_missing' }, 500);
  }
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'unauthorized', detail: userErr?.message }, 401);
  }

  const incoming = new URL(req.url);
  const table = incoming.searchParams.get('table') || '';
  if (!ALLOWED_TABLES.has(table)) {
    return json({ error: 'table_not_allowed', table }, 403);
  }

  const target = new URL(`${electricBase}/v1/shape`);
  // Copiar params Electric (offset, handle, live, cursor, ...) + table
  incoming.searchParams.forEach((value, key) => {
    if (key === 'table') return;
    target.searchParams.set(key, value);
  });
  target.searchParams.set('table', table);

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: req.headers.get('Accept') || 'application/json',
      },
    });
    const headers = new Headers(corsHeaders);
    const ct = upstream.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    // Electric shape protocol headers
    for (const h of [
      'electric-handle',
      'electric-offset',
      'electric-schema',
      'electric-cursor',
      'electric-up-to-date',
    ]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return json(
      {
        error: 'electric_unreachable',
        detail: e instanceof Error ? e.message : String(e),
        electricBase,
      },
      502,
    );
  }
});
