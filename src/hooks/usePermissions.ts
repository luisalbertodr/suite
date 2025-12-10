
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserPermission {
  permission_name: string;
  resource: string;
  action: string;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isSuperuser } = useAuth();

  const fetchUserPermissions = async () => {
    if (!user || isSuperuser) {
      // Los superusuarios tienen todos los permisos
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Get user's company ID first
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Get user permissions using the RPC function
      const { data, error } = await supabase.rpc('get_user_permissions', {
        user_id: user.id,
        company_id: profile.company_id
      });

      if (error) throw error;
      setPermissions(data || []);
      
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    // Los superusuarios tienen todos los permisos
    if (isSuperuser) return true;
    
    return permissions.some(p => p.resource === resource && p.action === action);
  };

  const canAccess = (resource: string): boolean => {
    // Los superusuarios pueden acceder a todo
    if (isSuperuser) return true;
    
    return permissions.some(p => p.resource === resource);
  };

  useEffect(() => {
    fetchUserPermissions();
  }, [user, isSuperuser]);

  return {
    permissions,
    loading,
    hasPermission,
    canAccess,
    refetch: fetchUserPermissions
  };
};
