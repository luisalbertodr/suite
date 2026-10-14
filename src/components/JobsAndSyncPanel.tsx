import React, { useCallback, useEffect, useState } from 'react';
import { Activity, DatabaseZap, ExternalLink, RefreshCw, Workflow } from 'lucide-react';
import { getInngestUiUrl, getSuiteJobsHealthUrl, isInngestConfigured } from '@/lib/inngestJobs';
import { getElectricProxyUrl, isElectricProxyConfigured } from '@/lib/electricSync';
import { useElectricServiceStatus } from '@/hooks/useElectricServiceStatus';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Health = { ok: boolean; detail: string; functions?: number };

async function probeJobs(url: string): Promise<Health> {
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const text = await res.text();
    let functions: number | undefined;
    try {
      const j = JSON.parse(text) as { functionCount?: number };
      if (typeof j.functionCount === 'number') functions = j.functionCount;
    } catch {
      /* plain text */
    }
    return { ok: res.ok, detail: `${res.status}`, functions };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function probeElectricProxy(
  proxyUrl: string,
  token: string | undefined,
): Promise<Health> {
  if (!token) return { ok: false, detail: 'sin sesión' };
  try {
    const url = new URL(proxyUrl);
    url.searchParams.set('table', 'suite_service_status');
    url.searchParams.set('offset', '-1');
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '',
        Accept: 'application/json',
      },
    });
    return {
      ok: res.ok || res.status === 200,
      detail: `proxy ${res.status}`,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export const JobsAndSyncPanel: React.FC<{ className?: string }> = ({ className }) => {
  const { session } = useAuth();
  const inngestUi = getInngestUiUrl();
  const jobsHealth = getSuiteJobsHealthUrl();
  const inngestOn = isInngestConfigured();
  const electricOn = isElectricProxyConfigured();
  const electricProxy = getElectricProxyUrl();
  const live = useElectricServiceStatus(true);
  const [jobs, setJobs] = useState<Health | null>(null);
  const [electricProbe, setElectricProbe] = useState<Health | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (jobsHealth) setJobs(await probeJobs(jobsHealth));
      if (electricProxy) {
        setElectricProbe(await probeElectricProxy(electricProxy, session?.access_token));
      }
    } finally {
      setRefreshing(false);
    }
  }, [jobsHealth, electricProxy, session?.access_token]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <section className="rounded-lg border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Workflow className="h-4 w-4 text-sky-500" />
          F5 · Jobs (Inngest)
        </div>
        {!inngestOn ? (
          <p className="text-xs text-muted-foreground">
            Configura <code className="text-[10px]">VITE_INNGEST_UI_URL</code> y{' '}
            <code className="text-[10px]">VITE_SUITE_JOBS_HEALTH_URL</code>.
          </p>
        ) : (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              suite-jobs:{' '}
              <span className={jobs?.ok ? 'text-emerald-600' : 'text-amber-700'}>
                {jobs ? `${jobs.detail}${jobs.functions != null ? ` · ${jobs.functions} funciones` : ''}` : '…'}
              </span>
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>Cron monitor de servicios (cada 5 min)</li>
              <li>Ping de humo (<code className="text-[10px]">suite/ping</code>)</li>
              <li>Cola WhatsApp marketing (off por defecto)</li>
            </ul>
            {inngestUi ? (
              <a
                href={inngestUi}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 hover:underline"
              >
                Dashboard Inngest <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <DatabaseZap className="h-4 w-4 text-violet-500" />
          F6 · Sync (ElectricSQL)
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Proxy:{' '}
          <span className={electricProbe?.ok ? 'text-emerald-600' : 'text-amber-700'}>
            {electricProbe?.detail ?? '…'}
          </span>
          {' · '}
          datos: <strong className="text-foreground">{live.mode}</strong>
          {live.error ? ` · ${live.error}` : ''}
        </p>
        {!electricOn ? (
          <p className="text-xs text-muted-foreground">
            Despliega Electric + Edge Function <code className="text-[10px]">electric-shape-proxy</code>.
          </p>
        ) : live.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin filas de monitor aún.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-auto text-xs">
            {live.rows.map((row) => (
              <li
                key={row.service_key}
                className="flex items-center justify-between gap-2 rounded border border-border/40 px-2 py-1"
              >
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  {row.service_key}
                </span>
                <span
                  className={
                    row.status === 'ok'
                      ? 'text-emerald-600'
                      : row.status === 'down'
                        ? 'text-destructive'
                        : 'text-amber-700'
                  }
                >
                  {row.status}
                  {row.latency_ms != null ? ` · ${row.latency_ms}ms` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
