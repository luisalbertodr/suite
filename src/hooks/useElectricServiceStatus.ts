import { useEffect, useState } from 'react';
import { ShapeStream, Shape } from '@electric-sql/client';
import { useAuth } from '@/hooks/useAuth';
import { getElectricProxyUrl, type ServiceStatusRow } from '@/lib/electricSync';
import { supabase } from '@/lib/supabase';

type State = {
  rows: ServiceStatusRow[];
  mode: 'electric' | 'supabase' | 'idle' | 'error';
  error?: string;
};

/**
 * F6 piloto: sync live de suite_service_status vía Electric shape proxy.
 * Fallback a lectura Supabase si Electric no responde.
 */
export function useElectricServiceStatus(enabled = true): State {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ rows: [], mode: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const loadFallback = async () => {
      const { data, error } = await supabase
        .from('suite_service_status')
        .select('service_key, status, last_error, updated_at, latency_ms')
        .order('service_key');
      if (cancelled) return;
      if (error) {
        setState({ rows: [], mode: 'error', error: error.message });
        return;
      }
      setState({ rows: (data || []) as ServiceStatusRow[], mode: 'supabase' });
    };

    const startElectric = async () => {
      const proxy = getElectricProxyUrl();
      const token = session?.access_token;
      if (!proxy || !token) {
        await loadFallback();
        return;
      }

      try {
        const stream = new ShapeStream({
          url: proxy,
          params: { table: 'suite_service_status' },
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '',
          },
        });
        const shape = new Shape(stream);
        cleanup = shape.subscribe(({ rows }) => {
          if (cancelled) return;
          const mapped = (rows as Record<string, unknown>[]).map((r) => ({
            service_key: String(r.service_key ?? ''),
            status: String(r.status ?? 'unknown'),
            last_error: (r.last_error as string | null) ?? null,
            updated_at: (r.updated_at as string | null) ?? null,
            latency_ms: typeof r.latency_ms === 'number' ? r.latency_ms : null,
          }));
          setState({ rows: mapped, mode: 'electric' });
        });
        // Si no hay datos en unos segundos, fallback
        window.setTimeout(() => {
          if (!cancelled) {
            setState((prev) => {
              if (prev.mode === 'electric' && prev.rows.length > 0) return prev;
              void loadFallback();
              return prev;
            });
          }
        }, 4000);
      } catch (e) {
        if (!cancelled) {
          setState({
            rows: [],
            mode: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
          await loadFallback();
        }
      }
    };

    void startElectric();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enabled, session?.access_token]);

  return state;
}
