import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  canNotify,
  loadWhatsappCfg,
  logNotification,
  markNotified,
  resolveMonitorCompanyId,
  sendMonitorEmail,
  sendMonitorWhatsapp,
  type MonitorSettings,
  type WhatsappCfg,
} from '../_shared/serviceMonitorNotify.ts';
import { issabelAuthHeaders } from '../_shared/issabelAuth.ts';
import { evaluateServiceAlerts, markAlertDown, markAlertRecovered } from '../_shared/serviceMonitorAlertState.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-monitor-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ServiceKey = 'supabase' | 'waha' | 'meta' | 'issabel' | 'style_dunasoft';
type ServiceStatus = 'ok' | 'degraded' | 'down' | 'unknown';

type CheckResult = {
  status: ServiceStatus;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
  recoveryAttempted?: boolean;
  recoverySuccess?: boolean;
  recoveryMessage?: string;
};

type Body = {
  source?: 'cron' | 'ui' | 'manual';
  run_recovery?: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

async function loadSettings(admin: ReturnType<typeof createClient>): Promise<MonitorSettings> {
  const { data, error } = await admin
    .from('suite_service_monitor_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data as MonitorSettings;
}

async function loadPreviousStatus(
  admin: ReturnType<typeof createClient>,
  key: ServiceKey,
): Promise<{ status: ServiceStatus; details: Record<string, unknown> }> {
  const { data } = await admin
    .from('suite_service_status')
    .select('status, details')
    .eq('service_key', key)
    .maybeSingle();
  return {
    status: (data?.status as ServiceStatus) ?? 'unknown',
    details: (data?.details as Record<string, unknown>) ?? {},
  };
}

async function persistCheck(
  admin: ReturnType<typeof createClient>,
  key: ServiceKey,
  result: CheckResult,
  prevStatus: ServiceStatus,
  details: Record<string, unknown>,
  settings: MonitorSettings,
): Promise<{
  newDetails: Record<string, unknown>;
  statusChanged: boolean;
  alert: ReturnType<typeof evaluateServiceAlerts>;
}> {
  const statusChanged = prevStatus !== result.status;

  const mergedForAlert = {
    ...details,
    ...(result.details ?? {}),
    last_message: result.message,
  };
  const alert = evaluateServiceAlerts(result.status, mergedForAlert, {
    failures_before_alert: settings.failures_before_alert ?? 2,
    successes_before_recovery: settings.successes_before_recovery ?? 3,
  });

  await admin.from('suite_service_check_log').insert({
    service_key: key,
    status: result.status,
    latency_ms: result.latencyMs,
    message: result.message,
    recovery_attempted: !!result.recoveryAttempted,
    recovery_success: result.recoverySuccess ?? null,
    recovery_message: result.recoveryMessage ?? null,
  });

  await admin
    .from('suite_service_status')
    .update({
      status: result.status,
      last_check_at: new Date().toISOString(),
      ...(result.status === 'ok' ? { last_ok_at: new Date().toISOString(), last_error: null } : {}),
      ...(result.status !== 'ok' ? { last_error: result.message } : {}),
      latency_ms: result.latencyMs,
      details: alert.details,
      consecutive_failures: alert.failureStreak,
      updated_at: new Date().toISOString(),
    })
    .eq('service_key', key);

  return { newDetails: alert.details, statusChanged, alert };
}

async function checkSupabase(admin: ReturnType<typeof createClient>): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const { error } = await admin.from('companies').select('id').limit(1);
    if (error) throw error;
    return { status: 'ok', latencyMs: Date.now() - t0, message: 'Postgres y API responden' };
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : 'Supabase no responde',
    };
  }
}

async function wahaJson<T>(cfg: WhatsappCfg, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Api-Key', cfg.api_key);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const resp = await fetch(`${trimSlash(cfg.base_url)}${path}`, { ...init, headers });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Waha ${path}: HTTP ${resp.status} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) as T : null as T;
}

