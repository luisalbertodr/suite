// Edge: lectura de eventos SmartPSS Lite (MySQL AttendanceRecordInfo).
// Variables en supabase-edge-functions:
//   SMARTPSS_MYSQL_HOST (ej. 192.168.99.110)
//   SMARTPSS_MYSQL_PORT (default 3306)
//   SMARTPSS_MYSQL_USER
//   SMARTPSS_MYSQL_PASSWORD
//   SMARTPSS_MYSQL_DATABASE (default smartpss_events)
//   SMARTPSS_MYSQL_TABLE (default AttendanceRecordInfo)
//
// Body: { "action": "ping" | "events.list", from?, to?, q?, device?, state?, limit? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import mysql from 'npm:mysql2@3.11.5/promise';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  action: 'ping' | 'events.list';
  from?: string;
  to?: string;
  q?: string;
  device?: string;
  state?: number | null;
  limit?: number;
};

type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  table: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function mysqlConfig(): MysqlConfig | null {
  const host = (Deno.env.get('SMARTPSS_MYSQL_HOST') ?? '').trim();
  const user = (Deno.env.get('SMARTPSS_MYSQL_USER') ?? '').trim();
  const password = Deno.env.get('SMARTPSS_MYSQL_PASSWORD') ?? '';
  if (!host || !user || !password) return null;

  const port = Number(Deno.env.get('SMARTPSS_MYSQL_PORT') ?? '3306');
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    user,
    password,
    database: (Deno.env.get('SMARTPSS_MYSQL_DATABASE') ?? 'smartpss_events').trim() || 'smartpss_events',
    table: (Deno.env.get('SMARTPSS_MYSQL_TABLE') ?? 'AttendanceRecordInfo').trim() || 'AttendanceRecordInfo',
  };
}

function parseYmd(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Interpreta bigint SmartPSS (ms, s o YYYYMMDDHHmmss). */
function bigintToIso(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'bigint' ? Number(raw) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Empaquetado YYYYMMDDHHmmss (12–14 dígitos)
  const asStr = String(Math.trunc(n));
  if (asStr.length >= 12 && asStr.length <= 14) {
    const p = asStr.padStart(14, '0');
    const iso = `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}T${p.slice(8, 10)}:${p.slice(10, 12)}:${p.slice(12, 14)}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // ms vs s
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function dayBoundsMs(ymd: string): { start: number; end: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const end = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start, end };
}

function safeIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Nombre de tabla inválido: ${name}`);
  }
  return `\`${name}\``;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row: Record<string, unknown>) {
  const personCard =
    asString(row.PerSonCardNo) ||
    asString(row.PersonCardNo) ||
    asString(row.personCardNo);

  const localMs = row.AttendanceDateTime;
  const utcMs = row.AttendanceUtcTime;

  return {
    person_id: asString(row.PersonID),
    person_name: asString(row.PersonName),
    person_card_no: personCard,
    attendance_datetime: asNumber(localMs),
    attendance_datetime_iso: bigintToIso(localMs),
    attendance_state: asNumber(row.AttendanceState),
    attendance_method: asNumber(row.AttendanceMethod),
    device_ip: asString(row.DeviceIPAddress),
    device_name: asString(row.DeviceName),
    snapshots_path: asString(row.SnapshotsPath),
    handler: asString(row.Handler),
    attendance_utc_time: asNumber(utcMs),
    attendance_utc_iso: bigintToIso(utcMs),
    remarks: asString(row.Remarks),
  };
}

