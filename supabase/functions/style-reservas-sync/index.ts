/**
 * Emula index.php?tag=stylegetreservas|stylereservas|stylereservaok
 * para Style DunaSoft (httpasp / ComRed replacement).
 *
 * Auth: parámetro form `id` = sync_token (style_reservas_sync_config.sync_token)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textOk(): Response {
  return new Response('OK', {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function textError(message: string, status = 400): Response {
  return new Response(`ERROR ${message}`, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function xmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function parseFormBody(raw: string): URLSearchParams {
  return new URLSearchParams(raw);
}

function pick(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? '').trim();
}

function parseDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

function parseFacturado(raw: string): boolean {
  return raw.toUpperCase() === 'SI';
}

function parseNumeric(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

type QueueRow = {
  id: number;
  operation: string;
  idplan: number;
  payload: Record<string, unknown>;
};

function payloadField(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'SI' : 'NO';
  return String(v);
}

function buildGetReservasXml(rows: QueueRow[], macand: string): string {
  if (rows.length === 0) {
    return '<?xml version="1.0" encoding="UTF-8"?><raiz/>';
  }

  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?><raiz>'];
  for (const row of rows) {
    const p = row.payload ?? {};
    const isDelete = row.operation === 'delete';
    const newBlock = (p.new as Record<string, unknown> | undefined) ?? p;
    const facturado = payloadField(newBlock, 'facturado') || 'NO';
    const servicios =
      payloadField(newBlock, 'planart_memo') ||
      payloadField(p, 'planart_memo') ||
      '';

    parts.push('<reservas_web>');
    parts.push(`<idplan>${row.idplan}</idplan>`);
    parts.push(`<idand>${row.id}</idand>`);
    parts.push(`<macand>${xmlEscape(macand)}</macand>`);
    parts.push(`<codemp>${xmlEscape(payloadField(newBlock, 'codemp'))}</codemp>`);
    parts.push(`<codcli>${xmlEscape(payloadField(newBlock, 'codcli'))}</codcli>`);
    parts.push(`<fecha>${xmlEscape(payloadField(newBlock, 'fecha'))}</fecha>`);
    parts.push(`<horini>${xmlEscape(payloadField(newBlock, 'horini'))}</horini>`);
    parts.push(`<horfin>${xmlEscape(payloadField(newBlock, 'horfin'))}</horfin>`);
    parts.push(`<texto>${xmlEscape(payloadField(newBlock, 'texto'))}</texto>`);
    parts.push(`<codrec>${xmlEscape(payloadField(newBlock, 'codrec'))}</codrec>`);
    parts.push(`<nomcli>${xmlEscape(payloadField(newBlock, 'nomcli'))}</nomcli>`);
    parts.push(`<tel1cli>${xmlEscape(payloadField(newBlock, 'tel1cli'))}</tel1cli>`);
    parts.push(`<facturado>${facturado === 'true' || facturado === 'SI' ? 'SI' : 'NO'}</facturado>`);
    parts.push(`<servicios>${xmlEscape(servicios)}</servicios>`);
    parts.push('<pendiente>SI</pendiente>');
    parts.push(`<eliminar>${isDelete ? 'SI' : 'NO'}</eliminar>`);
    parts.push(`<collet>${xmlEscape(payloadField(newBlock, 'collet'))}</collet>`);
    parts.push(`<colfon>${xmlEscape(payloadField(newBlock, 'colfon'))}</colfon>`);
    parts.push('</reservas_web>');
  }
  parts.push('</raiz>');
  return parts.join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return textError('Metodo no permitido', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return textError('Configuracion Supabase incompleta', 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);
  const tag = pick(params, 'tag').toLowerCase();
  const syncToken = pick(params, 'id');

  if (!syncToken) {
    return textError('Falta id (sync_token)');
  }

  const { data: companyId, error: companyErr } = await admin.rpc(
    'style_reservas_resolve_company',
    { p_sync_token: syncToken },
  );
  if (companyErr || !companyId) {
    return textError('Token sync invalido', 403);
  }

  const { data: cfgRow } = await admin
    .from('style_reservas_sync_config')
    .select('macand')
    .eq('company_id', companyId)
    .maybeSingle();
  const macand = cfgRow?.macand ?? 'SUITE-STYLE';

  if (tag === 'stylegetreservas') {
    const { data: rows, error } = await admin
      .schema('dunasoft')
      .from('style_reservas_queue')
      .select('id, operation, idplan, payload')
      .eq('company_id', companyId)
      .is('delivered_at', null)
      .order('id', { ascending: true })
      .limit(100);

    if (error) {
      return textError(error.message, 500);
    }

    const xml = buildGetReservasXml((rows ?? []) as QueueRow[], macand);
    return xmlResponse(xml);
  }

  if (tag === 'stylereservas') {
    const accion = pick(params, 'accion');
    const idplan = parseNumeric(pick(params, 'idplan'));
    const fecha = parseDate(pick(params, 'fecha'));

    const { error } = await admin.rpc('style_reservas_apply_from_style', {
      p_company_id: companyId,
      p_accion: accion,
      p_idplan: idplan,
      p_codemp: pick(params, 'codemp'),
      p_codcli: pick(params, 'codcli'),
      p_fecha: fecha,
      p_horini: pick(params, 'horini'),
      p_horfin: pick(params, 'horfin'),
      p_texto: pick(params, 'texto'),
      p_codrec: pick(params, 'codrec'),
      p_nomcli: pick(params, 'nomcli'),
      p_tel1cli: pick(params, 'tel1cli'),
      p_facturado: parseFacturado(pick(params, 'facturado')),
      p_servicios: pick(params, 'servicios'),
      p_colfon: parseNumeric(pick(params, 'colfon')),
      p_collet: parseNumeric(pick(params, 'collet')),
    });

    if (error) {
      return textError(error.message, 500);
    }
    return textOk();
  }

  if (tag === 'stylereservaok') {
    const idand = parseNumeric(pick(params, 'idand'));
    const idplan = parseNumeric(pick(params, 'idplan'));
    const ok = pick(params, 'reservaok').toUpperCase() !== 'NO';

    const { error } = await admin.rpc('style_reservas_ack', {
      p_company_id: companyId,
      p_idand: idand,
      p_idplan: idplan,
      p_macand: pick(params, 'macand') || macand,
      p_ok: ok,
    });

    if (error) {
      return textError(error.message, 500);
    }
    return textOk();
  }

  return textError(`tag desconocido: ${tag || '(vacio)'}`);
});
