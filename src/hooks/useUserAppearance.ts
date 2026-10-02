import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'user_appearance_preferences';

export type AppearanceTheme = 'light' | 'dark' | 'system';

export interface UserAppearancePreferences {
  sidebar_color: string;
  theme: AppearanceTheme;
  logo_url?: string | null;
}

const DEFAULT_PREFS: UserAppearancePreferences = {
  sidebar_color: 'blue',
  theme: 'light',
  logo_url: null,
};

const getLocalPreferences = (userId: string): UserAppearancePreferences | null => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<UserAppearancePreferences>;
    return {
      sidebar_color: parsed.sidebar_color || DEFAULT_PREFS.sidebar_color,
      theme: (parsed.theme as AppearanceTheme) || DEFAULT_PREFS.theme,
      logo_url: parsed.logo_url ?? null,
    };
  } catch {
    return null;
  }
};

const setLocalPreferences = (userId: string, prefs: UserAppearancePreferences) => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
};

async function persistToDb(userId: string, prefs: UserAppearancePreferences) {
  const payload = {
    user_id: userId,
    sidebar_color: prefs.sidebar_color,
    theme: prefs.theme,
    logo_url: prefs.logo_url ?? null,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase
    .from('user_appearance_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error && /theme/i.test(error.message || '')) {
    const { theme: _theme, ...withoutTheme } = payload;
    ({ error } = await supabase
      .from('user_appearance_preferences')
      .upsert(withoutTheme, { onConflict: 'user_id' }));
  }
  return error;
}

function normalizeTheme(value: string | null | undefined): AppearanceTheme {
  if (value === 'dark' || value === 'system' || value === 'light') return value;
  return 'light';
}

export type UseUserAppearanceOptions = {
  /** Si se indica, carga/guarda preferencias de ese usuario (p. ej. edición admin). */
  userId?: string | null;
  /** Si false, no aplica el tema al ThemeProvider (útil al editar a otro usuario). */
  applyTheme?: boolean;
  /** Mostrar toasts al guardar. Por defecto true. */
  showToasts?: boolean;
};

export const useUserAppearance = (options: UseUserAppearanceOptions = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const targetUserId = options.userId ?? user?.id ?? null;
  const applyTheme = options.applyTheme ?? !options.userId;
  const showToasts = options.showToasts ?? true;

  const [sidebarColor, setSidebarColor] = useState<string>(DEFAULT_PREFS.sidebar_color);
  const [themePreference, setThemePreference] = useState<AppearanceTheme>(DEFAULT_PREFS.theme);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback(
    async (prefs: UserAppearancePreferences, successMessage?: string) => {
      if (!targetUserId) {
        if (showToasts) {
          toast({
            title: 'Error',
            description: 'Debes estar autenticado para cambiar las preferencias',
            variant: 'destructive',
          });
        }
        return false;
      }

      setLocalPreferences(targetUserId, prefs);

      const error = await persistToDb(targetUserId, prefs);

      if (error) {
        console.error('Error saving appearance preferences:', error);
        if (showToasts) {
          toast({
            title: 'Error',
            description: 'No se pudo guardar la preferencia de apariencia',
            variant: 'destructive',
          });
        }
        return false;
      }

      if (showToasts && successMessage) {
        toast({
          title: 'Preferencias guardadas',
          description: successMessage,
        });
      }
      return true;
    },
    [showToasts, targetUserId, toast],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const local = getLocalPreferences(targetUserId);

        let data: { sidebar_color: string; theme?: string | null; logo_url?: string | null } | null = null;
        let error: { message?: string } | null = null;

        {
          const res = await supabase
            .from('user_appearance_preferences')
            .select('sidebar_color, theme, logo_url')
            .eq('user_id', targetUserId)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        // Compatibilidad si la columna theme aún no está migrada en prod.
        if (error && /theme/i.test(error.message || '')) {
          const res = await supabase
            .from('user_appearance_preferences')
            .select('sidebar_color, logo_url')
            .eq('user_id', targetUserId)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        if (cancelled) return;

        if (error) {
          console.error('Error loading appearance preferences:', error);
          if (local) {
            setSidebarColor(local.sidebar_color);
            setThemePreference(local.theme);
            setLogoUrl(local.logo_url ?? null);
            if (applyTheme) setTheme(local.theme);
          }
          return;
        }

        if (data) {
          const prefs: UserAppearancePreferences = {
            sidebar_color: data.sidebar_color || DEFAULT_PREFS.sidebar_color,
            theme: normalizeTheme(data.theme),
            logo_url: data.logo_url ?? null,
          };
          setSidebarColor(prefs.sidebar_color);
          setThemePreference(prefs.theme);
          setLogoUrl(prefs.logo_url ?? null);
          setLocalPreferences(targetUserId, prefs);
          if (applyTheme) setTheme(prefs.theme);
        } else if (local) {
          setSidebarColor(local.sidebar_color);
          setThemePreference(local.theme);
          setLogoUrl(local.logo_url ?? null);
          if (applyTheme) setTheme(local.theme);
          // Migrar localStorage → DB
          await persistToDb(targetUserId, local);
        } else if (applyTheme) {
          setTheme(DEFAULT_PREFS.theme);
        }
      } catch (err) {
        console.error('Error loading user preferences:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyTheme, setTheme, targetUserId]);

  const updateSidebarColor = async (newColor: string) => {
    const next: UserAppearancePreferences = {
      sidebar_color: newColor,
      theme: themePreference,
      logo_url: logoUrl,
    };
    const ok = await persist(next, 'El color del sidebar ha sido actualizado correctamente');
    if (ok) setSidebarColor(newColor);
  };

  const updateThemePreference = async (newTheme: AppearanceTheme) => {
    const next: UserAppearancePreferences = {
      sidebar_color: sidebarColor,
      theme: newTheme,
      logo_url: logoUrl,
    };
    const ok = await persist(next, 'El tema de la interfaz ha sido actualizado');
    if (ok) {
      setThemePreference(newTheme);
      if (applyTheme) setTheme(newTheme);
    }
  };

  const updateLogo = async (file: File) => {
    if (!targetUserId) {
      if (showToasts) {
        toast({
          title: 'Error',
          description: 'Debes estar autenticado para subir un logo',
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const next: UserAppearancePreferences = {
          sidebar_color: sidebarColor,
          theme: themePreference,
          logo_url: base64,
        };
        const ok = await persist(next, 'El logo ha sido subido correctamente');
        if (ok) setLogoUrl(base64);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error updating logo:', error);
      if (showToasts) {
        toast({
          title: 'Error',
          description: 'No se pudo subir el logo',
          variant: 'destructive',
        });
      }
    }
  };

  const removeLogo = async () => {
    if (!targetUserId) return;
    const next: UserAppearancePreferences = {
      sidebar_color: sidebarColor,
      theme: themePreference,
      logo_url: null,
    };
    const ok = await persist(next, 'El logo ha sido eliminado correctamente');
    if (ok) setLogoUrl(null);
  };

  return {
    sidebarColor,
    themePreference,
    logoUrl,
    updateSidebarColor,
    updateThemePreference,
    updateLogo,
    removeLogo,
    loading,
    targetUserId,
  };
};
