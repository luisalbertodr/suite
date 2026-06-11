import { createClient } from '@supabase/supabase-js';
import { processLock, type LockFunc } from '@supabase/auth-js';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (o VITE_SUPABASE_PUBLISHABLE_KEY). Crea un archivo .env en la raíz del proyecto (puedes partir de .env.example).'
  );
}

/**
 * supabase-js 2.103 no reenvía auth.lockAcquireTimeout a GoTrueClient (queda en 5000 ms).
 * Cola en proceso sin timeout para evitar abortos en login + carga de empresas.
 */
const suiteAuthLock: LockFunc = (name, _acquireTimeout, fn) => processLock(name, -1, fn);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: suiteAuthLock,
  },
});
