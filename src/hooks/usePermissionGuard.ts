import { useCallback } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Hook utilitario para proteger handlers imperativos.
 *
 * Uso:
 *   const { guard, can } = usePermissionGuard();
 *
 *   const handleCobrar = guard('sales', 'create', async () => {
 *     await procesarCobro();
 *   });
 *
 * Si el usuario no tiene el permiso, el callback no se ejecuta y se muestra
 * un toast informativo. `can(resource, action)` se puede usar para checks
 * inline previos a operaciones complejas.
 */
export const usePermissionGuard = () => {
  const { hasPermission, loading } = usePermissions();

  const can = useCallback(
    (resource: string, action: string) => hasPermission(resource, action),
    [hasPermission],
  );

  const requireOrToast = useCallback(
    (resource: string, action: string, customMessage?: string): boolean => {
      if (hasPermission(resource, action)) return true;
      toast.error(
        customMessage ?? `No tienes permiso para ${action} en ${resource}.`,
      );
      return false;
    },
    [hasPermission],
  );

  function guard<TArgs extends unknown[], TReturn>(
    resource: string,
    action: string,
    fn: (...args: TArgs) => TReturn | Promise<TReturn>,
    customMessage?: string,
  ): (...args: TArgs) => Promise<TReturn | undefined> {
    return async (...args: TArgs) => {
      if (loading) {
        toast.message('Comprobando permisos…');
        return undefined;
      }
      if (!hasPermission(resource, action)) {
        toast.error(
          customMessage ?? `No tienes permiso para ${action} en ${resource}.`,
        );
        return undefined;
      }
      return await fn(...args);
    };
  }

  return { can, guard, requireOrToast, loading };
};
