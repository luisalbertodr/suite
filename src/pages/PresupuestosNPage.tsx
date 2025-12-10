import React from 'react';
import { PresupuestosN } from '../components/PresupuestosN';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { PermissionCheck } from '@/components/PermissionCheck';

const PresupuestosNPage: React.FC = () => {
  const { companyId, loading } = useCompanyFilter();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No se encontró información de empresa</h2>
          <p className="text-gray-500 mt-2">Por favor, contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionCheck resource="presupuestos_n" action="read">
      <PresupuestosN />
    </PermissionCheck>
  );
};

export default PresupuestosNPage;