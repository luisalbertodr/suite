import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type OverrideMode = 'allow' | 'deny';

export interface UserPermissionOverride {
  id: string;
  company_id: string;
  user_id: string;
  permission_id: string | null;
  resource: string | null;
  action: string | null;
  mode: OverrideMode;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertOverrideInput {
  user_id: string;
  company_id: string;
  permission_id?: string | null;
  resource?: string | null;
  action?: string | null;
  mode: OverrideMode;
  reason?: string | null;
}

const debugError = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.error(...args);
};

/**
 * Hook de administración avanzada de usuarios:
 *   - Excepciones explícitas por usuario (ALLOW/DENY) sobre permisos del rol.
 *   - DENY tiene precedencia sobre ALLOW (lo aplica la RPC del servidor).
 *
 * Las operaciones de rol base, vínculo empleado y creación/borrado de usuarios
 * siguen viviendo en useUsers (que llama a la edge function `main`).
 * Este hook se centra en los overrides puros.
 */
export const useUserAdmin = (companyId: string | null | undefined) => {
  const [overrides, setOverrides] = useState<UserPermissionOverride[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchOverrides = useCallback(async () => {
    if (!companyId) {
      setOverrides([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_permission_overrides')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOverrides((data as UserPermissionOverride[]) ?? []);
    } catch (e) {
      debugError('fetchOverrides', e);
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const upsertOverride = useCallback(
    async (input: UpsertOverrideInput): Promise<boolean> => {
      try {
        // Selector preferido: permission_id; si no, (resource, action).
        const payload: Partial<UserPermissionOverride> = {
          user_id: input.user_id,
          company_id: input.company_id,
          permission_id: input.permission_id ?? null,
          resource: input.permission_id ? null : input.resource ?? null,
          action: input.permission_id ? null : input.action ?? null,
          mode: input.mode,
          reason: input.reason ?? null,
        };

        let query;
        if (input.permission_id) {
          query = supabase
            .from('user_permission_overrides')
            .upsert(payload, {
              onConflict: 'company_id,user_id,permission_id',
              ignoreDuplicates: false,
            });
        } else {
          query = supabase
            .from('user_permission_overrides')
            .upsert(payload, {
              onConflict: 'company_id,user_id,resource,action',
              ignoreDuplicates: false,
            });
        }

        const { error } = await query;
        if (error) throw error;
        await fetchOverrides();
        return true;
      } catch (e) {
        debugError('upsertOverride', e);
        const msg = e instanceof Error ? e.message : 'Error al guardar override';
        toast.error(msg);
        return false;
      }
    },
    [fetchOverrides],
  );

  const removeOverride = useCallback(
    async (overrideId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('id', overrideId);
        if (error) throw error;
        await fetchOverrides();
        return true;
      } catch (e) {
        debugError('removeOverride', e);
        const msg = e instanceof Error ? e.message : 'Error al eliminar override';
        toast.error(msg);
        return false;
      }
    },
    [fetchOverrides],
  );

  const removeOverrideByPermission = useCallback(
    async (userId: string, permissionId: string): Promise<boolean> => {
      if (!companyId) return false;
      try {
        const { error } = await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('user_id', userId)
          .eq('company_id', companyId)
          .eq('permission_id', permissionId);
        if (error) throw error;
        await fetchOverrides();
        return true;
      } catch (e) {
        debugError('removeOverrideByPermission', e);
        return false;
      }
    },
    [companyId, fetchOverrides],
  );

  const overridesByUser = (userId: string): UserPermissionOverride[] =>
    overrides.filter((o) => o.user_id === userId);

  const overrideForPermission = (
    userId: string,
    permissionId: string,
  ): UserPermissionOverride | undefined =>
    overrides.find((o) => o.user_id === userId && o.permission_id === permissionId);

  return {
    overrides,
    loading,
    refresh: fetchOverrides,
    upsertOverride,
    removeOverride,
    removeOverrideByPermission,
    overridesByUser,
    overrideForPermission,
  };
};