async function tryStartWahaSession(cfg: WhatsappCfg): Promise<string> {
  const session = cfg.session_name || 'default';
  try {
    await wahaJson(cfg, `/api/sessions/${encodeURIComponent(session)}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return 'session.start enviado';
  } catch {
    await wahaJson(cfg, '/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ name: session }),
    });
    return 'session.start (legacy) enviado';
  }
}

async function checkWaha(
  cfg: WhatsappCfg | null,
  runRecovery: boolean,
): Promise<CheckResult> {
  const t0 = Date.now();
  if (!cfg) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: 'whatsapp_config no configurado (URL/API key)',
    };
  }

  let publicOk = false;
  let publicError = '';
  try {
    const r = await fetch(`${trimSlash(cfg.base_url)}/ping`, { signal: AbortSignal.timeout(12_000) });
    publicOk = r.ok;
    if (!r.ok) publicError = `HTTP ${r.status}`;
  } catch (e) {
    publicError = e instanceof Error ? e.message : 'ping failed';
  }

  if (!publicOk) {
    let recoveryAttempted = false;
    let recoverySuccess = false;
    let recoveryMessage = '';
    if (runRecovery) {
      recoveryAttempted = true;
      recoveryMessage = 'Contenedor WAHA inalcanzable; no se puede session.start remotamente';
      recoverySuccess = false;
    }
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: `WAHA inalcanzable: ${publicError || 'sin respuesta en /ping'}`,
      recoveryAttempted,
      recoverySuccess,
      recoveryMessage,
      details: { public_ok: false },
    };
  }

  let sessions: Array<{ name?: string; status?: string }> = [];
  try {
    sessions = await wahaJson<Array<{ name?: string; status?: string }>>(cfg, '/api/sessions');
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : 'Auth WAHA fallida',
      details: { public_ok: true, auth_ok: false },
    };
  }

  const sessionName = cfg.session_name || 'default';
  const mine = sessions.find((s) => s.name === sessionName);
  const sessionStatus = (mine?.status ?? 'MISSING').toUpperCase();

  if (sessionStatus === 'WORKING') {
    return {
      status: 'ok',
      latencyMs: Date.now() - t0,
      message: `Sesión ${sessionName} WORKING`,
      details: { public_ok: true, auth_ok: true, session_status: sessionStatus },
    };
  }

  if (sessionStatus === 'STARTING' || sessionStatus === 'SCAN_QR') {
    return {
      status: 'degraded',
      latencyMs: Date.now() - t0,
      message: `Sesión ${sessionName} en ${sessionStatus}`,
      details: { session_status: sessionStatus },
    };
  }

  let recoveryAttempted = false;
  let recoverySuccess = false;
  let recoveryMessage = '';
  if (runRecovery) {
    recoveryAttempted = true;
    try {
      recoveryMessage = await tryStartWahaSession(cfg);
      await new Promise((r) => setTimeout(r, 2500));
      const again = await wahaJson<Array<{ name?: string; status?: string }>>(cfg, '/api/sessions');
      const againMine = again.find((s) => s.name === sessionName);
      const againStatus = (againMine?.status ?? '').toUpperCase();
      recoverySuccess = againStatus === 'WORKING';
      recoveryMessage += ` → estado ${againStatus || 'desconocido'}`;
      if (recoverySuccess) {
        return {
          status: 'ok',
          latencyMs: Date.now() - t0,
          message: `Recuperado: sesión ${sessionName} WORKING`,
          recoveryAttempted,
          recoverySuccess: true,
          recoveryMessage,
          details: { session_status: againStatus },
        };
      }
      if (againStatus === 'STARTING' || againStatus === 'SCAN_QR') {
        return {
          status: 'degraded',
          latencyMs: Date.now() - t0,
          message: `Sesión ${sessionName} en ${againStatus} tras session.start`,
          recoveryAttempted,
          recoverySuccess: false,
          recoveryMessage,
          details: { session_status: againStatus },
        };
      }
    } catch (e) {
      recoveryMessage = e instanceof Error ? e.message : 'session.start falló';
      recoverySuccess = false;
    }
  }

  return {
    status: 'down',
    latencyMs: Date.now() - t0,
    message: `Sesión ${sessionName}: ${sessionStatus}`,
    recoveryAttempted,
    recoverySuccess,
    recoveryMessage,
    details: { session_status: sessionStatus },
  };
}

async function checkMeta(admin: ReturnType<typeof createClient>, companyId: string | null): Promise<CheckResult> {
  const t0 = Date.now();
  if (!companyId) {
    return { status: 'unknown', latencyMs: Date.now() - t0, message: 'Sin empresa monitor' };
  }
  const { data: cfg, error } = await admin
    .from('meta_config')
    .select('access_token, enabled')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  if (!cfg?.enabled) {
    return { status: 'unknown', latencyMs: Date.now() - t0, message: 'Meta no habilitado' };
  }
  if (!cfg.access_token) {
    return { status: 'down', latencyMs: Date.now() - t0, message: 'Token Meta vacío' };
  }
  try {
    const url = `https://graph.facebook.com/v21.0/me?fields=id&access_token=${encodeURIComponent(cfg.access_token)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const payload = await r.json();
    if (!r.ok) {
      const msg = payload?.error?.message ?? `HTTP ${r.status}`;
      return { status: 'down', latencyMs: Date.now() - t0, message: msg };
    }
    return {
      status: 'ok',
      latencyMs: Date.now() - t0,
      message: `Graph API OK (id ${payload.id ?? '?'})`,
    };
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : 'Meta no responde',
    };
  }
}

