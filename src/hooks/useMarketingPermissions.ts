import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { MARKETING_HOST_COMPANY_ID } from '@/lib/marketingScope';
import { supabase } from '@/lib/supabase';
import { runWhenAuthReady } from '@/lib/authSession';

/** Marketing: permisos vía usePermissions (fusiona empresa activa + Estética + Medicina). */
export function useMarketingPermissions() {
  const { user, isSuperuser } = useAuth();
  const { hasPermission, loading } = usePermissions();

  const { data: rpcWrite } = useQuery({
    queryKey: ['marketing-permission-rpc', user?.id, 'write'],
    enabled: !!user && !isSuperuser,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await runWhenAuthReady(() =>
        supabase.rpc('current_user_has_marketing_permission', { p_action: 'write' }),
      );
      if (error) return false;
      return data === true;
    },
  });

  const { data: rpcRead } = useQuery({
    queryKey: ['marketing-permission-rpc', user?.id, 'read'],
    enabled: !!user && !isSuperuser,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await runWhenAuthReady(() =>
        supabase.rpc('current_user_has_marketing_permission', { p_action: 'read' }),
      );
      if (error) return false;
      return data === true;
    },
  });

  const canWrite =
    isSuperuser || hasPermission('marketing', 'write') || rpcWrite === true;
  const canRead =
    isSuperuser || hasPermission('marketing', 'read') || rpcRead === true || canWrite;

  return {
    loading: (loading && !isSuperuser) || (rpcWrite === undefined && !!user && !isSuperuser),
    canRead,
    canWrite,
    marketingCompanyId: MARKETING_HOST_COMPANY_ID,
  };
}
