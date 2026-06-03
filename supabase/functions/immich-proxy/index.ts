// Edge: pasarela autenticada hacia Immich (red interna).
// Variables en el contenedor supabase-edge-functions:
//   IMMICH_BASE_URL  (ej. http://192.168.99.110:2283)
//   IMMICH_API_KEY
//
// Body: { "action": "ping" | "search.by_date" | "search.metadata" | "asset.thumbnail" | "asset.download", ... }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ActionBody =
  | { action: 'ping' }
  | { action: 'search.by_date'; date: string; size?: number; page?: number }
  | {
      action: 'search.metadata';
      album_ids?: string[];
      description?: string;
      city?: string;
      taken_after?: string;
      taken_before?: string;
      size?: number;
      page?: number;
    }
  | { action: 'asset.thumbnail'; asset_id: string; size?: 'preview' | 'thumbnail' }
  | { action: 'asset.download'; asset_id: string };

function parseYmd(date: string): string | null {
  const s = String(date ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Rango [inicio, fin) del día en UTC (yyyy-MM-dd). */
function utcDayRange(ymd: string): { takenAfter: string; takenBefore: string } {
  const [y, mo, d] = ymd.split('-').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));
  return { takenAfter: start.toISOString(), takenBefore: end.toISOString() };
}

async function searchMetadataAssets(payload: Record<string, unknown>) {
  const result = await immichJson<{ assets?: { items?: unknown[]; total?: number } }>(
    '/search/metadata',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const items = (result.assets?.items ?? []) as Record<string, unknown>[];
  const assets = items
    .map((row) => {
      const id = String(row.id ?? '');
      if (!id) return null;
      return {
        id,
        type: row.type != null ? String(row.type) : undefined,
        originalFileName: row.originalFileName != null ? String(row.originalFileName) : undefined,
        originalMimeType: row.originalMimeType != null ? String(row.originalMimeType) : undefined,
        fileCreatedAt: row.fileCreatedAt != null ? String(row.fileCreatedAt) : undefined,
        localDateTime: row.localDateTime != null ? String(row.localDateTime) : undefined,
        width: typeof row.width === 'number' ? row.width : undefined,
        height: typeof row.height === 'number' ? row.height : undefined,
      };
    })
    .filter(Boolean);
  return { assets, total: result.assets?.total ?? assets.length };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function immichConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (Deno.env.get('IMMICH_BASE_URL') ?? '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('IMMICH_API_KEY') ?? '';
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

async function immichFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cfg = immichConfig();
  if (!cfg) throw new Error('Immich no configurado en el servidor (IMMICH_BASE_URL / IMMICH_API_KEY)');

  const headers = new Headers(init.headers ?? {});
  headers.set('x-api-key', cfg.apiKey);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const url = `${cfg.baseUrl}/api${path.startsWith('/') ? path : `/${path}`}`;
  return await fetch(url, { ...init, headers });
}

async function immichJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await immichFetch(path, init);
  const text = await resp.text();
  if (!resp.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      // ignore
    }
    throw new Error(`Immich ${resp.status}: ${msg}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      return err('Faltan variables de entorno de Supabase', 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return err('Falta token de autenticación', 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return err('Usuario no autenticado', 401);

    if (!immichConfig()) {
      return err(
        'Immich no configurado en el servidor. Añade IMMICH_BASE_URL e IMMICH_API_KEY al contenedor de Edge Functions.',
        503,
      );
    }

    let body: ActionBody;
    try {
      body = (await req.json()) as ActionBody;
    } catch {
      return err('Body JSON inválido');
    }
    if (!body?.action) return err('Falta `action`');

    switch (body.action) {
      case 'ping': {
        const pong = await immichJson<{ res?: string }>('/server/ping');
        return json({ ok: true, immich: pong });
      }

      case 'search.by_date': {
        const ymd = parseYmd(body.date);
        if (!ymd) return err('Falta date (yyyy-MM-dd)');
        const { takenAfter, takenBefore } = utcDayRange(ymd);
        const size = Math.min(body.size ?? 250, 250);
        const page = body.page ?? 1;
        const base = { size, page, withExif: false };

        const [byTaken, byCreated] = await Promise.all([
          searchMetadataAssets({ ...base, takenAfter, takenBefore }),
          searchMetadataAssets({ ...base, createdAfter: takenAfter, createdBefore: takenBefore }),
        ]);

        const merged = new Map<string, Record<string, unknown>>();
        for (const a of [...byTaken.assets, ...byCreated.assets]) {
          const row = a as Record<string, unknown>;
          const id = String(row.id ?? '');
          if (id) merged.set(id, row);
        }

        const assets = Array.from(merged.values()).filter((row) => {
          const local = String(row.localDateTime ?? '').slice(0, 10);
          const created = String(row.fileCreatedAt ?? '').slice(0, 10);
          if (local === ymd || created === ymd) return true;
          // Si Immich no devolvió fechas locales, confiar en el rango de búsqueda.
          if (!local && !created) return true;
          return false;
        });

        return json({ assets, total: assets.length });
      }

      case 'search.metadata': {
        const payload: Record<string, unknown> = {
          size: Math.min(body.size ?? 250, 250),
          page: body.page ?? 1,
          withExif: false,
          type: 'IMAGE',
        };
        if (body.album_ids?.length) payload.albumIds = body.album_ids;
        if (body.description?.trim()) payload.description = body.description.trim();
        if (body.city?.trim()) payload.city = body.city.trim();
        if (body.taken_after) payload.takenAfter = body.taken_after;
        if (body.taken_before) payload.takenBefore = body.taken_before;
        return json(await searchMetadataAssets(payload));
      }

      case 'asset.thumbnail': {
        if (!body.asset_id) return err('Falta asset_id');
        const size = body.size ?? 'preview';
        const resp = await immichFetch(
          `/assets/${encodeURIComponent(body.asset_id)}/thumbnail?size=${size}`,
        );
        if (!resp.ok) {
          const t = await resp.text();
          return err(t.slice(0, 200) || `HTTP ${resp.status}`, resp.status === 404 ? 404 : 502);
        }
        const buf = await resp.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': resp.headers.get('content-type') ?? 'image/jpeg',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }

      case 'asset.download': {
        if (!body.asset_id) return err('Falta asset_id');
        const info = await immichJson<{
          originalFileName?: string;
          originalMimeType?: string;
        }>(`/assets/${encodeURIComponent(body.asset_id)}`);
        const resp = await immichFetch(
          `/assets/${encodeURIComponent(body.asset_id)}/original`,
        );
        if (!resp.ok) {
          const t = await resp.text();
          return err(t.slice(0, 200) || `HTTP ${resp.status}`, 502);
        }
        const buf = await resp.arrayBuffer();
        const contentType =
          resp.headers.get('content-type') ??
          info.originalMimeType ??
          'application/octet-stream';
        const fileName = info.originalFileName ?? `immich-${body.asset_id}`;
        return new Response(buf, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '')}"`,
            'X-Immich-Filename': fileName,
            'X-Immich-Content-Type': contentType,
            'Cache-Control': 'private, max-age=86400',
          },
        });
      }

      default:
        return err(`Acción no soportada: ${(body as { action: string }).action}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado';
    console.error('immich-proxy:', msg);
    return err(msg, 500);
  }
});
