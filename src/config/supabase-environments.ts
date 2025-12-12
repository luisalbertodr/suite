// Configuración de entornos de Supabase
// Este archivo permite cambiar fácilmente entre Cloud y Local

export const SUPABASE_ENVIRONMENTS = {
  cloud: {
    projectId: "kztelbnarzrpbjlqastg",
    url: "https://kztelbnarzrpbjlqastg.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dGVsYm5hcnpycGJqbHFhc3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjcxNjEsImV4cCI6MjA2NDYwMzE2MX0.0jdEKfZgKsAqmZUWhhFqhZMWXYK-R8AABzwEQMgGjvU",
  },
  local: {
    projectId: "lipoout",
    url: "https://supabase.lipoout.com",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjc4ODg2NDAwLCJleHAiOjE3OTk1MzU2MDB9.fHmgj0NPdMpBwNnHUeHElnXo08u6j9tUy8rGlDq6XzA",
    serviceRoleKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2Nzg4ODY0MDAsImV4cCI6MTc5OTUzNTYwMH0.T_fOOOaoiFAyTLDkSCoaGwxy7TjlacSHJn2aZyCFP0M",
  }
} as const;

// Entorno por defecto (Cloud)
export const DEFAULT_ENVIRONMENT = 'cloud' as const;

// Clave para localStorage
export const ENVIRONMENT_STORAGE_KEY = 'supabase_environment';

// Obtener entorno activo desde localStorage o usar el por defecto
export const getActiveEnvironment = (): 'cloud' | 'local' => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ENVIRONMENT_STORAGE_KEY);
    if (stored === 'cloud' || stored === 'local') {
      return stored;
    }
  }
  return DEFAULT_ENVIRONMENT;
};

// Guardar entorno en localStorage
export const setActiveEnvironment = (env: 'cloud' | 'local'): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ENVIRONMENT_STORAGE_KEY, env);
  }
};

// Obtener configuración del entorno activo
export const getActiveConfig = () => {
  const env = getActiveEnvironment();
  return SUPABASE_ENVIRONMENTS[env];
};
