import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
} from '@/lib/workCenterBilling';

const debugError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

/** Empresas donde puede haber permisos de marketing (centro Lipoout). */
const MARKETING_PERM_COMPANY_IDS = [ESTETICA_COMPANY_ID, MEDICINA_COMPANY_ID];

export interface UserPermission {
  permission_name: string;
  resource: string;
  action: string;
}

function permKey(p: UserPermission): string {
  return `${p.resource}:${p.action}`;
}

function mergePermissions(lists: UserPermission[][]): UserPermission[] {
  const map = new Map<string, UserPermission>();
  for (const list of lists) {
    for (const p of list) {
      map.set(permKey(p), p);
    }
  }
  return [...map.values()];
}

function companyIdsForPermissionFetch(activeCompanyId: string | null): string[] {
  const ids = new Set<string>(MARKETING_PERM_COMPANY_IDS);
  if (activeCompanyId) ids.add(activeCompanyId);
  return [...ids];
}

/**
 * Permisos efectivos del usuario actual.
 * Fusiona permisos de la empresa activa + Estética + Medicina (OR lógico).
 */
export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isSuperuser } = useAuth();
  const { companyId } = useCompanyFilter();

  const fetchEffectiveRpc = useCallback(
    async (userId: string, scopeCompanyId: string): Promise<UserPermission[] | null> => {
      try {
        const { data, error } = await supabase.rpc('get_effective_user_permissions', {
          p_user_id: userId,
          p_company_id: scopeCompanyId,
        });
        if (error) {
          debugError('get_effective_user_permissions error:', scopeCompanyId, error);
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
        debugError('get_effective_user_permissions threw:', scopeCompanyId, e);
        return null;
      }
    },
    [],
  );

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

    setLoading(true);

    try {
      const scopeIds = companyIdsForPermissionFetch(companyId);
      const batches = await Promise.all(
        scopeIds.map((id) => fetchEffectiveRpc(user.id, id)),
      );

      const anyRpcOk = batches.some((b) => b !== null);
      if (anyRpcOk) {
        setPermissions(mergePermissions(batches.filter((b): b is UserPermission[] => b !== null)));
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
  }, [user, isSuperuser, companyId]);

  return {
    permissions,
    loading,
    hasPermission,
    canAccess,
    refetch: fetchUserPermissions,
  };
};
