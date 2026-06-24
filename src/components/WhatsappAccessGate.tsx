import React from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useMarketingPermissions } from '@/hooks/useMarketingPermissions';

export const WhatsappAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperuser } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const { canRead: canReadMarketing, loading: marketingLoading } = useMarketingPermissions();

  if (permLoading || marketingLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600" />
      </div>
    );
  }

  const allowed =
    isSuperuser || hasPermission('whatsapp', 'read') || canReadMarketing;

  if (!allowed) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Sin permisos</h3>
          <p className="mt-1 text-sm text-gray-500">
            No tienes permisos para usar WhatsApp en Suite.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
