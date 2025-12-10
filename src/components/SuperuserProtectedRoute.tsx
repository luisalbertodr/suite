
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SuperuserLogin } from './SuperuserLogin';

interface SuperuserProtectedRouteProps {
  children: React.ReactNode;
}

export const SuperuserProtectedRoute: React.FC<SuperuserProtectedRouteProps> = ({ children }) => {
  const { loading, isSuperuser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-orange-900 to-red-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Si no es superusuario, mostrar login de superusuario
  if (!isSuperuser) {
    return <SuperuserLogin />;
  }

  return <>{children}</>;
};
