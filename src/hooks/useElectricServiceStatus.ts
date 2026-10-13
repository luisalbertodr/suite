import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getElectricProxyUrl, type ServiceStatusRow } from '@/lib/electricSync';
import { supabase } from '@/lib/supabase';

type State = {
  rows: ServiceStatusRow[];
  mode: 'electric' | 'supabase' | 'idle' | 'error';
  error?: string;
};

/**
 * F6 piloto: lee suite_service_status.
 * Intenta shape proxy Electric (sin @electric-sql/client: evita lookbehind en bundle legacy Safari).
 * Fallback: Supabase REST.
 */
export function useElectricServiceStatus(enabled = true): State {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ rows: [], mode: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const mapRows = (data: Record<string, unknown>[]): ServiceStatusRow[] =>
      data.map((r) => ({
        service_key: String(r.service_key ?? ''),
        status: String(r.status ?? 'unknown'),
        last_error: (r.last_error as string | null) ?? null,
        updated_at: (r.updated_at as string | null) ?? null,
        latency_ms: typeof r.latency_ms === 'number' ? r.latency_ms : null,
      }));

    const loadSupabase = async () => {
      const { data, error } = await supabase
        .from('suite_service_status')
        .select('service_key, status, last_error, updated_at, latency_ms')
        .order('service_key');
      if (cancelled) return;
      if (error) {
        setState({ rows: [], mode: 'error', error: error.message });
        return;
      }
      setState({ rows: mapRows((data || []) as Record<string, unknown>[]), mode: 'supabase' });
    };

    const tryElectricSnapshot = async () => {
      const proxy = getElectricProxyUrl();
      const token = session?.access_token;
      if (!proxy || !token) {
        await loadSupabase();
        return;
      }
      try {
        const url = new URL(proxy);
        url.searchParams.set('table', 'suite_service_status');
        url.searchParams.set('offset', '-1');
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '',
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          await loadSupabase();
          return;
        }
        const payload = (await res.json()) as unknown;
        // Shape protocol: array of messages; extract insert/update values
        const rows: Record<string, unknown>[] = [];
        const list = Array.isArray(payload) ? payload : [];
        for (const msg of list) {
          if (!msg || typeof msg !== 'object') continue;
          const m = msg as { headers?: { operation?: string }; value?: Record<string, unknown> };
          if (m.value && (m.headers?.operation === 'insert' || m.headers?.operation === 'update' || !m.headers?.operation)) {
            rows.push(m.value);
          }
        }
        if (cancelled) return;
        if (rows.length === 0) {
          await loadSupabase();
          return;
        }
        // Dedupe by service_key (last wins)
        const byKey = new Map<string, Record<string, unknown>>();
        for (const r of rows) {
          const k = String(r.service_key ?? '');
          if (k) byKey.set(k, r);
        }
        setState({ rows: mapRows([...byKey.values()]), mode: 'electric' });
      } catch (e) {
        if (!cancelled) {
          setState({
            rows: [],
            mode: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
          await loadSupabase();
        }
      }
    };

    void tryElectricSnapshot();
    const id = window.setInterval(() => void tryElectricSnapshot(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, session?.access_token]);

  return state;
}