async function withConnection<T>(
  cfg: MysqlConfig,
  fn: (conn: mysql.Connection) => Promise<T>,
): Promise<T> {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 8_000,
    dateStrings: true,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => undefined);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') return err('Método no permitido', 405);

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

    const cfg = mysqlConfig();
    if (!cfg) {
      return err(
        'SmartPSS MySQL no configurado (SMARTPSS_MYSQL_HOST / USER / PASSWORD).',
        503,
      );
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return err('Body JSON inválido');
    }
    if (!body?.action) return err('Falta `action`');

    if (body.action === 'ping') {
      const result = await withConnection(cfg, async (conn) => {
        const [rows] = await conn.query(
          `SELECT COUNT(*) AS total FROM ${safeIdent(cfg.table)}`,
        );
        const total = Number((rows as Array<{ total: number }>)[0]?.total ?? 0);
        return { ok: true, database: cfg.database, table: cfg.table, total };
      });
      return json(result);
    }

    if (body.action === 'events.list') {
      const from = parseYmd(body.from);
      const to = parseYmd(body.to);
      const q = asString(body.q).slice(0, 80);
      const device = asString(body.device).slice(0, 80);
      const state =
        body.state === null || body.state === undefined || body.state === ('' as unknown)
          ? null
          : Number(body.state);
      const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 1000);

      const where: string[] = [];
      const params: unknown[] = [];

      if (from || to) {
        const fromMs = from ? dayBoundsMs(from).start : 0;
        const toMs = to ? dayBoundsMs(to).end : Number.MAX_SAFE_INTEGER;
        const fromSec = Math.floor(fromMs / 1000);
        const toSec = Math.floor(toMs / 1000);
        // Cubrir epoch ms, epoch s y empaquetado YYYYMMDDHHmmss
        const fromPacked = from ? Number(from.replace(/-/g, '') + '000000') : 0;
        const toPacked = to
          ? Number(to.replace(/-/g, '') + '235959')
          : 99999999999999;
        where.push(`(
          (AttendanceDateTime >= ? AND AttendanceDateTime < ?)
          OR (AttendanceDateTime >= ? AND AttendanceDateTime <= ?)
          OR (AttendanceUtcTime >= ? AND AttendanceUtcTime < ?)
          OR (AttendanceUtcTime >= ? AND AttendanceUtcTime < ?)
        )`);
        params.push(
          fromMs,
          toMs,
          fromPacked,
          toPacked,
          fromMs,
          toMs,
          fromSec,
          toSec,
        );
      }
      if (q) {
        where.push(
          '(PersonID LIKE ? OR PersonName LIKE ? OR PerSonCardNo LIKE ? OR Remarks LIKE ?)',
        );
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      if (device) {
        where.push('(DeviceName LIKE ? OR DeviceIPAddress LIKE ?)');
        const like = `%${device}%`;
        params.push(like, like);
      }
      if (state !== null && Number.isFinite(state)) {
        where.push('AttendanceState = ?');
        params.push(state);
      }

      const sql = `
        SELECT
          PersonID, PersonName, PerSonCardNo,
          AttendanceDateTime, AttendanceState, AttendanceMethod,
          DeviceIPAddress, DeviceName, SnapshotsPath, Handler,
          AttendanceUtcTime, Remarks
        FROM ${safeIdent(cfg.table)}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY AttendanceDateTime DESC
        LIMIT ?
      `;
      params.push(limit);

      const { events, total } = await withConnection(cfg, async (conn) => {
        const [rows] = await conn.query(sql, params);
        const events = (rows as Record<string, unknown>[]).map(normalizeRow);

        let total = events.length;
        if (where.length) {
          const [countRows] = await conn.query(
            `SELECT COUNT(*) AS total FROM ${safeIdent(cfg.table)} WHERE ${where.join(' AND ')}`,
            params.slice(0, -1),
          );
          total = Number((countRows as Array<{ total: number }>)[0]?.total ?? events.length);
        } else {
          const [countRows] = await conn.query(
            `SELECT COUNT(*) AS total FROM ${safeIdent(cfg.table)}`,
          );
          total = Number((countRows as Array<{ total: number }>)[0]?.total ?? events.length);
        }

        return { events, total };
      });

      return json({ events, total, limit });
    }

    return err('Acción no soportada');
  } catch (e) {
    console.error('smartpss-events error', e);
    return err(e instanceof Error ? e.message : 'Error interno', 500);
  }
});
