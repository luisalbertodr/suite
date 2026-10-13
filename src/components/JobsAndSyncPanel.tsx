import React, { useEffect, useState } from 'react';
import { Activity, DatabaseZap, ExternalLink, Workflow } from 'lucide-react';
import { getInngestUiUrl, getSuiteJobsHealthUrl, isInngestConfigured } from '@/lib/inngestJobs';
import { isElectricProxyConfigured } from '@/lib/electricSync';
import { useElectricServiceStatus } from '@/hooks/useElectricServiceStatus';
import { cn } from '@/lib/utils';

type Health = { ok: boolean; detail: string };

async function probe(url: string): Promise<Health> {
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const text = await res.text();
    return { ok: res.ok, detail: `${res.status} ${text.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export const JobsAndSyncPanel: React.FC<{ className?: string }> = ({ className }) => {
  const inngestUi = getInngestUiUrl();
  const jobsHealth = getSuiteJobsHealthUrl();
  const inngestOn = isInngestConfigured();
  const electricOn = isElectricProxyConfigured();
  const live = useElectricServiceStatus(true);
  const [jobs, setJobs] = useState<Health | null>(null);

  useEffect(() => {
    if (!jobsHealth) return;
    void probe(jobsHealth).then(setJobs);
  }, [jobsHealth]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <section className="rounded-lg border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Workflow className="h-4 w-4 text-sky-500" />
          F5 · Jobs (Inngest)
        </div>
        {!inngestOn ? (
          <p className="text-xs text-muted-foreground">
            Configura <code className="text-[10px]">VITE_INNGEST_UI_URL</code> y/o{' '}
            <code className="text-[10px]">VITE_SUITE_JOBS_HEALTH_URL</code>, y despliega el stack con{' '}
            <code className="text-[10px]">scripts/setup-inngest-portainer-stack.py</code> en el 110.
          </p>
        ) : (
          <div className="space-y-2 text-xs text-muted-foreground">
            {jobsHealth ? (
              <p>
                suite-jobs:{' '}
                <span className={jobs?.ok ? 'text-emerald-600' : 'text-amber-700'}>
                  {jobs ? jobs.detail : 'comprobando…'}
                </span>
              </p>
            ) : null}
            <p>
              Crons: monitor de servicios cada 5 min · cola WhatsApp marketing (off por defecto).
            </p>
            {inngestUi ? (
              <a
                href={inngestUi}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 hover:underline"
              >
                Abrir dashboard Inngest <ExternalLink className="h-3 w-3" />
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
          Piloto: <code className="text-[10px]">suite_service_status</code> vía shape proxy autenticado.
          Modo: <strong className="text-foreground">{live.mode}</strong>
          {live.error ? ` · ${live.error}` : ''}
        </p>
        {!electricOn ? (
          <p className="text-xs text-muted-foreground">
            Despliega Electric con <code className="text-[10px]">scripts/setup-electric-portainer-stack.py</code>{' '}
            y la Edge Function <code className="text-[10px]">electric-shape-proxy</code>.
          </p>
        ) : live.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin filas aún (o Electric no alcanza el shape).</p>
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
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