async function checkIssabel(): Promise<CheckResult> {
  const t0 = Date.now();
  const cdrUrl = Deno.env.get('ISSABEL_CDR_URL');
  if (!cdrUrl) {
    return { status: 'unknown', latencyMs: Date.now() - t0, message: 'ISSABEL_CDR_URL no configurada' };
  }
  try {
    const url = new URL(cdrUrl);
    url.searchParams.set('limit', '1');
    const headers = issabelAuthHeaders();
    if (!headers.Authorization) {
      return {
        status: 'unknown',
        latencyMs: Date.now() - t0,
        message: 'ISSABEL_API_TOKEN o ISSABEL_USERNAME/PASSWORD no configurados',
      };
    }
    const r = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(20_000) });
    if (r.status === 401 || r.status === 403) {
      const t = await r.text();
      return {
        status: 'degraded',
        latencyMs: Date.now() - t0,
        message: `Issabel responde pero auth CDR falló (${r.status}): ${t.slice(0, 120)}`,
      };
    }
    if (!r.ok) {
      const t = await r.text();
      return {
        status: 'down',
        latencyMs: Date.now() - t0,
        message: `Issabel HTTP ${r.status}: ${t.slice(0, 120)}`,
      };
    }
    return { status: 'ok', latencyMs: Date.now() - t0, message: 'Issabel CDR responde' };
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : 'Issabel no responde',
    };
  }
}

async function checkStyleDunasoft(admin: ReturnType<typeof createClient>): Promise<CheckResult> {
  const t0 = Date.now();
  const { data: cfg, error: cfgErr } = await admin
    .from('style_reservas_sync_config')
    .select('sync_enabled, company_id, updated_at')
    .limit(1)
    .maybeSingle();
  if (cfgErr) throw cfgErr;
  if (!cfg) {
    return { status: 'unknown', latencyMs: Date.now() - t0, message: 'style_reservas_sync_config vacío' };
  }
  if (!cfg.sync_enabled) {
    return { status: 'unknown', latencyMs: Date.now() - t0, message: 'Sync Style deshabilitado' };
  }

  const { count, error: qErr } = await admin
    .schema('dunasoft')
    .from('style_reservas_queue')
    .select('id', { count: 'exact', head: true })
    .is('delivered_at', null)
    .lt('created_at', new Date(Date.now() - 10 * 60_000).toISOString());
  if (qErr) {
    return {
      status: 'degraded',
      latencyMs: Date.now() - t0,
      message: `Cola Style: ${qErr.message}`,
    };
  }
  const stale = count ?? 0;
  if (stale > 0) {
    return {
      status: 'degraded',
      latencyMs: Date.now() - t0,
      message: `${stale} reserva(s) en cola >10 min sin entregar`,
      details: { stale_queue: stale },
    };
  }
  return {
    status: 'ok',
    latencyMs: Date.now() - t0,
    message: 'Style sync activo, cola OK',
    details: { stale_queue: 0 },
  };
}

