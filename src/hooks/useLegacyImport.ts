import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type {
  LegacyImportMode,
  LegacyImportRun,
  LegacyImportStatus,
} from '@/lib/legacyImportSteps';
import { legacyImportWorkerCommand } from '@/lib/legacyImportSteps';

type LegacyImportAction =
  | { action: 'getStatus' }
  | { action: 'reset'; scope: 'sales' | 'appointments' | 'all' }
  | {
      action: 'createRun';
      mode: LegacyImportMode;
      options?: Record<string, unknown>;
    }
  | { action: 'getRun'; runId: string }
  | { action: 'listRuns'; limit?: number };

async function invokeLegacyImport<T>(
  body: LegacyImportAction,
  companyId: string | null,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');
  if (!companyId) throw new Error('Empresa activa no definida');

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  if (!baseUrl) throw new Error('Falta VITE_SUPABASE_URL');

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/functions/v1/legacy-import`;
  const payload = { ...body, companyId };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red';
    throw new Error(`No se pudo contactar legacy-import: ${msg}`);
  }

  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    data = { error: text || res.statusText };
  }

  if (!res.ok) {
    const serverMessage =
      data && typeof data.error === 'string'
        ? data.error
        : `HTTP ${res.status}`;
    throw new Error(serverMessage);
  }

  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function useLegacyImport() {
  const { companyId } = useCompanyFilter();
  const [status, setStatus] = useState<LegacyImportStatus | null>(null);
  const [runs, setRuns] = useState<LegacyImportRun[]>([]);
  const [activeRun, setActiveRun] = useState<LegacyImportRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [statusRes, runsRes] = await Promise.all([
        invokeLegacyImport<{ status: LegacyImportStatus }>({ action: 'getStatus' }, companyId),
        invokeLegacyImport<{ runs: LegacyImportRun[] }>({ action: 'listRuns', limit: 5 }, companyId),
      ]);
      setStatus(statusRes.status);
      setRuns(runsRes.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar estado');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const resetLegacy = useCallback(
    async (scope: 'sales' | 'appointments' | 'all') => {
      setBusy(true);
      setError(null);
      try {
        await invokeLegacyImport<{ result: unknown }>({ action: 'reset', scope }, companyId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al borrar datos legacy');
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [companyId, refresh],
  );

  const createRun = useCallback(
    async (
      mode: LegacyImportMode,
      options?: Record<string, unknown>,
    ): Promise<{ runId: string; workerCommand: string }> => {
      setBusy(true);
      setError(null);
      try {
        const res = await invokeLegacyImport<{
          run: { id: string };
          workerCommand: string;
        }>({ action: 'createRun', mode, options }, companyId);
        await refresh();
        return {
          runId: res.run.id,
          workerCommand: res.workerCommand || legacyImportWorkerCommand(res.run.id),
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear ejecución');
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [companyId, refresh],
  );

  const pollRun = useCallback(
    async (runId: string) => {
      const res = await invokeLegacyImport<{ run: LegacyImportRun }>(
        { action: 'getRun', runId },
        companyId,
      );
      setActiveRun(res.run);
      if (res.run.status === 'completed' || res.run.status === 'failed') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        await refresh();
      }
    },
    [companyId, refresh],
  );

  const startPolling = useCallback(
    (runId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      void pollRun(runId);
      pollRef.current = setInterval(() => void pollRun(runId), 3000);
    },
    [pollRun],
  );

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  return {
    status,
    runs,
    activeRun,
    loading,
    busy,
    error,
    refresh,
    resetLegacy,
    createRun,
    startPolling,
    setActiveRun,
  };
}
