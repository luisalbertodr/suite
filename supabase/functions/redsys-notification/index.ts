import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processRedsysNotification } from '../_shared/redsysDeposit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function okText(body = 'OK'): Response {
  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id')?.trim();
  if (!companyId) {
    return new Response('Falta company_id', { status: 400 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let payload: {
    Ds_SignatureVersion?: string;
    Ds_MerchantParameters?: string;
    Ds_Signature?: string;
  } = {};

  try {
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = {
        Ds_SignatureVersion: String(form.get('Ds_SignatureVersion') ?? ''),
        Ds_MerchantParameters: String(form.get('Ds_MerchantParameters') ?? ''),
        Ds_Signature: String(form.get('Ds_Signature') ?? ''),
      };
    }
  } catch {
    // Algunos terminales envían x-www-form-urlencoded
    try {
      const text = await req.text();
      const params = new URLSearchParams(text);
      payload = {
        Ds_SignatureVersion: params.get('Ds_SignatureVersion') ?? '',
        Ds_MerchantParameters: params.get('Ds_MerchantParameters') ?? '',
        Ds_Signature: params.get('Ds_Signature') ?? '',
      };
    } catch {
      return new Response('Payload inválido', { status: 400 });
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const result = await processRedsysNotification(admin, companyId, payload);
    // Redsys espera HTTP 200; el cuerpo no es crítico
    return okText(result.authorized ? 'OK' : 'KO');
  } catch (e) {
    console.error('redsys-notification error:', e);
    return new Response(e instanceof Error ? e.message : 'Error', { status: 400 });
  }
});
