import { useLocation } from 'react-router-dom';
import { useWorkCenter } from '@/hooks/useWorkCenter';

/** Rutas donde el selector M/E cambia la empresa activa (switchCompany). */
const BILLING_SCOPE_PATH_PREFIXES = [
  '/',
  '/facturacion',
  '/marketing',
  '/articulos',
] as const;

function pathUsesBillingScope(pathname: string): boolean {
  if (pathname === '/') return true;
  return BILLING_SCOPE_PATH_PREFIXES.some(
    (prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

/** ¿La pestaña actual separa contenido por empresa emisora? */
export function useBillingScopeRoute() {
  const { pathname } = useLocation();
  const { isMultiEntity, loading: wcLoading } = useWorkCenter();
  const routeEnabled = pathUsesBillingScope(pathname);

  return {
    /** Multi-entidad y ruta que usa filtro por empresa activa. */
    enabled: isMultiEntity && routeEnabled,
    routeEnabled,
    isMultiEntity,
    loading: wcLoading,
  };
}
