
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
      // Superusers have all permissions
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Get user permissions using the RPC function with correct parameter name
      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_user_id: user.id
      });

      if (error) throw error;
      
      // The RPC returns an array of permission IDs (strings)
      // Map them to UserPermission objects
      const permissionIds = data as string[] || [];
      
      // If we have permission IDs, fetch the full permission details
      if (permissionIds.length > 0) {
        const { data: permissionDetails, error: detailsError } = await supabase
          .from('permissions')
          .select('*')
          .in('id', permissionIds);
          
        if (detailsError) throw detailsError;
        
        const mappedPermissions: UserPermission[] = (permissionDetails || []).map(p => ({
          permission_name: p.name || `${p.resource}:${p.action}`,
          resource: p.resource,
          action: p.action
        }));
        
        setPermissions(mappedPermissions);
      } else {
        setPermissions([]);
      }
      
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    // Superusers have all permissions
    if (isSuperuser) return true;
    
    return permissions.some(p => p.resource === resource && p.action === action);
  };

  const canAccess = (resource: string): boolean => {
    // Superusers can access everything
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
