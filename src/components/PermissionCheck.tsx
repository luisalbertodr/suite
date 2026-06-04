
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Shield } from 'lucide-react';

export type PermissionRef = { resource: string; action: string };

interface PermissionCheckProps {
  resource?: string;
  action?: string;
  /** Si se define, basta con tener uno de estos permisos. */
  anyOf?: PermissionRef[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionCheck: React.FC<PermissionCheckProps> = ({
  resource,
  action,
  anyOf,
  children,
  fallback
}) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  const allowed = anyOf?.length
    ? anyOf.some((p) => hasPermission(p.resource, p.action))
    : !!(resource && action && hasPermission(resource, action));

  if (!allowed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Sin permisos</h3>
          <p className="mt-1 text-sm text-gray-500">
            No tienes permisos para realizar esta acción.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
