
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Login } from './Login';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isSuperuser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Si no hay usuario autenticado Y no es superusuario, mostrar login normal
  if (!user && !isSuperuser) {
    return <Login />;
  }

  return <>{children}</>;
};
