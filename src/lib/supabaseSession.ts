import { supabase } from '@/lib/supabase';

/** Token JWT válido; intenta refresh si la sesión en caché expiró. */
export async function getSupabaseAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const { error } = await supabase.auth.getUser();
    if (!error) return session.access_token;
  }
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr || !refreshed.session?.access_token) {
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }
  return refreshed.session.access_token;
}
