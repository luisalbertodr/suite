import React from 'react';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { PermissionCheck, type PermissionRef } from '@/components/PermissionCheck';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface PageWrapperProps {
  resource?: string;
  action?: string;
  anyOf?: PermissionRef[];
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({
  resource,
  action,
  anyOf,
  children
}) => {
  const { companyId, loading } = useCompanyFilter();
  const { user, isSuperuser, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  if (!companyId) {
    const needsLogin = !user && !isSuperuser;
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center max-w-md px-4">
          <h2 className="text-xl font-semibold text-gray-700">
            {needsLogin ? 'Inicia sesión para continuar' : 'No se encontró información de empresa'}
          </h2>
          <p className="text-gray-500 mt-2">
            {needsLogin
              ? 'Tu sesión en suite.lipoout.com no está activa. Entra con tu usuario de Suite.'
              : 'La sesión puede haber caducado o tu usuario no tiene empresa asignada. Cierra sesión y vuelve a entrar.'}
          </p>
          {!needsLogin && (
            <Button className="mt-4" variant="outline" onClick={() => void signOut()}>
              Cerrar sesión
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PermissionCheck resource={resource} action={action} anyOf={anyOf}>
      {children}
    </PermissionCheck>
  );
};
