import { supabase } from '@/lib/supabase';

/** PostgREST sobre schema `dunasoft` reutilizando la misma sesión Auth (un solo GoTrueClient). */
export const dunasoftSupabase = supabase.schema('dunasoft');
