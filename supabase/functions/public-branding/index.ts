import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

type BrandingRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
  logo_url_dark: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
}

function parseDataUrl(dataUrl: string): { contentType: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!m) return null;
  const contentType = (m[1] || 'image/png').trim();
  try {
    const raw = atob(m[2]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return { contentType, bytes };
  } catch {
    return null;
  }
}

async function loadBranding(admin: ReturnType<typeof createClient>): Promise<BrandingRow | null> {
  const { data: centers, error: wcErr } = await admin
    .from('work_centers')
    .select('id, name, logo_url, logo_url_dark')
    .or('logo_url.not.is.null,logo_url_dark.not.is.null')
    .order('name')
    .limit(1);
  if (wcErr) throw wcErr;
  if (centers && centers.length > 0) return centers[0] as BrandingRow;

  const { data: companies, error: coErr } = await admin
    .from('companies')
    .select('id, name, logo_url, logo_url_dark')
    .or('logo_url.not.is.null,logo_url_dark.not.is.null')
    .order('name')
    .limit(1);
  if (coErr) throw coErr;
  if (companies && companies.length > 0) return companies[0] as BrandingRow;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Missing Supabase env' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const branding = await loadBranding(admin);
    if (!branding) {
      return json({ error: 'No branding logos' }, 404);
    }

    const url = new URL(req.url);
    const variant = (url.searchParams.get('variant') || '').toLowerCase();

    if (variant === 'light' || variant === 'dark') {
      const preferred =
        variant === 'dark'
          ? branding.logo_url_dark || branding.logo_url
          : branding.logo_url || branding.logo_url_dark;
      if (!preferred) return json({ error: 'Logo not found' }, 404);

      const parsed = parseDataUrl(preferred);
      if (!parsed) {
        // URL remota (http/https): redirigir
        if (/^https?:\/\//i.test(preferred)) {
          return Response.redirect(preferred, 302);
        }
        return json({ error: 'Unsupported logo format' }, 500);
      }

      return new Response(parsed.bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': parsed.contentType,
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // Metadatos (sin devolver el base64 completo).
    return json({
      ok: true,
      displayName: (branding.name || 'Lipoout').trim(),
      hasLight: !!branding.logo_url,
      hasDark: !!branding.logo_url_dark,
    });
  } catch (e) {
    console.error('public-branding', e);
    return json({ error: e instanceof Error ? e.message : 'Error' }, 500);
  }
});
