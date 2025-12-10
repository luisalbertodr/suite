
import React from 'react';
import { Articulos } from '../components/Articulos';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { PermissionCheck } from '@/components/PermissionCheck';

const ArticulosPage: React.FC = () => {
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
    <PermissionCheck resource="articles" action="read">
      <Articulos />
    </PermissionCheck>
  );
};

export default ArticulosPage;
