import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadEmailConfig, sendOutgoingEmail } from './emailSender.ts';

export type MonitorSettings = {
  enabled: boolean;
  check_interval_seconds: number;
  monitor_company_id: string | null;
  alert_email: string;
  waha_down_email: string;
  waha_up_whatsapp: string;
  notification_cooldown_minutes: number;
  failures_before_alert: number;
  successes_before_recovery: number;
};

export type WhatsappCfg = {
  company_id: string;
  base_url: string;
  api_key: string;
  session_name: string;
  default_country_code: string | null;
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function normalizeWhatsappDestination(raw: string, country = '34'): string {
  let s = String(raw ?? '').trim().replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.length <= 9) s = `${country}${s}`;
  return `${s}@c.us`;
}

async function wahaFetch(cfg: WhatsappCfg, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Api-Key', cfg.api_key);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${trimSlash(cfg.base_url)}${path}`, { ...init, headers });
}

export async function sendMonitorWhatsapp(
  cfg: WhatsappCfg,
  destination: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const chatId = destination.includes('@') ? destination : normalizeWhatsappDestination(destination);
    const resp = await wahaFetch(cfg, '/api/sendText', {
      method: 'POST',
      body: JSON.stringify({
        session: cfg.session_name || 'default',
        chatId,
        text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendMonitorEmail(
  admin: SupabaseClient,
  companyId: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cfg = await loadEmailConfig(admin, companyId);
    if (!cfg) {
      return { ok: false, error: 'Email SMTP/Resend no configurado' };
    }
    const result = await sendOutgoingEmail(cfg, { to, subject, html });
    if (!result.ok) return result;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function logNotification(
  admin: SupabaseClient,
  row: {
    service_key: string | null;
    channel: 'email' | 'whatsapp';
    destination: string;
    subject?: string;
    body: string;
    success: boolean;
    error?: string;
  },
): Promise<void> {
  await admin.from('suite_service_notifications').insert({
    service_key: row.service_key,
    channel: row.channel,
    destination: row.destination,
    subject: row.subject ?? null,
    body: row.body,
    success: row.success,
    error: row.error ?? null,
  });
}

export async function resolveMonitorCompanyId(
  admin: SupabaseClient,
  settings: MonitorSettings,
): Promise<string | null> {
  if (settings.monitor_company_id) return settings.monitor_company_id;

  const { data: wa } = await admin
    .from('whatsapp_config')
    .select('company_id')
    .eq('enabled', true)
    .not('base_url', 'is', null)
    .limit(1)
    .maybeSingle();
  if (wa?.company_id) return wa.company_id;

  const { data: co } = await admin.from('companies').select('id').limit(1).maybeSingle();
  return co?.id ?? null;
}

export async function loadWhatsappCfg(
  admin: SupabaseClient,
  companyId: string,
): Promise<WhatsappCfg | null> {
  const { data, error } = await admin
    .from('whatsapp_config')
    .select('company_id, base_url, api_key, session_name, default_country_code')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error || !data?.base_url || !data?.api_key) return null;
  return data as WhatsappCfg;
}

export function canNotify(
  details: Record<string, unknown>,
  key: string,
  cooldownMinutes: number,
): boolean {
  const last = details[key];
  if (typeof last !== 'string') return true;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= cooldownMinutes * 60_000;
}

export function markNotified(details: Record<string, unknown>, key: string): Record<string, unknown> {
  return { ...details, [key]: new Date().toISOString() };
}
