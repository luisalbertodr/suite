import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { MARKETING_HOST_COMPANY_ID } from '@/lib/marketingScope';

/** Marketing: permisos vía usePermissions (fusiona empresa activa + Estética + Medicina). */
export function useMarketingPermissions() {
  const { isSuperuser } = useAuth();
  const { hasPermission, loading } = usePermissions();

  return {
    loading: loading && !isSuperuser,
    canRead: isSuperuser || hasPermission('marketing', 'read'),
    canWrite: isSuperuser || hasPermission('marketing', 'write'),
    marketingCompanyId: MARKETING_HOST_COMPANY_ID,
  };
}
