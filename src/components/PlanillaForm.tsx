
import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { PlanillaFormData } from '@/hooks/usePlanillas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { toast } from 'sonner';

interface PlanillaFormProps {
  onClose: () => void;
  onSave: (data: PlanillaFormData) => Promise<void>;
  isLoading?: boolean;
}

export const PlanillaForm: React.FC<PlanillaFormProps> = ({
  onClose,
  onSave,
  isLoading = false,
}) => {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const [formData, setFormData] = useState<PlanillaFormData>({
    fecha: new Date().toISOString().split('T')[0],
    supplier_id: '',
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available for suppliers query');
        return [];
      }
      
      console.log('Fetching suppliers for company:', companyId);
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      
      console.log('Suppliers fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!companyId && !companyLoading,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyId) {
      console.error('No company ID available for form submission');
      toast.error('Error: No se pudo obtener la información de la empresa');
      return;
    }
    
    console.log('Submitting planilla form with data:', formData, 'for company:', companyId);
    
    try {
      const submitData = {
        ...formData,
        supplier_id: formData.supplier_id || undefined,
      };
      
      await onSave(submitData);
    } catch (error) {
      console.error('Error submitting planilla form:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log('Form input changed:', name, value);
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (companyLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3">Cargando información de la empresa...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
            <p className="text-gray-700">No se pudo obtener la información de la empresa.</p>
            <p className="text-gray-500 text-sm mt-2">Por favor, contacta con el administrador.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Nueva Planilla
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-2">
              Fecha *
            </label>
            <input
              type="date"
              id="fecha"
              name="fecha"
              value={formData.fecha}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor (Opcional)
            </label>
            <select
              id="supplier_id"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sin proveedor específico</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Creando...' : 'Crear'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
