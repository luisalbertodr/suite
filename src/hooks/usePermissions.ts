
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const debugError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

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

      // The RPC output can vary by environment/migration state:
      // - ["uuid1", "uuid2"]
      // - [{ id: "uuid1" }, { permission_id: "uuid2" }]
      // Normalize everything into plain UUID strings.
      const rawPermissionItems = Array.isArray(data) ? data : [];
      const permissionIds = rawPermissionItems
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            const candidate = record.id ?? record.permission_id ?? record.permissionId;
            return typeof candidate === 'string' ? candidate : null;
          }
          return null;
        })
        .filter((id): id is string => !!id);
      
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
      debugError('Error fetching user permissions:', error);
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
