import { inngest } from './client.js';

const supabaseUrl = () =>
  (process.env.SUITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://supabase.lipoout.com').replace(
    /\/+$/,
    '',
  );

async function invokeEdgeFunction(name: string, body: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  text: string;
}> {
  const secret = process.env.SERVICE_MONITOR_CRON_SECRET || process.env.SUITE_JOBS_CRON_SECRET || '';
  const url = `${supabaseUrl()}/functions/v1/${name}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    headers['x-monitor-secret'] = secret;
    headers['x-cron-secret'] = secret;
  }
  const anon = process.env.SUITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (anon) headers.Authorization = `Bearer ${anon}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text: text.slice(0, 2000) };
}

/** Ping de humo para verificar sync Inngest ↔ suite-jobs. */
export const ping = inngest.createFunction(
  { id: 'suite-ping', name: 'Suite ping' },
  { event: 'suite/ping' },
  async ({ event, step }) => {
    const at = await step.run('stamp', async () => new Date().toISOString());
    return { ok: true, at, payload: event.data ?? {} };
  },
);

/**
 * Cron: monitor de servicios (Edge Function service-health-monitor).
 * Sustituye/refuerza crons ad-hoc con reintentos durables de Inngest.
 */
export const serviceHealthCron = inngest.createFunction(
  { id: 'suite-service-health-cron', name: 'Service health monitor (cron)' },
  { cron: process.env.SUITE_HEALTH_CRON || '*/5 * * * *' },
  async ({ step }) => {
    const result = await step.run('invoke-service-health-monitor', async () =>
      invokeEdgeFunction('service-health-monitor', {
        source: 'cron',
        run_recovery: true,
      }),
    );
    if (!result.ok) {
      throw new Error(`service-health-monitor HTTP ${result.status}: ${result.text}`);
    }
    return result;
  },
);

/**
 * Cron opcional: cola WhatsApp marketing (si la función está desplegada).
 * Desactivar con SUITE_WA_QUEUE_CRON=off
 */
export const marketingWhatsappQueueCron = inngest.createFunction(
  {
    id: 'suite-marketing-whatsapp-queue-cron',
    name: 'Marketing WhatsApp queue (cron)',
  },
  { cron: process.env.SUITE_WA_QUEUE_CRON || '*/10 * * * *' },
  async ({ step }) => {
    if ((process.env.SUITE_WA_QUEUE_CRON || '').toLowerCase() === 'off') {
      return { skipped: true };
    }
    const result = await step.run('invoke-marketing-whatsapp-queue', async () =>
      invokeEdgeFunction('marketing-whatsapp-queue', { source: 'cron' }),
    );
    // 404 = función no desplegada / no usada → no fallar el run
    if (!result.ok && result.status !== 404) {
      throw new Error(`marketing-whatsapp-queue HTTP ${result.status}: ${result.text}`);
    }
    return result;
  },
);

export const functions = [ping, serviceHealthCron, marketingWhatsappQueueCron];
