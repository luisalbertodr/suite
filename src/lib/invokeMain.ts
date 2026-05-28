import { supabase } from '@/lib/supabase';

function isSuperuserPanelSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('superuser_session') === 'true';
}

/** Invoca la edge function `main` conservando el body JSON en errores 4xx/5xx. */
export async function invokeMain(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

  if (!baseUrl || !anonKey) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  }

  const payload = isSuperuserPanelSession()
    ? { ...body, isSuperuser: true }
    : body;

  const { data: { session } } = await supabase.auth.getSession();
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/functions/v1/main`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session?.access_token ?? anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.error || `Error HTTP ${response.status}`));
  }

  return result ?? {};
}