async function notifyWahaEvent(
  admin: ReturnType<typeof createClient>,
  settings: MonitorSettings,
  companyId: string,
  waCfg: WhatsappCfg | null,
  event: 'unrecoverable' | 'up',
  message: string,
  details: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let out = { ...details };
  const cooldown = settings.notification_cooldown_minutes;
  const stamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  const bodyText = `[Suite Monitor] WAHA — ${event === 'up' ? 'recuperado' : 'no recuperable'}\n${message}\n${stamp}`;

  // Email solo cuando WAHA no se puede recuperar (contenedor caído o session.start fallido).
  if (event === 'unrecoverable') {
    const key = 'last_email_waha_unrecoverable';
    if (canNotify(out, key, cooldown)) {
      const html = `<p><strong>Suite — Monitor WAHA</strong></p><p>${message.replace(/\n/g, '<br>')}</p><p><small>${stamp}</small></p>`;
      const res = await sendMonitorEmail(
        admin,
        companyId,
        settings.waha_down_email,
        'Suite: WAHA no recuperable',
        html,
      );
      await logNotification(admin, {
        service_key: 'waha',
        channel: 'email',
        destination: settings.waha_down_email,
        subject: 'Suite: WAHA no recuperable',
        body: bodyText,
        success: res.ok,
        error: res.error,
      });
      if (res.ok) out = markNotified(out, key);
      if (res.ok) out = markAlertDown(out);
    }
  }

  // WAHA recuperado → WhatsApp.
  if (event === 'up' && waCfg) {
    const key = 'last_whatsapp_waha_up';
    if (canNotify(out, key, cooldown)) {
      const res = await sendMonitorWhatsapp(waCfg, settings.waha_up_whatsapp, bodyText);
      await logNotification(admin, {
        service_key: 'waha',
        channel: 'whatsapp',
        destination: settings.waha_up_whatsapp,
        body: bodyText,
        success: res.ok,
        error: res.error,
      });
      if (res.ok) out = markNotified(out, key);
      if (res.ok) out = markAlertRecovered(out);
    }
  }

  return out;
}

/** Alertas de otros servicios: WhatsApp si WAHA operativo; si no, email de respaldo. */
async function notifyServiceAlert(
  admin: ReturnType<typeof createClient>,
  settings: MonitorSettings,
  companyId: string,
  waCfg: WhatsappCfg | null,
  wahaUsable: boolean,
  serviceKey: ServiceKey,
  displayName: string,
  message: string,
  details: Record<string, unknown>,
  event: 'down' | 'up' | 'degraded',
): Promise<Record<string, unknown>> {
  let out = { ...details };
  const cooldown = settings.notification_cooldown_minutes;
  const key = `last_alert_${serviceKey}_${event}`;
  if (!canNotify(out, key, cooldown)) return out;

  const stamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  const label =
    event === 'up' ? 'recuperado' : event === 'degraded' ? 'degradado' : 'caído';
  const bodyText = `[Suite Monitor] ${displayName} — ${label}\n${message}\n${stamp}`;

  if (wahaUsable && waCfg) {
    const res = await sendMonitorWhatsapp(waCfg, settings.waha_up_whatsapp, bodyText);
    await logNotification(admin, {
      service_key: serviceKey,
      channel: 'whatsapp',
      destination: settings.waha_up_whatsapp,
      body: bodyText,
      success: res.ok,
      error: res.error,
    });
    if (res.ok) out = markNotified(out, key);
    if (res.ok && event !== 'up') out = markAlertDown(out);
    if (res.ok && event === 'up') out = markAlertRecovered(out);
    return out;
  }

  const html = `<p><strong>Suite — ${displayName}</strong></p><p>${message}</p><p><small>${stamp}</small></p><p><small>(WAHA no disponible; aviso por email)</small></p>`;
  const res = await sendMonitorEmail(
    admin,
    companyId,
    settings.alert_email,
    `Suite: ${displayName} ${label}`,
    html,
  );
  await logNotification(admin, {
    service_key: serviceKey,
    channel: 'email',
    destination: settings.alert_email,
    subject: `Suite: ${displayName} ${label}`,
    body: bodyText,
    success: res.ok,
    error: res.error,
  });
  if (res.ok) out = markNotified(out, key);
  if (res.ok && event !== 'up') out = markAlertDown(out);
  if (res.ok && event === 'up') out = markAlertRecovered(out);
  return out;
}

