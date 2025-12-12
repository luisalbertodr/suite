// Cliente de Supabase con soporte multi-entorno (Cloud/Local)
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getActiveConfig, getActiveEnvironment, setActiveEnvironment, SUPABASE_ENVIRONMENTS } from '@/config/supabase-environments';

// Obtener configuración inicial
const initialConfig = getActiveConfig();

// Crear cliente inicial
let supabaseInstance: SupabaseClient<Database> = createClient<Database>(
  initialConfig.url,
  initialConfig.anonKey
);

// Export del cliente de Supabase
export const supabase = supabaseInstance;

// Función para recrear el cliente con nuevo entorno
export const switchSupabaseEnvironment = (env: 'cloud' | 'local'): void => {
  setActiveEnvironment(env);
  const config = SUPABASE_ENVIRONMENTS[env];
  supabaseInstance = createClient<Database>(config.url, config.anonKey);
  // Recargar la página para aplicar el nuevo cliente
  window.location.reload();
};

// Función para obtener el entorno actual
export const getCurrentEnvironment = getActiveEnvironment;
