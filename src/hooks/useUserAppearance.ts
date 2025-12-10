
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserAppearancePreferences {
  id?: string;
  user_id: string;
  sidebar_color: string;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const useUserAppearance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebarColor, setSidebarColor] = useState<string>('blue');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar preferencias del usuario al iniciar
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_appearance_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading user preferences:', error);
        } else if (data) {
          setSidebarColor(data.sidebar_color);
          setLogoUrl((data as any).logo_url || null);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserPreferences();
  }, [user]);

  // Función para actualizar el color del sidebar
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
      const { error } = await supabase
        .from('user_appearance_preferences')
        .upsert({
          user_id: user.id,
          sidebar_color: newColor,
          logo_url: logoUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

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

  // Función para actualizar el logo
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
      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Update preferences
      const { error } = await supabase
        .from('user_appearance_preferences')
        .upsert({
          user_id: user.id,
          sidebar_color: sidebarColor,
          logo_url: publicUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      setLogoUrl(publicUrl);
      toast({
        title: "Logo actualizado",
        description: "El logo ha sido subido correctamente"
      });
    } catch (error) {
      console.error('Error updating logo:', error);
      toast({
        title: "Error",
        description: "No se pudo subir el logo",
        variant: "destructive"
      });
    }
  };

  // Función para eliminar el logo
  const removeLogo = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_appearance_preferences')
        .upsert({
          user_id: user.id,
          sidebar_color: sidebarColor,
          logo_url: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

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