async function authorizeRequest(
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: true; source: string } | { ok: false; status: number; error: string }> {
  const cronSecret = Deno.env.get('SERVICE_MONITOR_CRON_SECRET');
  const headerSecret = req.headers.get('x-monitor-secret');
  if (cronSecret && headerSecret === cronSecret) {
    return { ok: true, source: 'cron' };
  }

  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!auth) return { ok: false, status: 401, error: 'No autorizado' };

  const token = auth.replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) {
    return { ok: true, source: 'service_role' };
  }

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Token inválido' };

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) return { ok: false, status: 500, error: 'SUPABASE_ANON_KEY no configurada' };
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return { ok: false, status: 500, error: 'SUPABASE_URL no configurada' };
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin');
  if (adminErr || !isAdmin) {
    return { ok: false, status: 403, error: 'Solo administradores' };
  }
  return { ok: true, source: 'ui' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const auth = await authorizeRequest(req, admin);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const settings = await loadSettings(admin);
  if (!settings.enabled && auth.source !== 'ui') {
    return json({ skipped: true, reason: 'monitor_disabled' });
  }

  const companyId = await resolveMonitorCompanyId(admin, settings);
  const waCfg = companyId ? await loadWhatsappCfg(admin, companyId) : null;
  const runRecovery = body.run_recovery !== false;

  const runners: Array<{ key: ServiceKey; name: string; run: () => Promise<CheckResult> }> = [
    { key: 'waha', name: 'WAHA / WhatsApp', run: () => checkWaha(waCfg, runRecovery) },
    { key: 'supabase', name: 'Supabase', run: () => checkSupabase(admin) },
    { key: 'meta', name: 'Meta', run: () => checkMeta(admin, companyId) },
    { key: 'issabel', name: 'Issabel', run: () => checkIssabel() },
    { key: 'style_dunasoft', name: 'Style Dunasoft', run: () => checkStyleDunasoft(admin) },
  ];

  const summary: Record<string, CheckResult & { status_changed?: boolean }> = {};
  let wahaUsable = false;

  for (const item of runners) {
    const prev = await loadPreviousStatus(admin, item.key);
    let result: CheckResult;
    try {
      result = await item.run();
    } catch (e) {
      result = {
        status: 'down',
        latencyMs: 0,
        message: e instanceof Error ? e.message : 'Error en check',
      };
    }

    let details = prev.details;
    const { newDetails, alert } = await persistCheck(
      admin,
      item.key,
      result,
      prev.status,
      details,
      settings,
    );
    details = newDetails;

    if (item.key === 'waha') {
      wahaUsable = result.status !== 'down';

      if (companyId) {
        const unrecoverable =
          result.status === 'down' &&
          (!result.details?.public_ok ||
            (result.recoveryAttempted && result.recoverySuccess === false));

        if (unrecoverable && alert.notifyDown) {
          details = await notifyWahaEvent(
            admin,
            settings,
            companyId,
            waCfg,
            'unrecoverable',
            result.recoveryMessage || result.message,
            details,
          );
        } else if (result.status === 'ok' && alert.notifyRecovery) {
          details = await notifyWahaEvent(
            admin,
            settings,
            companyId,
            waCfg,
            'up',
            result.recoveryMessage || result.message,
            details,
          );
        }
      }
    } else if (companyId) {
      if (alert.notifyDown) {
        details = await notifyServiceAlert(
          admin,
          settings,
          companyId,
          waCfg,
          wahaUsable,
          item.key,
          item.name,
          result.message,
          details,
          'down',
        );
      } else if (alert.notifyDegraded) {
        details = await notifyServiceAlert(
          admin,
          settings,
          companyId,
          waCfg,
          wahaUsable,
          item.key,
          item.name,
          result.message,
          details,
          'degraded',
        );
      } else if (alert.notifyRecovery) {
        details = await notifyServiceAlert(
          admin,
          settings,
          companyId,
          waCfg,
          wahaUsable,
          item.key,
          item.name,
          result.message,
          details,
          'up',
        );
      }
    }

    if (details !== newDetails) {
      await admin.from('suite_service_status').update({ details }).eq('service_key', item.key);
    }

    summary[item.key] = { ...result, status_changed: prev.status !== result.status };
  }

  return json({
    ok: true,
    source: auth.source,
    checked_at: new Date().toISOString(),
    summary,
  });
});
