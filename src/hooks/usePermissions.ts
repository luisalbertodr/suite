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

/**
 * Permisos efectivos del usuario actual.
 *
 * Estrategia:
 *  1) Primero intenta la RPC nueva `get_effective_user_permissions(p_user_id)`
 *     que combina rol + ALLOW (user_permissions + overrides allow) - DENY
 *     (overrides deny) en una sola consulta y devuelve permission_id/name/resource/action.
 *  2) Si esa RPC no existe en el entorno (entornos no migrados aún), cae al
 *     RPC legacy `get_user_permissions(p_user_id)` que devuelve solo IDs de
 *     `user_permissions` y resuelve los detalles via tabla `permissions`.
 *
 * Los superusuarios saltan toda la consulta.
 */
export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isSuperuser } = useAuth();

  const fetchEffectiveRpc = async (
    userId: string,
  ): Promise<UserPermission[] | null> => {
    try {
      const { data, error } = await supabase.rpc('get_effective_user_permissions', {
        p_user_id: userId,
      });
      if (error) {
        debugError('get_effective_user_permissions error, falling back to legacy:', error);
        return null;
      }
      if (!Array.isArray(data)) return null;
      return data.map((row: Record<string, unknown>) => ({
        permission_name:
          (row.permission_name as string) || `${row.resource}:${row.action}`,
        resource: String(row.resource ?? ''),
        action: String(row.action ?? ''),
      }));
    } catch (e) {
      debugError('get_effective_user_permissions threw, falling back:', e);
      return null;
    }
  };

  const fetchLegacyRpc = async (userId: string): Promise<UserPermission[]> => {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId,
    });
    if (error) throw error;

    const rawItems = Array.isArray(data) ? data : [];
    const permissionIds = rawItems
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

    if (permissionIds.length === 0) return [];

    const { data: details, error: detailsError } = await supabase
      .from('permissions')
      .select('*')
      .in('id', permissionIds);
    if (detailsError) throw detailsError;

    return (details || []).map((p) => ({
      permission_name: p.name || `${p.resource}:${p.action}`,
      resource: p.resource,
      action: p.action,
    }));
  };

  const fetchUserPermissions = async () => {
    if (!user || isSuperuser) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const effective = await fetchEffectiveRpc(user.id);
      if (effective !== null) {
        setPermissions(effective);
      } else {
        const legacy = await fetchLegacyRpc(user.id);
        setPermissions(legacy);
      }
    } catch (error) {
      debugError('Error fetching user permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (isSuperuser) return true;
    return permissions.some((p) => p.resource === resource && p.action === action);
  };

  const canAccess = (resource: string): boolean => {
    if (isSuperuser) return true;
    return permissions.some((p) => p.resource === resource);
  };

  useEffect(() => {
    fetchUserPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isSuperuser]);

  return {
    permissions,
    loading,
    hasPermission,
    canAccess,
    refetch: fetchUserPermissions,
  };
};
