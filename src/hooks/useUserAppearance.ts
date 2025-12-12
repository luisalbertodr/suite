
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Use localStorage instead of a non-existent database table
const STORAGE_KEY = 'user_appearance_preferences';

interface UserAppearancePreferences {
  sidebar_color: string;
  logo_url?: string | null;
}

const getStoredPreferences = (userId: string): UserAppearancePreferences | null => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setStoredPreferences = (userId: string, prefs: UserAppearancePreferences) => {
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(prefs));
};

export const useUserAppearance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebarColor, setSidebarColor] = useState<string>('blue');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user preferences on init
  useEffect(() => {
    const loadUserPreferences = () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const prefs = getStoredPreferences(user.id);
        if (prefs) {
          setSidebarColor(prefs.sidebar_color || 'blue');
          setLogoUrl(prefs.logo_url || null);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserPreferences();
  }, [user]);

  // Update sidebar color
  const updateSidebarColor = async (newColor: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado para cambiar las preferencias",
        variant: "destructive"
      });
      return;
    }

    try {
      setStoredPreferences(user.id, {
        sidebar_color: newColor,
        logo_url: logoUrl,
      });

      setSidebarColor(newColor);
      toast({
        title: "Preferencias guardadas",
        description: "El color del sidebar ha sido actualizado correctamente"
      });
    } catch (error) {
      console.error('Error updating sidebar color:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la preferencia de color",
        variant: "destructive"
      });
    }
  };

  // Update logo (store in localStorage as base64 or URL)
  const updateLogo = async (file: File) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado para subir un logo",
        variant: "destructive"
      });
      return;
    }

    try {
      // Convert to base64 for localStorage storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setStoredPreferences(user.id, {
          sidebar_color: sidebarColor,
          logo_url: base64,
        });
        setLogoUrl(base64);
        toast({
          title: "Logo actualizado",
          description: "El logo ha sido subido correctamente"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error updating logo:', error);
      toast({
        title: "Error",
        description: "No se pudo subir el logo",
        variant: "destructive"
      });
    }
  };

  // Remove logo
  const removeLogo = async () => {
    if (!user) return;

    try {
      setStoredPreferences(user.id, {
        sidebar_color: sidebarColor,
        logo_url: null,
      });

      setLogoUrl(null);
      toast({
        title: "Logo eliminado",
        description: "El logo ha sido eliminado correctamente"
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el logo",
        variant: "destructive"
      });
    }
  };

  return {
    sidebarColor,
    logoUrl,
    updateSidebarColor,
    updateLogo,
    removeLogo,
    loading
  };
};
